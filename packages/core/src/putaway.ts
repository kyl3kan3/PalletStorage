/**
 * Putaway strategy: given a pallet and a set of candidate locations,
 * pick the best empty location to store it.
 *
 * Rules (in order):
 *  1. Location must be active, empty, and match or exceed pallet weight.
 *  2. Prefer matching velocity class (A→A, B→B…). A-class product in A zone.
 *  3. Among matches, prefer locations closest to the dock (lower pathDistance).
 */

export interface PutawayLocation {
  id: string;
  path: string;
  active: boolean;
  occupied: boolean;
  maxWeightKg: number | null;
  velocityClass: string | null;
  /** Optional precomputed distance from receiving dock along the picking graph. */
  pathDistance?: number;
}

export interface PutawayPallet {
  weightKg: number | null;
  velocityClass: string | null;
}

export function suggestPutawayLocation(
  pallet: PutawayPallet,
  candidates: readonly PutawayLocation[],
): PutawayLocation | null {
  const eligible = candidates.filter((loc) => {
    if (!loc.active || loc.occupied) return false;
    if (pallet.weightKg != null && loc.maxWeightKg != null && pallet.weightKg > loc.maxWeightKg) {
      return false;
    }
    return true;
  });

  if (eligible.length === 0) return null;

  const scored = eligible
    .map((loc) => ({
      loc,
      score:
        (pallet.velocityClass && loc.velocityClass === pallet.velocityClass ? 0 : 100) +
        (loc.pathDistance ?? 0),
    }))
    .sort((a, b) => a.score - b.score);

  return scored[0]!.loc;
}
