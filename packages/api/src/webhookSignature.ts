import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify an Intuit (QuickBooks Online) webhook signature.
 *
 * Intuit signs the raw request body with HMAC-SHA256 keyed by the Verifier
 * Token from the dev dashboard, and sends the result base64-encoded in the
 * `intuit-signature` header. The signature is compared constant-time so we
 * don't leak how many bytes matched via response timing.
 *
 * Returns true on match, false otherwise. The caller is responsible for the
 * 401 response and for skipping JSON parsing on failure (so unsigned garbage
 * can't DoS the parser).
 */
export function verifyIntuitSignature(
  rawBody: string,
  header: string | null | undefined,
  token: string,
): boolean {
  if (!header) return false;
  const expected = createHmac("sha256", token).update(rawBody, "utf8").digest("base64");
  return safeEqual(expected, header);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
