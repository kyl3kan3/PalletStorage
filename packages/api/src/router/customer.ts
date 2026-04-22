import { z } from "zod";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { schema } from "@wms/db";
import { router, tenantProcedure, managerProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";

// Shared profile schema — used by create + update.
const profile = z.object({
  name: z.string().trim().min(1).max(200),
  contactName: z.string().trim().max(200).nullable().optional(),
  email: z
    .string()
    .trim()
    .email()
    .nullable()
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(64).nullable().optional(),
  taxId: z.string().trim().max(64).nullable().optional(),
  billingLine1: z.string().trim().max(200).nullable().optional(),
  billingLine2: z.string().trim().max(200).nullable().optional(),
  billingCity: z.string().trim().max(100).nullable().optional(),
  billingRegion: z.string().trim().max(100).nullable().optional(),
  billingPostalCode: z.string().trim().max(32).nullable().optional(),
  billingCountry: z.string().trim().max(100).nullable().optional(),
  shippingLine1: z.string().trim().max(200).nullable().optional(),
  shippingLine2: z.string().trim().max(200).nullable().optional(),
  shippingCity: z.string().trim().max(100).nullable().optional(),
  shippingRegion: z.string().trim().max(100).nullable().optional(),
  shippingPostalCode: z.string().trim().max(32).nullable().optional(),
  shippingCountry: z.string().trim().max(100).nullable().optional(),
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

export const customerRouter = router({
  /** All customers in the current org, ordered by name. */
  list: tenantProcedure.query(async ({ ctx }) => {
    const orgId = await requireOrgId(ctx);
    return ctx.db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.organizationId, orgId))
      .orderBy(asc(schema.customers.name));
  }),

  /** Lightweight search for autocomplete on new-order forms. */
  search: tenantProcedure
    .input(z.object({ q: z.string().trim().default(""), limit: z.number().int().max(50).default(20) }).default({}))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const q = `%${input.q}%`;
      return ctx.db
        .select({
          id: schema.customers.id,
          name: schema.customers.name,
          contactName: schema.customers.contactName,
          email: schema.customers.email,
          active: schema.customers.active,
        })
        .from(schema.customers)
        .where(
          and(
            eq(schema.customers.organizationId, orgId),
            input.q
              ? or(
                  ilike(schema.customers.name, q),
                  ilike(schema.customers.contactName, q),
                  ilike(schema.customers.email, q),
                )
              : undefined,
          ),
        )
        .orderBy(asc(schema.customers.name))
        .limit(input.limit);
    }),

  /** Detail view + counts for the detail page. */
  byId: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const [row] = await ctx.db
        .select()
        .from(schema.customers)
        .where(
          and(
            eq(schema.customers.id, input.id),
            eq(schema.customers.organizationId, orgId),
          ),
        )
        .limit(1);
      if (!row) return null;

      // Quick counts so the detail page can render summary tiles without
      // waiting on the larger queries below.
      const [palletCount] = await ctx.db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.pallets)
        .where(
          and(
            eq(schema.pallets.organizationId, orgId),
            eq(schema.pallets.customerId, row.id),
            eq(schema.pallets.status, "stored"),
          ),
        );
      const [outboundCount] = await ctx.db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.outboundOrders)
        .where(
          and(
            eq(schema.outboundOrders.organizationId, orgId),
            eq(schema.outboundOrders.customerId, row.id),
          ),
        );
      const [inboundCount] = await ctx.db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.inboundOrders)
        .where(
          and(
            eq(schema.inboundOrders.organizationId, orgId),
            eq(schema.inboundOrders.customerId, row.id),
          ),
        );

      return {
        customer: row,
        storedPallets: palletCount?.n ?? 0,
        outboundOrders: outboundCount?.n ?? 0,
        inboundOrders: inboundCount?.n ?? 0,
      };
    }),

  create: managerProcedure.input(profile).mutation(async ({ ctx, input }) => {
    const orgId = await requireOrgId(ctx);
    const clean = normalize(input) as typeof schema.customers.$inferInsert;
    const [row] = await ctx.db
      .insert(schema.customers)
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
        .update(schema.customers)
        .set(patch)
        .where(
          and(
            eq(schema.customers.id, id),
            eq(schema.customers.organizationId, orgId),
          ),
        );
      return { ok: true };
    }),

  /**
   * Soft-delete: just flips `active` off. Hard delete is risky because
   * pallets/orders may reference the row (FK is ON DELETE SET NULL,
   * which would quietly orphan the linkage).
   */
  deactivate: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const result = await ctx.db
        .update(schema.customers)
        .set({ active: false })
        .where(
          and(
            eq(schema.customers.id, input.id),
            eq(schema.customers.organizationId, orgId),
          ),
        )
        .returning({ id: schema.customers.id });
      if (result.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      }
      return { ok: true };
    }),
});
