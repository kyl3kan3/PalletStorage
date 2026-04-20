import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { schema } from "@wms/db";
import { classifyCode } from "@wms/core";
import { router, tenantProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";
import type { Context } from "../trpc";

async function resolveImpl(ctx: Context & { orgId: string }, code: string) {
  const orgId = await requireOrgId(ctx);
  const classified = classifyCode(code);

  const [label] = await ctx.db
    .select()
    .from(schema.labelCodes)
    .where(and(eq(schema.labelCodes.code, classified.code), eq(schema.labelCodes.organizationId, orgId)))
    .limit(1);

  if (!label) return { kind: "unknown" as const, code: classified.code };

  if (label.kind === "pallet" && label.palletId) {
    const [pallet] = await ctx.db
      .select()
      .from(schema.pallets)
      .where(eq(schema.pallets.id, label.palletId))
      .limit(1);
    return { kind: "pallet" as const, code: classified.code, pallet };
  }

  if (label.kind === "location" && label.locationId) {
    const [location] = await ctx.db
      .select()
      .from(schema.locations)
      .where(eq(schema.locations.id, label.locationId))
      .limit(1);
    return { kind: "location" as const, code: classified.code, location };
  }

  return { kind: "unknown" as const, code: classified.code };
}

/**
 * Resolve a scanned code (LPN or location label) into its underlying entity.
 * Exposed both as a query (for reactive UIs) and a mutation (for imperative
 * scan flows that want a one-shot network call).
 */
export const scanRouter = router({
  resolve: tenantProcedure.input(z.object({ code: z.string().min(1) })).query(({ ctx, input }) => {
    return resolveImpl(ctx, input.code);
  }),
  resolveOnce: tenantProcedure.input(z.object({ code: z.string().min(1) })).mutation(({ ctx, input }) => {
    return resolveImpl(ctx, input.code);
  }),
});
