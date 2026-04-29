import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { schema, type Db } from "@wms/db";

/**
 * Per-customer billing snapshot for a [from, to] window.
 *
 * Numbers are derived by event-sourcing the receive/ship movements
 * for each customer's pallets — no separate ledger needed. We walk
 * every receive/ship in chronological order, treating receive as +1
 * and ship as -1, and pull three values out of the run:
 *
 *   openingCount = running total just before the first row whose
 *                  created_at is in the window. Starting balance.
 *   peakCount    = max of openingCount and every running total seen
 *                  inside the window. Drives the storage charge —
 *                  this is the "if you brought 26 in then shipped 13,
 *                  you still pay for 26" semantic.
 *   currentCount = final running total at `to`. What's still in the
 *                  building right now (or at the end of the window).
 *
 * receives + ships are simple counts of rows in the window, used for
 * the in/out fees.
 *
 * Charges are integer-cent multiplies — no float arithmetic. Customers
 * without rates set have all *Charge fields = 0 and hasRates=false so
 * the UI can flag them and refuse QB export.
 */

export type BillingRow = {
  customerId: string;
  customerName: string;
  openingCount: number;
  currentCount: number;
  peakCount: number;
  receives: number;
  ships: number;
  storageRateCentsPerPalletMonth: number | null;
  receiveRateCentsPerPallet: number | null;
  shipRateCentsPerPallet: number | null;
  storageChargeCents: number;
  receiveChargeCents: number;
  shipChargeCents: number;
  totalChargeCents: number;
  hasRates: boolean;
};

export async function computeBillingPeriod(
  db: Db,
  orgId: string,
  customerId: string | null,
  from: Date,
  to: Date,
): Promise<BillingRow[]> {
  // Resolve which customers to compute. Single-customer mode for the
  // PDF route + QB export; null means every active customer in the
  // org for the report table.
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

  // One pass: pull every relevant movement up to `to` for every pallet
  // owned by ANY of these customers. Joining once is cheaper than
  // looping per-customer when the report renders org-wide.
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

  // Bucket per customer, sort each bucket once, walk to derive the
  // four counters per customer.
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

  const out: BillingRow[] = [];
  for (const c of customers) {
    const events = byCustomer.get(c.id) ?? [];
    let running = 0;
    let opening = 0;
    let openingLocked = false;
    let peak = 0;
    let receives = 0;
    let ships = 0;

    for (const e of events) {
      // Lock opening at the boundary: the moment we cross into the
      // window, the current `running` is the starting balance.
      if (!openingLocked && e.t >= fromMs) {
        opening = running;
        peak = running;
        openingLocked = true;
      }
      running += e.reason === "receive" ? 1 : -1;
      if (e.t >= fromMs && e.t <= toMs) {
        if (e.reason === "receive") receives += 1;
        else ships += 1;
        if (running > peak) peak = running;
      }
    }
    // No movements in or after the window — the current count IS the
    // opening balance, and peak equals it (storage carries over).
    if (!openingLocked) {
      opening = running;
      peak = running;
    }

    const storageRate = c.storageRateCentsPerPalletMonth;
    const receiveRate = c.receiveRateCentsPerPallet;
    const shipRate = c.shipRateCentsPerPallet;
    const storageChargeCents =
      storageRate != null && peak > 0 ? peak * storageRate : 0;
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
      receives,
      ships,
      storageRateCentsPerPalletMonth: storageRate,
      receiveRateCentsPerPallet: receiveRate,
      shipRateCentsPerPallet: shipRate,
      storageChargeCents,
      receiveChargeCents,
      shipChargeCents,
      totalChargeCents:
        storageChargeCents + receiveChargeCents + shipChargeCents,
      hasRates:
        storageRate != null && receiveRate != null && shipRate != null,
    });
  }
  return out.sort((a, b) => a.customerName.localeCompare(b.customerName));
}
