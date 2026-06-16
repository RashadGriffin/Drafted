/* ===========================================================
   POST /api/create-checkout
   -----------------------------------------------------------
   1. Validates the customization payload + style.
   2. Computes price SERVER-SIDE (ignores any client price).
   3. Inserts an order row as 'pending_payment'.
   4. Creates a Stripe Checkout Session.
   5. Returns the Stripe URL. NO generation happens here.

   Generation is triggered ONLY by the webhook after payment.
   =========================================================== */

const Stripe = require('stripe');
const { supa } = require('./_lib/supabase.js');
const { quote } = require('./_lib/pricing.js');
const { getStyle } = require('../../config/styles.js');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }

  const {
    styleKey, garmentType = 'tshirt', garmentColor, garmentSize,
    athleteName, jerseyNumber, sport, schoolTeam,
    primaryColorName, primaryColorHex, secondaryColorName, secondaryColorHex,
    sourcePhotoPath, quantity = 1, customerEmail,
  } = payload;

  // ---- Validate ----
  const style = getStyle(styleKey);
  if (!style || !style.enabled) return json(400, { error: 'Invalid or unavailable style' });
  if (!customerEmail || !/^[^@]+@[^@]+\.[^@]+$/.test(customerEmail))
    return json(400, { error: 'Valid email required' });
  if (!sourcePhotoPath) return json(400, { error: 'A source photo is required' });
  if (!athleteName) return json(400, { error: 'Athlete name is required' });

  // ---- Price (authoritative) ----
  const { quantity: q, unitCents, totalCents } = quote(garmentType, quantity);

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const siteUrl = process.env.SITE_URL || `https://${event.headers.host}`;

  try {
    // ---- Insert pending order ----
    const { data: order, error: insErr } = await supa()
      .from('orders')
      .insert({
        customer_email: customerEmail,
        customer_name: athleteName,
        style_key: styleKey,
        garment_type: garmentType,
        garment_color: garmentColor,
        garment_size: garmentSize,
        athlete_name: athleteName,
        jersey_number: jerseyNumber,
        sport,
        school_team: schoolTeam,
        primary_color_name: primaryColorName || null,
        primary_color_hex: primaryColorHex || null,
        secondary_color_name: secondaryColorName || null,
        secondary_color_hex: secondaryColorHex || null,
        source_photo_path: sourcePhotoPath,
        quantity: q,
        unit_price_cents: unitCents,
        total_cents: totalCents,
        status: 'pending_payment',
      })
      .select()
      .single();
    if (insErr) throw new Error(`Order insert failed: ${insErr.message}`);

    // ---- Stripe Checkout Session ----
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: customerEmail,
      line_items: [{
        quantity: q,
        price_data: {
          currency: 'usd',
          unit_amount: unitCents,
          product_data: {
            name: `Drafted Apparel — ${style.name}`,
            description: `Custom illustrated ${garmentType} • ${athleteName}${jerseyNumber ? ' #' + jerseyNumber : ''}`,
          },
        },
      }],
      // The order id + access token travel with the session.
      metadata: { order_id: order.id },
      // Instant on-site proof: redirect carries the access token.
      success_url: `${siteUrl}/proof.html?token=${order.access_token}`,
      cancel_url: `${siteUrl}/products/${styleKey}.html?canceled=1`,
    });

    // Save the session id for webhook correlation
    await supa().from('orders')
      .update({ stripe_session_id: session.id })
      .eq('id', order.id);

    return json(200, { url: session.url });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
