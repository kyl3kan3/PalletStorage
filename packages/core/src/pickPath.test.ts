import { describe, it, expect } from "vitest";
import { orderPicksSShape, parseAisleBay } from "./pickPath";

describe("pick path", () => {
  it("walks odd aisles forward and even aisles backward", () => {
    const picks = [
      { aisle: 2, bay: 1, payload: "a" },
      { aisle: 1, bay: 5, payload: "b" },
      { aisle: 2, bay: 7, payload: "c" },
      { aisle: 1, bay: 2, payload: "d" },
    ];
    const ordered = orderPicksSShape(picks).map((p) => p.payload);
    expect(ordered).toEqual(["d", "b", "c", "a"]);
  });

  it("parses aisle/bay from a path", () => {
    expect(parseAisleBay("WH1.A.03.02.1")).toEqual({ aisle: 2, bay: 1 });
  });
});
