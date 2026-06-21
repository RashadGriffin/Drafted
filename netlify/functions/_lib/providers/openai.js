/* OpenAI image-to-image provider (GPT Image family).
   Activates when GENERATION_PROVIDER=openai and OPENAI_API_KEY is set.

   Uses the IMAGE EDITS endpoint (/v1/images/edits) so the customer's
   uploaded photo is transformed into the illustration — NOT a random
   generation. The source photo is sent as multipart form-data.

   Model is set by OPENAI_IMAGE_MODEL (e.g. 'gpt-image-1', 'gpt-image-1.5',
   'gpt-image-2', etc.) so you can pick whatever your account supports
   without a code change. Returns a raw PNG buffer (no text overlay). */

const DEFAULT_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const COST_CENTS = Number(process.env.OPENAI_IMAGE_COST_CENTS || 5);
const SIZE = process.env.OPENAI_IMAGE_SIZE || '1024x1024';

module.exports = {
  defaultModel: DEFAULT_MODEL,
  async generate({ prompt, model, sourceImageBuffer, signal }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
    if (!sourceImageBuffer) throw new Error('No source photo provided for image-to-image generation');

    const useModel = model || DEFAULT_MODEL;

    // Build multipart form: image[] (the customer photo) + prompt + model.
    const form = new FormData();
    const blob = new Blob([sourceImageBuffer], { type: 'image/png' });
    form.append('image[]', blob, 'source.png');
    form.append('prompt', prompt);
    form.append('model', useModel);
    form.append('n', '1');
    form.append('size', SIZE);

    const res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` }, // no Content-Type: fetch sets the multipart boundary
      body: form,
      signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`OpenAI edits error ${res.status}: ${detail.slice(0, 600)}`);
    }

    const json = await res.json();
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) throw new Error('OpenAI returned no image data');

    return {
      model: useModel,
      imageBuffer: Buffer.from(b64, 'base64'),
      mimeType: 'image/png',
      costCents: COST_CENTS,
    };
  },
};
