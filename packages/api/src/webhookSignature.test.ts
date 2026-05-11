import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyIntuitSignature } from "./webhookSignature";

const token = "test-verifier-token";
const body = '{"eventNotifications":[{"realmId":"123","dataChangeEvent":{"entities":[]}}]}';

function sign(b: string, t: string): string {
  return createHmac("sha256", t).update(b, "utf8").digest("base64");
}

describe("verifyIntuitSignature", () => {
  it("accepts a correctly signed body", () => {
    expect(verifyIntuitSignature(body, sign(body, token), token)).toBe(true);
  });

  it("rejects a missing header", () => {
    expect(verifyIntuitSignature(body, null, token)).toBe(false);
    expect(verifyIntuitSignature(body, undefined, token)).toBe(false);
    expect(verifyIntuitSignature(body, "", token)).toBe(false);
  });

  it("rejects a modified body", () => {
    const sig = sign(body, token);
    expect(verifyIntuitSignature(body + " ", sig, token)).toBe(false);
  });

  it("rejects a modified signature", () => {
    const sig = sign(body, token);
    const tampered = sig.slice(0, -2) + (sig.endsWith("AA") ? "BB" : "AA");
    expect(verifyIntuitSignature(body, tampered, token)).toBe(false);
  });

  it("rejects a length-mismatched signature without throwing", () => {
    expect(verifyIntuitSignature(body, "too-short", token)).toBe(false);
  });

  it("rejects when signed with the wrong token", () => {
    expect(verifyIntuitSignature(body, sign(body, "other-token"), token)).toBe(false);
  });
});
