import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { schema, type Db } from "@wms/db";

/**
 * Per-customer billing snapshot for a [from, to] window.
 *
 * We event-source the receive/ship movements per customer (no separate
 * ledger): every receive is +1, every ship is -1. From the same walk we
 * pull three storage-basis figures so the bill-time UI can let the user
 * pick which one to charge against:
 *
 *   peakCount    — max running count seen inside the window. The "if
 *                  you brought 26 in then shipped 13, you still pay for
 *                  26" semantic. The default basis.
 *   averageCount — time-weighted average pallet count over the window.
 *                  Smooths out short spikes.
 *   palletDays   — sum of (count × days), i.e. the total "pallet-day"
 *                  exposure. Charged at (rate / 30) × palletDays so the
 *                  per-month rate field stays the same.
 *
 * receives + ships are simple counts of in-window rows for the in/out
 * fees. Charges are integer-cent multiplies; no floats. Customers
 * without rates get all *Charge fields = 0 and hasRates=false.
 *
 * `hasRates` only requires storage + receive — the two fees most 3PLs
 * actually invoice. Ship (outbound handling) is optional; if it's
 * unset the outbound line just doesn't appear on the statement, and
 * the QB push goes through anyway.
 */

export type StorageBasis = "peak" | "average" | "pallet_days";

