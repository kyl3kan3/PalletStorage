import { z } from "zod";
import { eq } from "drizzle-orm";
import { schema } from "@wms/db";
import { router, tenantProcedure } from "../trpc";

export const organizationRouter = router({
  current: tenantProcedure.query(async ({ ctx }) => {
    const [org] = await ctx.db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.clerkOrgId, ctx.orgId))
      .limit(1);
    return org ?? null;
  }),

  rename: tenantProcedure.input(z.object({ name: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    await ctx.db
      .update(schema.organizations)
      .set({ name: input.name })
      .where(eq(schema.organizations.clerkOrgId, ctx.orgId));
    return { ok: true };
  }),
});
