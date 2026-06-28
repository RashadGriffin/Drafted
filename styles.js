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
  "streetwear-sticker": {
    key: "streetwear-sticker",
    name: "Streetwear Sticker",
    enabled: true,
    tagline: "Bold die-cut sticker look.",
    description:
      "A premium streetwear sticker-style illustration: clean cel-shaded subject with a thick white outline and bold black contour. The most reliable, versatile style — works for single athletes, groups, and family photos.",

    // Option A: the AI renders the FULL sticker, including the white outline +
    // black contour + sticker edge. The template engine therefore should NOT
    // add its own outline for this style (would double up). The engine's role
    // here is placement + nameplate only.
    aiOwnsOutline: true,

    provider: null,
    model: null,

    // Prompt as authored. {{sport}} etc. tokens still fill from order data,
    // but this prompt is written to operate primarily on the uploaded photo.
    promptTemplate:
      "Transform the subject in the uploaded photo into a bold streetwear sticker-style graphic for apparel printing. " +
      "Preserve the subject's facial identity, hairstyle, expression, pose, body proportions, clothing or uniform silhouette, and any important handheld gear or accessories. " +
      "If the uploaded photo contains multiple people, preserve all subjects, their relative positions, their scale relationships, and the overall group composition. Keep the arrangement clean and readable. " +
      "Create a premium modern sticker-style illustration with a thick clean white outer outline around the full subject silhouette, plus a strong black outer contour line for extra separation and impact. " +
      "Use smooth cel shading, simplified color blocking, crisp edges, strong black contour lines, and a clean 2D illustrated look. Keep the style bold, graphic, and apparel-ready. " +
      "Reduce photographic realism. Reduce skin texture, fabric texture, tiny wrinkles, micro-details, and visual noise. Simplify shading and highlights into cleaner graphic shapes. Use limited gradients and controlled color transitions. " +
      "Keep faces recognizable but slightly simplified. Render facial features cleanly and clearly with smoother lines and less tiny detail. Avoid jagged facial lines or rough sketch texture. " +
      "Maintain accurate clothing colors, major uniform details, visible jersey numbers, key team lettering, and major accessory shapes, but simplify or omit tiny logos, tiny text, tiny patterns, and tiny equipment details if needed. " +
      "Preserve important sports gear that helps the composition, such as helmets, bats, balls, gloves, or similar objects, if they are part of the pose. " +
      "Keep the artwork isolated and centered. Transparent background. " +
      "No background scenery. No extra environmental elements. No extra graphics. No borders beyond the sticker outline. No frame. No random effects. No drop shadow unless it is subtle and integrated into the sticker edge. " +
      "Print-ready apparel illustration.",

    negativePrompt:
      "background scenery, environment, frame, border beyond sticker outline, extra graphics, busy background, " +
      "photographic noise, heavy texture, rough sketch lines, watermark, signature, added text or lettering not present in the original photo",

    // Name/number/school are still added programmatically AFTER generation.
    // (The AI keeps real jersey numbers already on the uniform; this overlay
    // adds the display nameplate — they don't conflict.)
    textOverlay: {
      enabled: true,
      name:   { show: true, xPct: 0.5, yPct: 0.88, maxChars: 18, align: "center", font: "BarlowCondensed-Bold", sizePct: 0.08, color: "#111111", uppercase: true },
      number: { show: false, xPct: 0.5, yPct: 0.74, maxChars: 2, align: "center", font: "BarlowCondensed-Bold", sizePct: 0.16, color: "#111111", uppercase: true },
      school: { show: true, xPct: 0.5, yPct: 0.94, maxChars: 28, align: "center", font: "Inter-Medium", sizePct: 0.034, color: "#555555", uppercase: true }
    }
  },

  // ----------------------------------------------------------
  "big-head": {
    key: "big-head",
    name: "Big Head",
    enabled: true,
    tagline: "Arcade big-head mode, premium finish.",
    description:
      "A clean 2D comic-style illustration with a classic arcade-game 'big head mode' twist — head playfully enlarged, body athletic, face kept realistic and mature. Fun without being childish.",

    // The AI renders the full illustrated character (head exaggeration is a
    // generation-time transform of the subject). The template engine handles
    // placement + nameplate; it does not redraw the figure.
    aiOwnsOutline: true,

    provider: null,
    model: null,

    // Prompt as authored. Operates on the uploaded photo (image input).
    promptTemplate:
      "Transform the subject in the uploaded photo into a clean 2D comic-style sports illustration with a modern arcade-game feel. " +
      "Preserve the subject's facial identity, expression, hairstyle, pose, uniform, sports gear, and body proportions. " +
      "Create a stylized \"big head mode\" character design inspired by classic arcade sports games, with the head intentionally enlarged for a fun exaggerated look, while keeping the body smaller and athletic. " +
      "Important: keep the head enlargement clean and natural. The neck must remain anatomically correct and should not enlarge with the head. Maintain a smooth, believable transition from jaw to neck to shoulders. Do not make the neck oversized, swollen, stretched, or distorted. " +
      "Keep the face more realistic and mature-looking. Preserve the subject's natural facial structure, including jawline, cheekbones, chin shape, nose shape, and mouth shape. Avoid baby-like, chibi-like, or toddler-like facial proportions. " +
      "The head should be enlarged, but the facial features should remain closer to realistic teen or adult proportions. Do not make the eyes oversized, the cheeks overly round, the forehead excessively bulbous, or the face overly soft and childlike. " +
      "Use bold outlines, smooth cel shading, crisp edges, simplified details, and clean graphic shapes. Keep the illustration premium, apparel-ready, and easy to read. " +
      "Keep the face recognizable and clean. Use slightly more realistic facial rendering with defined structure and less exaggerated cuteness. Do not fully pixelate the face. Use simplified facial detail with smooth contour transitions and controlled shading. " +
      "Maintain accurate uniform colors and major uniform details. Preserve important jersey elements exactly, including the team name or major chest lettering, jersey number, and clearly visible uniform design features. If the uniform contains prominent readable text such as a team name, recreate that text clearly and accurately. Only simplify or omit tiny brand marks, tiny patch text, tiny accessory text, and very small secondary details if needed. " +
      "Transparent background. No background. No text outside of the original uniform text. No extra graphics. No borders. No frame. No random effects. Print-ready apparel illustration.",

    negativePrompt:
      "chibi, toddler proportions, baby face, oversized eyes, swollen neck, distorted neck, " +
      "background scenery, frame, border, extra graphics, added text not on the original uniform, " +
      "watermark, signature, busy background, heavy photographic texture",

    // Name/number/school added programmatically AFTER generation (the AI keeps
    // real uniform text/numbers; this overlay adds the display nameplate).
    textOverlay: {
      enabled: true,
      name:   { show: true, xPct: 0.5, yPct: 0.90, maxChars: 18, align: "center", font: "BarlowCondensed-Bold", sizePct: 0.08, color: "#111111", uppercase: true },
      number: { show: false, xPct: 0.5, yPct: 0.76, maxChars: 2, align: "center", font: "BarlowCondensed-Bold", sizePct: 0.16, color: "#111111", uppercase: true },
      school: { show: true, xPct: 0.5, yPct: 0.95, maxChars: 28, align: "center", font: "Inter-Medium", sizePct: 0.034, color: "#555555", uppercase: true }
    }
  },

  // ----------------------------------------------------------
  "big-head": {
    key: "big-head",
    name: "Big Head",
    enabled: true,
    tagline: "Arcade big-head mode.",
    description:
      "A clean 2D comic-style illustration with a modern arcade-game feel — the head playfully enlarged in classic 'big head mode' while the face stays realistic and mature. Bold outlines, smooth cel shading, apparel-ready.",

    // AI renders the full illustrated character (subject only, transparent bg).
    // Outline is part of the comic style itself; engine handles placement + nameplate.
    aiOwnsOutline: true,

    provider: null,
    model: null,
    // styleReference: 'big-head.png', // DISABLED: a 2nd input image was contaminating likeness on athlete photos (aged/morphed the face, drifted the pose). Re-enable only with a neutral, NON-athlete reference.

    promptTemplate:
      "Transform the person in the photo into a premium, polished 2D comic-style illustration with a big-head caricature look — clean bold black outlines, smooth airbrushed cel shading with soft gradients and glossy highlights, subtle rim lighting, and rich saturated color. This must be unmistakably the SAME person in the photo. " +
      "Preserve their likeness exactly: facial identity and structure (jawline, cheekbones, chin, nose, mouth, eyes, eyebrows), skin tone, hair color and style, and expression. Preserve their APPARENT AGE precisely — if the person is a child or teenager, they must still clearly look like that same child or teenager. Do NOT age them up: do not harden or mature the face, do not add adult musculature, facial lines, stubble, or a heavier jaw. Keep them looking their real age. " +
      "Reproduce what they are actually wearing and holding exactly as in the photo: their real clothing, uniform, colors, and any visible team name, logo, number, text, or equipment — faithfully, without inventing or changing anything. Keep their pose, body position, and framing/crop the same as in the photo. " +
      "Big-head transform: enlarge the head for a fun caricature proportion while keeping the body smaller and proportional, with a build appropriate to the person's real age — not a muscular adult body unless that is genuinely how they look. Keep the neck anatomically correct — do not enlarge, swell, stretch, or distort it; keep a smooth jaw-to-neck-to-shoulders transition. Avoid chibi, baby, or toddler proportions and oversized eyes. The face must be an accurate, flattering likeness of THIS specific person at THIS age. " +
      "Do not invent or add any clothing, uniform, team, league, sport, logo, number, lettering, equipment, prop, person, or background that is not actually present in the photo. Restyle only what is truly there. " +
      "Composition: show the ENTIRE character fully inside the frame with generous empty margin on every side. The complete head and all of the hair must be fully visible with clear padding above the top of the head — never crop or cut off the head, hair, hands, feet, or any edge of the figure. Center the subject with comfortable headroom and do not zoom in tightly. " +
      "Transparent background. No background. No added text beyond text genuinely visible on the person's own clothing. No borders, no frame, no extra effects. Print-ready apparel illustration.",

    negativePrompt:
      "invented uniform, fabricated jersey, made-up team name, made-up jersey number, added sports equipment not in the photo, changed or replaced clothing, " +
      "chibi, baby face, toddler proportions, oversized eyes, swollen neck, stretched neck, distorted neck, bulbous forehead, overly round cheeks, childlike softness, " +
      "background scenery, frame, border, extra graphics, added text not on the original clothing, watermark, signature, busy background, heavy photographic texture",

    // Name/number/school still added programmatically after generation.
    // Number overlay off by default — the jersey number from the photo is preserved by the AI.
    textOverlay: {
      enabled: true,
      name:   { show: true, xPct: 0.5, yPct: 0.88, maxChars: 18, align: "center", font: "BarlowCondensed-Bold", sizePct: 0.08, color: "#111111", uppercase: true },
      number: { show: false, xPct: 0.5, yPct: 0.74, maxChars: 2, align: "center", font: "BarlowCondensed-Bold", sizePct: 0.16, color: "#111111", uppercase: true },
      school: { show: true, xPct: 0.5, yPct: 0.94, maxChars: 28, align: "center", font: "Inter-Medium", sizePct: 0.034, color: "#555555", uppercase: true }
    }
  },

  // ----------------------------------------------------------
  "minimal": {
    key: "minimal",
    name: "Minimal",
    enabled: true,
    tagline: "Minimalist flat vector.",
    description:
      "A minimalist flat-vector sports illustration — solid color blocking, simple clean outlines, very little shading, minimal facial detail. Full-body, centered, modern graphic-poster feel that reproduces consistently.",

    // Transparent subject — the shirt fabric is the background, so no
    // baked-in backdrop. Composites cleanly like the other styles.
    aiOwnsOutline: true,
    transparentSubject: true,

    provider: null,
    model: null,

    promptTemplate:
      "Transform the subject in the uploaded photo into a minimalist flat vector sports illustration. " +
      "Preserve the subject's overall identity through hairstyle, facial hair if visible, skin tone, body type, pose, uniform type, and sports equipment, but render the subject in a highly simplified graphic style. " +
      "Create a clean flat-color vector character with very minimal facial detail, simple black line accents, smooth edges, and simplified anatomy. Use solid color blocking, subtle shape-based shading only where needed, and a clean modern sports graphic look. " +
      "Keep the figure full-body and fully visible from head to toe. Maintain a clean upright athletic pose or a natural action pose based on the reference photo. Preserve the sport-specific posture and major equipment. " +
      "Important style rules: Use a minimalist flat illustration style. Use simple clean outlines. Use mostly solid fills with little or no texture. Use very limited shading. Keep facial features minimal and simplified. Do not make the face realistic. Do not use painterly rendering. Do not use comic-book crosshatching. Do not use 3D rendering. Do not use heavy gradients. Do not use detailed fabric texture. Do not use photorealistic lighting. " +
      "Uniform rules: Preserve the subject's sport, uniform type, and main uniform colors. Preserve major visible uniform elements such as large jersey numbers, major team lettering, and clear color blocking. Simplify or omit tiny logos, tiny text, tiny patches, and tiny accessory details if needed. Keep shoes, socks, and sports gear simplified but recognizable. " +
      "Composition rules: Show the entire subject as a full-body character. Center the subject. Keep the proportions clean and readable. Add a simple flat oval shadow beneath the feet if needed. Keep the design clean and isolated. " +
      "Background rules: Transparent background. No background color, no backdrop, no realistic environment, no clutter. No extra props unless visible and important in the source image. The illustration will be printed on apparel, so the garment itself serves as the background. " +
      "Output style: modern minimalist sports vector illustration, apparel-ready, clean graphic poster feel, simple, bold, and easy to reproduce consistently.",

    negativePrompt:
      "photorealism, painterly rendering, comic crosshatching, 3D rendering, heavy gradients, " +
      "detailed fabric texture, photorealistic lighting, realistic face, busy background, clutter, " +
      "extra props, watermark, signature, added text not on the original uniform",

    textOverlay: {
      enabled: true,
      name:   { show: true, xPct: 0.5, yPct: 0.88, maxChars: 18, align: "center", font: "BarlowCondensed-Bold", sizePct: 0.08, color: "#111111", uppercase: true },
      number: { show: false, xPct: 0.5, yPct: 0.74, maxChars: 2, align: "center", font: "BarlowCondensed-Bold", sizePct: 0.16, color: "#111111", uppercase: true },
      school: { show: true, xPct: 0.5, yPct: 0.94, maxChars: 28, align: "center", font: "Inter-Medium", sizePct: 0.034, color: "#555555", uppercase: true }
    }
  },

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

  // Append team-color guidance for the BACKGROUND + TEXT only.
  // (TeamColors lives in config/teamColors.js; required lazily so this
  // file stays usable even where the color module isn't present.)
  if (order.primary_color_hex || order.primaryHex) {
    try {
      const TC = require('./teamColors.js');
      const hint = TC.promptHint({
        primaryColorName:   order.primary_color_name   || order.primaryColorName,
        secondaryColorName: order.secondary_color_name || order.secondaryColorName,
      });
      if (hint) p += ' ' + hint;
    } catch (_) { /* color module optional */ }
  }
  // Customer revision request (from the proof page "Regenerate" feedback).
  // Applies only to the regeneration it was submitted for. Phrased as a
  // targeted revision so the model adjusts rather than starting over.
  const fb = (order.regen_feedback || '').trim();
  if (fb) {
    p += ' IMPORTANT REVISION REQUEST from the customer for this new version — ' +
         'apply these changes while keeping everything else faithful to the original photo: ' +
         fb;
  }

  return p;
}

module.exports = { STYLES, enabledStyles, getStyle, buildPrompt };
