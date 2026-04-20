import { z } from "zod";
import { and, eq, isNull, sql } from "drizzle-orm";
import { schema } from "@wms/db";
import { orderPicksSShape, parseAisleBay } from "@wms/core";
import { router, tenantProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";

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
        shipBy: z.date().optional(),
        lines: z
          .array(
            z.object({
              productId: z.string().uuid(),
              qtyOrdered: z.number().int().positive(),
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
          })),
        );
        return order;
      });
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
        const lines = await tx
          .select()
          .from(schema.outboundLines)
          .where(
            and(
              eq(schema.outboundLines.outboundOrderId, input.outboundOrderId),
              eq(schema.outboundLines.organizationId, orgId),
            ),
          );

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
              palletId: schema.pallets.id,
              qty: schema.palletItems.qty,
              locationId: schema.pallets.currentLocationId,
              path: schema.locations.path,
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

          let remaining = line.qtyOrdered - line.qtyPicked;
          for (const s of stock) {
            if (remaining <= 0) break;
            if (!s.locationId) continue;
            const take = Math.min(remaining, s.qty);
            candidates.push({
              outboundLineId: line.id,
              palletId: s.palletId,
              fromLocationId: s.locationId,
              qty: take,
              path: s.path,
            });
            remaining -= take;
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
});
