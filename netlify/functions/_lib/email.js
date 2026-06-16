/* Email via Resend REST. No-ops gracefully when EMAIL_API_KEY is unset
   (dev/test mode) so the flow never breaks on missing email config. */
async function sendEmail({ to, subject, html }) {
  const key = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM || 'Drafted Apparel <orders@draftedapparel.com>';
  if (!key) { console.log(`[email skipped] to=${to} subject="${subject}"`); return { skipped: true }; }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) console.error('Email send failed:', res.status, await res.text().catch(()=> ''));
  return { ok: res.ok };
}
module.exports = { sendEmail };
