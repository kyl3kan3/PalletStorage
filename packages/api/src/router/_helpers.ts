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
