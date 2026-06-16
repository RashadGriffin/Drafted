# Generation Layer (Step 2)

## One function the app calls
```js
const { generateIllustration } = require('./_lib/generate.js');
const result = await generateIllustration(orderRow);
// -> { provider, model, prompt, imageBuffer, mimeType, costCents, ms }
```
`imageBuffer` is the **raw** AI image — no text. Name/number/school are
composited later (step 4). The AI never renders text.

## Swapping providers
Precedence: **per-style override** (`config/styles.js` → `provider`) →
**global env** (`GENERATION_PROVIDER`) → **`mock`**.

So you can point one style at OpenAI and another at Replicate while testing,
or flip the whole site with a single env var. No app code changes.

## Providers
- `mock` — deterministic local PNG, zero cost/network. Default. Build & test on this.
- `openai` — GPT-Image via Images API. Needs `OPENAI_API_KEY`.
- `replicate` — Flux et al. Needs `REPLICATE_API_TOKEN`; model per-style or `REPLICATE_MODEL`.

Add another provider by dropping a file in `providers/` and registering it
in `generate.js`. Nothing else changes.

## Cost tracking
Each provider returns `costCents`; it's logged to `generation_jobs.cost_cents`
so you can watch API spend against the $55 price as you test models.
