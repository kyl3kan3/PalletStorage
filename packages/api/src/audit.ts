import { eq } from "drizzle-orm";
import { schema } from "@wms/db";
import type { Db } from "@wms/db";

// Accept either a full Db or a transaction handle from `db.transaction(...)`.
// Both expose `.select`, `.insert`, and `.transaction` (nested transactions
// become SAVEPOINTs in pg), which is what we need below.
type AuditDb = Pick<Db, "select" | "insert" | "transaction">;

export interface AuditLogInput {
  organizationId: string;
  /** Clerk user id of the actor (we resolve to internal users.id). */
  userClerkId?: string | null;
  /** e.g. "inbound.close", "customer.delete", "outbound.cancel" */
  action: string;
  /** e.g. "inbound_order", "customer", "outbound_order" */
  entityType: string;
  /** The internal id of the affected row, when applicable. */
  entityId?: string | null;
  /** Free-form structured context: counts, reasons, before/after values. */
  metadata?: Record<string, unknown> | null;
}

/**
 * Append a row to `audit_log`. Pass `db` from the calling procedure (or
 * the inner `tx` if inside a nested transaction) so the insert lives in
 * the same RLS context as the mutation it records.
 *
 * Failures here MUST NOT roll back the caller's mutation — audit is
 * best-effort. The insert runs in its own (savepoint-backed) inner
 * transaction so a failure — e.g. the audit_log table missing on an
 * un-migrated database — rolls back only the savepoint, not the parent.
 * The JS error is caught and logged to stderr.
 */
export async function logAudit(db: AuditDb, input: AuditLogInput): Promise<void> {
  try {
    let userId: string | null = null;
    if (input.userClerkId) {
      const [u] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.clerkUserId, input.userClerkId))
        .limit(1);
      userId = u?.id ?? null;
    }
    await db.transaction(async (inner) => {
      await inner.insert(schema.auditLog).values(buildAuditRow(input, userId));
    });
  } catch (err) {
    console.error("[audit] failed to write audit_log row", input.action, err);
  }
}

/**
 * Pure row-builder split out so it can be unit-tested without a database.
 */
export function buildAuditRow(
  input: AuditLogInput,
  userId: string | null,
): typeof schema.auditLog.$inferInsert {
  return {
    organizationId: input.organizationId,
    userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    metadata: (input.metadata ?? null) as Record<string, unknown> | null,
  };
}
