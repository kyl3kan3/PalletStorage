import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { schema } from "@wms/db";
import { router, tenantProcedure, managerProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";

/**
 * Cycle counts: location-scoped stock takes. Flow:
 *   1. create(locationId)   — snapshots expected qtys, status='open'
 *   2. submitCount(lines)   — operator records counted qtys, status='reviewing'
 *   3. approve()            — manager signs off; any variance becomes a
 *                             movement row and updates palletItems.qty,
 *                             status='closed'
 */
export const cycleCountRouter = router({
  listOpen: tenantProcedure.query(async ({ ctx }) => {
    const orgId = await requireOrgId(ctx);
    return ctx.db
      .select()
      .from(schema.cycleCounts)
      .where(
        and(
          eq(schema.cycleCounts.organizationId, orgId),
          inArray(schema.cycleCounts.status, ["open", "counting", "reviewing"]),
        ),
      );
  }),

  byId: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const [cc] = await ctx.db
        .select()
        .from(schema.cycleCounts)
        .where(and(eq(schema.cycleCounts.id, input.id), eq(schema.cycleCounts.organizationId, orgId)))
        .limit(1);
      if (!cc) return null;
      const lines = await ctx.db
        .select()
        .from(schema.cycleCountLines)
        .where(eq(schema.cycleCountLines.cycleCountId, cc.id));
      return { count: cc, lines };
    }),

  create: managerProcedure
    .input(
      z.object({
        warehouseId: z.string().uuid(),
        locationId: z.string().uuid(),
        dueAt: z.date().optional(),
        assignedUserId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db.transaction(async (tx) => {
        // Snapshot of what's at this location right now. We grab every
        // palletItem on every pallet currently parked there.
        const snapshot = await tx
          .select({
            palletItemId: schema.palletItems.id,
            qty: schema.palletItems.qty,
          })
          .from(schema.palletItems)
          .innerJoin(schema.pallets, eq(schema.pallets.id, schema.palletItems.palletId))
          .where(
            and(
              eq(schema.palletItems.organizationId, orgId),
              eq(schema.pallets.currentLocationId, input.locationId),
            ),
          );

        const [cc] = await tx
          .insert(schema.cycleCounts)
          .values({
            organizationId: orgId,
            warehouseId: input.warehouseId,
            locationId: input.locationId,
            assignedUserId: input.assignedUserId,
            dueAt: input.dueAt,
            status: "open",
          })
          .returning();

        if (snapshot.length > 0) {
          await tx.insert(schema.cycleCountLines).values(
            snapshot.map((s) => ({
              organizationId: orgId,
              cycleCountId: cc!.id,
              palletItemId: s.palletItemId,
              expectedQty: s.qty,
            })),
          );
        }

        return cc;
      });
    }),

  submitCount: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        lines: z
          .array(
            z.object({
              palletItemId: z.string().uuid(),
              countedQty: z.number().int().min(0),
              notes: z.string().trim().max(500).optional(),
            }),
          )
          .min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db.transaction(async (tx) => {
        const [cc] = await tx
          .select()
          .from(schema.cycleCounts)
          .where(and(eq(schema.cycleCounts.id, input.id), eq(schema.cycleCounts.organizationId, orgId)))
          .limit(1);
        if (!cc) throw new TRPCError({ code: "NOT_FOUND", message: "Count not found" });
        if (cc.status !== "open" && cc.status !== "counting") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Cannot submit count in status '${cc.status}'`,
          });
        }

        for (const l of input.lines) {
          await tx
            .update(schema.cycleCountLines)
            .set({ countedQty: l.countedQty, notes: l.notes })
            .where(
              and(
                eq(schema.cycleCountLines.cycleCountId, cc.id),
                eq(schema.cycleCountLines.palletItemId, l.palletItemId),
              ),
            );
        }

        await tx
          .update(schema.cycleCounts)
          .set({ status: "reviewing", submittedAt: new Date() })
          .where(eq(schema.cycleCounts.id, cc.id));
        return { ok: true };
      });
    }),

  /**
   * Manager sign-off. Any line with countedQty !== expectedQty generates a
   * cycle_count movement (variance in notes) and the palletItem.qty is
   * updated to match the counted qty. Closes the count.
   */
  approve: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db.transaction(async (tx) => {
        const [cc] = await tx
          .select()
          .from(schema.cycleCounts)
          .where(and(eq(schema.cycleCounts.id, input.id), eq(schema.cycleCounts.organizationId, orgId)))
          .limit(1);
        if (!cc) throw new TRPCError({ code: "NOT_FOUND", message: "Count not found" });
        if (cc.status !== "reviewing") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Cannot approve count in status '${cc.status}' (must be 'reviewing')`,
          });
        }

        const [userRow] = await tx
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.clerkUserId, ctx.userId))
          .limit(1);

        const lines = await tx
          .select({
            line: schema.cycleCountLines,
            palletId: schema.palletItems.palletId,
          })
          .from(schema.cycleCountLines)
          .innerJoin(
            schema.palletItems,
            eq(schema.palletItems.id, schema.cycleCountLines.palletItemId),
          )
          .where(eq(schema.cycleCountLines.cycleCountId, cc.id));

        let variances = 0;
        for (const { line, palletId } of lines) {
          if (line.countedQty == null) continue; // not counted → skip
          const delta = line.countedQty - line.expectedQty;
          if (delta === 0) continue;

          await tx
            .update(schema.palletItems)
            .set({ qty: line.countedQty })
            .where(eq(schema.palletItems.id, line.palletItemId));

          await tx.insert(schema.movements).values({
            organizationId: orgId,
            palletId,
            fromLocationId: cc.locationId,
            toLocationId: cc.locationId,
            reason: "cycle_count",
            userId: userRow?.id ?? null,
            refType: "cycle_count",
            refId: cc.id,
            notes: `variance ${delta > 0 ? "+" : ""}${delta} (expected ${line.expectedQty}, counted ${line.countedQty})`,
          });
          variances += 1;
        }

        await tx
          .update(schema.cycleCounts)
          .set({
            status: "closed",
            approvedAt: new Date(),
            approvedByUserId: userRow?.id ?? null,
          })
          .where(eq(schema.cycleCounts.id, cc.id));

        return { ok: true, variances };
      });
    }),

  cancel: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      await ctx.db
        .update(schema.cycleCounts)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(schema.cycleCounts.id, input.id),
            eq(schema.cycleCounts.organizationId, orgId),
          ),
        );
      return { ok: true };
    }),
});
