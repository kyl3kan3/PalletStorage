import { z } from "zod";
import { and, eq, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { schema } from "@wms/db";
import { allocate, generateBolNumber, orderPicksSShape, parseAisleBay, toEaches } from "@wms/core";
import { router, tenantProcedure, managerProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";
import { assertOutboundTransition, type OutboundStatus } from "./_stateMachine";

export const outboundRouter = router({
  list: tenantProcedure
    .input(z.object({ warehouseId: z.string().uuid().optional() }).default({}))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db
        .select()
        .from(schema.outboundOrders)
        .where(
          and(
            eq(schema.outboundOrders.organizationId, orgId),
            input.warehouseId ? eq(schema.outboundOrders.warehouseId, input.warehouseId) : undefined,
          ),
        );
    }),

  create: tenantProcedure
    .input(
      z.object({
        warehouseId: z.string().uuid(),
        reference: z.string().min(1),
        customer: z.string().optional(),
        customerId: z.string().uuid().nullable().optional(),
        shipBy: z.date().optional(),
        lines: z
          .array(
            z.object({
              productId: z.string().uuid(),
              qtyOrdered: z.number().int().positive(),
              qtyUnit: z.enum(["each", "case", "pallet"]).optional(),
            }),
          )
          .min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db.transaction(async (tx) => {
        const [order] = await tx
          .insert(schema.outboundOrders)
          .values({
            organizationId: orgId,
            warehouseId: input.warehouseId,
            reference: input.reference,
            customer: input.customer,
            customerId: input.customerId ?? null,
            shipBy: input.shipBy,
            status: "open",
          })
          .returning();

        await tx.insert(schema.outboundLines).values(
          input.lines.map((l) => ({
            organizationId: orgId,
            outboundOrderId: order!.id,
            productId: l.productId,
            qtyOrdered: l.qtyOrdered,
            qtyUnit: l.qtyUnit ?? "each",
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
        .from(schema.outboundOrders)
        .where(and(eq(schema.outboundOrders.id, input.id), eq(schema.outboundOrders.organizationId, orgId)))
        .limit(1);
      if (!order) return null;
      const lines = await ctx.db
        .select({
          id: schema.outboundLines.id,
          organizationId: schema.outboundLines.organizationId,
          outboundOrderId: schema.outboundLines.outboundOrderId,
          productId: schema.outboundLines.productId,
          qtyOrdered: schema.outboundLines.qtyOrdered,
          qtyPicked: schema.outboundLines.qtyPicked,
          qtyUnit: schema.outboundLines.qtyUnit,
          unitsPerCase: schema.products.unitsPerCase,
          casesPerPallet: schema.products.casesPerPallet,
        })
        .from(schema.outboundLines)
        .leftJoin(schema.products, eq(schema.products.id, schema.outboundLines.productId))
        .where(
          and(
            eq(schema.outboundLines.outboundOrderId, order.id),
            eq(schema.outboundLines.organizationId, orgId),
          ),
        );
      return { order, lines };
    }),

  /**
   * Allocate stock to an order: for each outbound line, find pallets holding
   * that product and create `picks` rows ordered along an S-shape path.
   */
  generatePicks: tenantProcedure
    .input(z.object({ outboundOrderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(schema.outboundOrders)
          .where(
            and(
              eq(schema.outboundOrders.id, input.outboundOrderId),
              eq(schema.outboundOrders.organizationId, orgId),
            ),
          )
          .limit(1);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        if (order.status !== "open" && order.status !== "draft") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Cannot generate picks for order in status '${order.status}'`,
          });
        }

        const lines = await tx
          .select()
          .from(schema.outboundLines)
          .where(
            and(
              eq(schema.outboundLines.outboundOrderId, input.outboundOrderId),
              eq(schema.outboundLines.organizationId, orgId),
            ),
          );

        // Fetch pack hierarchy for the products on this order, so
        // qtyOrdered in pallets/cases converts to eaches for allocation.
        const productIds = Array.from(new Set(lines.map((l) => l.productId)));
        const packRows = productIds.length
          ? await tx
              .select({
                id: schema.products.id,
                unitsPerCase: schema.products.unitsPerCase,
                casesPerPallet: schema.products.casesPerPallet,
              })
              .from(schema.products)
              .where(inArray(schema.products.id, productIds))
          : [];
        const packById = new Map(packRows.map((p) => [p.id, p]));

        type Candidate = {
          outboundLineId: string;
          palletId: string;
          fromLocationId: string;
          qty: number;
          path: string;
        };
        const candidates: Candidate[] = [];

        for (const line of lines) {
          const stock = await tx
            .select({
              palletItemId: schema.palletItems.id,
              palletId: schema.pallets.id,
              qty: schema.palletItems.qty,
              expiry: schema.palletItems.expiry,
              locationId: schema.pallets.currentLocationId,
              path: schema.locations.path,
              palletCreatedAt: schema.pallets.createdAt,
            })
            .from(schema.palletItems)
            .innerJoin(schema.pallets, eq(schema.pallets.id, schema.palletItems.palletId))
            .innerJoin(schema.locations, eq(schema.locations.id, schema.pallets.currentLocationId))
            .where(
              and(
                eq(schema.palletItems.organizationId, orgId),
                eq(schema.palletItems.productId, line.productId),
                eq(schema.pallets.status, "stored"),
              ),
            );

          // FEFO (with FIFO fallback by pallet.createdAt when no expiry set).
          const pack = packById.get(line.productId) ?? {};
          const orderedEaches = toEaches(line.qtyOrdered, line.qtyUnit, pack);
          const remaining = orderedEaches - line.qtyPicked;
          const allocations = allocate(
            remaining,
            stock
              .filter((s) => s.locationId != null)
              .map((s) => ({
                key: s.palletItemId,
                qty: s.qty,
                expiry: s.expiry ?? null,
                receivedAt: s.palletCreatedAt ?? null,
                _source: s,
              })),
            "fefo",
          );

          for (const a of allocations) {
            const s = a.candidate._source;
            candidates.push({
              outboundLineId: line.id,
              palletId: s.palletId,
              fromLocationId: s.locationId!,
              qty: a.take,
              path: s.path,
            });
          }
        }

        const ordered = orderPicksSShape(
          candidates.map((c) => ({ ...parseAisleBay(c.path), payload: c })),
        );

        if (ordered.length) {
          await tx.insert(schema.picks).values(
            ordered.map((o, i) => ({
              organizationId: orgId,
              outboundLineId: o.payload.outboundLineId,
              palletId: o.payload.palletId,
              fromLocationId: o.payload.fromLocationId,
              qty: o.payload.qty,
              sequence: i,
            })),
          );
        }

        await tx
          .update(schema.outboundOrders)
          .set({ status: "picking" })
          .where(eq(schema.outboundOrders.id, input.outboundOrderId));

        return { created: ordered.length };
      });
    }),

  /** All open picks for the current operator, sorted by sequence. */
  myPicks: tenantProcedure.query(async ({ ctx }) => {
    const orgId = await requireOrgId(ctx);
    return ctx.db
      .select({
        pick: schema.picks,
        line: schema.outboundLines,
        order: schema.outboundOrders,
        location: schema.locations,
      })
      .from(schema.picks)
      .innerJoin(schema.outboundLines, eq(schema.outboundLines.id, schema.picks.outboundLineId))
      .innerJoin(schema.outboundOrders, eq(schema.outboundOrders.id, schema.outboundLines.outboundOrderId))
      .leftJoin(schema.locations, eq(schema.locations.id, schema.picks.fromLocationId))
      .where(and(eq(schema.picks.organizationId, orgId), isNull(schema.picks.completedAt)))
      .orderBy(schema.picks.sequence);
  }),

  /** Operator confirms they've pulled a pick from its source location. */
  completePick: tenantProcedure
    .input(z.object({ pickId: z.string().uuid(), stagingLocationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db.transaction(async (tx) => {
        const [pick] = await tx
          .select()
          .from(schema.picks)
          .where(and(eq(schema.picks.id, input.pickId), eq(schema.picks.organizationId, orgId)))
          .limit(1);
        if (!pick) throw new Error("Pick not found");
        if (pick.completedAt) return { ok: true, alreadyCompleted: true };

        if (pick.palletId) {
          await tx.insert(schema.movements).values({
            organizationId: orgId,
            palletId: pick.palletId,
            fromLocationId: pick.fromLocationId,
            toLocationId: input.stagingLocationId,
            reason: "pick",
            refType: "outbound_line",
            refId: pick.outboundLineId,
          });
          await tx
            .update(schema.pallets)
            .set({ currentLocationId: input.stagingLocationId, status: "picked" })
            .where(eq(schema.pallets.id, pick.palletId));
        }

        await tx
          .update(schema.picks)
          .set({ completedAt: new Date() })
          .where(eq(schema.picks.id, pick.id));

        await tx
          .update(schema.outboundLines)
          .set({ qtyPicked: sql`${schema.outboundLines.qtyPicked} + ${pick.qty}` })
          .where(eq(schema.outboundLines.id, pick.outboundLineId));

        return { ok: true };
      });
    }),

  /**
   * Confirm all picks are complete and the order is staged for shipping.
   * Requires every line to be fully picked. Transitions picking → packed.
   */
  pack: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(schema.outboundOrders)
          .where(and(eq(schema.outboundOrders.id, input.id), eq(schema.outboundOrders.organizationId, orgId)))
          .limit(1);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        assertOutboundTransition(order.status as OutboundStatus, "packed");

        const lines = await tx
          .select()
          .from(schema.outboundLines)
          .where(eq(schema.outboundLines.outboundOrderId, order.id));

        // qtyPicked is in eaches; qtyOrdered may be in pallets/cases —
        // convert via product pack hierarchy.
        const productIds = Array.from(new Set(lines.map((l) => l.productId)));
        const packRows = productIds.length
          ? await tx
              .select({
                id: schema.products.id,
                unitsPerCase: schema.products.unitsPerCase,
                casesPerPallet: schema.products.casesPerPallet,
              })
              .from(schema.products)
              .where(inArray(schema.products.id, productIds))
          : [];
        const packById = new Map(packRows.map((p) => [p.id, p]));
        const shortLines = lines.filter((l) => {
          const pack = packById.get(l.productId) ?? {};
          return l.qtyPicked < toEaches(l.qtyOrdered, l.qtyUnit, pack);
        });
        if (shortLines.length > 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Cannot pack: ${shortLines.length} line(s) still need picking`,
          });
        }

        await tx
          .update(schema.outboundOrders)
          .set({ status: "packed", packedAt: new Date() })
          .where(eq(schema.outboundOrders.id, order.id));
        return { ok: true };
      });
    }),

  /**
   * Ship confirm. Generates a BOL number, flips every picked pallet on
   * the order to 'shipped', emits ship movements for the ledger, and
   * returns the shipment row (caller uses its id to download the BOL PDF).
   */
  ship: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        carrier: z.string().trim().max(120).optional(),
        trackingNumber: z.string().trim().max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(schema.outboundOrders)
          .where(and(eq(schema.outboundOrders.id, input.id), eq(schema.outboundOrders.organizationId, orgId)))
          .limit(1);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        assertOutboundTransition(order.status as OutboundStatus, "shipped");

        const [userRow] = await tx
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.clerkUserId, ctx.userId))
          .limit(1);

        const bolNumber = generateBolNumber();
        const [shipment] = await tx
          .insert(schema.shipments)
          .values({
            organizationId: orgId,
            outboundOrderId: order.id,
            bolNumber,
            carrier: input.carrier,
            trackingNumber: input.trackingNumber,
            shippedByUserId: userRow?.id ?? null,
          })
          .returning();

        // All pallets touched by this order's completed picks need to
        // flip to 'shipped' and get a ship movement in the ledger.
        const palletRows = await tx
          .selectDistinct({ palletId: schema.picks.palletId, fromLocationId: schema.picks.fromLocationId })
          .from(schema.picks)
          .innerJoin(
            schema.outboundLines,
            eq(schema.outboundLines.id, schema.picks.outboundLineId),
          )
          .where(
            and(
              eq(schema.outboundLines.outboundOrderId, order.id),
              isNotNull(schema.picks.palletId),
              isNotNull(schema.picks.completedAt),
            ),
          );

        for (const p of palletRows) {
          if (!p.palletId) continue;
          await tx.insert(schema.movements).values({
            organizationId: orgId,
            palletId: p.palletId,
            fromLocationId: p.fromLocationId,
            toLocationId: null,
            reason: "ship",
            userId: userRow?.id ?? null,
            refType: "outbound_order",
            refId: order.id,
          });
          await tx
            .update(schema.pallets)
            .set({ status: "shipped", currentLocationId: null })
            .where(eq(schema.pallets.id, p.palletId));
        }

        await tx
          .update(schema.outboundOrders)
          .set({ status: "shipped", shippedAt: new Date() })
          .where(eq(schema.outboundOrders.id, order.id));

        return { ok: true, shipment };
      });
    }),

  /** List shipments for an order (for BOL download + history). */
  shipments: tenantProcedure
    .input(z.object({ outboundOrderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db
        .select()
        .from(schema.shipments)
        .where(
          and(
            eq(schema.shipments.organizationId, orgId),
            eq(schema.shipments.outboundOrderId, input.outboundOrderId),
          ),
        );
    }),

  /**
   * Cancel an outbound order. Only allowed before any pick has been
   * completed — once stock is committed out of its location we require a
   * manual reversal, not a simple cancel.
   */
  cancel: managerProcedure
    .input(z.object({ id: z.string().uuid(), reason: z.string().trim().max(500) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(schema.outboundOrders)
          .where(and(eq(schema.outboundOrders.id, input.id), eq(schema.outboundOrders.organizationId, orgId)))
          .limit(1);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        assertOutboundTransition(order.status as OutboundStatus, "cancelled");

        const completed = await tx
          .select({ id: schema.picks.id })
          .from(schema.picks)
          .innerJoin(
            schema.outboundLines,
            eq(schema.outboundLines.id, schema.picks.outboundLineId),
          )
          .where(
            and(
              eq(schema.outboundLines.outboundOrderId, order.id),
              isNotNull(schema.picks.completedAt),
            ),
          )
          .limit(1);
        if (completed.length > 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Cannot cancel: picks have already been completed. Return stock to rack first.",
          });
        }

        // Discard any pending (uncompleted) picks alongside the cancel.
        await tx
          .delete(schema.picks)
          .where(
            and(
              eq(schema.picks.organizationId, orgId),
              isNull(schema.picks.completedAt),
              sql`${schema.picks.outboundLineId} in (select id from ${schema.outboundLines} where outbound_order_id = ${order.id})`,
            ),
          );

        await tx
          .update(schema.outboundOrders)
          .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: input.reason })
          .where(eq(schema.outboundOrders.id, order.id));
        return { ok: true };
      });
    }),
});
