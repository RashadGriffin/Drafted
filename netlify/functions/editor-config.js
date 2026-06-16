/* GET /api/editor-config?token=...
   Serves the text-editor everything it needs to render a faithful
   LIVE client-side preview: the style's text placement specs and the
   curated color palette. Keeps placement defaults in ONE place
   (config/styles.js) so the live preview matches the server composite. */
const { supa } = require('./_lib/supabase.js');
const { getStyle } = require('../../config/styles.js');
const { TEXT_COLORS, DEFAULT_TEXT_COLOR } = require('../../config/textColors.js');
const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

exports.handler = async (event) => {
  const token = event.queryStringParameters && event.queryStringParameters.token;
  if (!token || token.length < 32) return json(401, { error: 'Invalid link' });

  const { data: order } = await supa().from('orders').select('style_key, athlete_name, jersey_number, school_team').eq('access_token', token).single();
  if (!order) return json(404, { error: 'Order not found' });

  const style = getStyle(order.style_key);
  const ov = (style && style.textOverlay) || {};
  // Expose only the placement fields the preview needs (not internal flags).
  const specs = {};
  for (const k of ['name', 'school', 'number']) {
    if (ov[k]) specs[k] = {
      xPct: ov[k].xPct ?? 0.5, yPct: ov[k].yPct ?? 0.5, sizePct: ov[k].sizePct ?? 0.05,
      align: ov[k].align || 'center', uppercase: !!ov[k].uppercase, maxChars: ov[k].maxChars || 24,
      font: ov[k].font || 'Inter-Medium', defaultColor: ov[k].color || DEFAULT_TEXT_COLOR,
    };
  }

  return json(200, {
    styleKey: order.style_key,
    specs,
    colors: TEXT_COLORS,
    defaultColor: DEFAULT_TEXT_COLOR,
    // Pre-fill suggestions from what they entered at order time (may be blank).
    prefill: {
      name: order.athlete_name || '',
      number: order.jersey_number || '',
      school: order.school_team || '',
    },
  });
};
