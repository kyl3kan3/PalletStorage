import { z } from "zod";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { schema } from "@wms/db";
import { router, tenantProcedure, managerProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";

const profile = z.object({
  name: z.string().trim().min(1).max(200),
  contactName: z.string().trim().max(200).nullable().optional(),
  email: z.string().trim().email().nullable().optional().or(z.literal("")),
  phone: z.string().trim().max(64).nullable().optional(),
  addressLine1: z.string().trim().max(200).nullable().optional(),
  addressLine2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  region: z.string().trim().max(100).nullable().optional(),
  postalCode: z.string().trim().max(32).nullable().optional(),
  country: z.string().trim().max(100).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  active: z.boolean().optional(),
});

function normalize(input: z.infer<typeof profile>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    out[k] = v === "" ? null : v;
  }
  return out;
}

export const supplierRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    const orgId = await requireOrgId(ctx);
    return ctx.db
      .select()
      .from(schema.suppliers)
      .where(eq(schema.suppliers.organizationId, orgId))
      .orderBy(asc(schema.suppliers.name));
  }),

  search: tenantProcedure
    .input(z.object({ q: z.string().trim().default(""), limit: z.number().int().max(50).default(20) }).default({}))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const q = `%${input.q}%`;
      return ctx.db
        .select({
          id: schema.suppliers.id,
          name: schema.suppliers.name,
          contactName: schema.suppliers.contactName,
          email: schema.suppliers.email,
          active: schema.suppliers.active,
        })
        .from(schema.suppliers)
        .where(
          and(
            eq(schema.suppliers.organizationId, orgId),
            input.q
              ? or(
                  ilike(schema.suppliers.name, q),
                  ilike(schema.suppliers.contactName, q),
                  ilike(schema.suppliers.email, q),
                )
              : undefined,
          ),
        )
        .orderBy(asc(schema.suppliers.name))
        .limit(input.limit);
    }),

  byId: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const [row] = await ctx.db
        .select()
        .from(schema.suppliers)
        .where(
          and(
            eq(schema.suppliers.id, input.id),
            eq(schema.suppliers.organizationId, orgId),
          ),
        )
        .limit(1);
      if (!row) return null;
      const [inboundCount] = await ctx.db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.inboundOrders)
        .where(
          and(
            eq(schema.inboundOrders.organizationId, orgId),
            eq(schema.inboundOrders.supplierId, row.id),
          ),
        );
      return { supplier: row, inboundOrders: inboundCount?.n ?? 0 };
    }),

  create: managerProcedure.input(profile).mutation(async ({ ctx, input }) => {
    const orgId = await requireOrgId(ctx);
    const clean = normalize(input) as typeof schema.suppliers.$inferInsert;
    const [row] = await ctx.db
      .insert(schema.suppliers)
      .values({ ...clean, organizationId: orgId, name: input.name })
      .returning();
    return row;
  }),

  update: managerProcedure
    .input(profile.partial({ name: true }).extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const { id, ...rest } = input;
      const patch = normalize(rest as z.infer<typeof profile>);
      if (Object.keys(patch).length === 0) return { ok: true };
      await ctx.db
        .update(schema.suppliers)
        .set(patch)
        .where(
          and(
            eq(schema.suppliers.id, id),
            eq(schema.suppliers.organizationId, orgId),
          ),
        );
      return { ok: true };
    }),

  deactivate: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const result = await ctx.db
        .update(schema.suppliers)
        .set({ active: false })
        .where(
          and(
            eq(schema.suppliers.id, input.id),
            eq(schema.suppliers.organizationId, orgId),
          ),
        )
        .returning({ id: schema.suppliers.id });
      if (result.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Supplier not found" });
      }
      return { ok: true };
    }),
});
