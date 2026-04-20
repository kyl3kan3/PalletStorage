import { and, eq, inArray } from "drizzle-orm";
import { schema, type Db } from "@wms/db";
import { qboFetch, type QboConnection } from "./client";

/**
 * Ensure every WMS product referenced by a line has a corresponding QBO Item.
 * Cached on the quickbooks_connections row as productItemMap to avoid
 * round-tripping on every export.
 */
async function ensureItems(
  db: Db,
  conn: typeof schema.quickbooksConnections.$inferSelect,
  orgId: string,
  productIds: string[],
): Promise<Record<string, string>> {
  const map = { ...conn.productItemMap };
  const missing = productIds.filter((id) => !map[id]);
  if (missing.length === 0) return map;

  const products = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.organizationId, orgId), inArray(schema.products.id, missing)));

  for (const p of products) {
    const existing = await qboFetch<{ QueryResponse: { Item?: { Id: string }[] } }>(
      conn,
      `/query?query=${encodeURIComponent(`select * from Item where Name = '${p.sku.replace(/'/g, "\\'")}'`)}`,
    );
    let qboId = existing.QueryResponse.Item?.[0]?.Id;
    if (!qboId) {
      const created = await qboFetch<{ Item: { Id: string } }>(conn, "/item", {
        method: "POST",
        body: {
          Name: p.sku,
          Description: p.name,
          Type: "Inventory",
          TrackQtyOnHand: true,
          QtyOnHand: 0,
          InvStartDate: new Date().toISOString().slice(0, 10),
          IncomeAccountRef: { value: "1" },
          ExpenseAccountRef: { value: "2" },
          AssetAccountRef: { value: "3" },
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
    .select()
    .from(schema.inboundLines)
    .where(eq(schema.inboundLines.inboundOrderId, inboundOrderId));

  const itemMap = await ensureItems(db, conn, orgId, lines.map((l) => l.productId));

  const bill = {
    VendorRef: { value: "1", name: order.supplier ?? "Unknown" },
    DocNumber: order.reference,
    Line: lines.map((l) => ({
      DetailType: "ItemBasedExpenseLineDetail",
      Amount: l.qtyReceived, // unit cost is tracked in QB Item; this is a placeholder
      ItemBasedExpenseLineDetail: {
        ItemRef: { value: itemMap[l.productId] },
        Qty: l.qtyReceived,
      },
    })),
  };

  const res = await qboFetch<{ Bill: { Id: string } }>(conn, "/bill", { method: "POST", body: bill });
  return { qboId: res.Bill.Id };
}

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
    .select()
    .from(schema.outboundLines)
    .where(eq(schema.outboundLines.outboundOrderId, outboundOrderId));

  const itemMap = await ensureItems(db, conn, orgId, lines.map((l) => l.productId));

  const invoice = {
    CustomerRef: { value: "1", name: order.customer ?? "Unknown" },
    DocNumber: order.reference,
    Line: lines.map((l) => ({
      DetailType: "SalesItemLineDetail",
      Amount: l.qtyPicked,
      SalesItemLineDetail: {
        ItemRef: { value: itemMap[l.productId] },
        Qty: l.qtyPicked,
      },
    })),
  };

  const res = await qboFetch<{ Invoice: { Id: string } }>(conn, "/invoice", { method: "POST", body: invoice });
  return { qboId: res.Invoice.Id };
}

export async function exportAdjustmentAsInventoryAdjustment(
  db: Db,
  _conn: typeof schema.quickbooksConnections.$inferSelect,
  orgId: string,
  movementIds: string[],
) {
  const movements = await db
    .select()
    .from(schema.movements)
    .where(
      and(
        eq(schema.movements.organizationId, orgId),
        inArray(schema.movements.id, movementIds),
      ),
    );
  // QBO v3 does not have a first-class InventoryAdjustment endpoint in all
  // regions; the usual pattern is a JournalEntry or adjusting the Item's
  // QtyOnHand directly. Left as a focused follow-up once the real
  // chart-of-accounts mapping is known.
  return { qboId: "pending", movements: movements.length };
}
