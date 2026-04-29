import { z } from "zod";
import { and, eq, ilike, isNull, sql } from "drizzle-orm";
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
            qtyExpected: l.qtyExpected,
            qtyUnit: l.qtyUnit ?? "each",
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

        // Look up the inbound order's customer so we can backfill it
        // onto the pallet. Without this, the per-customer billing
        // report sees no activity even when the order is bound to a
        // 3PL client.
        const [order] = await tx
          .select({ customerId: schema.inboundOrders.customerId })
          .from(schema.inboundOrders)
          .where(eq(schema.inboundOrders.id, line.inboundOrderId))
          .limit(1);

        await tx.insert(schema.palletItems).values({
          organizationId: orgId,
          palletId: input.palletId,
          productId: line.productId,
          qty: input.qty,
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

  /**
   * Parse a document (text from .xlsx/.pdf, or an image data URL
   * from a phone photo / scanned page) into a draft inbound order.
   * Sends to gpt-4o-mini with strict JSON output. Read-only — caller
   * reviews + edits the result, then submits applyAiImport.
   */
  parseFromDocument: managerProcedure
    .input(
      z.object({
        text: z.string().trim().max(40_000).optional(),
        imageDataUrl: z
          .string()
          .regex(/^data:image\/(png|jpeg);base64,/)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireOrgId(ctx);
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

      const prompt = [
        "You are extracting an INBOUND warehouse order (a shipment arriving from a supplier or 3PL customer) from the document below.",
        "Pull whatever fields are present:",
        "  - reference: PO number, BOL number, order number, or any other reference printed on the doc",
        "  - supplierName: who is sending the freight (sender / shipper / from)",
        "  - customerName: the 3PL client whose stock this is (consignee / bill-to / for) — only set if clearly NOT the receiving warehouse",
        "  - expectedAt: ISO YYYY-MM-DD if a delivery / expected date is shown",
        "  - lines: an array of one entry per product/SKU on the manifest, each with:",
        "      productName: the human label, e.g. 'Rocky Mountains Vanilla 12oz'",
        "      sku: the SKU / item number / part number, if present",
        "      qty: integer quantity",
        '      qtyUnit: one of "each", "case", or "pallet" — pick the unit the qty is in. Default "each" if uncertain.',
        "Skip footer/total rows and decorative text.",
        'Return strict JSON: {"reference":"...","supplierName":"...","customerName":"...","expectedAt":"YYYY-MM-DD","lines":[{"productName":"...","sku":"...","qty":1,"qtyUnit":"each"},...]}.',
        "Omit fields whose value is unknown rather than guessing.",
      ].join("\n");

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
          max_tokens: 4000,
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

      return {
        reference: cleanStr(parsed.reference, 120),
        supplierName: cleanStr(parsed.supplierName),
        customerName: cleanStr(parsed.customerName),
        expectedAt: cleanStr(parsed.expectedAt, 32),
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
        expectedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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
