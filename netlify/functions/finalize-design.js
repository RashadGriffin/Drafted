/* POST /api/finalize-design
   Called when the customer finishes the post-approval text editor
   (or chooses "no text" at the fork). Composes the final print file
   from the APPROVED art + their chosen text/colors, stores it, and
   marks the order 'finalized' (ready for production).

   Body: {
     token,                         // orders.access_token
     wantsText,                     // bool — answered the fork
     name, school, number,         // optional text (any blank)
     nameColor, schoolColor, numberColor   // optional curated hex
   }

   If wantsText is false (or all fields blank), the finalized design
   is the clean, text-free art.
*/
const { supa, BUCKETS, uploadBuffer, signedUrl, downloadBuffer } = require('./_lib/supabase.js');
const { processArt, composeWithText } = require('./_lib/compose.js');
const { getStyle } = require('../../config/styles.js');
const { safeColor } = require('../../config/textColors.js');

const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

function clean(s, max) {
  return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, '').trim().slice(0, max || 40);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let p; try { p = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }
  const { token } = p;
  if (!token || token.length < 32) return json(401, { error: 'Invalid link' });

  const { data: order } = await supa().from('orders').select('*').eq('access_token', token).single();
  if (!order) return json(404, { error: 'Order not found' });
  if (!order.paid) return json(403, { error: 'Order not paid' });

  // Must have an approved proof to finalize onto.
  if (!order.approved_proof_id) return json(409, { error: 'Approve a design before finalizing' });

  const { data: proof } = await supa().from('proofs')
    .select('id, composited_path, status').eq('id', order.approved_proof_id).single();
  if (!proof || proof.status !== 'ready' || !proof.composited_path) {
    return json(409, { error: 'Approved design is unavailable' });
  }

  // Resolve text fields. wantsText=false => clean shirt (ignore any text).
  const wantsText = p.wantsText !== false;
  const fields = wantsText ? {
    name:   clean(p.name, 18),
    school: clean(p.school, 28),
    number: clean(p.number, 4),
  } : { name: '', school: '', number: '' };

  const colors = {
    name:   safeColor(p.nameColor),
    school: safeColor(p.schoolColor),
    number: safeColor(p.numberColor),
  };

  try {
    const style = getStyle(order.style_key);
    const art = await downloadBuffer(BUCKETS.proofs, proof.composited_path);

    // Compose final (text or clean). composeWithText handles all-blank => clean.
    const { proofBuffer, printBuffer } = await composeWithText(art, style, fields, colors);

    const finalProofPath = `${order.id}/final-proof.png`;
    const finalPrintPath = `${order.id}/final-print.png`;
    await uploadBuffer(BUCKETS.proofs, finalProofPath, proofBuffer, 'image/png');
    await uploadBuffer(BUCKETS.print, finalPrintPath, printBuffer, 'image/png');

    await supa().from('orders').update({
      status: 'finalized',
      wants_text: wantsText,
      final_name: fields.name || null,
      final_school: fields.school || null,
      final_number: fields.number || null,
      final_name_color: fields.name ? colors.name : null,
      final_school_color: fields.school ? colors.school : null,
      final_number_color: fields.number ? colors.number : null,
      final_proof_path: finalProofPath,
      final_print_path: finalPrintPath,
      finalized_at: new Date().toISOString(),
    }).eq('id', order.id);

    const url = await signedUrl(BUCKETS.proofs, finalProofPath, 3600);
    return json(200, { ok: true, status: 'finalized', finalUrl: url });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
