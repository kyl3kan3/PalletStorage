import { z } from "zod";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { schema } from "@wms/db";
import { router, tenantProcedure, managerProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";

/**
 * Cross-cutting task inbox. Surfaces the two things on the floor that
 * an operator actually needs to do next: the picks assigned to them,
 * and the cycle counts assigned to them. Managers get a second query
 * for the unassigned backlog so they can delegate.
 *
 * We intentionally don't introduce a generic `tasks` table — each task
 * type already has its own domain-specific row (picks, cycleCounts)
 * with status, due date, and variance tracking. A generic task layer
 * would just mirror fields and rot.
 */
export const taskRouter = router({
  /** Tasks currently assigned to the signed-in user. */
  listMine: tenantProcedure.query(async ({ ctx }) => {
    const orgId = await requireOrgId(ctx);
    const [user] = await ctx.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.clerkUserId, ctx.userId))
      .limit(1);
    if (!user) return { picks: [], counts: [] };

    const picks = await ctx.db
      .select({
        id: schema.picks.id,
        qty: schema.picks.qty,
        sequence: schema.picks.sequence,
        completedAt: schema.picks.completedAt,
        locationPath: schema.locations.path,
        orderReference: schema.outboundOrders.reference,
        orderCustomer: schema.outboundOrders.customer,
        orderId: schema.outboundOrders.id,
      })
      .from(schema.picks)
      .innerJoin(schema.outboundLines, eq(schema.outboundLines.id, schema.picks.outboundLineId))
      .innerJoin(schema.outboundOrders, eq(schema.outboundOrders.id, schema.outboundLines.outboundOrderId))
      .leftJoin(schema.locations, eq(schema.locations.id, schema.picks.fromLocationId))
      .where(
        and(
          eq(schema.picks.organizationId, orgId),
          eq(schema.picks.assignedUserId, user.id),
          isNull(schema.picks.completedAt),
        ),
      )
      .orderBy(schema.picks.sequence);

    const counts = await ctx.db
      .select({
        id: schema.cycleCounts.id,
        status: schema.cycleCounts.status,
        dueAt: schema.cycleCounts.dueAt,
        locationPath: schema.locations.path,
      })
      .from(schema.cycleCounts)
      .leftJoin(schema.locations, eq(schema.locations.id, schema.cycleCounts.locationId))
      .where(
        and(
          eq(schema.cycleCounts.organizationId, orgId),
          eq(schema.cycleCounts.assignedUserId, user.id),
          inArray(schema.cycleCounts.status, ["open", "counting"]),
        ),
      );

    return { picks, counts };
  }),

  /** Manager view: picks and counts nobody owns yet. */
  backlog: managerProcedure.query(async ({ ctx }) => {
    const orgId = await requireOrgId(ctx);
    const picks = await ctx.db
      .select({
        id: schema.picks.id,
        qty: schema.picks.qty,
        sequence: schema.picks.sequence,
        locationPath: schema.locations.path,
        orderReference: schema.outboundOrders.reference,
        orderId: schema.outboundOrders.id,
      })
      .from(schema.picks)
      .innerJoin(schema.outboundLines, eq(schema.outboundLines.id, schema.picks.outboundLineId))
      .innerJoin(schema.outboundOrders, eq(schema.outboundOrders.id, schema.outboundLines.outboundOrderId))
      .leftJoin(schema.locations, eq(schema.locations.id, schema.picks.fromLocationId))
      .where(
        and(
          eq(schema.picks.organizationId, orgId),
          isNull(schema.picks.assignedUserId),
          isNull(schema.picks.completedAt),
        ),
      )
      .orderBy(schema.picks.sequence);

    const counts = await ctx.db
      .select({
        id: schema.cycleCounts.id,
        status: schema.cycleCounts.status,
        dueAt: schema.cycleCounts.dueAt,
        locationPath: schema.locations.path,
      })
      .from(schema.cycleCounts)
      .leftJoin(schema.locations, eq(schema.locations.id, schema.cycleCounts.locationId))
      .where(
        and(
          eq(schema.cycleCounts.organizationId, orgId),
          isNull(schema.cycleCounts.assignedUserId),
          inArray(schema.cycleCounts.status, ["open", "counting"]),
        ),
      );

    return { picks, counts };
  }),

  /** Assign or unassign a pick. Pass null to take it back into the pool. */
  assignPick: managerProcedure
    .input(
      z.object({
        pickId: z.string().uuid(),
        userId: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const result = await ctx.db
        .update(schema.picks)
        .set({ assignedUserId: input.userId })
        .where(and(eq(schema.picks.id, input.pickId), eq(schema.picks.organizationId, orgId)))
        .returning({ id: schema.picks.id });
      if (result.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pick not found" });
      }
      return { ok: true };
    }),

  /** Same for cycle counts. */
  assignCycleCount: managerProcedure
    .input(
      z.object({
        cycleCountId: z.string().uuid(),
        userId: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const result = await ctx.db
        .update(schema.cycleCounts)
        .set({ assignedUserId: input.userId })
        .where(
          and(
            eq(schema.cycleCounts.id, input.cycleCountId),
            eq(schema.cycleCounts.organizationId, orgId),
          ),
        )
        .returning({ id: schema.cycleCounts.id });
      if (result.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cycle count not found" });
      }
      return { ok: true };
    }),
});
