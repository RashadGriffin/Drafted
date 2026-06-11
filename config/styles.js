/* ===========================================================
   DRAFTED APPAREL — Style Configuration
   -----------------------------------------------------------
   Styles are DATA, not code. While you test which AI model best
   replicates each look, you change things HERE — never in the
   generation logic, product pages, or proof flow.

   Each style controls:
     - its customer-facing name + copy
     - which generation provider/model it targets (per-style override)
     - the prompt template fed to the model
     - the programmatic text-overlay spec (name / number / school)
       applied AFTER generation — AI never renders text.

   These prompts are IP. They live in the repo (version-controlled),
   NOT in the public Decap CMS.
   =========================================================== */

const STYLES = {
  // ----------------------------------------------------------
  "sketch-series": {
    key: "sketch-series",
    name: "Sketch Series",
    enabled: true,
    tagline: "Loose line art with color pops.",
    description:
      "Dynamic action poses in loose, expressive line art with bold color pops. Engineered so minor variation reads as artistic intent.",

    // Per-style provider override. null = use global default from env.
    provider: null,          // 'openai' | 'replicate' | 'mock' | null
    model: null,             // e.g. 'gpt-image-1' or a replicate model id

    // Prompt template. {{tokens}} are filled from order data at runtime.
    // NOTE: deliberately upper-body / three-quarter to play to AI strengths.
    promptTemplate:
      "Loose energetic sketch-style illustration of a {{sport}} athlete, " +
      "upper body / three-quarter pose, expressive hand-drawn line art with " +
      "selective bold color pops on a clean transparent-friendly background. " +
      "Dynamic, confident, premium sports-merch aesthetic. No text, no lettering, " +
      "no numbers anywhere in the image.",

    negativePrompt:
      "text, letters, words, numbers, watermark, signature, jersey lettering, busy background",

    // Programmatic text overlay spec (applied to the generated image).
    // Coordinates are fractions (0..1) of the composited canvas.
    textOverlay: {
      enabled: true,
      name:   { show: true, xPct: 0.5, yPct: 0.84, maxChars: 18, align: "center", font: "BarlowCondensed-Bold", sizePct: 0.075, color: "#111111", uppercase: true },
      number: { show: true, xPct: 0.5, yPct: 0.70, maxChars: 2,  align: "center", font: "BarlowCondensed-Bold", sizePct: 0.20,  color: "#FF9500", uppercase: true },
      school: { show: true, xPct: 0.5, yPct: 0.90, maxChars: 28, align: "center", font: "Inter-Medium",        sizePct: 0.035, color: "#555555", uppercase: true }
    }
  },

  // ----------------------------------------------------------
  "pixel-series": {
    key: "pixel-series",
    name: "Pixel Series",
    enabled: true,
    tagline: "Clean 8-bit portrait style.",
    description:
      "An 8-bit pixel portrait. The pixel grid naturally absorbs AI inconsistency, giving reliable, repeatable results.",

    provider: null,
    model: null,

    promptTemplate:
      "Clean 8-bit pixel-art portrait of a {{sport}} athlete, retro 16x16-style " +
      "blocky pixels, limited vibrant palette, centered upper-body composition, " +
      "crisp pixel edges, premium collectible look. No text, no letters, no numbers.",

    negativePrompt:
      "text, letters, words, numbers, smooth gradients, photorealism, blur, watermark",

    textOverlay: {
      enabled: true,
      name:   { show: true, xPct: 0.5, yPct: 0.85, maxChars: 18, align: "center", font: "PressStart2P", sizePct: 0.045, color: "#111111", uppercase: true },
      number: { show: true, xPct: 0.5, yPct: 0.68, maxChars: 2,  align: "center", font: "PressStart2P", sizePct: 0.13,  color: "#FF9500", uppercase: true },
      school: { show: true, xPct: 0.5, yPct: 0.92, maxChars: 24, align: "center", font: "PressStart2P", sizePct: 0.028, color: "#555555", uppercase: true }
    }
  },

  // ----------------------------------------------------------
  "clean-series": {
    key: "clean-series",
    name: "Clean Series",
    enabled: true,
    tagline: "Minimalist figure, oversized number.",
    description:
      "A minimalist illustrated silhouette against a large jersey number. Minimal face detail required, so AI stays consistent.",

    provider: null,
    model: null,

    promptTemplate:
      "Minimalist single-color silhouette illustration of a {{sport}} athlete in a " +
      "dynamic pose, clean flat vector look, lots of negative space, premium modern " +
      "sports poster aesthetic, simple solid background. No text, no letters, no numbers.",

    negativePrompt:
      "text, letters, words, numbers, facial detail, busy background, gradients, watermark",

    // The big number is part of the DESIGN here, so the overlay number is large.
    textOverlay: {
      enabled: true,
      number: { show: true, xPct: 0.5, yPct: 0.5,  maxChars: 2,  align: "center", font: "BarlowCondensed-Bold", sizePct: 0.55, color: "rgba(17,17,17,0.10)", uppercase: true, behind: true },
      name:   { show: true, xPct: 0.5, yPct: 0.88, maxChars: 18, align: "center", font: "BarlowCondensed-Bold", sizePct: 0.07, color: "#111111", uppercase: true },
      school: { show: true, xPct: 0.5, yPct: 0.93, maxChars: 28, align: "center", font: "Inter-Medium",        sizePct: 0.032, color: "#555555", uppercase: true }
    }
  }
};

// Helper: list only enabled styles (used by product grid / shop).
function enabledStyles() {
  return Object.values(STYLES).filter(s => s.enabled);
}

// Helper: safely fetch a style by key.
function getStyle(key) {
  return STYLES[key] || null;
}

// Fill a prompt template with order data.
function buildPrompt(style, order) {
  let p = style.promptTemplate || "";
  const tokens = {
    sport: order.sport || "athlete",
    name: order.athlete_name || "",
    number: order.jersey_number || "",
    school: order.school_team || ""
  };
  for (const [k, v] of Object.entries(tokens)) {
    p = p.replaceAll(`{{${k}}}`, v);
  }
  return p;
}

module.exports = { STYLES, enabledStyles, getStyle, buildPrompt };
