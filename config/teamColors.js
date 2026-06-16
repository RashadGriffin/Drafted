/* ===========================================================
   DRAFTED APPAREL — Team Color System
   -----------------------------------------------------------
   Controlled customization for the DESIGN's background + text
   colors. These colors NEVER touch the athlete illustration —
   the athlete is an extracted subject placed on top.

   Customer chooses Primary + Secondary from named school-color
   swatches (friendly names shown; hex stored). Black and white
   are applied automatically for contrast/legibility where needed
   — the customer does NOT pick an accent.

   AI/owner decides WHERE each color goes per design. This module
   assigns NO fixed roles; it provides the palette + shade
   variations + a prompt hint.

   Runs in browser (window.TeamColors) and Node (module.exports).
   =========================================================== */
(function (root) {
  'use strict';

  const COLORS = [
    { family: 'Red', name: 'Scarlet',  hex: '#C8102E', pairings: ['Athletic Gold','White','Black','Silver'] },
    { family: 'Red', name: 'Cardinal', hex: '#9E1B32', pairings: ['Athletic Gold','White','Navy','Silver'] },
    { family: 'Red', name: 'Crimson',  hex: '#A6192E', pairings: ['White','Athletic Gold','Black','Gray'] },
    { family: 'Red', name: 'Maroon',   hex: '#7A0019', pairings: ['Athletic Gold','White','Black','Silver'] },
    { family: 'Red', name: 'Burgundy', hex: '#6A2A35', pairings: ['Vegas Gold','White','Black','Silver'] },

    { family: 'Blue', name: 'Columbia Blue', hex: '#6CACE4', pairings: ['Navy','White','Black','Silver'] },
    { family: 'Blue', name: 'Royal Blue',    hex: '#1D4ED8', pairings: ['White','Athletic Gold','Safety Orange','Silver'] },
    { family: 'Blue', name: 'Navy',          hex: '#0B1F3A', pairings: ['White','Athletic Gold','Columbia Blue','Silver'] },
    { family: 'Blue', name: 'Powder Blue',   hex: '#9BCBEB', pairings: ['Navy','White','Black','Gray'] },
    { family: 'Blue', name: 'Steel Blue',    hex: '#4682B4', pairings: ['White','Athletic Gold','Black','Silver'] },

    { family: 'Green', name: 'Kelly Green',  hex: '#1B7A3D', pairings: ['White','Athletic Gold','Black','Silver'] },
    { family: 'Green', name: 'Forest Green', hex: '#14452F', pairings: ['White','Athletic Gold','Black','Silver'] },
    { family: 'Green', name: 'Emerald',      hex: '#00925B', pairings: ['White','Metallic Gold','Black','Silver'] },
    { family: 'Green', name: 'Olive',        hex: '#5B6236', pairings: ['Vegas Gold','White','Black','Charcoal'] },

    { family: 'Gold', name: 'Athletic Gold',  hex: '#FDB515', pairings: ['Navy','Black','Royal Blue','White'] },
    { family: 'Gold', name: 'Vegas Gold',     hex: '#C5B358', pairings: ['Black','Maroon','Forest Green','White'] },
    { family: 'Gold', name: 'Metallic Gold',  hex: '#D4AF37', pairings: ['Black','Navy','Emerald','White'] },
    { family: 'Gold', name: 'Bright Yellow',  hex: '#FFD200', pairings: ['Black','Royal Blue','Navy','White'] },

    { family: 'Orange', name: 'Tennessee Orange', hex: '#FF8200', pairings: ['White','Black','Navy','Gray'] },
    { family: 'Orange', name: 'Burnt Orange',     hex: '#BF5700', pairings: ['White','Black','Charcoal','Silver'] },
    { family: 'Orange', name: 'Safety Orange',    hex: '#FF6A13', pairings: ['Navy','Black','White','Royal Blue'] },

    { family: 'Purple', name: 'Royal Purple', hex: '#5C2D91', pairings: ['Athletic Gold','White','Black','Silver'] },
    { family: 'Purple', name: 'Deep Purple',  hex: '#3B1A5C', pairings: ['Metallic Gold','White','Silver','Black'] },
    { family: 'Purple', name: 'Lavender',     hex: '#B57EDC', pairings: ['White','Charcoal','Silver','Black'] },

    { family: 'Neutral', name: 'Black',    hex: '#111111', pairings: ['White','Athletic Gold','Silver','Scarlet'] },
    { family: 'Neutral', name: 'White',    hex: '#F5F5F5', pairings: ['Navy','Black','Scarlet','Royal Blue'] },
    { family: 'Neutral', name: 'Silver',   hex: '#C7CACE', pairings: ['Navy','Black','Maroon','Forest Green'] },
    { family: 'Neutral', name: 'Charcoal', hex: '#36393B', pairings: ['White','Athletic Gold','Silver','Scarlet'] },
    { family: 'Neutral', name: 'Gray',     hex: '#8A8D90', pairings: ['Navy','Black','White','Scarlet'] },
  ];

  const FAMILY_ORDER = ['Red','Blue','Green','Gold','Orange','Purple','Neutral'];
  const byName = {};
  COLORS.forEach(c => { byName[c.name.toLowerCase()] = c; });

  function getColor(name) { return name ? (byName[String(name).toLowerCase()] || null) : null; }
  function byFamily() {
    const out = {}; FAMILY_ORDER.forEach(f => { out[f] = []; });
    COLORS.forEach(c => { (out[c.family] = out[c.family] || []).push(c); });
    return out;
  }
  function suggestSecondary(primaryName) {
    const p = getColor(primaryName); if (!p) return [];
    return (p.pairings || []).map(getColor).filter(Boolean).filter(c => c.name !== p.name);
  }

  function hexToRgb(hex) {
    const h = hex.replace('#',''); const n = h.length===3?h.split('').map(x=>x+x).join(''):h;
    return { r: parseInt(n.slice(0,2),16), g: parseInt(n.slice(2,4),16), b: parseInt(n.slice(4,6),16) };
  }
  function rgbToHex(r,g,b){ const c=v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0'); return '#'+c(r)+c(g)+c(b); }
  function shade(hex,percent){ const {r,g,b}=hexToRgb(hex); if(percent<0){const t=1+percent;return rgbToHex(r*t,g*t,b*t);} return rgbToHex(r+(255-r)*percent,g+(255-g)*percent,b+(255-b)*percent); }
  function rgba(hex,alpha){ const {r,g,b}=hexToRgb(hex); return `rgba(${r},${g},${b},${alpha})`; }
  function isLight(hex){ const {r,g,b}=hexToRgb(hex); return (0.299*r+0.587*g+0.114*b)>150; }
  function variations(hex){ return { base:hex, dark:shade(hex,-0.28), light:shade(hex,0.32), overlay:rgba(hex,0.3) }; }

  function buildPalette(sel) {
    const primary = getColor(sel.primaryColorName);
    const secondary = getColor(sel.secondaryColorName);
    if (!primary) return null;
    const pv = variations(primary.hex);
    const sv = secondary ? variations(secondary.hex) : null;
    return {
      primary:   { name: primary.name, hex: primary.hex, ...pv },
      secondary: secondary ? { name: secondary.name, hex: secondary.hex, ...sv } : null,
      autoInkOnPrimary:   isLight(primary.hex) ? '#111111' : '#FFFFFF',
      autoInkOnSecondary: secondary ? (isLight(secondary.hex) ? '#111111' : '#FFFFFF') : null,
    };
  }

  function selectionOutput(sel) {
    const p = getColor(sel.primaryColorName);
    const s = getColor(sel.secondaryColorName);
    return {
      primaryColorName:   p ? p.name : null,
      primaryHex:         p ? p.hex  : null,
      secondaryColorName: s ? s.name : null,
      secondaryHex:       s ? s.hex  : null,
    };
  }

  function promptHint(sel) {
    const p = getColor(sel.primaryColorName);
    const s = getColor(sel.secondaryColorName);
    if (!p) return '';
    let parts = `${p.name.toLowerCase()} (${p.hex})`;
    if (s) parts += ` and ${s.name.toLowerCase()} (${s.hex})`;
    return `Design background and text colors: ${parts}. Use black or white automatically for contrast and legibility where needed. These colors apply only to the background and any text — do not alter the athlete's own colors or appearance.`;
  }

  const API = { COLORS, FAMILY_ORDER, getColor, byFamily, suggestSecondary, variations, buildPalette, selectionOutput, promptHint, shade, rgba, isLight, hexToRgb };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.TeamColors = API;
})(typeof window !== 'undefined' ? window : globalThis);
