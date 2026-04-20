import { describe, it, expect } from "vitest";
import { suggestPutawayLocation, type PutawayLocation } from "./putaway";

const loc = (o: Partial<PutawayLocation> & { id: string }): PutawayLocation => ({
  path: o.id,
  active: true,
  occupied: false,
  maxWeightKg: 1000,
  velocityClass: null,
  pathDistance: 0,
  ...o,
});

describe("putaway", () => {
  it("returns null when nothing is eligible", () => {
    const res = suggestPutawayLocation({ weightKg: 500, velocityClass: "A" }, [
      loc({ id: "1", occupied: true }),
      loc({ id: "2", active: false }),
    ]);
    expect(res).toBeNull();
  });

  it("respects weight capacity", () => {
    const res = suggestPutawayLocation({ weightKg: 900, velocityClass: null }, [
      loc({ id: "small", maxWeightKg: 500 }),
      loc({ id: "big", maxWeightKg: 1500 }),
    ]);
    expect(res?.id).toBe("big");
  });

  it("prefers matching velocity class over distance", () => {
    const res = suggestPutawayLocation({ weightKg: 100, velocityClass: "A" }, [
      loc({ id: "near-B", velocityClass: "B", pathDistance: 1 }),
      loc({ id: "far-A", velocityClass: "A", pathDistance: 50 }),
    ]);
    expect(res?.id).toBe("far-A");
  });

  it("breaks ties by pathDistance", () => {
    const res = suggestPutawayLocation({ weightKg: 100, velocityClass: "A" }, [
      loc({ id: "far", velocityClass: "A", pathDistance: 20 }),
      loc({ id: "near", velocityClass: "A", pathDistance: 5 }),
    ]);
    expect(res?.id).toBe("near");
  });
});
