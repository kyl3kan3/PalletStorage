// Lookup + create helpers for the QuickBooks entities that Bills and
// Invoices depend on: Vendors, Customers, and chart-of-accounts. The
// exports were previously crashing against real QBO sandboxes because
// they hardcoded IDs like "1"/"2"/"3" that only exist in Intuit's
// documentation — every real company has its own account numbering.

import { qboFetch, type QboConnection } from "./client";

// QBO's GROUP BY operator isn't friendly in SQL-style queries, so we
// filter client-side after a simple select. AccountType values come
// from https://developer.intuit.com/.../account#account-types.
interface QboAccount {
  Id: string;
  Name: string;
  AccountType: string;
  AccountSubType?: string;
}

interface QboVendor {
  Id: string;
  DisplayName: string;
}
interface QboCustomer {
  Id: string;
  DisplayName: string;
}

export interface ResolvedAccounts {
  income: string;
  expense: string;
  asset: string;
}

/**
 * Pick the first account of each needed type. Good enough for an
 * automated export — operators can move line items to the correct
 * account inside QBO if the defaults aren't what they want.
 */
export async function resolveAccounts(conn: QboConnection): Promise<ResolvedAccounts> {
  const resp = await qboFetch<{ QueryResponse: { Account?: QboAccount[] } }>(
    conn,
    `/query?query=${encodeURIComponent("select * from Account maxresults 200")}`,
  );
  const accounts = resp.QueryResponse.Account ?? [];

  const income =
    firstOfType(accounts, "Income", "SalesOfProductIncome") ??
    firstOfType(accounts, "Income");
  const expense =
    firstOfType(accounts, "Cost of Goods Sold") ??
    firstOfType(accounts, "Expense");
  const asset =
    firstOfType(accounts, "Other Current Asset", "Inventory") ??
    firstOfType(accounts, "Other Current Asset");

  if (!income || !expense || !asset) {
    throw new Error(
      "QuickBooks company is missing standard accounts (Income / Cost of Goods Sold / Inventory). " +
        "Run the default setup in your QBO sandbox or create these before exporting.",
    );
  }
  return { income, expense, asset };
}

function firstOfType(
  accounts: readonly QboAccount[],
  type: string,
  subType?: string,
): string | undefined {
  return accounts.find(
    (a) => a.AccountType === type && (!subType || a.AccountSubType === subType),
  )?.Id;
}

// ── Vendor / Customer ─────────────────────────────────────────────────
/** Find by DisplayName, create if missing. */
export async function findOrCreateVendor(
  conn: QboConnection,
  displayName: string,
): Promise<string> {
  const safe = escapeQboLiteral(displayName);
  const existing = await qboFetch<{ QueryResponse: { Vendor?: QboVendor[] } }>(
    conn,
    `/query?query=${encodeURIComponent(`select * from Vendor where DisplayName = '${safe}'`)}`,
  );
  const hit = existing.QueryResponse.Vendor?.[0];
  if (hit) return hit.Id;

  const created = await qboFetch<{ Vendor: QboVendor }>(conn, "/vendor", {
    method: "POST",
    body: { DisplayName: displayName },
  });
  return created.Vendor.Id;
}

export async function findOrCreateCustomer(
  conn: QboConnection,
  displayName: string,
): Promise<string> {
  const safe = escapeQboLiteral(displayName);
  const existing = await qboFetch<{ QueryResponse: { Customer?: QboCustomer[] } }>(
    conn,
    `/query?query=${encodeURIComponent(`select * from Customer where DisplayName = '${safe}'`)}`,
  );
  const hit = existing.QueryResponse.Customer?.[0];
  if (hit) return hit.Id;

  const created = await qboFetch<{ Customer: QboCustomer }>(conn, "/customer", {
    method: "POST",
    body: { DisplayName: displayName },
  });
  return created.Customer.Id;
}

/** Escape single quotes and backslashes for QBO's SQL-ish query grammar. */
export function escapeQboLiteral(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
