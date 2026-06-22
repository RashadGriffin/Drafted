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

// Fire-and-forget POST to the background generation function. We don't await
// the result (it can run up to 15 min); we just need the 202 that it was
// queued. Failure to enqueue is logged but never blocks the webhook response.
async function invokeBackground(site, payload) {
  try {
    const url = `${site}/.netlify/functions/generate-background`;
    // Don't await the full response body; just kick it off. A short timeout
    // guards against the rare case the invoke hangs.
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    }).catch(() => {});
    clearTimeout(t);
  } catch (e) {
    console.error('[webhook] failed to enqueue background generation', e.message);
  }
}

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

        // Hand generation off to the background function (up to 15 min) so we
        // don't block the webhook (Stripe needs a fast response, and real
        // OpenAI generation exceeds the 60s function cap). Fire-and-forget.
        await invokeBackground(site, {
          orderIds: (orders || []).map(o => o.id),
          groupToken: group.access_token,
          email: group.customer_email,
        });

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

      await invokeBackground(site, {
        orderIds: [orderId],
        singleToken: order.access_token,
        email: order.customer_email,
        regenLimit: order.regen_limit,
      });

      return { statusCode: 200, body: 'ok' };
    }

    // Acknowledge all other event types.
    return { statusCode: 200, body: 'ignored' };
  } catch (e) {
    console.error('Webhook handler error:', e.message);
    return { statusCode: 500, body: 'handler error' };
  }
};
