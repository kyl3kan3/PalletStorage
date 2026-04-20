import { eq } from "drizzle-orm";
import { schema, type Db } from "@wms/db";

export interface ClerkIdentity {
  userId: string;
  email: string | null;
  name: string | null;
  orgId: string | null;
  orgName: string | null;
  role: "admin" | "manager" | "operator" | null;
}

/**
 * Idempotently mirror the Clerk user / organization / membership into our
 * local tables. Called on every authenticated request — cheap enough (3
 * indexed lookups + optional inserts) and avoids the complexity of a Clerk
 * webhook for first-time users. Returns the internal organization.id.
 */
export async function ensureProvisioned(db: Db, id: ClerkIdentity): Promise<string | null> {
  // user row
  let [user] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.clerkUserId, id.userId))
    .limit(1);
  if (!user) {
    [user] = await db
      .insert(schema.users)
      .values({
        clerkUserId: id.userId,
        email: id.email ?? `${id.userId}@unknown.local`,
        name: id.name,
      })
      .onConflictDoNothing({ target: schema.users.clerkUserId })
      .returning({ id: schema.users.id });
    if (!user) {
      [user] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.clerkUserId, id.userId))
        .limit(1);
    }
  }

  if (!id.orgId) return null;

  // org row
  let [org] = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.clerkOrgId, id.orgId))
    .limit(1);
  if (!org) {
    [org] = await db
      .insert(schema.organizations)
      .values({ clerkOrgId: id.orgId, name: id.orgName ?? "Untitled" })
      .onConflictDoNothing({ target: schema.organizations.clerkOrgId })
      .returning({ id: schema.organizations.id });
    if (!org) {
      [org] = await db
        .select({ id: schema.organizations.id })
        .from(schema.organizations)
        .where(eq(schema.organizations.clerkOrgId, id.orgId))
        .limit(1);
    }
  }

  if (user && org) {
    await db
      .insert(schema.memberships)
      .values({ organizationId: org.id, userId: user.id, role: id.role ?? "operator" })
      .onConflictDoNothing();
  }

  return org?.id ?? null;
}
