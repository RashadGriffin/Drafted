/* Replicate provider (e.g. Flux and others).
   Activates when GENERATION_PROVIDER=replicate and REPLICATE_API_TOKEN is set.
   Model is set per-style (config/styles.js -> model) or REPLICATE_MODEL env.
   Polls the prediction until complete, downloads the resulting image. */

const COST_CENTS = Number(process.env.REPLICATE_IMAGE_COST_CENTS || 3);

module.exports = {
  defaultModel: process.env.REPLICATE_MODEL || 'black-forest-labs/flux-schnell',
  async generate({ prompt, negativePrompt, model, signal }) {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) throw new Error('REPLICATE_API_TOKEN is not set');
    const useModel = model || this.defaultModel;

    // Create prediction
    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait',   // ask Replicate to hold the connection if it can
      },
      body: JSON.stringify({
        // For official models you can pass "version" or use the model route.
        // Using the generic input contract common to text-to-image models:
        model: useModel,
        input: {
          prompt,
          ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
          num_outputs: 1,
          aspect_ratio: '1:1',
          output_format: 'png',
        },
      }),
      signal,
    });

    if (!createRes.ok) {
      const detail = await createRes.text().catch(() => '');
      throw new Error(`Replicate create error ${createRes.status}: ${detail.slice(0, 500)}`);
    }

    let pred = await createRes.json();

    // Poll until terminal state (if "wait" didn't already finish it)
    const deadline = Date.now() + 60_000;
    while (pred.status && !['succeeded','failed','canceled'].includes(pred.status)) {
      if (Date.now() > deadline) throw new Error('Replicate prediction timed out');
      await new Promise(r => setTimeout(r, 1500));
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }, signal,
      });
      pred = await poll.json();
    }

    if (pred.status !== 'succeeded') {
      throw new Error(`Replicate prediction ${pred.status}: ${JSON.stringify(pred.error||'').slice(0,300)}`);
    }

    // output is usually an array of URLs
    const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    if (!url) throw new Error('Replicate returned no output URL');

    const imgRes = await fetch(url, { signal });
    if (!imgRes.ok) throw new Error(`Failed to download Replicate image: ${imgRes.status}`);
    const arrayBuf = await imgRes.arrayBuffer();

    return {
      model: useModel,
      imageBuffer: Buffer.from(arrayBuf),
      mimeType: 'image/png',
      costCents: COST_CENTS,
    };
  }
};
