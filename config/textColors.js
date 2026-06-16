/* ===========================================================
   CURATED text-overlay colors.
   The ONLY colors a customer may apply to their name/school/number.
   Hand-picked to look premium on a shirt — no open color wheel.
   Change this list to adjust what customers can choose.
   =========================================================== */

const TEXT_COLORS = [
  { name: 'Black',      hex: '#111111' },
  { name: 'White',      hex: '#FFFFFF' },
  { name: 'Charcoal',   hex: '#444444' },
  { name: 'Navy',       hex: '#0B2545' },
  { name: 'Royal',      hex: '#1D4ED8' },
  { name: 'Red',        hex: '#B91C1C' },
  { name: 'Gold',       hex: '#C2960C' },
  { name: 'Forest',     hex: '#14532D' },
];

const DEFAULT_TEXT_COLOR = '#111111';
const ALLOWED_HEX = new Set(TEXT_COLORS.map(c => c.hex.toUpperCase()));

// Server-side guard: only allow a curated hex; otherwise fall back.
function safeColor(hex) {
  if (typeof hex !== 'string') return DEFAULT_TEXT_COLOR;
  const up = hex.toUpperCase();
  return ALLOWED_HEX.has(up) ? up : DEFAULT_TEXT_COLOR;
}

module.exports = { TEXT_COLORS, DEFAULT_TEXT_COLOR, safeColor };
