/* ===========================================================
   DRAFTED APPAREL — Generation Adapter
   -----------------------------------------------------------
   ONE entry point the whole app calls: generateIllustration().
   Providers live behind it. Swapping OpenAI <-> Replicate <-> mock
   is an env var (or a per-style override in config/styles.js).

   The rest of the system NEVER imports a provider directly.
   This is the seam that protects you while you test models.
   =========================================================== */

const { getStyle, buildPrompt } = require('../../../config/styles.js');
const { downloadBuffer, BUCKETS } = require('./supabase.js');

// Provider registry. Add new providers here; nothing else changes.
const providers = {
  mock:     require('./providers/mock.js'),
  openai:   require('./providers/openai.js'),
  replicate:require('./providers/replicate.js'),
};

/**
 * Resolve which provider to use for a given style.
 * Precedence: per-style override (config) -> global env -> 'mock'.
 */
function resolveProvider(style) {
  const name =
    (style && style.provider) ||
    process.env.GENERATION_PROVIDER ||
    'mock';
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Unknown generation provider: "${name}". Available: ${Object.keys(providers).join(', ')}`);
  }
  return { name, provider };
}

/**
 * generateIllustration
 * The single function the app uses.
 *
 * @param {object} order  - row from `orders` (style_key, sport, etc.)
 * @param {object} [opts] - { signal, attemptNo }
 * @returns {Promise<{
 *   provider: string, model: string, prompt: string,
 *   imageBuffer: Buffer, mimeType: string, costCents: number
 * }>}
 *
 * NOTE: returns the RAW image (no text). Text overlay is a separate
 * step (step 4) — the AI never renders name/number/school.
 */
async function generateIllustration(order, opts = {}) {
  const style = getStyle(order.style_key);
  if (!style) throw new Error(`Unknown style_key: "${order.style_key}"`);
  if (!style.enabled) throw new Error(`Style "${order.style_key}" is disabled`);

  const { name: providerName, provider } = resolveProvider(style);
  const prompt = buildPrompt(style, order);
  const model = style.model || provider.defaultModel || 'default';

  // For image-to-image providers, fetch the customer's uploaded photo so the
  // provider can transform THEIR athlete (not generate a random one).
  let sourceImageBuffer = null;
  if (order.source_photo_path) {
    try {
      sourceImageBuffer = await downloadBuffer(BUCKETS.source, order.source_photo_path);
    } catch (e) {
      throw new Error(`Could not load source photo (${order.source_photo_path}): ${e.message}`);
    }
  }

  // Optional per-style illustration reference (STYLE guidance only — never the
  // subject). Lives in a private Supabase bucket; loaded like the customer photo,
  // and appended AFTER it by the provider so the customer's face always wins.
  let styleReferenceBuffer = null;
  if (style.styleReference) {
    try {
      styleReferenceBuffer = await downloadBuffer(BUCKETS.styleRefs, style.styleReference);
    } catch (e) {
      // Non-fatal: if the reference can't load, fall back to text-only styling.
      console.error(`Style reference load failed (${style.styleReference}): ${e.message}`);
    }
  }

  const started = Date.now();
  const result = await provider.generate({
    prompt,
    negativePrompt: style.negativePrompt || '',
    model,
    style,
    order,
    sourceImageBuffer,
    styleReferenceBuffer,
    signal: opts.signal,
  });

  return {
    provider: providerName,
    model: result.model || model,
    prompt,
    imageBuffer: result.imageBuffer,
    mimeType: result.mimeType || 'image/png',
    costCents: typeof result.costCents === 'number' ? result.costCents : 0,
    ms: Date.now() - started,
  };
}

module.exports = { generateIllustration, resolveProvider, providers };
