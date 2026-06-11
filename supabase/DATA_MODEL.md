# Drafted Apparel — Data Model (Step 1)

This is the backbone of the automated **pay → generate → proof → approve / regenerate / manual-touch** flow.

## The core idea
- **Marketing content** (homepage copy, photos, testimonials) → lives in Decap CMS / JSON. Owner edits freely.
- **Styles** (prompts, model choice, text-overlay specs) → live in `config/styles.js` in the repo. Sensitive IP, version-controlled, owner-edited in code.
- **Order & proof state** → lives in Supabase (Postgres). Written ONLY by server-side Netlify Functions using the service-role key.

## Tables

### `orders`
One row per purchase. The spine of everything.
- **Access:** `access_token` (random 32-byte hex) powers *both* instant on-site proof access (token in the post-checkout redirect URL) and the emailed magic-link return path. No customer accounts.
- **Customization:** style, garment, athlete name / number / sport / school, uploaded photo path.
- **Commerce:** quantity, locked unit price (bulk tier captured at checkout), Stripe refs, `paid` flag + `paid_at`.
- **Lifecycle:** `status` enum walks the order from `pending_payment` → `paid` → `generating` → `proof_ready` → (`regenerating` | `manual_requested` …) → `approved` → `in_production` → `shipped`.
- **Regen control:** `regen_count`, `regen_limit` (default 3), `manual_unlocked` (flips true once the 3 re-rolls are spent — this is what gates the Manual Touch option).

### `proofs`
One row per image shown to the customer (attempt 1 = initial, 2–4 = regens, plus any manual upload).
- Tracks provider/model/prompt used (provenance), and three storage paths: `raw_image_path` (AI output), `composited_path` (after text overlay — what the customer sees), `print_file_path` (full-res for Printful).

### `manual_requests`
Captures the customer's typed description of what to fix. Links to the resolving proof when the owner uploads a correction.

### `generation_jobs`
Audit + idempotency + **margin tracking**. Every adapter call logs provider, model, and estimated `cost_cents`. This is how you'll watch API spend against your $55 price as you test models.

## Security model
- RLS is **on** for all tables with **no public policies** → the browser/anon key can't touch them.
- All reads/writes go through Netlify Functions using the **service-role key** (server-side only, never shipped to the client).
- Storage buckets (`source-photos`, `proofs`, `print-files`) are **private**; customers see images only via short-lived **signed URLs** minted by functions.

## Why this enforces your rules
- **Payment before generation:** generation is only ever triggered by the Stripe *webhook* flipping `paid = true`. No client code can start a generation. Screenshot/free-gen abuse is structurally blocked.
- **Max 3 free regens then manual unlocks:** enforced by `regen_count < regen_limit` checks server-side; `manual_unlocked` is the gate.
- **AI never renders text:** text fields live in the order; they're composited as an overlay layer (step 4), never sent as text to render inside the prompt (note the "no text/letters/numbers" negative prompts).
- **Styles in flux:** swap model, prompt, or overlay per style in `config/styles.js` with zero downstream changes.
