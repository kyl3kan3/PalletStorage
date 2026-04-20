import { z } from "zod";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { schema } from "@wms/db";
import { router, tenantProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";

export const productRouter = router({
  search: tenantProcedure
    .input(z.object({ q: z.string().default(""), limit: z.number().int().min(1).max(100).default(25) }))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const q = `%${input.q}%`;
      return ctx.db
        .select()
        .from(schema.products)
        .where(
          and(
            eq(schema.products.organizationId, orgId),
            input.q
              ? or(ilike(schema.products.sku, q), ilike(schema.products.name, q), ilike(schema.products.barcode, q))
              : undefined,
          ),
        )
        .limit(input.limit);
    }),

  bulkImport: tenantProcedure
    .input(
      z.object({
        products: z
          .array(
            z.object({
              sku: z.string().min(1),
              name: z.string().min(1),
              barcode: z.string().optional(),
              weightKg: z.number().positive().optional(),
              velocityClass: z.enum(["A", "B", "C"]).optional(),
            }),
          )
          .min(1)
          .max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const rows = input.products.map((p) => ({
        organizationId: orgId,
        sku: p.sku,
        name: p.name,
        barcode: p.barcode,
        weightKg: p.weightKg?.toString(),
        velocityClass: p.velocityClass,
      }));
      // onConflictDoUpdate on (organization_id, sku) so re-imports update
      // rather than fail — standard ETL behaviour.
      await ctx.db
        .insert(schema.products)
        .values(rows)
        .onConflictDoUpdate({
          target: [schema.products.organizationId, schema.products.sku],
          set: {
            name: sql`excluded.name`,
            barcode: sql`excluded.barcode`,
            weightKg: sql`excluded.weight_kg`,
            velocityClass: sql`excluded.velocity_class`,
          },
        });
      return { imported: rows.length };
    }),

  create: tenantProcedure
    .input(
      z.object({
        sku: z.string().min(1),
        name: z.string().min(1),
        barcode: z.string().optional(),
        weightKg: z.number().positive().optional(),
        velocityClass: z.enum(["A", "B", "C"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const [row] = await ctx.db
        .insert(schema.products)
        .values({
          organizationId: orgId,
          sku: input.sku,
          name: input.name,
          barcode: input.barcode,
          weightKg: input.weightKg?.toString(),
          velocityClass: input.velocityClass,
        })
        .returning();
      return row;
    }),
});
