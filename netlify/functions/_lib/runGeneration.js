/* ===========================================================
   runGeneration(orderId, { trigger })
   -----------------------------------------------------------
   Shared engine used by the webhook (initial) and the
   regenerate function (regen). Enforces invariants:

   - Order MUST be paid. Unpaid -> hard refuse. (Belt & suspenders
     on top of the webhook-only trigger.)
   - Respects regen_limit for 'regen' triggers.
   - Calls the generation adapter (provider-agnostic).
   - Stores RAW image now; text-overlay compositing is wired in step 4.
   - Logs spend to generation_jobs.
   - Advances order.status and proof rows.

   trigger: 'initial' | 'regen'
   =========================================================== */

const { supa, BUCKETS, uploadBuffer } = require('./supabase.js');
const { generateIllustration } = require('./generate.js');
const { composeProof } = require('./compose.js');
const { snapUniformColors, snapEnabled } = require('./colorSnap.js');
const { getStyle } = require('../../../config/styles.js');

async function runGeneration(orderId, { trigger = 'initial' } = {}) {
  const { data: order, error } = await supa()
    .from('orders').select('*').eq('id', orderId).single();
  if (error || !order) throw new Error('Order not found');

  // ---- Invariant: payment before generation. No exceptions. ----
  if (!order.paid) throw new Error('Refusing to generate: order not paid');

  // ---- Regen limit enforcement ----
  let attemptNo;
  if (trigger === 'regen') {
    if (order.regen_count >= order.regen_limit) {
      throw new Error('Regeneration limit reached');
    }
    attemptNo = order.regen_count + 2; // attempt 1 was initial; regen #1 => attempt 2
  } else {
    attemptNo = 1;
  }

  // ---- Mark in-flight ----
  await supa().from('orders').update({
    status: trigger === 'regen' ? 'regenerating' : 'generating',
  }).eq('id', orderId);

  // ---- Create proof row (pending) ----
  const { data: proof, error: pErr } = await supa().from('proofs').insert({
    order_id: orderId,
    attempt_no: attemptNo,
    kind: 'auto',
    status: 'rendering',
  }).select().single();
  if (pErr) throw new Error(`Proof insert failed: ${pErr.message}`);

  // ---- Log job start ----
  const { data: job } = await supa().from('generation_jobs').insert({
    order_id: orderId, proof_id: proof.id, trigger, status: 'started',
  }).select().single();

  try {
    // ---- Generate (provider-agnostic) ----
    const result = await generateIllustration(order);

    // ---- Optional: uniform color snap (OFF by default) ----
    // Subtly corrects uniform colors that are NEAR a picked team color
    // to the exact hex. Preserves whites, skin, background. Tune via env
    // once real generated images exist. See _lib/colorSnap.js.
    let genBuffer = result.imageBuffer;
    if (snapEnabled() && (order.primary_color_hex || order.secondary_color_hex)) {
      try {
        const picks = [order.primary_color_hex, order.secondary_color_hex].filter(Boolean);
        genBuffer = await snapUniformColors(genBuffer, picks);
      } catch (snapErr) {
        console.error('colorSnap skipped:', snapErr.message); // never block a proof on this
      }
    }

    // ---- Store RAW image ----
    const rawPath = `${orderId}/attempt-${attemptNo}-raw.png`;
    await uploadBuffer(BUCKETS.proofs, rawPath, genBuffer, result.mimeType);

    // ---- STEP 4: composite name/number/school programmatically ----
    const style = getStyle(order.style_key);
    const { compositedBuffer, printBuffer } = await composeProof(genBuffer, style, order);
    const compositedPath = `${orderId}/attempt-${attemptNo}-proof.png`;
    const printPath = `${orderId}/attempt-${attemptNo}-print.png`;
    await uploadBuffer(BUCKETS.proofs, compositedPath, compositedBuffer, 'image/png');
    await uploadBuffer(BUCKETS.print, printPath, printBuffer, 'image/png');

    // ---- Update proof ----
    await supa().from('proofs').update({
      provider: result.provider,
      model: result.model,
      prompt_used: result.prompt,
      raw_image_path: rawPath,
      composited_path: compositedPath,
      print_file_path: printPath,
      feedback: trigger === 'regen' ? (order.regen_feedback || null) : null,
      status: 'ready',
    }).eq('id', proof.id);

    // ---- Update order ----
    const patch = { status: 'proof_ready' };
    if (trigger === 'regen') {
      const newCount = order.regen_count + 1;
      patch.regen_count = newCount;
      if (newCount >= order.regen_limit) patch.manual_unlocked = true;
    }
    await supa().from('orders').update(patch).eq('id', orderId);

    // ---- Close job ----
    if (job) await supa().from('generation_jobs').update({
      provider: result.provider, model: result.model,
      cost_cents: result.costCents, status: 'succeeded',
      finished_at: new Date().toISOString(),
    }).eq('id', job.id);

    return { proofId: proof.id, compositedPath, attemptNo };
  } catch (genErr) {
    await supa().from('proofs').update({
      status: 'failed', error_detail: genErr.message,
    }).eq('id', proof.id);
    if (job) await supa().from('generation_jobs').update({
      status: 'failed', error_detail: genErr.message,
      finished_at: new Date().toISOString(),
    }).eq('id', job.id);
    // Revert order to a reviewable state
    await supa().from('orders').update({
      status: trigger === 'regen' ? 'proof_ready' : 'paid',
    }).eq('id', orderId);
    throw genErr;
  }
}

module.exports = { runGeneration };