export type BillingRow = {
  customerId: string;
  customerName: string;
  openingCount: number;
  currentCount: number;
  peakCount: number;
  averageCount: number;
  palletDays: number;
  receives: number;
  ships: number;
  storageRateCentsPerPalletMonth: number | null;
  receiveRateCentsPerPallet: number | null;
  shipRateCentsPerPallet: number | null;
  /** Storage basis chosen for the precomputed charge fields below. */
  storageBasis: StorageBasis;
  /** All three storage-basis charges in cents — UI/consumer can flip without recomputing. */
  storageChargeByBasisCents: Record<StorageBasis, number>;
  storageChargeCents: number;
  receiveChargeCents: number;
  shipChargeCents: number;
  totalChargeCents: number;
  hasRates: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function computeBillingPeriod(
  db: Db,
  orgId: string,
  customerId: string | null,
  from: Date,
  to: Date,
  options?: { storageBasis?: StorageBasis },
): Promise<BillingRow[]> {
  const basis: StorageBasis = options?.storageBasis ?? "peak";

  const customers = await db
    .select({
      id: schema.customers.id,
      name: schema.customers.name,
      storageRateCentsPerPalletMonth:
        schema.customers.storageRateCentsPerPalletMonth,
      receiveRateCentsPerPallet: schema.customers.receiveRateCentsPerPallet,
      shipRateCentsPerPallet: schema.customers.shipRateCentsPerPallet,
    })
    .from(schema.customers)
    .where(
      and(
        eq(schema.customers.organizationId, orgId),
        customerId ? eq(schema.customers.id, customerId) : undefined,
      ),
    );
  if (customers.length === 0) return [];

  const movements = await db
    .select({
      customerId: schema.pallets.customerId,
      reason: schema.movements.reason,
      createdAt: schema.movements.createdAt,
    })
    .from(schema.movements)
    .innerJoin(schema.pallets, eq(schema.pallets.id, schema.movements.palletId))
    .where(
      and(
        eq(schema.movements.organizationId, orgId),
        isNotNull(schema.pallets.customerId),
        customerId ? eq(schema.pallets.customerId, customerId) : undefined,
        inArray(schema.movements.reason, ["receive", "ship"]),
      ),
    );

  const byCustomer = new Map<string, Array<{ reason: string; t: number }>>();
  for (const m of movements) {
    if (!m.customerId) continue;
    if (!m.createdAt) continue;
    const t = new Date(m.createdAt).getTime();
    if (t > to.getTime()) continue;
    const arr = byCustomer.get(m.customerId) ?? [];
    arr.push({ reason: m.reason, t });
    byCustomer.set(m.customerId, arr);
  }
  for (const arr of byCustomer.values()) arr.sort((a, b) => a.t - b.t);

  const fromMs = from.getTime();
  const toMs = to.getTime();
  const windowMs = Math.max(0, toMs - fromMs);

  const out: BillingRow[] = [];
  for (const c of customers) {
    const events = byCustomer.get(c.id) ?? [];
    let running = 0;
    let opening = 0;
    let openingLocked = false;
    let peak = 0;
    let receives = 0;
    let ships = 0;
    // Time-weighted accumulator: sum of (running * milliseconds spent at
    // that running) across the in-window time. Divide by DAY_MS to get
    // pallet-days.
    let palletDayMsAccum = 0;
    let lastEdgeMs = fromMs;

    for (const e of events) {
      if (e.t < fromMs) {
        // Pre-window event — just update running so opening is correct.
        running += e.reason === "receive" ? 1 : -1;
        continue;
      }
      if (!openingLocked) {
        opening = running;
        peak = running;
        openingLocked = true;
      }
      // Span at the current running level from lastEdgeMs to this event
      // (capped at the window end).
      const cappedMs = Math.min(e.t, toMs);
      if (cappedMs > lastEdgeMs) {
        palletDayMsAccum += running * (cappedMs - lastEdgeMs);
        lastEdgeMs = cappedMs;
      }
      if (e.t <= toMs) {
        running += e.reason === "receive" ? 1 : -1;
        if (e.reason === "receive") receives += 1;
        else ships += 1;
        if (running > peak) peak = running;
      }
    }
    if (!openingLocked) {
      // No events at or after fromMs — running is steady across the
      // whole window at its current value.
      opening = running;
      peak = running;
      palletDayMsAccum = Math.max(0, running) * windowMs;
    } else if (toMs > lastEdgeMs) {
      palletDayMsAccum += Math.max(0, running) * (toMs - lastEdgeMs);
    }

    const palletDays = palletDayMsAccum / DAY_MS;
    const windowDays = windowMs / DAY_MS;
    const averageCount = windowDays > 0 ? palletDays / windowDays : 0;

    const storageRate = c.storageRateCentsPerPalletMonth;
    const receiveRate = c.receiveRateCentsPerPallet;
    const shipRate = c.shipRateCentsPerPallet;

    // Pre-compute charges for ALL bases so the UI can flip without a
    // re-roundtrip. Keep integer cents; round once per number.
    const storageByBasis: Record<StorageBasis, number> = {
      peak: storageRate != null ? Math.max(0, peak) * storageRate : 0,
      average:
        storageRate != null
          ? Math.round(Math.max(0, averageCount) * storageRate)
          : 0,
      pallet_days:
        storageRate != null
          ? Math.round((Math.max(0, palletDays) * storageRate) / 30)
          : 0,
    };
    const storageChargeCents = storageByBasis[basis];
    const receiveChargeCents =
      receiveRate != null && receives > 0 ? receives * receiveRate : 0;
    const shipChargeCents =
      shipRate != null && ships > 0 ? ships * shipRate : 0;

    out.push({
      customerId: c.id,
      customerName: c.name,
      openingCount: Math.max(0, opening),
      currentCount: Math.max(0, running),
      peakCount: Math.max(0, peak),
      averageCount: Math.max(0, Math.round(averageCount * 100) / 100),
      palletDays: Math.max(0, Math.round(palletDays * 100) / 100),
      receives,
      ships,
      storageRateCentsPerPalletMonth: storageRate,
      receiveRateCentsPerPallet: receiveRate,
      shipRateCentsPerPallet: shipRate,
      storageBasis: basis,
      storageChargeByBasisCents: storageByBasis,
      storageChargeCents,
      receiveChargeCents,
      shipChargeCents,
      totalChargeCents:
        storageChargeCents + receiveChargeCents + shipChargeCents,
      hasRates: storageRate != null && receiveRate != null,
    });
  }
  return out.sort((a, b) => a.customerName.localeCompare(b.customerName));
}

/**
 * Recompute charges with custom rates / a different storage basis.
 * Used when a manager applies one-off overrides at bill-time without
 * permanently changing the customer's saved rates. Pure math against
 * the row's already-computed counts — no DB hit.
 */
export type RateOverrides = {
  storageRateCentsPerPalletMonth?: number;
  receiveRateCentsPerPallet?: number;
  shipRateCentsPerPallet?: number;
};

export function applyRatesToRow(
  row: BillingRow,
  basis: StorageBasis,
  overrides?: RateOverrides,
): {
  storageCharge: number;
  receiveCharge: number;
  shipCharge: number;
  total: number;
  storageRate: number;
  receiveRate: number;
  shipRate: number;
  storageQty: number;
} {
  const storageRate =
    overrides?.storageRateCentsPerPalletMonth ??
    row.storageRateCentsPerPalletMonth ??
    0;
  const receiveRate =
    overrides?.receiveRateCentsPerPallet ?? row.receiveRateCentsPerPallet ?? 0;
  const shipRate =
    overrides?.shipRateCentsPerPallet ?? row.shipRateCentsPerPallet ?? 0;

  let storageQty: number;
  let storageCharge: number;
  if (basis === "peak") {
    storageQty = row.peakCount;
    storageCharge = Math.round(storageQty * storageRate);
  } else if (basis === "average") {
    storageQty = row.averageCount;
    storageCharge = Math.round(storageQty * storageRate);
  } else {
    storageQty = row.palletDays;
    storageCharge = Math.round((storageQty * storageRate) / 30);
  }
  const receiveCharge = row.receives * receiveRate;
  const shipCharge = row.ships * shipRate;
  return {
    storageCharge,
    receiveCharge,
    shipCharge,
    total: storageCharge + receiveCharge + shipCharge,
    storageRate,
    receiveRate,
    shipRate,
    storageQty,
  };
}
