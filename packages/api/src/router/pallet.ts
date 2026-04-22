import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { schema } from "@wms/db";
import { generateLPN } from "@wms/core";
import { router, tenantProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";

export const palletRouter = router({
  byLpn: tenantProcedure.input(z.object({ lpn: z.string() })).query(async ({ ctx, input }) => {
    const orgId = await requireOrgId(ctx);
    const [pallet] = await ctx.db
      .select()
      .from(schema.pallets)
      .where(and(eq(schema.pallets.organizationId, orgId), eq(schema.pallets.lpn, input.lpn)))
      .limit(1);
    if (!pallet) return null;

    const items = await ctx.db
      .select()
      .from(schema.palletItems)
      .where(
        and(
          eq(schema.palletItems.palletId, pallet.id),
          eq(schema.palletItems.organizationId, orgId),
        ),
      );

    return { pallet, items };
  }),

  create: tenantProcedure
    .input(
      z.object({
        warehouseId: z.string().uuid(),
        weightKg: z.number().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const lpn = generateLPN();
      const [row] = await ctx.db
        .insert(schema.pallets)
        .values({
          organizationId: orgId,
          warehouseId: input.warehouseId,
          lpn,
          status: "in_transit",
          weightKg: input.weightKg?.toString(),
        })
        .returning();

      await ctx.db.insert(schema.labelCodes).values({
        organizationId: orgId,
        code: lpn,
        kind: "pallet",
        palletId: row!.id,
      });
      return row;
    }),

  move: tenantProcedure
    .input(
      z.object({
        palletId: z.string().uuid(),
        toLocationId: z.string().uuid(),
        reason: z.enum(["putaway", "move", "pick", "adjust"]).default("move"),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db.transaction(async (tx) => {
        const [pallet] = await tx
          .select()
          .from(schema.pallets)
          .where(and(eq(schema.pallets.id, input.palletId), eq(schema.pallets.organizationId, orgId)))
          .limit(1);
        if (!pallet) throw new Error("Pallet not found");

        await tx.insert(schema.movements).values({
          organizationId: orgId,
          palletId: pallet.id,
          fromLocationId: pallet.currentLocationId,
          toLocationId: input.toLocationId,
          reason: input.reason,
          notes: input.notes,
        });

        await tx
          .update(schema.pallets)
          .set({
            currentLocationId: input.toLocationId,
            status: input.reason === "putaway" ? "stored" : pallet.status,
          })
          .where(eq(schema.pallets.id, pallet.id));

        return { ok: true };
      });
    }),
});
