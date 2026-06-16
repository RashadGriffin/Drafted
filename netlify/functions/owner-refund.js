/* POST /api/owner-refund  (owner only — requires x-owner-secret header)
   Body: { orderId }
   Issues a Stripe refund against the order's payment intent, marks the
   order refunded. Idempotent: a second call won't double-refund. */
const Stripe = require('stripe');
const { supa } = require('./_lib/supabase.js');
const { sendEmail } = require('./_lib/email.js');
const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!process.env.OWNER_SECRET || event.headers['x-owner-secret'] !== process.env.OWNER_SECRET) {
    return json(401, { error: 'Unauthorized' });
  }

  let p; try { p = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }
  const { orderId } = p;
  if (!orderId) return json(400, { error: 'orderId required' });

  const { data: order } = await supa().from('orders').select('*').eq('id', orderId).single();
  if (!order) return json(404, { error: 'Order not found' });
  if (!order.paid) return json(400, { error: 'Order was never paid — nothing to refund' });
  if (order.status === 'refunded' || order.refunded_at) {
    return json(200, { ok: true, alreadyRefunded: true });
  }
  if (!order.stripe_payment_intent) {
    return json(400, { error: 'No Stripe payment intent on this order — refund manually in Stripe' });
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const refund = await stripe.refunds.create({ payment_intent: order.stripe_payment_intent });

    await supa().from('orders').update({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
      stripe_refund_id: refund.id,
    }).eq('id', orderId);

    // Optional courtesy email to the customer.
    if (order.customer_email) {
      await sendEmail({
        to: order.customer_email,
        subject: 'Your Drafted Apparel refund',
        html: `<p>Hi ${order.athlete_name || ''} — we've issued a full refund for your order. ` +
              `It should appear on your statement within a few business days.</p>` +
              `<p>Thanks for giving Drafted a try.</p>`,
      });
    }

    return json(200, { ok: true, refundId: refund.id });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
