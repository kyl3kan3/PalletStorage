import { z } from "zod";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { schema } from "@wms/db";
import { router, tenantProcedure, managerProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";

/**
 * Dock scheduling. A truck calls in, we schedule an inbound or
 * outbound appointment. On arrival we mark it `at_dock` and assign a
 * door (a location of type='dock'). The appointment links to the
 * actual inbound/outbound order being worked, and the door assignment
 * propagates to that order so the existing receive / ship flows know
 * which door to use.
 */

const baseInput = z.object({
  warehouseId: z.string().uuid(),
  type: z.enum(["inbound", "outbound"]),
  scheduledAt: z.date(),
  carrier: z.string().trim().max(120).optional(),
  driverName: z.string().trim().max(120).optional(),
  driverPhone: z.string().trim().max(64).optional(),
  reference: z.string().trim().max(120).optional(),
  supplierId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  inboundOrderId: z.string().uuid().nullable().optional(),
  outboundOrderId: z.string().uuid().nullable().optional(),
  dockLocationId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const appointmentRouter = router({
  /**
   * List appointments. Defaults to a 14-day window centered on today
   * if no range is given — covers a typical "next two weeks" view.
   */
  list: tenantProcedure
    .input(
      z
        .object({
          from: z.date().optional(),
          to: z.date().optional(),
          type: z.enum(["inbound", "outbound"]).optional(),
          status: z
            .enum(["scheduled", "at_dock", "in_progress", "completed", "cancelled"])
            .optional(),
          warehouseId: z.string().uuid().optional(),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const now = new Date();
      const from =
        input.from ??
        new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days back
      const to =
        input.to ??
        new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days forward
      return ctx.db
        .select({
          id: schema.dockAppointments.id,
          warehouseId: schema.dockAppointments.warehouseId,
          type: schema.dockAppointments.type,
          scheduledAt: schema.dockAppointments.scheduledAt,
          carrier: schema.dockAppointments.carrier,
          driverName: schema.dockAppointments.driverName,
          driverPhone: schema.dockAppointments.driverPhone,
          reference: schema.dockAppointments.reference,
          supplierId: schema.dockAppointments.supplierId,
          supplierName: schema.suppliers.name,
          customerId: schema.dockAppointments.customerId,
          customerName: schema.customers.name,
          inboundOrderId: schema.dockAppointments.inboundOrderId,
          outboundOrderId: schema.dockAppointments.outboundOrderId,
          dockLocationId: schema.dockAppointments.dockLocationId,
          dockCode: schema.locations.code,
          status: schema.dockAppointments.status,
          notes: schema.dockAppointments.notes,
          arrivedAt: schema.dockAppointments.arrivedAt,
          completedAt: schema.dockAppointments.completedAt,
        })
        .from(schema.dockAppointments)
        .leftJoin(
          schema.suppliers,
          eq(schema.suppliers.id, schema.dockAppointments.supplierId),
        )
        .leftJoin(
          schema.customers,
          eq(schema.customers.id, schema.dockAppointments.customerId),
        )
        .leftJoin(
          schema.locations,
          eq(schema.locations.id, schema.dockAppointments.dockLocationId),
        )
        .where(
          and(
            eq(schema.dockAppointments.organizationId, orgId),
            input.warehouseId
              ? eq(schema.dockAppointments.warehouseId, input.warehouseId)
              : undefined,
            input.type
              ? eq(schema.dockAppointments.type, input.type)
              : undefined,
            input.status
              ? eq(schema.dockAppointments.status, input.status)
              : undefined,
            gte(schema.dockAppointments.scheduledAt, from),
            lte(schema.dockAppointments.scheduledAt, to),
          ),
        )
        .orderBy(asc(schema.dockAppointments.scheduledAt));
    }),

  byId: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const [row] = await ctx.db
        .select()
        .from(schema.dockAppointments)
        .where(
          and(
            eq(schema.dockAppointments.id, input.id),
            eq(schema.dockAppointments.organizationId, orgId),
          ),
        )
        .limit(1);
      if (!row)
        throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found" });
      return row;
    }),

  schedule: managerProcedure
    .input(baseInput)
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const [row] = await ctx.db
        .insert(schema.dockAppointments)
        .values({
          organizationId: orgId,
          warehouseId: input.warehouseId,
          type: input.type,
          scheduledAt: input.scheduledAt,
          carrier: input.carrier ?? null,
          driverName: input.driverName ?? null,
          driverPhone: input.driverPhone ?? null,
          reference: input.reference ?? null,
          supplierId: input.supplierId ?? null,
          customerId: input.customerId ?? null,
          inboundOrderId: input.inboundOrderId ?? null,
          outboundOrderId: input.outboundOrderId ?? null,
          dockLocationId: input.dockLocationId ?? null,
          notes: input.notes ?? null,
        })
        .returning({ id: schema.dockAppointments.id });
      if (!row)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to schedule appointment",
        });
      return { id: row.id };
    }),

  update: managerProcedure
    .input(baseInput.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const { id, ...rest } = input;
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v === undefined) continue;
        patch[k] = v === "" ? null : v;
      }
      if (Object.keys(patch).length === 0) return { ok: true };
      await ctx.db
        .update(schema.dockAppointments)
        .set(patch)
        .where(
          and(
            eq(schema.dockAppointments.id, id),
            eq(schema.dockAppointments.organizationId, orgId),
          ),
        );
      return { ok: true };
    }),

  /**
   * Mark a scheduled truck as arrived at the dock. Assigns the door
   * (location of type 'dock') to the appointment AND propagates it
   * onto the linked inbound or outbound order so the existing receive
   * / ship flows know which door to use.
   */
  checkIn: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        dockLocationId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const [appt] = await ctx.db
        .select()
        .from(schema.dockAppointments)
        .where(
          and(
            eq(schema.dockAppointments.id, input.id),
            eq(schema.dockAppointments.organizationId, orgId),
          ),
        )
        .limit(1);
      if (!appt)
        throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found" });

      return ctx.db.transaction(async (tx) => {
        await tx
          .update(schema.dockAppointments)
          .set({
            status: "at_dock",
            arrivedAt: new Date(),
            ...(input.dockLocationId
              ? { dockLocationId: input.dockLocationId }
              : {}),
          })
          .where(eq(schema.dockAppointments.id, input.id));

        const dockId = input.dockLocationId ?? appt.dockLocationId;
        if (dockId && appt.inboundOrderId) {
          await tx
            .update(schema.inboundOrders)
            .set({ receivingLocationId: dockId })
            .where(eq(schema.inboundOrders.id, appt.inboundOrderId));
        }
        if (dockId && appt.outboundOrderId) {
          await tx
            .update(schema.outboundOrders)
            .set({ shippingLocationId: dockId })
            .where(eq(schema.outboundOrders.id, appt.outboundOrderId));
        }
        // Auto-transition the linked inbound order from 'open' to
        // 'receiving' on truck arrival. Mirrors what the first
        // receiveLine call would have done — saves a manual step.
        // Guarded on status='open' so we don't reset draft or roll
        // back receiving→receiving etc.
        if (appt.inboundOrderId) {
          await tx
            .update(schema.inboundOrders)
            .set({ status: "receiving" })
            .where(
              and(
                eq(schema.inboundOrders.id, appt.inboundOrderId),
                eq(schema.inboundOrders.status, "open"),
              ),
            );
        }
        return { ok: true };
      });
    }),

  assignDoor: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        dockLocationId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const [appt] = await ctx.db
        .select()
        .from(schema.dockAppointments)
        .where(
          and(
            eq(schema.dockAppointments.id, input.id),
            eq(schema.dockAppointments.organizationId, orgId),
          ),
        )
        .limit(1);
      if (!appt)
        throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found" });

      return ctx.db.transaction(async (tx) => {
        await tx
          .update(schema.dockAppointments)
          .set({ dockLocationId: input.dockLocationId })
          .where(eq(schema.dockAppointments.id, input.id));
        if (appt.inboundOrderId) {
          await tx
            .update(schema.inboundOrders)
            .set({ receivingLocationId: input.dockLocationId })
            .where(eq(schema.inboundOrders.id, appt.inboundOrderId));
        }
        if (appt.outboundOrderId) {
          await tx
            .update(schema.outboundOrders)
            .set({ shippingLocationId: input.dockLocationId })
            .where(eq(schema.outboundOrders.id, appt.outboundOrderId));
        }
        return { ok: true };
      });
    }),

  complete: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      await ctx.db
        .update(schema.dockAppointments)
        .set({ status: "completed", completedAt: new Date() })
        .where(
          and(
            eq(schema.dockAppointments.id, input.id),
            eq(schema.dockAppointments.organizationId, orgId),
          ),
        );
      return { ok: true };
    }),

  cancel: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      await ctx.db
        .update(schema.dockAppointments)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(schema.dockAppointments.id, input.id),
            eq(schema.dockAppointments.organizationId, orgId),
          ),
        );
      return { ok: true };
    }),

  /**
   * Aggregated counts for the home Today board. Returns one number
   * per lane step so the UI can render counts without fetching every
   * appointment / order.
   */
  todayCounts: tenantProcedure.query(async ({ ctx }) => {
    const orgId = await requireOrgId(ctx);
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const [
      inboundScheduled,
      outboundScheduled,
      inboundAtDock,
      outboundAtDock,
      inboundReceiving,
      outboundPicking,
      outboundPacked,
      palletsAwaitingPutaway,
    ] = await Promise.all([
      ctx.db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.dockAppointments)
        .where(
          and(
            eq(schema.dockAppointments.organizationId, orgId),
            eq(schema.dockAppointments.type, "inbound"),
            eq(schema.dockAppointments.status, "scheduled"),
            gte(schema.dockAppointments.scheduledAt, startOfDay),
            lte(schema.dockAppointments.scheduledAt, endOfDay),
          ),
        ),
      ctx.db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.dockAppointments)
        .where(
          and(
            eq(schema.dockAppointments.organizationId, orgId),
            eq(schema.dockAppointments.type, "outbound"),
            eq(schema.dockAppointments.status, "scheduled"),
            gte(schema.dockAppointments.scheduledAt, startOfDay),
            lte(schema.dockAppointments.scheduledAt, endOfDay),
          ),
        ),
      ctx.db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.dockAppointments)
        .where(
          and(
            eq(schema.dockAppointments.organizationId, orgId),
            eq(schema.dockAppointments.type, "inbound"),
            eq(schema.dockAppointments.status, "at_dock"),
          ),
        ),
      ctx.db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.dockAppointments)
        .where(
          and(
            eq(schema.dockAppointments.organizationId, orgId),
            eq(schema.dockAppointments.type, "outbound"),
            eq(schema.dockAppointments.status, "at_dock"),
          ),
        ),
      ctx.db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.inboundOrders)
        .where(
          and(
            eq(schema.inboundOrders.organizationId, orgId),
            eq(schema.inboundOrders.status, "receiving"),
          ),
        ),
      ctx.db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.outboundOrders)
        .where(
          and(
            eq(schema.outboundOrders.organizationId, orgId),
            eq(schema.outboundOrders.status, "picking"),
          ),
        ),
      ctx.db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.outboundOrders)
        .where(
          and(
            eq(schema.outboundOrders.organizationId, orgId),
            eq(schema.outboundOrders.status, "packed"),
          ),
        ),
      ctx.db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.pallets)
        .where(
          and(
            eq(schema.pallets.organizationId, orgId),
            eq(schema.pallets.status, "received"),
          ),
        ),
    ]);

    return {
      inboundScheduledToday: inboundScheduled[0]?.n ?? 0,
      outboundScheduledToday: outboundScheduled[0]?.n ?? 0,
      inboundAtDock: inboundAtDock[0]?.n ?? 0,
      outboundAtDock: outboundAtDock[0]?.n ?? 0,
      inboundReceiving: inboundReceiving[0]?.n ?? 0,
      outboundPicking: outboundPicking[0]?.n ?? 0,
      outboundPacked: outboundPacked[0]?.n ?? 0,
      palletsAwaitingPutaway: palletsAwaitingPutaway[0]?.n ?? 0,
    };
  }),
});
