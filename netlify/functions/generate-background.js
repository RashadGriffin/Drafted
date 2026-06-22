/* Background generation worker.
   Netlify gives *-background functions up to 15 minutes (vs. the 60s cap on
   normal functions), which is what real OpenAI image-to-image needs.

   Invoked fire-and-forget (POST) by stripe-webhook after payment. Receives a
   list of order IDs; generates each sequentially, then emails the proof link.

   Idempotent: Netlify retries background functions on failure (after 1m, then
   2m). runGeneration already guards on order state, and we skip orders that
   are already past 'paid', so retries can't double-charge OpenAI for work
   that's already done. */

const { supa } = require('./_lib/supabase.js');
const { runGeneration } = require('./_lib/runGeneration.js');
const { sendEmail } = require('./_lib/email.js');

exports.handler = async (event) => {
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: 'bad json' }; }

  const { orderIds, groupToken, singleToken, email, regenLimit } = body;
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return { statusCode: 400, body: 'no orderIds' };
  }
  const site = process.env.SITE_URL || '';

  for (const id of orderIds) {
    try {
      // Skip if this order already produced a proof (retry-safe).
      const { data: o } = await supa()
        .from('orders').select('status').eq('id', id).single();
      if (o && !['paid'].includes(o.status)) {
        // already advanced past paid (proof_ready/approved/etc) — don't redo
        continue;
      }
      await runGeneration(id, { trigger: 'initial' });
    } catch (genErr) {
      console.error('[gen-bg] generation error for order', id, genErr.message);
      // leave it; proof page will show the error state, owner can regen
    }
  }

  // Notify once everything in this batch is done.
  try {
    if (email) {
      const link = groupToken
        ? `${site}/proof.html?token=${groupToken}`
        : `${site}/proof.html?token=${singleToken}`;
      const many = orderIds.length > 1;
      await sendEmail({
        to: email,
        subject: `Your Drafted proof${many ? 's are' : ' is'} ready 🔥`,
        html: `<p>Your custom illustration${many ? 's are' : ' is'} ready to review:</p>
          <p><a href="${link}">View your proof${many ? 's' : ''}</a></p>
          ${regenLimit ? `<p>Approve it, or regenerate up to ${regenLimit} times free.</p>` : ''}`,
      });
    }
  } catch (e) { console.error('[gen-bg] email error', e.message); }

  return { statusCode: 200, body: 'done' };
};
