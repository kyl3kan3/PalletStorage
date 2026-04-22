/**
 * Pack-hierarchy conversions. Order lines can be entered in any of
 * {each, case, pallet}; downstream logic (receiving comparisons, pick
 * allocation) runs in eaches, so we convert via the product's own
 * unitsPerCase + casesPerPallet.
 *
 * Both pack fields are `NOT NULL DEFAULT 1`, so the worst case — a
 * product with no packaging config — reduces to an each-only product
 * and the math is a no-op.
 */

export type QtyUnit = "each" | "case" | "pallet";

export interface PackHierarchy {
  unitsPerCase?: number | null;
  casesPerPallet?: number | null;
}

export function toEaches(qty: number, unit: QtyUnit, product: PackHierarchy): number {
  const upc = Math.max(1, product.unitsPerCase ?? 1);
  const cpp = Math.max(1, product.casesPerPallet ?? 1);
  switch (unit) {
    case "each":
      return qty;
    case "case":
      return qty * upc;
    case "pallet":
      return qty * upc * cpp;
  }
}

export function qtyUnitLabel(unit: QtyUnit, plural = true): string {
  switch (unit) {
    case "each":
      return plural ? "items" : "item";
    case "case":
      return plural ? "cases" : "case";
    case "pallet":
      return plural ? "pallets" : "pallet";
  }
}
