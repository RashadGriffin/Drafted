/* ===========================================================
   DRAFTED APPAREL — Supabase server client
   Service-role only. NEVER import this into browser code.
   All DB + Storage access flows through here, server-side.
   =========================================================== */

const { createClient } = require('@supabase/supabase-js');

let _client = null;

function supa() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

// ---- Storage helpers (private buckets + signed URLs) ----
const BUCKETS = { source: 'source-photos', proofs: 'proofs', print: 'print-files' };

async function uploadBuffer(bucket, path, buffer, contentType) {
  const { error } = await supa().storage.from(bucket).upload(path, buffer, {
    contentType, upsert: true,
  });
  if (error) throw new Error(`Storage upload failed (${bucket}/${path}): ${error.message}`);
  return path;
}

async function signedUrl(bucket, path, expiresInSec = 3600) {
  if (!path) return null;
  const { data, error } = await supa().storage.from(bucket).createSignedUrl(path, expiresInSec);
  if (error) throw new Error(`Signed URL failed (${bucket}/${path}): ${error.message}`);
  return data.signedUrl;
}

module.exports = { supa, BUCKETS, uploadBuffer, signedUrl };
