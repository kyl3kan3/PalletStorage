import { z } from "zod";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { schema } from "@wms/db";
import { router, tenantProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";

/**
 * Turn Postgres unique-violation errors (23505) into a readable tRPC
 * error. We raise this from product.create when a duplicate SKU would
 * otherwise surface as a raw "duplicate key value violates..." message.
 */
function isUniqueViolation(e: unknown): e is { code: string; constraint_name?: string } {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === "23505";
}

export const productRouter = router({
  search: tenantProcedure
    .input(z.object({ q: z.string().default(""), limit: z.number().int().min(1).max(500).default(25) }))
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
              sku: z.string().min(1).optional(),
              name: z.string().min(1),
              barcode: z.string().optional(),
              weightKg: z.number().positive().optional(),
              velocityClass: z.enum(["A", "B", "C"]).optional(),
              unitPriceCents: z.number().int().min(0).optional(),
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
        unitPriceCents: p.unitPriceCents,
      }));
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
            unitPriceCents: sql`excluded.unit_price_cents`,
          },
        });
      return { imported: rows.length };
    }),

  create: tenantProcedure
    .input(
      z.object({
        sku: z.string().min(1).optional(),
        name: z.string().min(1),
        barcode: z.string().optional(),
        weightKg: z.number().positive().optional(),
        velocityClass: z.enum(["A", "B", "C"]).optional(),
        unitPriceCents: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      try {
        const [row] = await ctx.db
          .insert(schema.products)
          .values({
            organizationId: orgId,
            sku: input.sku,
            name: input.name,
            barcode: input.barcode,
            weightKg: input.weightKg?.toString(),
            velocityClass: input.velocityClass,
            unitPriceCents: input.unitPriceCents,
          })
          .returning();
        return row;
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: input.sku
              ? `A product with SKU "${input.sku}" already exists. Pick a different SKU or leave it blank.`
              : "A product with these details already exists.",
          });
        }
        throw e;
      }
    }),

  /**
   * Update the unit price (cents). Kept as its own mutation so the
   * Products page can inline-edit without round-tripping every field.
   */
  setPrice: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        unitPriceCents: z.number().int().min(0).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      await ctx.db
        .update(schema.products)
        .set({ unitPriceCents: input.unitPriceCents })
        .where(and(eq(schema.products.id, input.id), eq(schema.products.organizationId, orgId)));
      return { ok: true };
    }),
});
