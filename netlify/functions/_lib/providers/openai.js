/* OpenAI image generation provider (GPT-Image).
   Activates only when GENERATION_PROVIDER=openai and OPENAI_API_KEY is set.
   Uses the Images API. Returns a raw PNG buffer (no text). */

const DEFAULT_MODEL = 'gpt-image-1';

// Rough cost estimate per image for margin tracking (cents).
// Tune to your actual plan/size. 1024x1024 standard ~ a few cents.
const COST_CENTS = Number(process.env.OPENAI_IMAGE_COST_CENTS || 4);

module.exports = {
  defaultModel: DEFAULT_MODEL,
  async generate({ prompt, model, signal }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        prompt,
        n: 1,
        size: '1024x1024',
        // gpt-image-1 returns b64 by default in `data[].b64_json`
      }),
      signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`OpenAI image error ${res.status}: ${detail.slice(0, 500)}`);
    }

    const json = await res.json();
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) throw new Error('OpenAI returned no image data');

    return {
      model: model || DEFAULT_MODEL,
      imageBuffer: Buffer.from(b64, 'base64'),
      mimeType: 'image/png',
      costCents: COST_CENTS,
    };
  }
};
