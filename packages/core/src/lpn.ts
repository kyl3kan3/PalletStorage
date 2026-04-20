import { customAlphabet } from "nanoid";

// Crockford-ish alphabet: no 0/O/1/I/L to avoid misreads on printed labels.
// Code128 renders these fine, and the resulting codes are case-insensitive-safe.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const LENGTH = 10;

const gen = customAlphabet(ALPHABET, LENGTH);

/** Generate a License Plate Number for a pallet. Prefixed with "P-". */
export function generateLPN(): string {
  return `P-${gen()}`;
}

/** Generate a location label code. Prefixed with "L-". */
export function generateLocationCode(): string {
  return `L-${gen()}`;
}

const LPN_RE = /^P-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{10}$/;
const LOC_RE = /^L-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{10}$/;

export function isLPN(s: string): boolean {
  return LPN_RE.test(s);
}
export function isLocationCode(s: string): boolean {
  return LOC_RE.test(s);
}

export type LabelRef =
  | { kind: "pallet"; code: string }
  | { kind: "location"; code: string }
  | { kind: "unknown"; code: string };

export function classifyCode(raw: string): LabelRef {
  const code = raw.trim().toUpperCase();
  if (isLPN(code)) return { kind: "pallet", code };
  if (isLocationCode(code)) return { kind: "location", code };
  return { kind: "unknown", code };
}
