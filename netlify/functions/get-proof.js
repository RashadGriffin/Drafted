/* GET /api/get-proof?token=...
   The proof page's data source. Token = orders.access_token (from the
   Stripe redirect or the emailed magic link). Returns order state +
   a signed URL for the latest ready proof. */
const { supa, BUCKETS, signedUrl } = require('./_lib/supabase.js');
const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

exports.handler = async (event) => {
  const token = event.queryStringParameters && event.queryStringParameters.token;
  if (!token || token.length < 32) return json(401, { error: 'Invalid link' });

  const { data: order } = await supa().from('orders').select('*').eq('access_token', token).single();
  if (!order) return json(404, { error: 'Order not found' });

  const { data: proofs } = await supa().from('proofs')
    .select('id, attempt_no, kind, status, composited_path, feedback, created_at')
    .eq('order_id', order.id)
    .order('created_at', { ascending: false });

  const readyProofs = (proofs || []).filter(p => p.status === 'ready');
  const latestReady = readyProofs[0] || null;
  const generating =
    ['generating', 'regenerating'].includes(order.status) ||
    (order.status === 'paid' && !latestReady);

  // Sign every ready proof so the customer can browse their full history.
  // (1 + regen_limit attempts max — a small list.)
  const history = [];
  for (const p of readyProofs) {
    const url = p.composited_path
      ? await signedUrl(BUCKETS.proofs, p.composited_path, 3600) : null;
    history.push({
      id: p.id,
      attemptNo: p.attempt_no,
      kind: p.kind,
      feedback: p.feedback || null,
      url,
    });
  }

  return json(200, {
    status: order.status,
    paid: order.paid,
    athleteName: order.athlete_name,
    jerseyNumber: order.jersey_number,
    styleKey: order.style_key,
    quantity: order.quantity,
    regenCount: order.regen_count,
    regenLimit: order.regen_limit,
    manualUnlocked: order.manual_unlocked,
    approvedProofId: order.approved_proof_id || null,
    generating,
    // latest (kept for back-compat with the generating->ready transition)
    proof: latestReady ? {
      id: latestReady.id,
      attemptNo: latestReady.attempt_no,
      kind: latestReady.kind,
      url: history.find(h => h.id === latestReady.id)?.url || null,
    } : null,
    // full browsable history (newest first)
    history,
    attempts: (proofs || []).map(p => ({ attemptNo: p.attempt_no, kind: p.kind, status: p.status })),
  });
};
