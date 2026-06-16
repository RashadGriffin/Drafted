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

  const { token, action, description, feedback, proofId } = p;
  if (!token || token.length < 32) return json(401, { error: 'Invalid link' });

  const { data: order } = await supa().from('orders').select('*').eq('access_token', token).single();
  if (!order) return json(404, { error: 'Order not found' });
  if (!order.paid) return json(403, { error: 'Order is not paid' });

  const owner = process.env.OWNER_NOTIFICATION_EMAIL;

  try {
    // ---------- APPROVE ----------
    if (action === 'approve') {
      // Approve the SPECIFIC proof the customer selected (they may have picked
      // an earlier version). Falls back to the latest ready proof if none given.
      let chosen = null;
      if (proofId) {
        const { data: pick } = await supa().from('proofs')
          .select('id, attempt_no, print_file_path, status')
          .eq('order_id', order.id).eq('id', proofId).single();
        if (!pick || pick.status !== 'ready') return json(400, { error: 'That version is no longer available' });
        chosen = pick;
      } else {
        const { data: latest } = await supa().from('proofs')
          .select('id, attempt_no, print_file_path, status').eq('order_id', order.id).eq('status', 'ready')
          .order('created_at', { ascending: false }).limit(1).single();
        chosen = latest;
      }
      if (!chosen) return json(400, { error: 'No proof available to approve' });

      await supa().from('orders').update({ status: 'approved', approved_proof_id: chosen.id }).eq('id', order.id);

      if (owner) await sendEmail({
        to: owner,
        subject: `✅ Proof approved — ${order.athlete_name} (qty ${order.quantity})`,
        html: `<p>Order <b>${order.id}</b> approved by customer.</p>
          <p>Approved version: <b>attempt ${chosen.attempt_no}</b><br>
          Print file: <b>${chosen.print_file_path || '(in print-files bucket)'}</b></p>
          <p>Push this file to Printful.</p>`,
      });
      return json(200, { ok: true, status: 'approved' });
    }

    // ---------- REGENERATE ----------
    if (action === 'regenerate') {
      if (order.regen_count >= order.regen_limit) return json(403, { error: 'Regeneration limit reached' });
      // Feedback can ONLY be our own preset phrases (no free text in the UI).
      // Allowlist-filter server-side too, so nothing unvetted can reach the
      // image prompt even via a hand-crafted API call. Unknown text is dropped.
      const ALLOWED = new Set([
        'Match the team and uniform colors more accurately to the original photo.',
        'Lighten the uniform slightly while keeping it accurate to the photo.',
        'Darken the uniform slightly while keeping it accurate to the photo.',
        'Render the jersey number and team lettering crisply and accurately.',
        'Make the face look more like the person in the original photo.',
        'Simplify the face with cleaner, smoother features.',
        'Show more of the body for a fuller view of the subject, keeping the same pose.',
        'Make the illustration bolder and higher-contrast.',
        'Make it cleaner and less busy, with less visual clutter.',
        'Make it more polished and refined overall.',
      ]);
      const raw = String(feedback || '');
      const safe = raw.split(/(?<=\.)\s+/).map(x => x.trim()).filter(x => ALLOWED.has(x));
      const fb = safe.join(' ').slice(0, 600);
      await supa().from('orders').update({ regen_feedback: fb || null }).eq('id', order.id);
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
