import { schema, type Db } from "@wms/db";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { qboFetch, refreshAccessToken, type QboConnection } from "./client";
import { findOrCreateCustomer } from "./refs";
import {
  applyRatesToRow,
  type BillingRow,
  type RateOverrides,
  type StorageBasis,
} from "../billing/calculate";

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

export type BillingExtraLine = {
  description: string;
  amountCents: number; // negative is allowed for discounts
};

export type PostBillingInvoiceOptions = {
  storageBasis?: StorageBasis;
  overrides?: RateOverrides;
  extraLines?: BillingExtraLine[];
  /** Free-text memo printed on the QBO invoice (and PDF). */
  memo?: string;
  /** Days from invoice date to due date (Net N). */
  dueInDays?: number;
};

const STORAGE_BASIS_LABEL: Record<StorageBasis, string> = {
  peak: "peak",
  average: "average",
  pallet_days: "pallet-days",
};

function fmtStorageQty(basis: StorageBasis, qty: number): string {
  if (basis === "pallet_days") return qty.toFixed(2);
  if (basis === "average") return qty.toFixed(2);
  return String(Math.round(qty));
}

/**
 * Post a QBO Invoice with up to three computed lines + any caller-
 * supplied extras (one-off fees, discounts as negative amounts).
 * Honors per-bill rate overrides + storage basis without mutating the
 * customer's saved rates. Skips lines whose charge is zero.
 */
export async function postBillingInvoice(
  conn: QboConnection,
  customerNameForQbo: string,
  row: BillingRow,
  from: Date,
  options: PostBillingInvoiceOptions = {},
): Promise<{ qboId: string }> {
  const customerId = await findOrCreateCustomer(conn, customerNameForQbo);
  const basis = options.storageBasis ?? row.storageBasis;
  const charges = applyRatesToRow(row, basis, options.overrides);

  const period = periodLabel(from);
  const lines: Array<Record<string, unknown>> = [];

  if (charges.storageCharge > 0) {
    const itemId = await findOrCreateServiceItem(conn, STORAGE_ITEM);
    lines.push({
      DetailType: "SalesItemLineDetail",
      Amount: charges.storageCharge / 100,
      Description: `Storage — ${fmtStorageQty(basis, charges.storageQty)} ${STORAGE_BASIS_LABEL[basis]} in ${period}`,
      SalesItemLineDetail: {
        ItemRef: { value: itemId },
        Qty: basis === "peak" ? Math.round(charges.storageQty) : Number(charges.storageQty.toFixed(2)),
        UnitPrice: charges.storageRate / 100,
      },
    });
  }
  if (charges.receiveCharge > 0) {
    const itemId = await findOrCreateServiceItem(conn, INBOUND_ITEM);
    lines.push({
      DetailType: "SalesItemLineDetail",
      Amount: charges.receiveCharge / 100,
      Description: `Inbound handling — ${row.receives} pallet(s) received in ${period}`,
      SalesItemLineDetail: {
        ItemRef: { value: itemId },
        Qty: row.receives,
        UnitPrice: charges.receiveRate / 100,
      },
    });
  }
  if (charges.shipCharge > 0) {
    const itemId = await findOrCreateServiceItem(conn, OUTBOUND_ITEM);
    lines.push({
      DetailType: "SalesItemLineDetail",
      Amount: charges.shipCharge / 100,
      Description: `Outbound handling — ${row.ships} pallet(s) shipped in ${period}`,
      SalesItemLineDetail: {
        ItemRef: { value: itemId },
        Qty: row.ships,
        UnitPrice: charges.shipRate / 100,
      },
    });
  }

  // Ad-hoc lines: fees, discounts (negative), accessorials. We use
  // SalesItemLineDetail keyed to the storage item so QBO accepts the
  // line without forcing the user to pre-create a "Misc" item; the
  // description carries the meaning. Set Qty=1 / UnitPrice=amount so
  // QBO computes Amount cleanly.
  if (options.extraLines && options.extraLines.length > 0) {
    const fallbackItemId = await findOrCreateServiceItem(conn, STORAGE_ITEM);
    for (const extra of options.extraLines) {
      const desc = (extra.description ?? "").trim().slice(0, 200);
      if (!desc || extra.amountCents === 0) continue;
      lines.push({
        DetailType: "SalesItemLineDetail",
        Amount: extra.amountCents / 100,
        Description: desc,
        SalesItemLineDetail: {
          ItemRef: { value: fallbackItemId },
          Qty: 1,
          UnitPrice: extra.amountCents / 100,
        },
      });
    }
  }

  if (lines.length === 0) {
    throw new Error("No billable charges for this period.");
  }

  const invoice: Record<string, unknown> = {
    CustomerRef: { value: customerId },
    DocNumber: `STG-${period}-${row.customerId.slice(0, 6)}`,
    Line: lines,
  };
  if (options.memo && options.memo.trim()) {
    invoice.CustomerMemo = { value: options.memo.trim().slice(0, 1000) };
  }
  if (options.dueInDays != null && options.dueInDays >= 0) {
    const dueDate = new Date();
    dueDate.setUTCDate(dueDate.getUTCDate() + options.dueInDays);
    invoice.DueDate = dueDate.toISOString().slice(0, 10);
  }

  const res = await qboFetch<{ Invoice: { Id: string } }>(conn, "/invoice", {
    method: "POST",
    body: invoice,
  });
  return { qboId: res.Invoice.Id };
}
