/* POST /api/owner-orders  (owner only — requires x-owner-secret header)
   Body: { limit? }
   Returns recent orders with the fields the dashboard needs. Read-only. */
const { supa } = require('./_lib/supabase.js');
const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!process.env.OWNER_SECRET || event.headers['x-owner-secret'] !== process.env.OWNER_SECRET) {
    return json(401, { error: 'Unauthorized' });
  }

  let p = {}; try { p = JSON.parse(event.body || '{}'); } catch {}
  const limit = Math.min(Math.max(parseInt(p.limit || 50, 10), 1), 200);

  const { data: orders, error } = await supa()
    .from('orders')
    .select('id, created_at, athlete_name, customer_email, style_key, status, paid, total_cents, quantity, regen_count, regen_limit, refunded_at, access_token')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return json(500, { error: error.message });

  // Trim token to just what the proof link needs; never expose secrets.
  const rows = (orders || []).map(o => ({
    id: o.id,
    created_at: o.created_at,
    athlete_name: o.athlete_name,
    customer_email: o.customer_email,
    style_key: o.style_key,
    status: o.status,
    paid: o.paid,
    total_cents: o.total_cents,
    quantity: o.quantity,
    regen_count: o.regen_count,
    regen_limit: o.regen_limit,
    refunded: !!o.refunded_at,
    proof_token: o.access_token,
  }));

  return json(200, { orders: rows });
};
