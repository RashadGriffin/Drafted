/* ===========================================================
   STEP 4 — Text-Overlay Compositor
   Takes the RAW AI image + the style's textOverlay spec and
   composites athlete name / number / school programmatically.
   AI never renders text — this layer does, deterministically.

   Output: { compositedBuffer, printBuffer }
   - composited: 1024px, shown to the customer on the proof page
   - print: 3000px PNG for Printful (resized from composited)

   Uses sharp + an SVG text layer (librsvg). Fonts: bold system
   stack for now; custom brand fonts can be bundled later (see
   RUNBOOK "Fonts" note).
   =========================================================== */

const sharp = require('sharp');

const FONT_STACK = {
  'BarlowCondensed-Bold': "'Barlow Condensed','Arial Narrow','DejaVu Sans Condensed',Arial,sans-serif",
  'Inter-Medium': "Inter,'DejaVu Sans',Arial,sans-serif",
  'PressStart2P': "'Press Start 2P','Courier New',monospace",
};

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function textEl(spec, value, W, H){
  if(!spec || !spec.show || !value) return '';
  let v = String(value);
  if (spec.maxChars) v = v.slice(0, spec.maxChars);
  if (spec.uppercase) v = v.toUpperCase();
  const x = (spec.xPct ?? .5) * W;
  const y = (spec.yPct ?? .5) * H;
  const size = (spec.sizePct ?? .05) * H;
  const anchor = spec.align === 'left' ? 'start' : spec.align === 'right' ? 'end' : 'middle';
  const family = FONT_STACK[spec.font] || FONT_STACK['Inter-Medium'];
  return `<text x="${x}" y="${y}" font-family="${family}" font-weight="800" font-size="${size}" fill="${esc(spec.color||'#111')}" text-anchor="${anchor}" dominant-baseline="middle">${esc(v)}</text>`;
}

async function composeProof(rawBuffer, style, order, opts = {}) {
  const W = 1024, H = 1024;
  const ov = style.textOverlay || {};
  if (ov.enabled === false) {
    const composited = await sharp(rawBuffer).resize(W, H, { fit: 'cover' }).png().toBuffer();
    const print = await sharp(composited).resize(opts.printSize || 3000, opts.printSize || 3000).png().toBuffer();
    return { compositedBuffer: composited, printBuffer: print };
  }

  // Render order matters: "behind"-flagged layers first (lowest), then the rest.
  const layers = [];
  const entries = [
    ['number', order.jersey_number],
    ['name',   order.athlete_name],
    ['school', order.school_team],
  ];
  for (const [k, val] of entries) if (ov[k] && ov[k].behind) layers.push(textEl(ov[k], val, W, H));
  for (const [k, val] of entries) if (ov[k] && !ov[k].behind) layers.push(textEl(ov[k], val, W, H));

  const svg = Buffer.from(
    `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${layers.join('')}</svg>`
  );

  const compositedBuffer = await sharp(rawBuffer)
    .resize(W, H, { fit: 'cover' })
    .composite([{ input: svg, top: 0, left: 0 }])
    .png()
    .toBuffer();

  const printBuffer = await sharp(compositedBuffer)
    .resize(opts.printSize || 3000, opts.printSize || 3000, { kernel: 'lanczos3' })
    .png()
    .toBuffer();

  return { compositedBuffer, printBuffer };
}

module.exports = { composeProof };
