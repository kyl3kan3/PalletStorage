import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { schema } from "@wms/db";
import { router, tenantProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";

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

  receiveLine: tenantProcedure
    .input(
      z.object({
        inboundLineId: z.string().uuid(),
        palletId: z.string().uuid(),
        qty: z.number().int().positive(),
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
        return { ok: true };
      });
    }),
});
