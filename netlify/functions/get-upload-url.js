/* POST /api/get-upload-url  { filename, contentType }
   Returns a short-lived signed upload URL so the browser uploads the
   source photo DIRECTLY to Supabase Storage (private bucket). The photo
   never transits our functions — no payload limits, faster, cheaper. */
const crypto = require('crypto');
const { supa, BUCKETS } = require('./_lib/supabase.js');

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  let p; try { p = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }

  const { filename = 'photo.jpg', contentType } = p;
  if (!ALLOWED.includes(contentType)) return json(400, { error: 'Please upload a JPG, PNG, WEBP, or HEIC photo' });

  const safe = String(filename).toLowerCase().replace(/[^a-z0-9._-]/g, '-').slice(-60);
  const path = `incoming/${crypto.randomUUID()}-${safe}`;

  const { data, error } = await supa().storage.from(BUCKETS.source).createSignedUploadUrl(path);
  if (error) return json(500, { error: `Could not create upload URL: ${error.message}` });

  return json(200, { path, signedUrl: data.signedUrl });
};
