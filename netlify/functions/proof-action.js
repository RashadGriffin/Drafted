/* POST /api/proof-action  { token, action, description? }
   action: 'approve' | 'regenerate' | 'manual'
   ALL gates enforced server-side:
   - approve requires a ready proof
   - regenerate respects paid + regen_limit (runGeneration enforces both)
   - manual requires manual_unlocked + a real description (per spec:
     manual touch only unlocks after all 3 regenerations are used) */
const { supa, BUCKETS, signedUrl } = require('./_lib/supabase.js');
const { runGeneration } = require('./_lib/runGeneration.js');
const { sendEmail } = require('./_lib/email.js');
const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  let p; try { p = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }

  const { token, action, description } = p;
  if (!token || token.length < 32) return json(401, { error: 'Invalid link' });

  const { data: order } = await supa().from('orders').select('*').eq('access_token', token).single();
  if (!order) return json(404, { error: 'Order not found' });
  if (!order.paid) return json(403, { error: 'Order is not paid' });

  const owner = process.env.OWNER_NOTIFICATION_EMAIL;

  try {
    // ---------- APPROVE ----------
    if (action === 'approve') {
      const { data: ready } = await supa().from('proofs')
        .select('id').eq('order_id', order.id).eq('status', 'ready')
        .order('created_at', { ascending: false }).limit(1).single();
      if (!ready) return json(400, { error: 'No proof available to approve' });

      await supa().from('orders').update({ status: 'approved', approved_proof_id: ready.id }).eq('id', order.id);

      if (owner) await sendEmail({
        to: owner,
        subject: `✅ Proof approved — ${order.athlete_name} (qty ${order.quantity})`,
        html: `<p>Order <b>${order.id}</b> approved by customer. Print file is in the <b>print-files</b> bucket. Push to Printful.</p>`,
      });
      return json(200, { ok: true, status: 'approved' });
    }

    // ---------- REGENERATE ----------
    if (action === 'regenerate') {
      if (order.regen_count >= order.regen_limit) return json(403, { error: 'Regeneration limit reached' });
      await runGeneration(order.id, { trigger: 'regen' });
      return json(200, { ok: true, status: 'proof_ready' });
    }

    // ---------- MANUAL TOUCH ----------
    if (action === 'manual') {
      if (!order.manual_unlocked) return json(403, { error: 'Manual touch unlocks after all regenerations are used' });
      const desc = String(description || '').trim();
      if (desc.length < 5) return json(400, { error: 'Please describe specifically what needs fixing' });

      await supa().from('manual_requests').insert({ order_id: order.id, description: desc });
      await supa().from('orders').update({ status: 'manual_requested' }).eq('id', order.id);

      // Owner gets everything needed to fix it: description, photo, latest proof.
      if (owner) {
        const photoUrl = order.source_photo_path
          ? await signedUrl(BUCKETS.source, order.source_photo_path, 86400) : null;
        const { data: latest } = await supa().from('proofs')
          .select('composited_path').eq('order_id', order.id).eq('status', 'ready')
          .order('created_at', { ascending: false }).limit(1).single();
        const proofUrl = latest && latest.composited_path
          ? await signedUrl(BUCKETS.proofs, latest.composited_path, 86400) : null;

        await sendEmail({
          to: owner,
          subject: `🛠 Manual touch requested — ${order.athlete_name}`,
          html: `<p><b>Order:</b> ${order.id}<br>
            <b>Athlete:</b> ${order.athlete_name} #${order.jersey_number || ''} — ${order.sport || ''}, ${order.school_team || ''}<br>
            <b>Style:</b> ${order.style_key}</p>
            <p><b>Customer says to fix:</b><br>${desc.replace(/</g, '&lt;')}</p>
            <p>${photoUrl ? `<a href="${photoUrl}">Original photo</a> · ` : ''}${proofUrl ? `<a href="${proofUrl}">Latest proof</a>` : ''}</p>
            <p>Upload the corrected proof via the owner endpoint (see RUNBOOK.md → Manual touch).</p>`,
        });
      }
      return json(200, { ok: true, status: 'manual_requested' });
    }

    return json(400, { error: 'Unknown action' });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
