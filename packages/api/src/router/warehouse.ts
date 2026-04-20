import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { schema } from "@wms/db";
import { router, tenantProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";

export const warehouseRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    const orgId = await requireOrgId(ctx);
    return ctx.db.select().from(schema.warehouses).where(eq(schema.warehouses.organizationId, orgId));
  }),

  create: tenantProcedure
    .input(z.object({ code: z.string().min(1), name: z.string().min(1), timezone: z.string().default("UTC") }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const [row] = await ctx.db
        .insert(schema.warehouses)
        .values({ organizationId: orgId, ...input })
        .returning();
      return row;
    }),

  byId: tenantProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const orgId = await requireOrgId(ctx);
    const [row] = await ctx.db
      .select()
      .from(schema.warehouses)
      .where(and(eq(schema.warehouses.id, input.id), eq(schema.warehouses.organizationId, orgId)))
      .limit(1);
    return row ?? null;
  }),
});
