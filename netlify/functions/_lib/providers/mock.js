/* Mock generation provider.
   Produces a deterministic placeholder PNG locally — no network, no cost.
   Lets us build + test the entire pay->proof flow for free.
   The image visibly encodes the style + sport so you can confirm
   the right data flowed through end to end. */

const zlib = require('zlib');

// Minimal PNG encoder (solid background + simple blocks) so we depend on nothing.
// For realism in dev we just generate a colored canvas with deterministic tint.
function makePng(width, height, rgb) {
  // Build raw RGBA, then deflate into a single IDAT. (Uncompressed-ish but valid.)
  const bytesPerPixel = 4;
  const rowSize = width * bytesPerPixel + 1; // +1 filter byte per row
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const o = y * rowSize + 1 + x * bytesPerPixel;
      // subtle diagonal pattern so it doesn't look broken
      const t = ((x + y) % 64) < 32 ? 0 : 12;
      raw[o]   = Math.max(0, Math.min(255, rgb[0] + t));
      raw[o+1] = Math.max(0, Math.min(255, rgb[1] + t));
      raw[o+2] = Math.max(0, Math.min(255, rgb[2] + t));
      raw[o+3] = 255;
    }
  }
  const idat = zlib.deflateSync(raw);

  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const body = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0, 0);
    return Buffer.concat([len, body, crc]);
  }
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// CRC32 (PNG)
let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

const TINTS = {
  'sketch-series': [216, 208, 196],
  'pixel-series':  [120, 130, 160],
  'clean-series':  [200, 196, 188],
};

module.exports = {
  defaultModel: 'mock-canvas-v1',
  async generate({ style, order }) {
    // simulate latency so the proof page "generating..." state is real
    await new Promise(r => setTimeout(r, 600));
    const tint = TINTS[style.key] || [200, 200, 200];
    const imageBuffer = makePng(1024, 1024, tint);
    return {
      model: 'mock-canvas-v1',
      imageBuffer,
      mimeType: 'image/png',
      costCents: 0,
    };
  }
};
