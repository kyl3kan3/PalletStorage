/**
 * Pick-path ordering using a simple S-shape / snake traversal of aisles.
 *
 * Locations carry an (aisle, bay) coordinate. We walk aisles in ascending
 * order; within odd-numbered aisles we traverse bays forward, within even
 * ones we traverse them in reverse, minimizing total travel distance for a
 * rectangular warehouse.
 */

export interface PickCandidate<T = unknown> {
  aisle: number;
  bay: number;
  payload: T;
}

export function orderPicksSShape<T>(picks: readonly PickCandidate<T>[]): PickCandidate<T>[] {
  return [...picks].sort((a, b) => {
    if (a.aisle !== b.aisle) return a.aisle - b.aisle;
    const forward = a.aisle % 2 === 1;
    return forward ? a.bay - b.bay : b.bay - a.bay;
  });
}

/**
 * Parse a location path like "WH1.A.03.02.1" into aisle/bay coords.
 * Adapt this to whatever path format the warehouse uses.
 */
export function parseAisleBay(path: string): { aisle: number; bay: number } {
  const parts = path.split(".");
  // heuristic: second-to-last numeric segment is aisle, last numeric is bay
  const nums = parts.map((p) => Number(p)).filter((n) => !Number.isNaN(n));
  const aisle = nums[nums.length - 2] ?? 0;
  const bay = nums[nums.length - 1] ?? 0;
  return { aisle, bay };
}
