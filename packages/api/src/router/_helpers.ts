import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { schema } from "@wms/db";
import type { Context } from "../trpc";

/** Resolve internal organizations.id from Clerk org id in context. */
export async function requireOrgId(ctx: Context & { orgId: string }): Promise<string> {
  const [org] = await ctx.db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.clerkOrgId, ctx.orgId))
    .limit(1);
  if (!org) throw new TRPCError({ code: "FORBIDDEN", message: "Organization not provisioned" });
  return org.id;
}

/**
 * Detect Postgres unique-violation errors (SQLSTATE 23505) so each
 * router can translate them into a CONFLICT TRPCError with a message
 * the operator can act on — instead of leaking the raw
 *   "duplicate key value violates unique constraint \"foo_uq\""
 * string into the toast.
 *
 * `constraint_name` is sometimes present on postgres-js errors;
 * callers can match on it to surface column-specific copy.
 */
export function isUniqueViolation(
  e: unknown,
): e is { code: string; constraint_name?: string; constraint?: string } {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: unknown }).code === "23505"
  );
}

/**
 * Convenience wrapper: rethrow `e` unchanged unless it's a 23505, in
 * which case raise a CONFLICT TRPCError with `message`. Keeps each
 * mutation site short:
 *
 *   try {
 *     await tx.insert(schema.foo).values(…);
 *   } catch (e) {
 *     throwIfDuplicate(e, `A foo with code "${input.code}" already exists.`);
 *     throw e;
 *   }
 */
export function throwIfDuplicate(e: unknown, message: string): void {
  if (isUniqueViolation(e)) {
    throw new TRPCError({ code: "CONFLICT", message });
  }
}
