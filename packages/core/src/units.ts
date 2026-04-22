/**
 * Pure UI label for the qty unit on an order line. Units are
 * independent — "5 pallets" and "5 cases" aren't convertible, they're
 * just two different ways a customer can describe what's on an order.
 * Downstream code compares qtyExpected/qtyReceived numerically without
 * translation.
 */

export type QtyUnit = "each" | "case" | "pallet";

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
