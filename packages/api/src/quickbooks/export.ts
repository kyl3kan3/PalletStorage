import { and, eq, inArray } from "drizzle-orm";
import { schema, type Db } from "@wms/db";
import { qboFetch, type QboConnection } from "./client";
import {
  escapeQboLiteral,
  findOrCreateCustomer,
  findOrCreateVendor,
  resolveAccounts,
  type ResolvedAccounts,
} from "./refs";

/**
 * Ensure every WMS product referenced by a line has a matching QBO Item.
 * Cached on quickbooks_connections.productItemMap so we don't query QBO
 * on every export.
 */
async function ensureItems(
  db: Db,
  conn: typeof schema.quickbooksConnections.$inferSelect,
  orgId: string,
  productIds: string[],
  accounts: ResolvedAccounts,
): Promise<Record<string, string>> {
  const map = { ...conn.productItemMap };
  const missing = productIds.filter((id) => !map[id]);
  if (missing.length === 0) return map;

  const products = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.organizationId, orgId), inArray(schema.products.id, missing)));

  for (const p of products) {
    // QBO Items key on Name, which we normally map to our SKU. When a
    // product has no SKU (now allowed since 0009), fall back to the
    // product's display name as the Item Name. Collisions on name are
    // the operator's problem to resolve inside QBO.
    const qboItemName = (p.sku && p.sku.trim()) || p.name;
    const existing = await qboFetch<{ QueryResponse: { Item?: { Id: string }[] } }>(
      conn,
      `/query?query=${encodeURIComponent(`select * from Item where Name = '${escapeQboLiteral(qboItemName)}'`)}`,
    );
    let qboId = existing.QueryResponse.Item?.[0]?.Id;
    if (!qboId) {
      const created = await qboFetch<{ Item: { Id: string } }>(conn, "/item", {
        method: "POST",
        body: {
          Name: qboItemName,
          Description: p.name,
          Type: "Inventory",
          TrackQtyOnHand: true,
          QtyOnHand: 0,
          InvStartDate: new Date().toISOString().slice(0, 10),
          IncomeAccountRef: { value: accounts.income },
          ExpenseAccountRef: { value: accounts.expense },
          AssetAccountRef: { value: accounts.asset },
          ...(p.unitPriceCents != null
            ? { UnitPrice: p.unitPriceCents / 100 }
            : {}),
        },
      });
      qboId = created.Item.Id;
    }
    map[p.id] = qboId;
  }

  await db
    .update(schema.quickbooksConnections)
    .set({ productItemMap: map })
    .where(eq(schema.quickbooksConnections.organizationId, orgId));

  return map;
}

/** qty * unit_price_cents / 100, or 0 when no price is set. */
function lineAmount(qty: number, unitPriceCents: number | null | undefined): number {
  if (!unitPriceCents) return 0;
  return (qty * unitPriceCents) / 100;
}

// ── Inbound → Bill ───────────────────────────────────────────────────
export async function exportInboundAsBill(
  db: Db,
  conn: typeof schema.quickbooksConnections.$inferSelect,
  orgId: string,
  inboundOrderId: string,
) {
  const [order] = await db
    .select()
    .from(schema.inboundOrders)
    .where(and(eq(schema.inboundOrders.id, inboundOrderId), eq(schema.inboundOrders.organizationId, orgId)))
    .limit(1);
  if (!order) throw new Error("Inbound order not found");

  const lines = await db
    .select({
      id: schema.inboundLines.id,
      productId: schema.inboundLines.productId,
      qtyReceived: schema.inboundLines.qtyReceived,
      unitPriceCents: schema.products.unitPriceCents,
    })
    .from(schema.inboundLines)
    .innerJoin(schema.products, eq(schema.products.id, schema.inboundLines.productId))
    .where(eq(schema.inboundLines.inboundOrderId, inboundOrderId));

  const accounts = await resolveAccounts(conn);
  const itemMap = await ensureItems(db, conn, orgId, lines.map((l) => l.productId), accounts);
  const vendorId = await findOrCreateVendor(conn, order.supplier ?? `Supplier (${order.reference})`);

  const bill = {
    VendorRef: { value: vendorId },
    DocNumber: order.reference,
    Line: lines.map((l) => ({
      DetailType: "ItemBasedExpenseLineDetail",
      Amount: lineAmount(l.qtyReceived, l.unitPriceCents),
      ItemBasedExpenseLineDetail: {
        ItemRef: { value: itemMap[l.productId] },
        Qty: l.qtyReceived,
      },
    })),
  };

  const res = await qboFetch<{ Bill: { Id: string } }>(conn, "/bill", {
    method: "POST",
    body: bill,
  });
  return { qboId: res.Bill.Id };
}

