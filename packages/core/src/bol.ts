import { customAlphabet } from "nanoid";

// Same Crockford-ish alphabet as LPN. BOL numbers are printed big on the
// BOL PDF; we want them unambiguous under fluorescent warehouse lighting.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const LENGTH = 8;
const gen = customAlphabet(ALPHABET, LENGTH);

/** Generate a Bill Of Lading number. Prefixed with "BOL-". */
export function generateBolNumber(): string {
  return `BOL-${gen()}`;
}
