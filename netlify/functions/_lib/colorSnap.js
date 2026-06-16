/* ===========================================================
   DRAFTED APPAREL — Uniform Color Snap (post-generation)
   -----------------------------------------------------------
   Subtle color CORRECTION, not a recolor. For each pixel in the
   generated illustration, if its color is within THRESHOLD of a
   picked team color, snap it to that exact hex. Everything not
   near a picked color is left untouched (white stays white,
   skin/background unaffected).

   Example: white jersey + off-purple trim, picks = purple+gold.
   The trim (near purple) snaps to exact purple; the white jersey
   and anything not near purple/gold is preserved.

   DISABLED BY DEFAULT. Enable + tune via env once real generated
   images are available:
     COLOR_SNAP_ENABLED=true
     COLOR_SNAP_THRESHOLD=28     (CIE76 deltaE; lower = stricter)
     COLOR_SNAP_STRENGTH=1.0     (0..1; 1 = full snap, <1 = nudge)

   Uses sharp for raw pixel access. Operates in LAB-ish distance
   via a simple weighted RGB->Lab approximation for perceptual
   closeness without extra deps.
   =========================================================== */

const sharp = require('sharp');

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map(x => x + x).join('') : h;
  return { r: parseInt(n.slice(0,2),16), g: parseInt(n.slice(2,4),16), b: parseInt(n.slice(4,6),16) };
}

// sRGB -> linear -> XYZ -> Lab (D65). Standard conversion.
function rgbToLab(r, g, b) {
  let R = r/255, G = g/255, B = b/255;
  R = R > 0.04045 ? Math.pow((R+0.055)/1.055, 2.4) : R/12.92;
  G = G > 0.04045 ? Math.pow((G+0.055)/1.055, 2.4) : G/12.92;
  B = B > 0.04045 ? Math.pow((B+0.055)/1.055, 2.4) : B/12.92;
  let X = (R*0.4124 + G*0.3576 + B*0.1805) / 0.95047;
  let Y = (R*0.2126 + G*0.7152 + B*0.0722) / 1.00000;
  let Z = (R*0.0193 + G*0.1192 + B*0.9505) / 1.08883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787*t + 16/116);
  X = f(X); Y = f(Y); Z = f(Z);
  return { L: 116*Y - 16, a: 500*(X-Y), b: 200*(Y-Z) };
}

function deltaE(lab1, lab2) {
  const dL = lab1.L - lab2.L, da = lab1.a - lab2.a, db = lab1.b - lab2.b;
  return Math.sqrt(dL*dL + da*da + db*db);
}

/* Build the target list (picked team colors) with precomputed Lab. */
function buildTargets(pickedHexes) {
  return pickedHexes.filter(Boolean).map(hex => {
    const { r, g, b } = hexToRgb(hex);
    return { hex, r, g, b, lab: rgbToLab(r, g, b) };
  });
}

/* Core: snap pixels near any target to that target's exact color.
   @param buffer  PNG/JPEG buffer (the generated illustration)
   @param pickedHexes  array of exact team-color hexes to snap toward
   @param opts  { threshold, strength }
   @returns PNG buffer */
async function snapUniformColors(buffer, pickedHexes, opts = {}) {
  const threshold = opts.threshold != null ? opts.threshold : Number(process.env.COLOR_SNAP_THRESHOLD || 28);
  const strength  = opts.strength  != null ? opts.strength  : Number(process.env.COLOR_SNAP_STRENGTH || 1.0);
  const targets = buildTargets(pickedHexes);
  if (!targets.length) return buffer;

  const img = sharp(buffer).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // Small cache so we don't recompute Lab for repeated pixel colors.
  const cache = new Map();

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i], g = data[i+1], b = data[i+2];
    const key = (r << 16) | (g << 8) | b;
    let decision = cache.get(key);
    if (decision === undefined) {
      const lab = rgbToLab(r, g, b);
      let best = null, bestD = Infinity;
      for (const t of targets) {
        const d = deltaE(lab, t.lab);
        if (d < bestD) { bestD = d; best = t; }
      }
      decision = (best && bestD <= threshold) ? best : null;
      cache.set(key, decision);
    }
    if (decision) {
      // strength 1.0 = exact snap; <1 nudges toward target.
      data[i]   = Math.round(r + (decision.r - r) * strength);
      data[i+1] = Math.round(g + (decision.g - g) * strength);
      data[i+2] = Math.round(b + (decision.b - b) * strength);
    }
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

/* Gate: should we run at all? (off by default) */
function snapEnabled() {
  return String(process.env.COLOR_SNAP_ENABLED || 'false').toLowerCase() === 'true';
}

module.exports = { snapUniformColors, snapEnabled, rgbToLab, deltaE, hexToRgb, buildTargets };
