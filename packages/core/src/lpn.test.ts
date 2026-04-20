import { describe, it, expect } from "vitest";
import { generateLPN, generateLocationCode, classifyCode, isLPN } from "./lpn";

describe("LPN", () => {
  it("generates a valid LPN", () => {
    const lpn = generateLPN();
    expect(isLPN(lpn)).toBe(true);
  });

  it("LPNs are unique across a large batch", () => {
    const set = new Set(Array.from({ length: 10_000 }, () => generateLPN()));
    expect(set.size).toBe(10_000);
  });

  it("classifies codes", () => {
    expect(classifyCode(generateLPN()).kind).toBe("pallet");
    expect(classifyCode(generateLocationCode()).kind).toBe("location");
    expect(classifyCode("random").kind).toBe("unknown");
  });
});
