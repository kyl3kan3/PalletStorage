import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { schema } from "@wms/db";
import { router, tenantProcedure, managerProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";

const profileInput = z.object({
  name: z.string().min(1).max(200).optional(),
  legalName: z.string().trim().max(200).nullable().optional(),
  billingEmail: z.string().trim().email().nullable().optional().or(z.literal("")),
  phone: z.string().trim().max(64).nullable().optional(),
  taxId: z.string().trim().max(64).nullable().optional(),
  addressLine1: z.string().trim().max(200).nullable().optional(),
  addressLine2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  region: z.string().trim().max(100).nullable().optional(),
  postalCode: z.string().trim().max(32).nullable().optional(),
  country: z.string().trim().max(100).nullable().optional(),
  timezone: z.string().trim().max(64).optional(),
  logoUrl: z.string().trim().url().nullable().optional().or(z.literal("")),
});

export const organizationRouter = router({
  current: tenantProcedure.query(async ({ ctx }) => {
    const [org] = await ctx.db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.clerkOrgId, ctx.orgId))
      .limit(1);
    return org ?? null;
  }),

  rename: tenantProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(schema.organizations)
        .set({ name: input.name })
        .where(eq(schema.organizations.clerkOrgId, ctx.orgId));
      return { ok: true };
    }),

  /**
   * Update the company profile. Manager-or-admin only — anyone on the
   * floor shouldn't be able to change the legal address used on BOLs.
   * Empty strings from form fields are coerced to NULL.
   */
  updateProfile: managerProcedure
    .input(profileInput)
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      // Whitelist the columns we actually update so stray keys can't
      // sneak through (defense-in-depth alongside zod's strict types).
      const patch: Record<string, string | null> = {};
      const assign = (
        key: keyof typeof input,
        col: keyof typeof schema.organizations.$inferInsert,
      ) => {
        const v = input[key];
        if (v === undefined) return;
        patch[col as string] = v === "" ? null : (v ?? null);
      };
      assign("name", "name");
      assign("legalName", "legalName");
      assign("billingEmail", "billingEmail");
      assign("phone", "phone");
      assign("taxId", "taxId");
      assign("addressLine1", "addressLine1");
      assign("addressLine2", "addressLine2");
      assign("city", "city");
      assign("region", "region");
      assign("postalCode", "postalCode");
      assign("country", "country");
      assign("timezone", "timezone");
      assign("logoUrl", "logoUrl");

      if (Object.keys(patch).length === 0) return { ok: true };

      await ctx.db
        .update(schema.organizations)
        .set(patch)
        .where(eq(schema.organizations.id, orgId));
      return { ok: true };
    }),

  /**
   * Members of the current organization joined to users. Used by the
   * Settings → Team page as a lightweight mirror of what Clerk
   * exposes. Clerk remains the source of truth for invites + role
   * changes — we're just showing what our DB sees so the UI can
   * indicate which users the WMS has provisioned.
   */
  members: tenantProcedure.query(async ({ ctx }) => {
    const orgId = await requireOrgId(ctx);
    return ctx.db
      .select({
        userId: schema.users.id,
        clerkUserId: schema.users.clerkUserId,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.memberships.role,
        joinedAt: schema.memberships.createdAt,
      })
      .from(schema.memberships)
      .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
      .where(eq(schema.memberships.organizationId, orgId));
  }),

  /**
   * Effective role of the signed-in user in the active org, as computed
   * by the tRPC handler (prefers the memberships-table value over
   * Clerk's reported role — see apps/web/src/app/api/trpc/[trpc]/route.ts).
   * Returned as a plain string so the client can gate UI without
   * reimplementing the Clerk↔DB reconciliation.
   */
  myRole: tenantProcedure.query(({ ctx }) => {
    return { role: ctx.role ?? "operator" };
  }),

  /**
   * Onboarding checklist. Shown on Home for freshly-provisioned orgs.
   * Each step is boolean (done or not); the client renders a
   * dismissible card when any of them are unchecked. Counts are
   * cheap because every table is already indexed on organization_id.
   */
  onboarding: tenantProcedure.query(async ({ ctx }) => {
    const orgId = await requireOrgId(ctx);
    const one = async (
      table:
        | typeof schema.warehouses
        | typeof schema.products
        | typeof schema.customers
        | typeof schema.suppliers
        | typeof schema.inboundOrders
        | typeof schema.outboundOrders,
    ) => {
      const [row] = await ctx.db
        .select({ n: sql<number>`count(*)::int` })
        .from(table)
        .where(eq(table.organizationId, orgId));
      return (row?.n ?? 0) > 0;
    };
    const [warehouse, product, customer, supplier, inbound, outbound] =
      await Promise.all([
        one(schema.warehouses),
        one(schema.products),
        one(schema.customers),
        one(schema.suppliers),
        one(schema.inboundOrders),
        one(schema.outboundOrders),
      ]);
    return {
      warehouse,
      product,
      customer,
      supplier,
      inbound,
      outbound,
      /** All "core" steps done. Catalog extras (customer/supplier) are optional. */
      coreDone: warehouse && product && (inbound || outbound),
    };
  }),
});
