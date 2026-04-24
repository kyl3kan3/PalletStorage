import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { appRouter, createTRPCContext, ensureProvisioned } from "@wms/api";
import { db, schema } from "@wms/db";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

const handler = async (req: Request) => {
  const { userId, orgId, orgRole } = await auth();
  const traceId = randomUUID();

  let effectiveRole: "admin" | "manager" | "operator" | null = mapRole(orgRole ?? null);

  // Mirror Clerk identity into our DB so downstream procedures can resolve
  // the internal organizations.id without a race on first sign-in.
  if (userId) {
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      let orgName: string | null = null;
      if (orgId) {
        const org = await client.organizations.getOrganization({ organizationId: orgId });
        orgName = org.name;
      }
      await ensureProvisioned(db, {
        userId,
        email: user.primaryEmailAddress?.emailAddress ?? null,
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
        orgId: orgId ?? null,
        orgName,
        role: effectiveRole,
      });

      // After provisioning, the memberships table may hold a more
      // privileged role than Clerk reports (e.g. the test-account seed
      // upgrades the caller to 'admin'). Prefer the DB role when it
      // exists — provisioning uses onConflictDoNothing() so that value
      // is stable across requests.
      if (orgId) {
        const [membership] = await db
          .select({ role: schema.memberships.role })
          .from(schema.memberships)
          .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
          .innerJoin(
            schema.organizations,
            eq(schema.organizations.id, schema.memberships.organizationId),
          )
          .where(
            and(
              eq(schema.users.clerkUserId, userId),
              eq(schema.organizations.clerkOrgId, orgId),
            ),
          )
          .limit(1);
        if (membership) effectiveRole = membership.role;
      }
    } catch (error) {
      // Non-fatal — the procedure will throw FORBIDDEN if provisioning didn't
      // happen. Log for observability so drift can be diagnosed in production.
      console.warn("[trpc] identity provisioning failed", {
        traceId,
        userId,
        orgId,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () =>
      createTRPCContext({
        db,
        userId: userId ?? null,
        orgId: orgId ?? null,
        role: effectiveRole,
        traceId,
        updateClerkOrgName: async (clerkOrgId, name) => {
          const client = await clerkClient();
          await client.organizations.updateOrganization(clerkOrgId, { name });
        },
      }),
  });
};

function mapRole(role: string | null) {
  if (role === "org:admin" || role === "admin") return "admin" as const;
  if (role === "org:manager" || role === "manager") return "manager" as const;
  if (role) return "operator" as const;
  return null;
}

export { handler as GET, handler as POST };
