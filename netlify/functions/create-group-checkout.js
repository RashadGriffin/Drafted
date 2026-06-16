/* ===========================================================
   POST /api/create-group-checkout
   Multi-design checkout. Takes an array of designs, creates ONE
   order_group + N pending orders (one per design), prices the SUM
   (bulk tiers apply across the whole group), and creates a single
   Stripe Checkout Session for the group.

   A single-design purchase is just a group with one design.
   Generation is still triggered ONLY by the webhook after payment.
   =========================================================== */
const Stripe = require('stripe');
const { supa } = require('./_lib/supabase.js');
const { unitPriceCents, GARMENT_PRICE_CENTS } = require('./_lib/pricing.js');
const { getStyle } = require('../../config/styles.js');
const { REGEN_LIMIT } = require('../../config/settings.js');

const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }

  const { designs, customerEmail } = payload;

  // ---- Validate top-level ----
  if (!customerEmail || !/^[^@]+@[^@]+\.[^@]+$/.test(customerEmail))
    return json(400, { error: 'Valid email required' });
  if (!Array.isArray(designs) || designs.length === 0)
    return json(400, { error: 'Add at least one design' });
  if (designs.length > 20)
    return json(400, { error: 'Too many designs in one order' });

  // ---- Validate each design ----
  const clean = [];
  for (let i = 0; i < designs.length; i++) {
    const d = designs[i] || {};
    const style = getStyle(d.styleKey);
    if (!style || !style.enabled) return json(400, { error: `Design ${i + 1}: invalid style` });
    if (!d.sourcePhotoPath) return json(400, { error: `Design ${i + 1}: photo is required` });
    const qty = Math.max(1, Math.min(50, parseInt(d.quantity, 10) || 1));
    clean.push({
      styleKey: d.styleKey,
      garmentType: d.garmentType || 'tshirt',
      garmentColor: d.garmentColor || null,
      garmentSize: d.garmentSize || null,
      sport: (d.sport || '').toString().slice(0, 24),
      sourcePhotoPath: d.sourcePhotoPath,
      quantity: qty,
      styleName: style.name,
    });
  }

  // ---- Price: bulk tiers apply across the WHOLE group's shirt count ----
  // (A family ordering 2 different designs = 2 shirts => 2-3 tier.)
  const totalQty = clean.reduce((s, d) => s + d.quantity, 0);
  for (const d of clean) {
    d.unitCents = unitPriceCents(d.garmentType, totalQty);  // tier by group size
    d.lineCents = d.unitCents * d.quantity;
  }
  const groupTotalCents = clean.reduce((s, d) => s + d.lineCents, 0);

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const siteUrl = process.env.SITE_URL || `https://${event.headers.host}`;

  try {
    // ---- Create the group ----
    const { data: group, error: gErr } = await supa().from('order_groups').insert({
      customer_email: customerEmail,
      total_cents: groupTotalCents,
      status: 'pending_payment',
    }).select().single();
    if (gErr) throw new Error(`Group insert failed: ${gErr.message}`);

    // ---- Create one order (design) per item ----
    const orderRows = clean.map((d, idx) => ({
      group_id: group.id,
      group_seq: idx + 1,
      customer_email: customerEmail,
      style_key: d.styleKey,
      garment_type: d.garmentType,
      garment_color: d.garmentColor,
      garment_size: d.garmentSize,
      sport: d.sport,
      source_photo_path: d.sourcePhotoPath,
      quantity: d.quantity,
      unit_price_cents: d.unitCents,
      total_cents: d.lineCents,
      regen_limit: REGEN_LIMIT,
      status: 'pending_payment',
    }));
    const { error: oErr } = await supa().from('orders').insert(orderRows);
    if (oErr) throw new Error(`Orders insert failed: ${oErr.message}`);

    // ---- One Stripe session for the whole group ----
    const line_items = clean.map((d) => ({
      quantity: d.quantity,
      price_data: {
        currency: 'usd',
        unit_amount: d.unitCents,
        product_data: {
          name: `Drafted Apparel — ${d.styleName}`,
          description: `Custom illustrated ${d.garmentType}`,
        },
      },
    }));

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: customerEmail,
      line_items,
      metadata: { group_id: group.id },
      success_url: `${siteUrl}/proof.html?token=${group.access_token}`,
      cancel_url: `${siteUrl}/shop.html?canceled=1`,
    });

    await supa().from('order_groups').update({ stripe_session_id: session.id }).eq('id', group.id);

    return json(200, { url: session.url });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
