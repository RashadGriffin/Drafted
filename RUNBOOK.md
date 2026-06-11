# Drafted Apparel — Deployment Runbook (Step 8)

Follow in order. Each phase is independently testable. Total time: ~45–60 min.

---

## Phase 1 — Push to GitHub

```bash
cd drafted-apparel
git init
git add .
git commit -m "Drafted Apparel — full site + automated generation backend"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/drafted-apparel.git
git push -u origin main
```

---

## Phase 2 — Supabase (database + storage)

1. Create a project at supabase.com (free tier is fine to start).
2. **SQL Editor** → paste the entire contents of `supabase/schema.sql` → Run.
3. **Storage** → create 3 buckets, ALL **private** (do not enable public access):
   - `source-photos`
   - `proofs`
   - `print-files`
4. **Settings → API**: copy these two values for Phase 3:
   - Project URL → `SUPABASE_URL`
   - `service_role` key (NOT anon) → `SUPABASE_SERVICE_ROLE_KEY`

> The service-role key bypasses RLS — it must ONLY ever live in Netlify env vars,
> never in any frontend file. The schema has RLS on with zero public policies,
> so the browser can never touch order data directly.

---

## Phase 3 — Netlify (hosting + functions)

1. Netlify → **Add new site → Import existing project** → pick the GitHub repo.
   - Build command: *(leave blank)* · Publish directory: `.`
   - Functions directory auto-detects `netlify/functions`.
2. **Site configuration → Environment variables** — add:

| Variable | Value | Notes |
|---|---|---|
| `SITE_URL` | `https://draftedapparel.com` | no trailing slash |
| `SUPABASE_URL` | from Phase 2 | |
| `SUPABASE_SERVICE_ROLE_KEY` | from Phase 2 | **secret** |
| `GENERATION_PROVIDER` | `mock` | keep mock until Phase 6 passes |
| `STRIPE_SECRET_KEY` | `sk_test_...` | **test key first** |
| `STRIPE_WEBHOOK_SECRET` | from Phase 4 | |
| `OWNER_NOTIFICATION_EMAIL` | your email | manual-touch + approval alerts |
| `OWNER_SECRET` | long random string | guards `/api/owner-upload` |
| `EMAIL_API_KEY` | Resend API key | optional at first — emails no-op without it |
| `EMAIL_FROM` | `Drafted Apparel <orders@draftedapparel.com>` | verify domain in Resend |

3. Deploy. Confirm the site loads and `/admin` shows the Decap login.

---

## Phase 4 — Stripe (test mode)

1. Stripe Dashboard → **toggle Test mode ON**.
2. **Developers → API keys** → copy the test secret key → `STRIPE_SECRET_KEY`.
3. **Developers → Webhooks → Add endpoint**:
   - URL: `https://YOUR-SITE.netlify.app/api/stripe-webhook`
   - Events: `checkout.session.completed`
4. Copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET` env var → redeploy.

---

## Phase 5 — Decap CMS (marketing content editing)

1. Netlify → **Site configuration → Identity → Enable Identity**.
2. Identity → Registration → **Invite only**.
3. Identity → Services → **Enable Git Gateway**.
4. Identity → **Invite users** → your email → accept invite, set password.
5. Edit at `https://yoursite/admin` — changes commit to GitHub and auto-redeploy.

---

## Phase 6 — End-to-end test (mock provider, test cards)

1. Open a product page → fill customization → upload a photo → **Pay & Generate**.
2. Stripe test card: `4242 4242 4242 4242`, any future date, any CVC.
3. You should land on `/proof.html?token=...` and watch the proof appear.
4. Verify in Supabase:
   - `orders`: `paid=true`, `status=proof_ready`
   - `proofs`: row with `status=ready`, composited + print paths
   - `generation_jobs`: succeeded, `cost_cents=0`
5. Test **Regenerate** ×3 → confirm `manual_unlocked` flips and the Manual
   Touch button activates. Submit a manual request → check your owner email.
6. Test **Approve** → status `approved`, owner email arrives.

## Phase 6b — Manual touch (owner side)

When a manual request email arrives, fix the image, then upload the corrected proof:

```bash
base64 -i fixed.png | tr -d '\n' > b64.txt
curl -X POST https://yoursite/api/owner-upload \
  -H "Content-Type: application/json" \
  -H "x-owner-secret: YOUR_OWNER_SECRET" \
  -d "{\"orderId\":\"THE_ORDER_ID\",\"imageBase64\":\"$(cat b64.txt)\"}"
```
Customer is auto-emailed their review link. (A small owner dashboard can replace
this curl later.)

---

## Phase 7 — Go live

1. Pick the real provider: set `GENERATION_PROVIDER=openai` (+ `OPENAI_API_KEY`)
   or `replicate` (+ `REPLICATE_API_TOKEN`). Per-style overrides live in
   `config/styles.js`. **Run one paid test order with the live provider** —
   provider APIs occasionally need a field tweak; it's isolated to one file in
   `netlify/functions/_lib/providers/`.
2. Stripe → **toggle Live mode** → swap `STRIPE_SECRET_KEY` to `sk_live_...`,
   create the live webhook endpoint, swap `STRIPE_WEBHOOK_SECRET`.
3. Resend → verify your domain → set `EMAIL_API_KEY` + `EMAIL_FROM`.
4. Domain: point `draftedapparel.com` at Netlify (Domain management → add domain).
5. Replace placeholder zones with real photos via Decap (`/admin`) and
   `assets/uploads/`.

---

## Known limits & upgrade paths (read once)

- **Webhook generation timing.** Generation currently runs inside the webhook.
  Mock is instant; real providers take 10–40s, which can brush Netlify's
  function timeout. If you see timeouts after going live, convert
  `stripe-webhook.js` to trigger a **Netlify background function** that calls
  `runGeneration` — the proof page already polls, so no frontend change needed.
- **Overlay fonts.** The compositor uses bold system font stacks. To use exact
  brand fonts (Barlow Condensed etc.) in the printed overlay, bundle TTFs and
  a fontconfig file with the function. Cosmetic; do after launch.
- **Printful push is manual.** On approval you get an email; the print file is
  in the `print-files` bucket. Automating the Printful API call is a clean
  later addition (status already has `in_production` / `shipped`).
- **Clean Series "behind" number** renders as a low-opacity overlay (can't go
  truly behind a generated raster). Tune opacity/placement in `config/styles.js`.
- **Replicate/OpenAI inputs** vary by model — adjust only the provider file.

## File map (what's where)

| Thing | Where |
|---|---|
| Style prompts / models / overlay specs (IP) | `config/styles.js` |
| Marketing copy & photos | Decap at `/admin` → `content/*.json` |
| DB schema | `supabase/schema.sql` |
| Payment → generation flow | `netlify/functions/` |
| Proof experience | `proof.html` |
| Product pages | `products/*.html` (rebuild: `node scripts/build-products.js`) |
