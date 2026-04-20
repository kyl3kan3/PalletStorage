/**
 * Stock allocation for outbound picks. Given a demand quantity and a list
 * of candidate pallet-items (each with qty available), return the subset
 * to consume and how much to take from each.
 *
 * FEFO (First-Expired-First-Out) is the default: candidates with the
 * nearest expiry are consumed first. Candidates without an expiry date
 * are consumed last, then broken by earliest `receivedAt` (so older stock
 * rotates first).
 */

export interface AllocationCandidate {
  /** Unique id for your caller's bookkeeping — not touched here. */
  key: string;
  qty: number;
  expiry: Date | null;
  receivedAt: Date | null;
}

export interface Allocation<C extends AllocationCandidate> {
  candidate: C;
  take: number;
}

export type AllocationStrategy = "fefo" | "fifo";

export function allocate<C extends AllocationCandidate>(
  demand: number,
  candidates: readonly C[],
  strategy: AllocationStrategy = "fefo",
): Allocation<C>[] {
  if (demand <= 0) return [];

  const sorted = [...candidates].sort((a, b) => compareCandidates(a, b, strategy));

  const result: Allocation<C>[] = [];
  let remaining = demand;
  for (const c of sorted) {
    if (remaining <= 0) break;
    if (c.qty <= 0) continue;
    const take = Math.min(remaining, c.qty);
    result.push({ candidate: c, take });
    remaining -= take;
  }
  return result;
}

function compareCandidates(
  a: AllocationCandidate,
  b: AllocationCandidate,
  strategy: AllocationStrategy,
): number {
  if (strategy === "fefo") {
    const ae = a.expiry?.getTime();
    const be = b.expiry?.getTime();
    if (ae != null && be != null && ae !== be) return ae - be;
    if (ae != null && be == null) return -1;
    if (ae == null && be != null) return 1;
  }
  // Fallback: FIFO by receivedAt (oldest first). Nulls last.
  const ar = a.receivedAt?.getTime();
  const br = b.receivedAt?.getTime();
  if (ar != null && br != null) return ar - br;
  if (ar != null) return -1;
  if (br != null) return 1;
  return 0;
}
