/* ===========================================================
   DRAFTED APPAREL — Pricing (server-authoritative)
   Bulk tiers computed here, never trusted from the client.
   Same SKU + same design only (enforced: one style per order).
   =========================================================== */

// Base price by garment type, in cents.
const GARMENT_PRICE_CENTS = {
  tshirt: 5500,
  // hoodie: TBD — add when owner confirms
};

// Bulk tiers by quantity (per-unit cents). Highest matching min wins.
const BULK_TIERS = [
  { minQty: 1, unitCents: 5500 },
  { minQty: 2, unitCents: 5000 },
  { minQty: 4, unitCents: 4500 },
];

function unitPriceCents(garmentType, quantity) {
  const q = Math.max(1, parseInt(quantity, 10) || 1);
  // Garment base (only tshirt for now); fall back to tshirt if unknown.
  const base = GARMENT_PRICE_CENTS[garmentType] || GARMENT_PRICE_CENTS.tshirt;
  // Apply bulk tier (tiers are defined against the tshirt price;
  // when hoodies arrive, switch to percentage tiers off `base`).
  let tier = BULK_TIERS[0];
  for (const t of BULK_TIERS) if (q >= t.minQty) tier = t;
  // If base differs from tshirt, keep the discount delta consistent:
  const discountDelta = GARMENT_PRICE_CENTS.tshirt - tier.unitCents;
  return Math.max(0, base - discountDelta);
}

function quote(garmentType, quantity) {
  const q = Math.max(1, parseInt(quantity, 10) || 1);
  const unit = unitPriceCents(garmentType, q);
  return { quantity: q, unitCents: unit, totalCents: unit * q };
}

module.exports = { quote, unitPriceCents, GARMENT_PRICE_CENTS, BULK_TIERS };
