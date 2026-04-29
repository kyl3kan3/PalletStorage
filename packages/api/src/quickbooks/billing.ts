import { schema, type Db } from "@wms/db";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { qboFetch, refreshAccessToken, type QboConnection } from "./client";
import { findOrCreateCustomer } from "./refs";
import type { BillingRow } from "../billing/calculate";

/**
 * QBO invoice push for a single per-customer billing period. Mirrors
 * the shape of exportOutboundAsInvoice() but the line items are
 * service-style fees (storage / inbound / outbound handling) rather
 * than product picks. QBO requires an Item ref on every
 * SalesItemLineDetail line, so we ensure three service items exist
 * (Pallet Storage, Inbound Handling, Outbound Handling) keyed off
 * their names — created lazily on first export.
 */

/**
 * Loads + refreshes the org's QBO connection. Throws PRECONDITION_FAILED
 * if QB isn't connected. Mirrors the requireConnection helper in the
 * quickbooks router but exported here so the report router can reuse.
 */
export async function loadQbConnection(db: Db, orgId: string): Promise<QboConnection> {
  const [conn] = await db
    .select()
    .from(schema.quickbooksConnections)
    .where(eq(schema.quickbooksConnections.organizationId, orgId))
    .limit(1);
  if (!conn) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "QuickBooks is not connected — Settings → Integrations.",
    });
  }
  if (conn.accessTokenExpiresAt.getTime() - Date.now() < 5 * 60_000) {
    const refreshed = await refreshAccessToken(conn.refreshToken);
    await db
      .update(schema.quickbooksConnections)
      .set({
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        accessTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      })
      .where(eq(schema.quickbooksConnections.organizationId, conn.organizationId));
    return {
      accessToken: refreshed.access_token,
      realmId: conn.realmId,
      productItemMap: {},
    };
  }
  return {
    accessToken: conn.accessToken,
    realmId: conn.realmId,
    productItemMap: {},
  };
}

interface QboItem {
  Id: string;
  Name: string;
}

/**
 * Resolve (or create) a service-type Item in QBO by name. Used so the
 * three billing line types each have a stable ItemRef across runs —
 * e.g. all Storage charges roll up under one Item in QBO reports.
 */
async function findOrCreateServiceItem(conn: QboConnection, name: string): Promise<string> {
  const escaped = name.replace(/'/g, "''");
  const existing = await qboFetch<{ QueryResponse: { Item?: QboItem[] } }>(
    conn,
    `/query?query=${encodeURIComponent(`select * from Item where Name = '${escaped}'`)}`,
  );
  const hit = existing.QueryResponse.Item?.[0];
  if (hit) return hit.Id;

  // Need an income account to attach the service item to. Use whatever
  // account QBO returns when we ask for income-type accounts; user can
  // re-categorize later in QBO.
  const accounts = await qboFetch<{
    QueryResponse: { Account?: Array<{ Id: string; AccountType: string; Name: string }> };
  }>(
    conn,
    `/query?query=${encodeURIComponent("select * from Account where AccountType = 'Income'")}`,
  );
  const income = accounts.QueryResponse.Account?.[0];
  if (!income) {
    throw new Error(
      "No Income account found in QuickBooks — create one in QBO before exporting billing.",
    );
  }

  const created = await qboFetch<{ Item: QboItem }>(conn, "/item", {
    method: "POST",
    body: {
      Name: name,
      Type: "Service",
      IncomeAccountRef: { value: income.Id },
    },
  });
  return created.Item.Id;
}

const STORAGE_ITEM = "Pallet Storage";
const INBOUND_ITEM = "Inbound Handling";
const OUTBOUND_ITEM = "Outbound Handling";

/** Format a yyyy-mm string for the period label printed in QBO. */
export function periodLabel(from: Date): string {
  const y = from.getUTCFullYear();
  const m = String(from.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Post a QBO Invoice with up to three lines covering this billing
 * period. Skips lines whose charge is zero (e.g. a customer with no
 * shipments that month doesn't get a $0 outbound-handling line).
 */
export async function postBillingInvoice(
  conn: QboConnection,
  customerNameForQbo: string,
  row: BillingRow,
  from: Date,
): Promise<{ qboId: string }> {
  const customerId = await findOrCreateCustomer(conn, customerNameForQbo);

  const period = periodLabel(from);
  const lines: Array<Record<string, unknown>> = [];

  if (row.storageChargeCents > 0) {
    const itemId = await findOrCreateServiceItem(conn, STORAGE_ITEM);
    lines.push({
      DetailType: "SalesItemLineDetail",
      Amount: row.storageChargeCents / 100,
      Description: `Storage — ${row.peakCount} pallet(s) peak in ${period}`,
      SalesItemLineDetail: {
        ItemRef: { value: itemId },
        Qty: row.peakCount,
        UnitPrice: (row.storageRateCentsPerPalletMonth ?? 0) / 100,
      },
    });
  }
  if (row.receiveChargeCents > 0) {
    const itemId = await findOrCreateServiceItem(conn, INBOUND_ITEM);
    lines.push({
      DetailType: "SalesItemLineDetail",
      Amount: row.receiveChargeCents / 100,
      Description: `Inbound handling — ${row.receives} pallet(s) received in ${period}`,
      SalesItemLineDetail: {
        ItemRef: { value: itemId },
        Qty: row.receives,
        UnitPrice: (row.receiveRateCentsPerPallet ?? 0) / 100,
      },
    });
  }
  if (row.shipChargeCents > 0) {
    const itemId = await findOrCreateServiceItem(conn, OUTBOUND_ITEM);
    lines.push({
      DetailType: "SalesItemLineDetail",
      Amount: row.shipChargeCents / 100,
      Description: `Outbound handling — ${row.ships} pallet(s) shipped in ${period}`,
      SalesItemLineDetail: {
        ItemRef: { value: itemId },
        Qty: row.ships,
        UnitPrice: (row.shipRateCentsPerPallet ?? 0) / 100,
      },
    });
  }

  if (lines.length === 0) {
    throw new Error("No billable charges for this period.");
  }

  const invoice = {
    CustomerRef: { value: customerId },
    DocNumber: `STG-${period}-${row.customerId.slice(0, 6)}`,
    Line: lines,
  };
  const res = await qboFetch<{ Invoice: { Id: string } }>(conn, "/invoice", {
    method: "POST",
    body: invoice,
  });
  return { qboId: res.Invoice.Id };
}
