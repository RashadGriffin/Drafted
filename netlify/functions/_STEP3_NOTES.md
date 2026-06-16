# Step 3 — Checkout, Webhook, Generation Trigger

## The security model (why your rules hold)
- **Only the webhook generates.** `create-checkout` never generates; it just
  makes a `pending_payment` order + Stripe session. Generation is triggered
  exclusively by `stripe-webhook` after Stripe confirms payment. A user cannot
  POST their way to a free image.
- **Signature verified.** The webhook rejects any request not signed by Stripe.
- **Idempotent.** Re-delivered events won't double-charge or double-generate
  (`order.paid` short-circuits).
- **Belt & suspenders.** `runGeneration` itself refuses if `!order.paid`.
- **Price is server-authoritative.** `pricing.js` computes bulk tiers; the client
  cannot set its own price.

## Functions
- `POST /.netlify/functions/create-checkout` — validate → price → insert order → Stripe session → return URL.
- `POST /.netlify/functions/stripe-webhook` — verify → mark paid → `runGeneration(initial)`.
- `_lib/runGeneration.js` — shared engine (used by webhook now, regenerate later).

## Local / test-mode setup (Stripe test mode)
1. `npm install` (installs stripe + supabase sdk).
2. Set env (use **test** Stripe keys):
   - `STRIPE_SECRET_KEY=sk_test_...`
   - `STRIPE_WEBHOOK_SECRET=whsec_...`  (from `stripe listen` or dashboard)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `GENERATION_PROVIDER=mock`  (keep mock until the proof flow is verified)
3. Forward webhooks while testing:
   ```
   stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook
   ```
4. Trigger a test purchase; confirm in Supabase:
   - order flips `paid=true`, `status=proof_ready`
   - a `proofs` row appears with `status=ready`
   - a `generation_jobs` row logs the (mock) run at `cost_cents=0`

## Redirects
`netlify.toml` will map `/api/*` → `/.netlify/functions/*` (added next).
Success URL already points to `/proof.html?token=...` (built in step 5).
