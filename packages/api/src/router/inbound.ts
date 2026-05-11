import { z } from "zod";
import { and, asc, eq, ilike, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { schema } from "@wms/db";
import { generateLPN } from "@wms/core";
import { router, tenantProcedure, managerProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";
import { assertInboundTransition, type InboundStatus } from "./_stateMachine";
import { logAudit } from "../audit";

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
        receivingLocationId: z.string().uuid().nullable().optional(),
        expectedAt: z.date().optional(),
        lines: z
          .array(
            z.object({
              productId: z.string().uuid(),
              qtyExpected: z.number().int().positive(),
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
          .insert(schema.inboundOrders)
          .values({
            organizationId: orgId,
            warehouseId: input.warehouseId,
            reference: input.reference,
            supplier: input.supplier,
            supplierId: input.supplierId ?? null,
            customerId: input.customerId ?? null,
            receivingLocationId: input.receivingLocationId ?? null,
            expectedAt: input.expectedAt,
            status: "open",
          })
          .returning();

        await tx.insert(schema.inboundLines).values(
          input.lines.map((l) => ({
            organizationId: orgId,
            inboundOrderId: order!.id,
            productId: l.productId,
            qtyUnit: l.qtyUnit ?? "each",
            qtyExpected: l.qtyExpected,
          })),
        );
        return order;
      });
    }),

  /**
   * Edit the header fields on an inbound order. The reference can be
   * changed only while the order hasn't started receiving; everything
   * else (supplier, customer, receiving location, expected date,
   * free-text supplier label) is safe to change any time since none
   * of it is referenced by downstream rows.
   */
  updateHeader: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reference: z.string().min(1).optional(),
        supplier: z.string().max(200).nullable().optional(),
        supplierId: z.string().uuid().nullable().optional(),
        customerId: z.string().uuid().nullable().optional(),
        receivingLocationId: z.string().uuid().nullable().optional(),
        expectedAt: z.date().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const [order] = await ctx.db
        .select()
        .from(schema.inboundOrders)
        .where(
          and(
            eq(schema.inboundOrders.id, input.id),
            eq(schema.inboundOrders.organizationId, orgId),
          ),
        )
        .limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      if (order.status === "closed" || order.status === "cancelled") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Can't edit a ${order.status} order`,
        });
      }

      // Only let the reference change before receiving starts.
      if (input.reference !== undefined && input.reference !== order.reference) {
        if (order.status !== "open" && order.status !== "draft") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Reference can only change before receiving begins",
          });
        }
      }

      const patch: Record<string, unknown> = {};
      if (input.reference !== undefined) patch.reference = input.reference;
      if (input.supplier !== undefined) patch.supplier = input.supplier;
      if (input.supplierId !== undefined) patch.supplierId = input.supplierId;
      if (input.customerId !== undefined) patch.customerId = input.customerId;
      if (input.receivingLocationId !== undefined) {
        patch.receivingLocationId = input.receivingLocationId;
      }
      if (input.expectedAt !== undefined) patch.expectedAt = input.expectedAt;

      if (Object.keys(patch).length === 0) return { ok: true };

      await ctx.db
        .update(schema.inboundOrders)
        .set(patch)
        .where(eq(schema.inboundOrders.id, order.id));
      return { ok: true };
    }),

  /** Edit qtyExpected (and optionally qtyUnit) on a line. Received qty is unchanged. */
  updateLine: managerProcedure
    .input(
      z.object({
        lineId: z.string().uuid(),
        qtyExpected: z.number().int().positive(),
        qtyUnit: z.enum(["each", "case", "pallet"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const patch: { qtyExpected: number; qtyUnit?: "each" | "case" | "pallet" } = {
        qtyExpected: input.qtyExpected,
      };
      if (input.qtyUnit) patch.qtyUnit = input.qtyUnit;
      const result = await ctx.db
        .update(schema.inboundLines)
        .set(patch)
        .where(
          and(
            eq(schema.inboundLines.id, input.lineId),
            eq(schema.inboundLines.organizationId, orgId),
          ),
        )
        .returning({ id: schema.inboundLines.id });
      if (result.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
    }),

  /** Add a new line to an existing order. */
  addLine: managerProcedure
    .input(
      z.object({
        inboundOrderId: z.string().uuid(),
        productId: z.string().uuid(),
        qtyExpected: z.number().int().positive(),
        qtyUnit: z.enum(["each", "case", "pallet"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      // Verify the order belongs to this tenant and isn't terminal.
      const [order] = await ctx.db
        .select({ status: schema.inboundOrders.status })
        .from(schema.inboundOrders)
        .where(
          and(
            eq(schema.inboundOrders.id, input.inboundOrderId),
            eq(schema.inboundOrders.organizationId, orgId),
          ),
        )
        .limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.status === "closed" || order.status === "cancelled") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Can't add to a ${order.status} order`,
        });
      }
      const [row] = await ctx.db
        .insert(schema.inboundLines)
        .values({
          organizationId: orgId,
          inboundOrderId: input.inboundOrderId,
          productId: input.productId,
          qtyExpected: input.qtyExpected,
          qtyUnit: input.qtyUnit ?? "each",
        })
        .returning();
      return row;
    }),

  /** Remove a line. Only allowed if nothing's been received against it. */
  removeLine: managerProcedure
    .input(z.object({ lineId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const [line] = await ctx.db
        .select()
        .from(schema.inboundLines)
        .where(
          and(
            eq(schema.inboundLines.id, input.lineId),
            eq(schema.inboundLines.organizationId, orgId),
          ),
        )
        .limit(1);
      if (!line) throw new TRPCError({ code: "NOT_FOUND" });
      if (line.qtyReceived > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Line has received qty; can't remove without returning stock first",
        });
      }
      await ctx.db
        .delete(schema.inboundLines)
        .where(eq(schema.inboundLines.id, input.lineId));
      return { ok: true };
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

  /**
   * Pallets that came in against this order. Used by the inbound
   * detail page to show what's been received and lets the user
   * putaway anything still sitting on the dock.
   */
  palletsForOrder: tenantProcedure
    .input(z.object({ inboundOrderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      // Movements with refType=inbound_order point at the receive
      // event — that's the link from a pallet back to an inbound.
      return ctx.db
        .selectDistinctOn([schema.pallets.id], {
          palletId: schema.pallets.id,
          lpn: schema.pallets.lpn,
          status: schema.pallets.status,
          currentLocationId: schema.pallets.currentLocationId,
          locationCode: schema.locations.code,
          locationType: schema.locations.type,
          createdAt: schema.pallets.createdAt,
        })
        .from(schema.pallets)
        .innerJoin(
          schema.movements,
          and(
            eq(schema.movements.palletId, schema.pallets.id),
            eq(schema.movements.refType, "inbound_order"),
            eq(schema.movements.refId, input.inboundOrderId),
          ),
        )
        .leftJoin(
          schema.locations,
          eq(schema.locations.id, schema.pallets.currentLocationId),
        )
        .where(eq(schema.pallets.organizationId, orgId))
        .orderBy(schema.pallets.id);
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

        // Look up the inbound order's customer + receiving dock so we
        // can backfill them onto the pallet. The receivingLocationId is
        // where the pallet physically lands at receive — without setting
        // it, the pallet shows location "—" until someone manually
        // putaways, and the movement ledger has no record of the dock
        // landing.
        const [order] = await tx
          .select({
            customerId: schema.inboundOrders.customerId,
            receivingLocationId: schema.inboundOrders.receivingLocationId,
          })
          .from(schema.inboundOrders)
          .where(eq(schema.inboundOrders.id, line.inboundOrderId))
          .limit(1);

        await tx.insert(schema.palletItems).values({
          organizationId: orgId,
          palletId: input.palletId,
          productId: line.productId,
          qty: input.qty,
          qtyUnit: line.qtyUnit,
          lot: input.lot,
          expiry: input.expiry,
        });

        // Defensive backfill: if the pallet was created before
        // pallet.create accepted customerId (or the inbound's customer
        // changed mid-flow), copy the order's customerId onto the
        // pallet now. Only writes when customerId is currently null
        // so we don't clobber an explicit assignment.
        if (order?.customerId) {
          await tx
            .update(schema.pallets)
            .set({ customerId: order.customerId })
            .where(
              and(
                eq(schema.pallets.id, input.palletId),
                eq(schema.pallets.organizationId, orgId),
                isNull(schema.pallets.customerId),
              ),
            );
        }

        await tx
          .update(schema.inboundLines)
          .set({ qtyReceived: line.qtyReceived + input.qty })
          .where(eq(schema.inboundLines.id, line.id));

        // Set pallet status='received' AND land it at the receiving
        // dock. currentLocationId only gets the dock when the order
        // actually has a receiving location set; otherwise the pallet
        // stays at null and the dashboard's "awaiting putaway" KPI
        // catches it.
        await tx
          .update(schema.pallets)
          .set({
            status: "received",
            ...(order?.receivingLocationId
              ? { currentLocationId: order.receivingLocationId }
              : {}),
          })
          .where(and(eq(schema.pallets.id, input.palletId), eq(schema.pallets.organizationId, orgId)));

        await tx.insert(schema.movements).values({
          organizationId: orgId,
          palletId: input.palletId,
          fromLocationId: null,
          toLocationId: order?.receivingLocationId ?? null,
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
   * Bulk-receive every line at its expected qty in one transaction.
   * The 3PL ASN-match happy path: a 30-line truck that landed clean
   * gets received with one tap instead of 30. Refuses if anything's
   * been partially received already — operator falls back to the
   * per-line flow for variance handling.
   *
   * If defaultRackId is provided, every freshly-created pallet gets
   * putaway'd straight to that rack (status=stored) in the same
   * transaction. Otherwise pallets land at the dock (status=received)
   * for separate putaway via the Tasks page.
   */
  receiveAll: managerProcedure
    .input(
      z.object({
        inboundOrderId: z.string().uuid(),
        defaultRackId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(schema.inboundOrders)
          .where(
            and(
              eq(schema.inboundOrders.id, input.inboundOrderId),
              eq(schema.inboundOrders.organizationId, orgId),
            ),
          )
          .limit(1);
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        if (order.status !== "open" && order.status !== "receiving") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Can't bulk-receive a ${order.status} order`,
          });
        }

        const lines = await tx
          .select()
          .from(schema.inboundLines)
          .where(
            and(
              eq(schema.inboundLines.inboundOrderId, order.id),
              eq(schema.inboundLines.organizationId, orgId),
            ),
          );
        if (lines.length === 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Order has no lines to receive",
          });
        }
        const partial = lines.find((l) => l.qtyReceived > 0);
        if (partial) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Order is partially received already. Use the per-line receive flow to finish it.",
          });
        }

        // One pallet per line, lpn auto-assigned. If defaultRackId is
        // provided, land each pallet at the rack with status=stored
        // (skips a separate putaway hop); otherwise drop them at the
        // receiving dock with status=received so they show up on the
        // Tasks putaway worklist.
        const landingLocationId = input.defaultRackId ?? order.receivingLocationId;
        const targetStatus = input.defaultRackId ? "stored" : "received";

        const palletIds: string[] = [];
        for (const line of lines) {
          const lpn = generateLPN();
          const [pallet] = await tx
            .insert(schema.pallets)
            .values({
              organizationId: orgId,
              warehouseId: order.warehouseId,
              customerId: order.customerId ?? null,
              lpn,
              status: targetStatus,
              currentLocationId: landingLocationId ?? null,
            })
            .returning({ id: schema.pallets.id });
          if (!pallet) throw new Error("Failed to create pallet");
          palletIds.push(pallet.id);

          await tx.insert(schema.labelCodes).values({
            organizationId: orgId,
            code: lpn,
            kind: "pallet",
            palletId: pallet.id,
          });

          await tx.insert(schema.palletItems).values({
            organizationId: orgId,
            palletId: pallet.id,
            productId: line.productId,
            qty: line.qtyExpected,
            qtyUnit: line.qtyUnit,
          });

          await tx
            .update(schema.inboundLines)
            .set({ qtyReceived: line.qtyExpected })
            .where(eq(schema.inboundLines.id, line.id));

          // Receive movement: null → receiving location.
          await tx.insert(schema.movements).values({
            organizationId: orgId,
            palletId: pallet.id,
            fromLocationId: null,
            toLocationId: order.receivingLocationId ?? null,
            reason: "receive",
            refType: "inbound_order",
            refId: order.id,
          });

          // Optional putaway movement: receiving location → rack.
          if (input.defaultRackId) {
            await tx.insert(schema.movements).values({
              organizationId: orgId,
              palletId: pallet.id,
              fromLocationId: order.receivingLocationId ?? null,
              toLocationId: input.defaultRackId,
              reason: "putaway",
              refType: "inbound_order",
              refId: order.id,
            });
          }
        }

        // Order goes from open → receiving on bulk-receive (close is a
        // separate step). Receiving → receiving is a no-op.
        if (order.status === "open") {
          await tx
            .update(schema.inboundOrders)
            .set({ status: "receiving" })
            .where(eq(schema.inboundOrders.id, order.id));
        }

        await logAudit(tx, {
          organizationId: orgId,
          userClerkId: ctx.userId,
          action: "inbound.receiveAll",
          entityType: "inbound_order",
          entityId: order.id,
          metadata: {
            palletCount: palletIds.length,
            putAway: !!input.defaultRackId,
          },
        });

        return { ok: true, palletCount: palletIds.length };
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

        await logAudit(tx, {
          organizationId: orgId,
          userClerkId: ctx.userId,
          action: "inbound.close",
          entityType: "inbound_order",
          entityId: order.id,
          metadata: {
            shortClosed: shortLines.length > 0,
            shortLines: shortLines.length,
            closeReason: input.closeReason ?? null,
          },
        });

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

        await logAudit(tx, {
          organizationId: orgId,
          userClerkId: ctx.userId,
          action: "inbound.cancel",
          entityType: "inbound_order",
          entityId: order.id,
          metadata: { reason: input.reason },
        });

        return { ok: true };
      });
    }),

  /**
   * Parse a document (text from .xlsx/.pdf, or an image data URL
   * from a phone photo / scanned page) into a draft inbound order.
   * Sends to gpt-4o-mini with strict JSON output. Read-only — caller
   * reviews + edits the result, then submits applyAiImport.
   */
  parseFromDocument: managerProcedure
    .input(
      z.object({
        text: z.string().trim().max(200_000).optional(),
        imageDataUrl: z
          .string()
          .regex(/^data:image\/(png|jpeg);base64,/)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "OPENAI_API_KEY not set on the server.",
        });
      }
      if (!input.text && !input.imageDataUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Provide either text or imageDataUrl.",
        });
      }

      // Pre-fetch the org's existing customers, suppliers, and products
      // so the AI can match by exact spelling rather than inventing
      // near-duplicates that downstream `ilike` lookups don't catch
      // reliably. Capped to keep prompts within token budget.
      const [knownCustomers, knownSuppliers, knownProducts] = await Promise.all(
        [
          ctx.db
            .select({ id: schema.customers.id, name: schema.customers.name })
            .from(schema.customers)
            .where(eq(schema.customers.organizationId, orgId))
            .orderBy(asc(schema.customers.name))
            .limit(500),
          ctx.db
            .select({ id: schema.suppliers.id, name: schema.suppliers.name })
            .from(schema.suppliers)
            .where(eq(schema.suppliers.organizationId, orgId))
            .orderBy(asc(schema.suppliers.name))
            .limit(500),
          ctx.db
            .select({ sku: schema.products.sku, name: schema.products.name })
            .from(schema.products)
            .where(eq(schema.products.organizationId, orgId))
            .orderBy(asc(schema.products.name))
            .limit(500),
        ],
      );

      const knownCustomersBlock = knownCustomers.length
        ? `KNOWN CUSTOMERS in this org (3PL clients we already have):\n${knownCustomers
            .map((c) => `  - ${c.name}`)
            .join("\n")}\nIf the document's consignee / bill-to / customer name matches one of these (even loosely — "Ronnies" vs "Ronnie's Ice Cream"), return the EXACT spelling above.`
        : "";
      const knownSuppliersBlock = knownSuppliers.length
        ? `KNOWN SUPPLIERS in this org (vendors / shippers we've received from):\n${knownSuppliers
            .map((s) => `  - ${s.name}`)
            .join("\n")}\nSame rule: prefer the EXACT spelling above when there's a fuzzy match.`
        : "";
      const knownProductsBlock = knownProducts.length
        ? `KNOWN PRODUCTS in this org:\n${knownProducts
            .map((p) => `  - ${p.name}${p.sku ? ` [SKU: ${p.sku}]` : ""}`)
            .join("\n")}\nWhen a manifest line matches a known product (by name OR SKU, fuzzy ok), reuse the EXACT name + SKU. Novel products are fine — they'll be auto-created on confirm.`
        : "";

      const prompt = [
        "You are extracting an INBOUND warehouse order (a shipment arriving from a supplier or 3PL customer) from the document below. The doc may be a packing slip, BOL, supplier invoice, ASN, pickup ticket, or delivery confirmation.",
        knownCustomersBlock,
        knownSuppliersBlock,
        knownProductsBlock,
        "Pull whatever fields are present:",
        '  - reference: the SHIPMENT IDENTIFIER. Try in this priority order: PO # ("PO 12345", "P.O. #12345", "Purchase Order: 12345"), BOL # ("BOL 12345", "Bill of Lading: 12345"), ASN #, invoice #, order #, pickup #, delivery #, tracking #. Whichever appears most prominently is the answer. Always required if visible — this is how the warehouse looks the order up later.',
        '  - supplierName: who is SENDING the freight. Look for "From", "Ship From", "Shipper", "Origin", "Vendor", "Sold By". Match against KNOWN SUPPLIERS above first.',
        '  - customerName: the 3PL client whose stock this is. Look for "To", "Consignee", "Bill To", "For", "Deliver To", "Sold To". Match against KNOWN CUSTOMERS above first. The receiving WAREHOUSE address (where the truck physically delivers) is NOT the customer — skip it.',
        "  - expectedAt: ISO YYYY-MM-DD if a delivery / expected / appointment date is shown. If a TIME is also given (e.g. \"Delivery: 4/30 8:00 AM\" or \"Appointment 14:00\"), return a full ISO 8601 datetime: 'YYYY-MM-DDTHH:MM:00' instead — keep it date-only when no time is shown.",
        "  - lines: an array of one entry per product/SKU on the manifest, each with:",
        "      productName: the human label, e.g. 'Rocky Mountains Vanilla 12oz'. Match against KNOWN PRODUCTS above when possible.",
        "      sku: the SKU / item # / part # / UPC, if present. Reuse exact SKU from KNOWN PRODUCTS on a match.",
        "      qty: integer quantity",
        '      qtyUnit: one of "each", "case", or "pallet" — pick the unit the qty is in. PALLET is most common on a packing slip / BOL ("12 pallets of widget X"); use "case" for case counts; default "each" only if truly uncertain.',
        "Skip footer / total / grand-total rows and decorative text. Treat repeated header lines (one per page on a multi-page doc) as one.",
        "PROCESS EVERY LINE in the input — do not summarize, truncate, or stop early. The text below may include MULTIPLE Excel sheets/tabs separated by '--- <sheet name> ---' markers, OR multiple PDF pages joined together; treat them all as one document and emit every line item.",
        'Return strict JSON: {"reference":"...","supplierName":"...","customerName":"...","expectedAt":"YYYY-MM-DD or YYYY-MM-DDTHH:MM:00","lines":[{"productName":"...","sku":"...","qty":1,"qtyUnit":"each"},...]}.',
        "Omit fields whose value is unknown rather than guessing.",
      ]
        .filter(Boolean)
        .join("\n");

      const messageContent: Array<Record<string, unknown>> = [
        { type: "text", text: prompt },
      ];
      if (input.text) {
        messageContent.push({ type: "text", text: `DOCUMENT:\n${input.text}` });
      }
      if (input.imageDataUrl) {
        messageContent.push({
          type: "image_url",
          image_url: { url: input.imageDataUrl, detail: "high" },
        });
      }

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: messageContent }],
          max_tokens: 16_000,
          temperature: 0,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `OpenAI returned ${res.status}: ${body.slice(0, 400)}`,
        });
      }
      const payload = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content ?? "";

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(content) as Record<string, unknown>;
      } catch {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "Couldn't parse JSON from OpenAI.",
        });
      }
      const cleanStr = (v: unknown, max = 200): string | undefined => {
        if (typeof v !== "string") return undefined;
        const t = v.trim();
        return t ? t.slice(0, max) : undefined;
      };
      const cleanInt = (v: unknown): number | undefined => {
        if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
        return Math.max(0, Math.round(v));
      };
      const cleanUnit = (v: unknown): "each" | "case" | "pallet" => {
        const s = typeof v === "string" ? v.toLowerCase() : "";
        if (s === "case" || s === "cases") return "case";
        if (s === "pallet" || s === "pallets") return "pallet";
        return "each";
      };
      const lines = (Array.isArray(parsed.lines) ? parsed.lines : [])
        .map((r) => {
          const o = r as Record<string, unknown>;
          const productName = cleanStr(o.productName);
          if (!productName) return null;
          return {
            productName,
            sku: cleanStr(o.sku, 64),
            qty: cleanInt(o.qty) ?? 1,
            qtyUnit: cleanUnit(o.qtyUnit),
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      const supplierName = cleanStr(parsed.supplierName);
      const customerName = cleanStr(parsed.customerName);

      // Surface existing-name matches up front so the UI can chip
      // "Matched to {existing}" before the user clicks Confirm — that
      // way a near-duplicate ("Ronnies" vs "Ronnie's") gets caught
      // before `createFromAiImport` would silently create a second row.
      let existingSupplier: { id: string; name: string } | undefined;
      if (supplierName) {
        const [match] = await ctx.db
          .select({ id: schema.suppliers.id, name: schema.suppliers.name })
          .from(schema.suppliers)
          .where(
            and(
              eq(schema.suppliers.organizationId, orgId),
              ilike(schema.suppliers.name, supplierName),
            ),
          )
          .limit(1);
        if (match) existingSupplier = match;
      }
      let existingCustomer: { id: string; name: string } | undefined;
      if (customerName) {
        const [match] = await ctx.db
          .select({ id: schema.customers.id, name: schema.customers.name })
          .from(schema.customers)
          .where(
            and(
              eq(schema.customers.organizationId, orgId),
              ilike(schema.customers.name, customerName),
            ),
          )
          .limit(1);
        if (match) existingCustomer = match;
      }

      // expectedAt may come back as YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS.
      // The createFromAiImport input today only accepts date-only, so
      // split: keep `expectedAt` as the date for compatibility, expose
      // `expectedTime` as HH:MM if the AI extracted one. The UI can show
      // both; the create mutation can be widened in a follow-up.
      const rawExpected = cleanStr(parsed.expectedAt, 32);
      let expectedAt: string | undefined;
      let expectedTime: string | undefined;
      if (rawExpected) {
        const dateMatch = /^(\d{4}-\d{2}-\d{2})/.exec(rawExpected);
        if (dateMatch) expectedAt = dateMatch[1];
        const timeMatch = /T(\d{2}:\d{2})/.exec(rawExpected);
        if (timeMatch) expectedTime = timeMatch[1];
      }

      return {
        reference: cleanStr(parsed.reference, 120),
        supplierName,
        customerName,
        expectedAt,
        expectedTime,
        existingSupplier,
        existingCustomer,
        lines,
      };
    }),

  /**
   * Create an inbound order from AI-parsed data. Resolves supplier
   * + customer by case-insensitive name (auto-creating if missing),
   * resolves products by name (auto-creating with a placeholder SKU
   * fallback so the insert succeeds even on DBs without 0009), and
   * inserts the order + lines in a single transaction. Returns the
   * new order's id so the caller can route to /inbound/[id].
   */
  createFromAiImport: managerProcedure
    .input(
      z.object({
        warehouseId: z.string().uuid(),
        reference: z.string().trim().min(1).max(120),
        supplierName: z.string().trim().max(200).optional(),
        customerName: z.string().trim().max(200).optional(),
        // Accept either YYYY-MM-DD (date-only) or full ISO datetime
        // (YYYY-MM-DDTHH:MM[:SS]) — the AI returns datetime when an
        // appointment time is shown on the doc.
        expectedAt: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/)
          .optional(),
        lines: z
          .array(
            z.object({
              productName: z.string().trim().min(1).max(200),
              sku: z.string().trim().max(64).optional(),
              qty: z.number().int().positive(),
              qtyUnit: z.enum(["each", "case", "pallet"]),
            }),
          )
          .min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db.transaction(async (tx) => {
        // Resolve supplier (find by name; auto-create if missing).
        let supplierId: string | null = null;
        if (input.supplierName) {
          const [existing] = await tx
            .select({ id: schema.suppliers.id })
            .from(schema.suppliers)
            .where(
              and(
                eq(schema.suppliers.organizationId, orgId),
                ilike(schema.suppliers.name, input.supplierName),
              ),
            )
            .limit(1);
          if (existing) {
            supplierId = existing.id;
          } else {
            const [created] = await tx
              .insert(schema.suppliers)
              .values({ organizationId: orgId, name: input.supplierName })
              .returning({ id: schema.suppliers.id });
            supplierId = created?.id ?? null;
          }
        }
        // Resolve customer.
        let customerId: string | null = null;
        if (input.customerName) {
          const [existing] = await tx
            .select({ id: schema.customers.id })
            .from(schema.customers)
            .where(
              and(
                eq(schema.customers.organizationId, orgId),
                ilike(schema.customers.name, input.customerName),
              ),
            )
            .limit(1);
          if (existing) {
            customerId = existing.id;
          } else {
            const [created] = await tx
              .insert(schema.customers)
              .values({ organizationId: orgId, name: input.customerName })
              .returning({ id: schema.customers.id });
            customerId = created?.id ?? null;
          }
        }

        // Resolve product ids (find or create with placeholder SKU).
        const productIds: string[] = [];
        for (const line of input.lines) {
          const key = line.productName.trim().toLowerCase();
          const [existing] = await tx
            .select({ id: schema.products.id })
            .from(schema.products)
            .where(
              and(
                eq(schema.products.organizationId, orgId),
                sql`lower(trim(${schema.products.name})) = ${key}`,
              ),
            )
            .limit(1);
          if (existing) {
            productIds.push(existing.id);
            continue;
          }
          let sku = line.sku?.trim() || undefined;
          if (!sku) {
            const slug = line.productName
              .trim()
              .toUpperCase()
              .replace(/[^A-Z0-9]+/g, "-")
              .slice(0, 24)
              .replace(/^-+|-+$/g, "");
            sku = `IMP-${slug || "ITEM"}-${Date.now().toString(36).slice(-5)}`;
          }
          const [created] = await tx
            .insert(schema.products)
            .values({
              organizationId: orgId,
              name: line.productName.trim(),
              sku,
            })
            .returning({ id: schema.products.id });
          if (!created) throw new Error("Failed to create product");
          productIds.push(created.id);
        }

        const [order] = await tx
          .insert(schema.inboundOrders)
          .values({
            organizationId: orgId,
            warehouseId: input.warehouseId,
            reference: input.reference,
            supplierId,
            customerId,
            expectedAt: input.expectedAt ? new Date(input.expectedAt) : undefined,
            status: "open",
          })
          .returning();
        if (!order) throw new Error("Failed to create inbound order");

        await tx.insert(schema.inboundLines).values(
          input.lines.map((line, i) => ({
            organizationId: orgId,
            inboundOrderId: order.id,
            productId: productIds[i]!,
            qtyExpected: line.qty,
            qtyUnit: line.qtyUnit,
          })),
        );

        return { id: order.id };
      });
    }),
});
