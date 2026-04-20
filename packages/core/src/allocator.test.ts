import { describe, expect, it } from "vitest";
import { allocate } from "./allocator";

const d = (iso: string) => new Date(iso);

describe("allocator — FEFO", () => {
  it("prefers earliest expiry first", () => {
    const result = allocate(10, [
      { key: "late", qty: 20, expiry: d("2030-01-01"), receivedAt: d("2024-01-01") },
      { key: "early", qty: 20, expiry: d("2025-06-01"), receivedAt: d("2024-06-01") },
    ]);
    expect(result.map((r) => r.candidate.key)).toEqual(["early"]);
    expect(result[0]!.take).toBe(10);
  });

  it("spans multiple candidates when one isn't enough", () => {
    const result = allocate(15, [
      { key: "a", qty: 10, expiry: d("2025-01-01"), receivedAt: null },
      { key: "b", qty: 10, expiry: d("2025-06-01"), receivedAt: null },
      { key: "c", qty: 10, expiry: d("2026-01-01"), receivedAt: null },
    ]);
    expect(result.map((r) => [r.candidate.key, r.take])).toEqual([
      ["a", 10],
      ["b", 5],
    ]);
  });

  it("falls through to FIFO when no expiry is set", () => {
    const result = allocate(5, [
      { key: "newer", qty: 10, expiry: null, receivedAt: d("2024-06-01") },
      { key: "older", qty: 10, expiry: null, receivedAt: d("2024-01-01") },
    ]);
    expect(result.map((r) => r.candidate.key)).toEqual(["older"]);
  });

  it("puts items without expiry after items with expiry (FEFO tie-break)", () => {
    const result = allocate(10, [
      { key: "noExpiry", qty: 20, expiry: null, receivedAt: d("2020-01-01") },
      { key: "farExpiry", qty: 20, expiry: d("2030-01-01"), receivedAt: d("2024-01-01") },
    ]);
    expect(result.map((r) => r.candidate.key)).toEqual(["farExpiry"]);
  });

  it("returns [] for zero or negative demand", () => {
    expect(allocate(0, [{ key: "a", qty: 1, expiry: null, receivedAt: null }])).toEqual([]);
    expect(allocate(-1, [{ key: "a", qty: 1, expiry: null, receivedAt: null }])).toEqual([]);
  });

  it("skips candidates with qty<=0", () => {
    const result = allocate(5, [
      { key: "empty", qty: 0, expiry: d("2025-01-01"), receivedAt: null },
      { key: "full", qty: 5, expiry: d("2025-06-01"), receivedAt: null },
    ]);
    expect(result.map((r) => r.candidate.key)).toEqual(["full"]);
  });

  it("returns partial allocation when demand exceeds total", () => {
    const result = allocate(100, [
      { key: "a", qty: 5, expiry: null, receivedAt: null },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.take).toBe(5);
  });
});
