/**
 * Pure helpers for turning codes into printable label data.
 * Actual PDF rendering lives in apps/web using @react-pdf/renderer.
 */

export interface PalletLabelData {
  code: string; // LPN e.g. "P-AB23CDEFGH"
  organizationName: string;
  warehouseCode: string;
  createdAt: Date;
}

export interface LocationLabelData {
  code: string;
  path: string; // human-readable e.g. "A-03-02-1"
  warehouseCode: string;
}

/** Encode a short code as a Code128-compatible string (just strips whitespace). */
export function toCode128(code: string): string {
  return code.trim().toUpperCase();
}

/** Build the QR payload — a URL-like string the mobile app deep-links. */
export function toQrPayload(kind: "pallet" | "location", code: string): string {
  return `wms://${kind}/${encodeURIComponent(code)}`;
}
