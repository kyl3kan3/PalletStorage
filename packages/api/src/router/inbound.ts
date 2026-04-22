import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { schema } from "@wms/db";
import { router, tenantProcedure, managerProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";
import { assertInboundTransition, type InboundStatus } from "./_stateMachine";

export const inboundRouter = router({
  list: tenantProcedure
    .input(z.object({ warehouseId: z.string().uuid().optional() }).default({}))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db
        .select()
        .from(schema.inboundOrders)
        .where(
          and(
            eq(schema.inboundOrders.organizationId, orgId),
            input.warehouseId ? eq(schema.inboundOrders.warehouseId, input.warehouseId) : undefined,
          ),
        );
    }),

  create: tenantProcedure
    .input(
      z.object({
        warehouseId: z.string().uuid(),
        reference: z.string().min(1),
        supplier: z.string().optional(),
        supplierId: z.string().uuid().nullable().optional(),
        customerId: z.string().uuid().nullable().optional(),
        expectedAt: z.date().optional(),
        lines: z
          .array(
            z.object({
              productId: z.string().uuid(),
              qtyExpected: z.number().int().positive(),
            }),
          )
          .min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db.transaction(async (tx) => {
        const [order] = await tx
          .insert(schema.inboundOrders)
          .values({
            organizationId: orgId,
            warehouseId: input.warehouseId,
            reference: input.reference,
            supplier: input.supplier,
            supplierId: input.supplierId ?? null,
            customerId: input.customerId ?? null,
            expectedAt: input.expectedAt,
            status: "open",
          })
          .returning();

        await tx.insert(schema.inboundLines).values(
          input.lines.map((l) => ({
            organizationId: orgId,
            inboundOrderId: order!.id,
            productId: l.productId,
            qtyExpected: l.qtyExpected,
          })),
        );
        return order;
      });
    }),

  /** Detail view with lines, for the web dashboard. */
  byId: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const [order] = await ctx.db
        .select()
        .from(schema.inboundOrders)
        .where(and(eq(schema.inboundOrders.id, input.id), eq(schema.inboundOrders.organizationId, orgId)))
        .limit(1);
      if (!order) return null;
      const lines = await ctx.db
        .select()
        .from(schema.inboundLines)
        .where(
          and(
            eq(schema.inboundLines.inboundOrderId, order.id),
            eq(schema.inboundLines.organizationId, orgId),
          ),
        );
      return { order, lines };
    }),

  receiveLine: tenantProcedure
    .input(
      z.object({
        inboundLineId: z.string().uuid(),
        palletId: z.string().uuid(),
        qty: z.number().int().positive(),
        // Optional lot/batch number printed on the receipt; FEFO uses this
        // alongside expiry to rotate stock correctly.
        lot: z.string().trim().max(64).optional(),
        expiry: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db.transaction(async (tx) => {
        const [line] = await tx
          .select()
          .from(schema.inboundLines)
          .where(
            and(eq(schema.inboundLines.id, input.inboundLineId), eq(schema.inboundLines.organizationId, orgId)),
          )
          .limit(1);
        if (!line) throw new Error("Line not found");

        await tx.insert(schema.palletItems).values({
          organizationId: orgId,
          palletId: input.palletId,
          productId: line.productId,
          qty: input.qty,
          lot: input.lot,
          expiry: input.expiry,
        });

        await tx
          .update(schema.inboundLines)
          .set({ qtyReceived: line.qtyReceived + input.qty })
          .where(eq(schema.inboundLines.id, line.id));

        await tx
          .update(schema.pallets)
          .set({ status: "received" })
          .where(and(eq(schema.pallets.id, input.palletId), eq(schema.pallets.organizationId, orgId)));

        await tx.insert(schema.movements).values({
          organizationId: orgId,
          palletId: input.palletId,
          toLocationId: null,
          reason: "receive",
          refType: "inbound_order",
          refId: line.inboundOrderId,
        });

        // First receive on an 'open' order transitions it to 'receiving'.
        await tx
          .update(schema.inboundOrders)
          .set({ status: "receiving" })
          .where(
            and(
              eq(schema.inboundOrders.id, line.inboundOrderId),
              eq(schema.inboundOrders.organizationId, orgId),
              eq(schema.inboundOrders.status, "open"),
            ),
          );

        return { ok: true };
      });
    }),

  /**
   * Close an inbound order. Fully-received orders close without a reason; a
   * short-close (some line has qtyReceived < qtyExpected) requires manager
   * role and a `closeReason` so the shortfall is auditable.
   */
  close: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        closeReason: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(schema.inboundOrders)
          .where(and(eq(schema.inboundOrders.id, input.id), eq(schema.inboundOrders.organizationId, orgId)))
          .limit(1);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        assertInboundTransition(order.status as InboundStatus, "closed");

        const lines = await tx
          .select()
          .from(schema.inboundLines)
          .where(eq(schema.inboundLines.inboundOrderId, order.id));
        const shortLines = lines.filter((l) => l.qtyReceived < l.qtyExpected);
        if (shortLines.length > 0 && !input.closeReason) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Cannot short-close without a reason (${shortLines.length} line(s) under-received)`,
          });
        }

        const [userRow] = await tx
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.clerkUserId, ctx.userId))
          .limit(1);

        await tx
          .update(schema.inboundOrders)
          .set({
            status: "closed",
            closedAt: new Date(),
            closedByUserId: userRow?.id ?? null,
            closeReason: input.closeReason ?? null,
            receivedAt: order.receivedAt ?? new Date(),
          })
          .where(eq(schema.inboundOrders.id, order.id));

        return { ok: true, shortClosed: shortLines.length > 0 };
      });
    }),

  cancel: managerProcedure
    .input(z.object({ id: z.string().uuid(), reason: z.string().trim().max(500) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(schema.inboundOrders)
          .where(and(eq(schema.inboundOrders.id, input.id), eq(schema.inboundOrders.organizationId, orgId)))
          .limit(1);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        assertInboundTransition(order.status as InboundStatus, "cancelled");

        await tx
          .update(schema.inboundOrders)
          .set({ status: "cancelled", closeReason: input.reason })
          .where(eq(schema.inboundOrders.id, order.id));
        return { ok: true };
      });
    }),
});
