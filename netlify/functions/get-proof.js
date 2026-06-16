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
    .select('id, attempt_no, kind, status, composited_path, created_at')
    .eq('order_id', order.id)
    .order('created_at', { ascending: false });

  const latestReady = (proofs || []).find(p => p.status === 'ready');
  const generating =
    ['generating', 'regenerating'].includes(order.status) ||
    (order.status === 'paid' && !latestReady);

  let proofUrl = null;
  if (latestReady && latestReady.composited_path) {
    proofUrl = await signedUrl(BUCKETS.proofs, latestReady.composited_path, 3600);
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
    generating,
    proof: latestReady ? {
      id: latestReady.id,
      attemptNo: latestReady.attempt_no,
      kind: latestReady.kind,
      url: proofUrl,
    } : null,
    attempts: (proofs || []).map(p => ({ attemptNo: p.attempt_no, kind: p.kind, status: p.status })),
  });
};
