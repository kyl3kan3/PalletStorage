import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { schema } from "@wms/db";
import { router, tenantProcedure, managerProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";

// Columns we want shipped to the client. Excludes the mapPdfData
// bytea blob on purpose — a 3MB PDF sent through tRPC/superjson
// gets expanded into a millions-element array and blows past
// Vercel's response size + kills the page. The blob is served
// separately via /api/warehouses/[id]/map.
const warehouseSelect = {
  id: schema.warehouses.id,
  organizationId: schema.warehouses.organizationId,
  code: schema.warehouses.code,
  name: schema.warehouses.name,
  timezone: schema.warehouses.timezone,
  mapPdfUrl: schema.warehouses.mapPdfUrl,
  mapPdfFilename: schema.warehouses.mapPdfFilename,
  createdAt: schema.warehouses.createdAt,
};

export const warehouseRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    const orgId = await requireOrgId(ctx);
    return ctx.db
      .select(warehouseSelect)
      .from(schema.warehouses)
      .where(eq(schema.warehouses.organizationId, orgId));
  }),

  create: tenantProcedure
    .input(z.object({ code: z.string().min(1), name: z.string().min(1), timezone: z.string().default("UTC") }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const [row] = await ctx.db
        .insert(schema.warehouses)
        .values({ organizationId: orgId, ...input })
        .returning(warehouseSelect);
      return row;
    }),

  byId: tenantProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const orgId = await requireOrgId(ctx);
    const [row] = await ctx.db
      .select(warehouseSelect)
      .from(schema.warehouses)
      .where(and(eq(schema.warehouses.id, input.id), eq(schema.warehouses.organizationId, orgId)))
      .limit(1);
    return row ?? null;
  }),

  /** Save / clear the URL of a PDF floor map for the warehouse. */
  setMapPdfUrl: managerProcedure
    .input(z.object({ id: z.string().uuid(), url: z.string().url().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      await ctx.db
        .update(schema.warehouses)
        .set({ mapPdfUrl: input.url })
        .where(
          and(eq(schema.warehouses.id, input.id), eq(schema.warehouses.organizationId, orgId)),
        );
      return { ok: true };
    }),
});
