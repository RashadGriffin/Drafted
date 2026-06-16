/* ===========================================================
   COMPOSITOR
   Two responsibilities, deliberately separated:

   1) processArt()    — produce the pure illustration (NO text).
                        Used at GENERATION time. The proof the
                        customer approves is text-free artwork.

   2) composeWithText() — composite the customer's chosen text
                        (name / school / number + colors) onto an
                        already-approved illustration. Used at the
                        END of the live editor step to build the
                        final print file.

   AI never renders text. This layer does, deterministically — but
   only AFTER the art is approved and only if the customer opts in.
   =========================================================== */

const sharp = require('sharp');

const PROOF_SIZE = 1024;   // shown to the customer
const PRINT_SIZE = 3000;   // sent to Printful

const FONT_STACK = {
  'BarlowCondensed-Bold': "'Barlow Condensed','Arial Narrow','DejaVu Sans Condensed',Arial,sans-serif",
  'Inter-Medium': "Inter,'DejaVu Sans',Arial,sans-serif",
  'PressStart2P': "'Press Start 2P','Courier New',monospace",
};

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* 1) PURE ART — no text. Used at generation time. */
async function processArt(rawBuffer, opts = {}) {
  const W = opts.proofSize || PROOF_SIZE;
  const proofBuffer = await sharp(rawBuffer)
    .resize(W, W, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
  const printBuffer = await sharp(rawBuffer)
    .resize(opts.printSize || PRINT_SIZE, opts.printSize || PRINT_SIZE, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 }, kernel: 'lanczos3' })
    .png()
    .toBuffer();
  return { proofBuffer, printBuffer };
}

function textEl(spec, value, color, W, H){
  if(!spec || !value) return '';
  let v = String(value);
  if (spec.maxChars) v = v.slice(0, spec.maxChars);
  if (spec.uppercase) v = v.toUpperCase();
  const x = (spec.xPct ?? .5) * W;
  const y = (spec.yPct ?? .5) * H;
  const size = (spec.sizePct ?? .05) * H;
  const anchor = spec.align === 'left' ? 'start' : spec.align === 'right' ? 'end' : 'middle';
  const family = FONT_STACK[spec.font] || FONT_STACK['Inter-Medium'];
  const fill = color || spec.color || '#111111';
  return `<text x="${x}" y="${y}" font-family="${family}" font-weight="800" font-size="${size}" fill="${esc(fill)}" text-anchor="${anchor}" dominant-baseline="middle">${esc(v)}</text>`;
}

/* 2) COMPOSE WITH TEXT — approved art + customer's chosen text/colors. */
async function composeWithText(art, style, fields = {}, colors = {}, opts = {}) {
  const W = opts.proofSize || PROOF_SIZE;
  const ov = (style && style.textOverlay) || {};

  const entries = [
    ['number', fields.number, colors.number],
    ['name',   fields.name,   colors.name],
    ['school', fields.school, colors.school],
  ];

  const layers = [];
  for (const [k, val, col] of entries) if (ov[k] && ov[k].behind) layers.push(textEl(ov[k], val, col, W, W));
  for (const [k, val, col] of entries) if (ov[k] && !ov[k].behind) layers.push(textEl(ov[k], val, col, W, W));

  const hasText = layers.some(Boolean);
  if (!hasText) return processArt(art, opts);   // clean shirt

  const svg = Buffer.from(
    `<svg width="${W}" height="${W}" viewBox="0 0 ${W} ${W}" xmlns="http://www.w3.org/2000/svg">${layers.join('')}</svg>`
  );
  const proofBuffer = await sharp(art)
    .resize(W, W, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .composite([{ input: svg, top: 0, left: 0 }])
    .png()
    .toBuffer();

  const P = opts.printSize || PRINT_SIZE;
  const svgPrint = Buffer.from(
    `<svg width="${P}" height="${P}" viewBox="0 0 ${W} ${W}" xmlns="http://www.w3.org/2000/svg">${layers.join('')}</svg>`
  );
  const printBuffer = await sharp(art)
    .resize(P, P, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 }, kernel: 'lanczos3' })
    .composite([{ input: svgPrint, top: 0, left: 0 }])
    .png()
    .toBuffer();

  return { proofBuffer, printBuffer };
}

module.exports = { processArt, composeWithText, PROOF_SIZE, PRINT_SIZE, FONT_STACK };
