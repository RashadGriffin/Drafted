/* GET /api/get-group?token=...
   Accepts a GROUP access token (from the post-payment redirect / email).
   Returns the ordered list of designs in the group, each with its OWN
   access token + a light status, so the proof page can walk through
   them one at a time using the existing per-design endpoints.

   Backward compatible: if the token is actually a single ORDER token
   (legacy), returns a one-item group so the page handles it uniformly. */
const { supa } = require('./_lib/supabase.js');
const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

function designView(o) {
  return {
    token: o.access_token,
    seq: o.group_seq || 1,
    styleKey: o.style_key,
    status: o.status,
    // "done" = finalized or further along; drives the walkthrough's checkmarks
    done: ['finalized', 'in_production', 'shipped'].includes(o.status),
    approved: ['approved', 'finalized', 'in_production', 'shipped'].includes(o.status),
  };
}

exports.handler = async (event) => {
  const token = event.queryStringParameters && event.queryStringParameters.token;
  if (!token || token.length < 32) return json(401, { error: 'Invalid link' });

  // Try as a GROUP token first.
  const { data: group } = await supa().from('order_groups').select('*').eq('access_token', token).single();

  if (group) {
    const { data: orders } = await supa().from('orders')
      .select('id, access_token, group_seq, style_key, status')
      .eq('group_id', group.id)
      .order('group_seq', { ascending: true });
    const designs = (orders || []).map(designView);
    return json(200, {
      isGroup: true,
      groupToken: token,
      email: group.customer_email,
      total: designs.length,
      designs,
    });
  }

  // Fall back: token is a single ORDER (legacy / direct order link).
  const { data: order } = await supa().from('orders')
    .select('id, access_token, group_seq, style_key, status').eq('access_token', token).single();
  if (!order) return json(404, { error: 'Order not found' });

  return json(200, {
    isGroup: false,
    groupToken: null,
    total: 1,
    designs: [designView(order)],
  });
};
