import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { appRouter, createTRPCContext, ensureProvisioned } from "@wms/api";
import { db } from "@wms/db";

const handler = async (req: Request) => {
  const { userId, orgId, orgRole } = await auth();

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
        role: mapRole(orgRole ?? null),
      });
    } catch {
      // Non-fatal — the procedure will throw FORBIDDEN if provisioning didn't happen.
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
        role: mapRole(orgRole ?? null),
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
