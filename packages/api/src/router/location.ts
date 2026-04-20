import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { schema } from "@wms/db";
import { generateLocationCode } from "@wms/core";
import { router, tenantProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";

export const locationRouter = router({
  listByWarehouse: tenantProcedure
    .input(z.object({ warehouseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db
        .select()
        .from(schema.locations)
        .where(
          and(
            eq(schema.locations.organizationId, orgId),
            eq(schema.locations.warehouseId, input.warehouseId),
          ),
        );
    }),

  create: tenantProcedure
    .input(
      z.object({
        warehouseId: z.string().uuid(),
        parentId: z.string().uuid().nullable().optional(),
        code: z.string().min(1),
        path: z.string().min(1),
        type: z.enum(["floor", "rack", "staging", "dock"]).default("rack"),
        maxWeightKg: z.number().positive().optional(),
        velocityClass: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const [row] = await ctx.db
        .insert(schema.locations)
        .values({
          organizationId: orgId,
          warehouseId: input.warehouseId,
          parentId: input.parentId ?? null,
          code: input.code,
          path: input.path,
          type: input.type,
          maxWeightKg: input.maxWeightKg?.toString(),
          velocityClass: input.velocityClass,
        })
        .returning();

      // Issue a scannable label code for this location.
      await ctx.db.insert(schema.labelCodes).values({
        organizationId: orgId,
        code: generateLocationCode(),
        kind: "location",
        locationId: row!.id,
      });
      return row;
    }),
});