// ── Outbound → Invoice ───────────────────────────────────────────────
export async function exportOutboundAsInvoice(
  db: Db,
  conn: typeof schema.quickbooksConnections.$inferSelect,
  orgId: string,
  outboundOrderId: string,
) {
  const [order] = await db
    .select()
    .from(schema.outboundOrders)
    .where(and(eq(schema.outboundOrders.id, outboundOrderId), eq(schema.outboundOrders.organizationId, orgId)))
    .limit(1);
  if (!order) throw new Error("Outbound order not found");

  const lines = await db
    .select({
      id: schema.outboundLines.id,
      productId: schema.outboundLines.productId,
      qtyPicked: schema.outboundLines.qtyPicked,
      unitPriceCents: schema.products.unitPriceCents,
    })
    .from(schema.outboundLines)
    .innerJoin(schema.products, eq(schema.products.id, schema.outboundLines.productId))
    .where(eq(schema.outboundLines.outboundOrderId, outboundOrderId));

  const accounts = await resolveAccounts(conn);
  const itemMap = await ensureItems(db, conn, orgId, lines.map((l) => l.productId), accounts);
  const customerId = await findOrCreateCustomer(
    conn,
    order.customer ?? `Customer (${order.reference})`,
  );

  const invoice = {
    CustomerRef: { value: customerId },
    DocNumber: order.reference,
    Line: lines.map((l) => ({
      DetailType: "SalesItemLineDetail",
      Amount: lineAmount(l.qtyPicked, l.unitPriceCents),
      SalesItemLineDetail: {
        ItemRef: { value: itemMap[l.productId] },
        Qty: l.qtyPicked,
      },
    })),
  };

  const res = await qboFetch<{ Invoice: { Id: string } }>(conn, "/invoice", {
    method: "POST",
    body: invoice,
  });
  return { qboId: res.Invoice.Id };
}

// ── Cycle-count adjustments → per-item QtyOnHand sparse update ───────
/**
 * QBO v3 doesn't expose an InventoryAdjustment object; the canonical way
 * to reflect a stock-take variance is a sparse PUT on each Item adjusting
 * its QtyOnHand. We collapse the supplied movements by product (summing
 * deltas) and push one sparse update per item.
 */
export async function exportAdjustmentAsInventoryAdjustment(
  db: Db,
  conn: typeof schema.quickbooksConnections.$inferSelect,
  orgId: string,
  movementIds: string[],
) {
  const movements = await db
    .select({
      movement: schema.movements,
      palletItem: schema.palletItems,
    })
    .from(schema.movements)
    .innerJoin(schema.palletItems, eq(schema.palletItems.palletId, schema.movements.palletId))
    .where(
      and(
        eq(schema.movements.organizationId, orgId),
        inArray(schema.movements.id, movementIds),
        eq(schema.movements.reason, "cycle_count"),
      ),
    );

  if (movements.length === 0) {
    throw new Error("No cycle_count movements found for the provided ids");
  }

  // Parse the variance from the movement notes ("variance +N ..." or "variance -N ...").
  const deltaByProduct = new Map<string, number>();
  for (const row of movements) {
    const m = row.movement;
    const match = m.notes?.match(/variance\s+([+-]?\d+)/i);
    if (!match) continue;
    const delta = Number.parseInt(match[1]!, 10);
    if (Number.isNaN(delta)) continue;
    const key = row.palletItem.productId;
    deltaByProduct.set(key, (deltaByProduct.get(key) ?? 0) + delta);
  }

  if (deltaByProduct.size === 0) {
    return { qboId: "no_variance", movements: movements.length };
  }

  const accounts = await resolveAccounts(conn);
  const itemMap = await ensureItems(
    db,
    conn,
    orgId,
    [...deltaByProduct.keys()],
    accounts,
  );

  const results: Array<{ productId: string; itemId: string; qtyOnHand: number }> = [];

  // Fetch each current Item (we need SyncToken for sparse updates) and
  // post back a new QtyOnHand = current + delta.
  for (const [productId, delta] of deltaByProduct.entries()) {
    const itemId = itemMap[productId];
    if (!itemId) continue;
    const current = await qboFetch<{ Item: { SyncToken: string; QtyOnHand?: number } }>(
      conn,
      `/item/${encodeURIComponent(itemId)}`,
    );
    const nextQty = (current.Item.QtyOnHand ?? 0) + delta;
    const updated = await qboFetch<{ Item: { Id: string; QtyOnHand: number } }>(
      conn,
      "/item?operation=update",
      {
        method: "POST",
        body: {
          Id: itemId,
          SyncToken: current.Item.SyncToken,
          sparse: true,
          QtyOnHand: Math.max(0, nextQty),
          InvStartDate: new Date().toISOString().slice(0, 10),
        },
      },
    );
    results.push({ productId, itemId, qtyOnHand: updated.Item.QtyOnHand });
  }

  return { qboId: `${results.length}_items_adjusted`, movements: movements.length, results };
}
