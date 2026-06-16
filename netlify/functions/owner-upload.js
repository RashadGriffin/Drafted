/* POST /api/owner-upload  (owner only — requires x-owner-secret header)
   Body: { orderId, imageBase64 }
   Stores the manually corrected proof, prepares the print file, flips
   the order back to proof_ready, resolves the manual request, and
   emails the customer their review link. */
const sharp = require('sharp');
const { supa, BUCKETS, uploadBuffer } = require('./_lib/supabase.js');
const { sendEmail } = require('./_lib/email.js');
const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!process.env.OWNER_SECRET || event.headers['x-owner-secret'] !== process.env.OWNER_SECRET) {
    return json(401, { error: 'Unauthorized' });
  }

  let p; try { p = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }
  const { orderId, imageBase64 } = p;
  if (!orderId || !imageBase64) return json(400, { error: 'orderId and imageBase64 required' });

  const { data: order } = await supa().from('orders').select('*').eq('id', orderId).single();
  if (!order) return json(404, { error: 'Order not found' });

  try {
    const buf = Buffer.from(imageBase64, 'base64');
    const stamp = Date.now();
    const compositedPath = `${orderId}/manual-${stamp}-proof.png`;
    const printPath = `${orderId}/manual-${stamp}-print.png`;

    const composited = await sharp(buf).resize(1024, 1024, { fit: 'cover' }).png().toBuffer();
    const print = await sharp(buf).resize(3000, 3000, { fit: 'cover', kernel: 'lanczos3' }).png().toBuffer();
    await uploadBuffer(BUCKETS.proofs, compositedPath, composited, 'image/png');
    await uploadBuffer(BUCKETS.print, printPath, print, 'image/png');

    // attempt_no after initial (1) + regens used
    const attemptNo = 1 + (order.regen_count || 0) + 1;
    const { data: proof, error: pErr } = await supa().from('proofs').insert({
      order_id: orderId, attempt_no: attemptNo, kind: 'manual',
      provider: 'manual', model: 'owner',
      composited_path: compositedPath, print_file_path: printPath, status: 'ready',
    }).select().single();
    if (pErr) throw new Error(pErr.message);

    await supa().from('manual_requests')
      .update({ status: 'resolved', resolved_proof_id: proof.id, resolved_at: new Date().toISOString() })
      .eq('order_id', orderId).eq('status', 'open');
    await supa().from('orders').update({ status: 'proof_ready' }).eq('id', orderId);

    const site = process.env.SITE_URL || 'https://draftedapparel.com';
    await sendEmail({
      to: order.customer_email,
      subject: 'Your updated Drafted proof is ready 🎨',
      html: `<p>Hey ${order.athlete_name || ''} — we made your fixes by hand. Take a look and approve when it's right:</p>
        <p><a href="${site}/proof.html?token=${order.access_token}">Review your proof</a></p>`,
    });

    return json(200, { ok: true, proofId: proof.id });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
