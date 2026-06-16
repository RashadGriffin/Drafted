/* ===========================================================
   POST /api/stripe-webhook  (Stripe calls this)
   -----------------------------------------------------------
   THE security boundary. This is the ONLY place an order
   becomes 'paid' and the ONLY trigger for generation.

   - Verifies Stripe signature (rejects forged calls).
   - On checkout.session.completed: marks order paid, then
     invokes the generation runner (initial attempt).
   - Idempotent: re-delivered events won't double-generate.

   Requires raw body for signature check — Netlify provides
   event.body; we must NOT pre-parse it.
   =========================================================== */

const Stripe = require('stripe');
const { supa } = require('./_lib/supabase.js');
const { runGeneration } = require('./_lib/runGeneration.js');
const { sendEmail } = require('./_lib/email.js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = event.headers['stripe-signature'];
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;
  try {
    // Netlify may base64-encode the body; Stripe needs the raw bytes.
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : event.body;
    stripeEvent = stripe.webhooks.constructEvent(raw, sig, whSecret);
  } catch (err) {
    return { statusCode: 400, body: `Webhook signature verification failed: ${err.message}` };
  }

  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;
      const groupId = session.metadata?.group_id;
      const orderId = session.metadata?.order_id;
      const site = process.env.SITE_URL || `https://${event.headers.host}`;

      // ---------- MULTI-DESIGN: group payment ----------
      if (groupId) {
        const { data: group, error: gErr } = await supa()
          .from('order_groups').select('*').eq('id', groupId).single();
        if (gErr || !group) return { statusCode: 200, body: 'Group not found; ignoring.' };
        if (group.paid) return { statusCode: 200, body: 'Already processed.' };

        const paidAt = new Date().toISOString();
        await supa().from('order_groups').update({
          paid: true, paid_at: paidAt,
          stripe_payment_intent: session.payment_intent || null,
          status: 'paid',
        }).eq('id', groupId);

        // Mark every order in the group paid, then generate each in seq order.
        const { data: orders } = await supa().from('orders')
          .select('*').eq('group_id', groupId).order('group_seq', { ascending: true });

        for (const o of (orders || [])) {
          await supa().from('orders').update({
            paid: true, paid_at: paidAt,
            stripe_payment_intent: session.payment_intent || null,
            status: 'paid',
          }).eq('id', o.id);
        }
        // Generate sequentially so we stay within resource limits.
        for (const o of (orders || [])) {
          try { await runGeneration(o.id, { trigger: 'initial' }); }
          catch (genErr) { console.error('Generation error for order', o.id, genErr.message); }
        }

        // One email with the group proof link.
        try {
          await sendEmail({ to: group.customer_email, subject: 'Your Drafted proofs are ready 🔥',
            html: `<p>Your custom illustration${(orders||[]).length>1?'s are':' is'} ready to review:</p>
              <p><a href="${site}/proof.html?token=${group.access_token}">View your proof${(orders||[]).length>1?'s':''}</a></p>` });
        } catch (e) { console.error('Email error (group)', e.message); }

        return { statusCode: 200, body: 'ok' };
      }

      // ---------- LEGACY: single-order payment (kept for safety) ----------
      if (!orderId) return { statusCode: 200, body: 'No order_id/group_id in metadata; ignoring.' };

      const { data: order, error } = await supa()
        .from('orders').select('*').eq('id', orderId).single();
      if (error || !order) return { statusCode: 200, body: 'Order not found; ignoring.' };
      if (order.paid) return { statusCode: 200, body: 'Already processed.' };

      await supa().from('orders').update({
        paid: true,
        paid_at: new Date().toISOString(),
        stripe_payment_intent: session.payment_intent || null,
        status: 'paid',
      }).eq('id', orderId);

      try {
        await runGeneration(orderId, { trigger: 'initial' });
        await sendEmail({ to: order.customer_email, subject: 'Your Drafted proof is ready 🔥',
          html: `<p>Your custom illustration is ready to review:</p>
            <p><a href="${site}/proof.html?token=${order.access_token}">View your proof</a></p>
            <p>Approve it, or regenerate up to ${order.regen_limit} times free.</p>` });
      } catch (genErr) {
        console.error('Generation error for order', orderId, genErr.message);
      }

      return { statusCode: 200, body: 'ok' };
    }

    // Acknowledge all other event types.
    return { statusCode: 200, body: 'ignored' };
  } catch (e) {
    console.error('Webhook handler error:', e.message);
    return { statusCode: 500, body: 'handler error' };
  }
};
