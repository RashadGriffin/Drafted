const sharp = require('sharp');

async function detectSubjectBounds(buf) {
  const img = sharp(buf);
  const { width, height } = await img.metadata();
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  let minX = width, minY = height, maxX = 0, maxY = 0, found = false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * ch + (ch - 1)];
      if (alpha > 12) {
        found = true;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/* Build a dilated solid-color silhouette from the subject's alpha.
   Mask stays SINGLE channel the whole way; we then attach it as the
   alpha channel of a solid color plate. */
async function makeSilhouette(subjectBuf, grow, color) {
  const pad = grow + 12;

  // 1. pure single-channel alpha, padded
  const mask = await sharp(subjectBuf)
    .ensureAlpha()
    .extractChannel(3)                 // 1-channel grayscale (alpha)
    .toColourspace('b-w')              // force true single channel
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r:0,g:0,b:0,alpha:0 } })
    .blur(Math.max(0.3, grow * 0.55))  // spread edges
    .threshold(38)                     // hard dilated silhouette
    .toColourspace('b-w')              // stay single channel after threshold
    .toBuffer();

  const meta = await sharp(mask).metadata();
  const pw = meta.width, ph = meta.height;

  // 2. solid color plate, then attach mask as its alpha
  const plate = await sharp({ create: { width: pw, height: ph, channels: 3, background: { r: color.r, g: color.g, b: color.b } } })
    .joinChannel(mask)                 // RGB + 1ch alpha = RGBA
    .png()
    .toBuffer();

  return { buf: plate, pad };
}

async function composeSticker(subjectBuf, template, data) {
  const C = template.canvas;
  const S = template.sticker;

  const bounds = await detectSubjectBounds(subjectBuf);
  const trimmed = await sharp(subjectBuf).extract(bounds).png().toBuffer();

  const zone = template.safeZones.subjectSafeZone;
  const scale = Math.min(zone.width / bounds.width, zone.height / bounds.height);
  const sw = Math.round(bounds.width * scale);
  const sh = Math.round(bounds.height * scale);
  const subjScaled = await sharp(trimmed).resize(sw, sh).png().toBuffer();

  const black = await makeSilhouette(subjScaled, S.whiteOutlinePx + S.blackContourPx, { r:17,g:17,b:17 });
  const white = await makeSilhouette(subjScaled, S.whiteOutlinePx, { r:255,g:255,b:255 });

  // soft drop shadow: blurred dark silhouette, offset down/right
  const shadowGrow = S.whiteOutlinePx + S.blackContourPx;
  const shadowSil = await makeSilhouette(subjScaled, shadowGrow, { r:0,g:0,b:0 });
  const shadow = await sharp(shadowSil.buf).blur(S.dropShadow.blur)
    .ensureAlpha().modulate({brightness:1})
    .composite([{input:Buffer.from([0,0,0,Math.round(255*S.dropShadow.opacity)]),raw:{width:1,height:1,channels:4},tile:true,blend:'dest-in'}])
    .png().toBuffer();

  const cx = zone.x + Math.round((zone.width - sw) / 2);
  const cy = zone.y + Math.round((zone.height - sh) / 2);

  const layers = [
    { input: shadow, left: cx - shadowSil.pad + 6, top: cy - shadowSil.pad + S.dropShadow.dy },
    { input: black.buf, left: cx - black.pad, top: cy - black.pad },
    { input: white.buf, left: cx - white.pad, top: cy - white.pad },
    { input: subjScaled, left: cx, top: cy },
  ];

  if (data.lastName) {
    const nz = template.safeZones.nameSafeZone;
    const name = String(data.lastName).toUpperCase();
    const fontSize = Math.min(template.text.lastName.maxSize, Math.floor(nz.width / (name.length * 0.62)));
    const nameSvg = `<svg width="${nz.width}" height="${nz.height}" xmlns="http://www.w3.org/2000/svg">
      <text x="${nz.width/2}" y="${nz.height*0.78}" text-anchor="middle"
        font-family="Arial Black, sans-serif" font-weight="900" font-size="${fontSize}"
        fill="#111111" stroke="#ffffff" stroke-width="14" paint-order="stroke"
        letter-spacing="8">${name}</text></svg>`;
    layers.push({ input: Buffer.from(nameSvg), left: nz.x, top: nz.y });
  }

  return sharp({ create: { width: C.width, height: C.height, channels: 4, background: { r:0,g:0,b:0,alpha:0 } } })
    .composite(layers).png().toBuffer();
}

module.exports = { composeSticker, detectSubjectBounds, makeSilhouette };
