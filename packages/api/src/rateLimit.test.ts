import { afterEach, describe, expect, it } from "vitest";
import { rateLimit, __resetRateLimit } from "./rateLimit";

afterEach(() => __resetRateLimit());

describe("rateLimit", () => {
  it("allows up to `max` requests inside the window", () => {
    for (let i = 0; i < 5; i++) {
      expect(() => rateLimit("k", { max: 5, windowMs: 60_000 })).not.toThrow();
    }
  });

  it("throws TOO_MANY_REQUESTS once the bucket is exhausted", () => {
    for (let i = 0; i < 3; i++) rateLimit("k", { max: 3, windowMs: 60_000 });
    expect(() => rateLimit("k", { max: 3, windowMs: 60_000 })).toThrow(/Rate limit exceeded/);
  });

  it("isolates keys", () => {
    for (let i = 0; i < 3; i++) rateLimit("a", { max: 3, windowMs: 60_000 });
    expect(() => rateLimit("b", { max: 3, windowMs: 60_000 })).not.toThrow();
  });

  it("isolates the openai per-org bucket from the default one", () => {
    // The customer.parseInventorySheet path uses `openai:<orgId>` as its
    // key with a 20/min cap. Hitting that cap must not spill into another
    // org's bucket or into unrelated procedures.
    for (let i = 0; i < 20; i++) {
      rateLimit("openai:org-a", { max: 20, windowMs: 60_000 });
    }
    expect(() => rateLimit("openai:org-a", { max: 20, windowMs: 60_000 })).toThrow(
      /Rate limit exceeded/,
    );
    expect(() => rateLimit("openai:org-b", { max: 20, windowMs: 60_000 })).not.toThrow();
    expect(() => rateLimit("user:org-a-user", { max: 600, windowMs: 60_000 })).not.toThrow();
  });
});
