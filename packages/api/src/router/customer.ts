import { z } from "zod";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { schema } from "@wms/db";
import { generateLPN } from "@wms/core";
import { router, tenantProcedure, managerProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";

// Shared profile schema — used by create + update.
const profile = z.object({
  name: z.string().trim().min(1).max(200),
  contactName: z.string().trim().max(200).nullable().optional(),
  email: z
    .string()
    .trim()
    .email()
    .nullable()
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(64).nullable().optional(),
  taxId: z.string().trim().max(64).nullable().optional(),
  billingLine1: z.string().trim().max(200).nullable().optional(),
  billingLine2: z.string().trim().max(200).nullable().optional(),
  billingCity: z.string().trim().max(100).nullable().optional(),
  billingRegion: z.string().trim().max(100).nullable().optional(),
  billingPostalCode: z.string().trim().max(32).nullable().optional(),
  billingCountry: z.string().trim().max(100).nullable().optional(),
  shippingLine1: z.string().trim().max(200).nullable().optional(),
  shippingLine2: z.string().trim().max(200).nullable().optional(),
  shippingCity: z.string().trim().max(100).nullable().optional(),
  shippingRegion: z.string().trim().max(100).nullable().optional(),
  shippingPostalCode: z.string().trim().max(32).nullable().optional(),
  shippingCountry: z.string().trim().max(100).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  // Per-customer billing rates in integer cents. Used by the monthly
  // storage statement on /reports/billing. All optional + nullable so
  // an existing customer without rates is fine — they just can't be
  // QB-exported until rates are set.
  storageRateCentsPerPalletMonth: z.number().int().min(0).nullable().optional(),
  receiveRateCentsPerPallet: z.number().int().min(0).nullable().optional(),
  shipRateCentsPerPallet: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional(),
});

function normalize(input: z.infer<typeof profile>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    out[k] = v === "" ? null : v;
  }
  return out;
}

export const customerRouter = router({
  /** All customers in the current org, ordered by name. */
  list: tenantProcedure.query(async ({ ctx }) => {
    const orgId = await requireOrgId(ctx);
    return ctx.db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.organizationId, orgId))
      .orderBy(asc(schema.customers.name));
  }),

  /** Lightweight search for autocomplete on new-order forms. */
  search: tenantProcedure
    .input(z.object({ q: z.string().trim().default(""), limit: z.number().int().max(500).default(20) }).default({}))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const q = `%${input.q}%`;
      return ctx.db
        .select({
          id: schema.customers.id,
          name: schema.customers.name,
          contactName: schema.customers.contactName,
          email: schema.customers.email,
          active: schema.customers.active,
        })
        .from(schema.customers)
        .where(
          and(
            eq(schema.customers.organizationId, orgId),
            input.q
              ? or(
                  ilike(schema.customers.name, q),
                  ilike(schema.customers.contactName, q),
                  ilike(schema.customers.email, q),
                )
              : undefined,
          ),
        )
        .orderBy(asc(schema.customers.name))
        .limit(input.limit);
    }),

  /** Detail view + counts for the detail page. */
  byId: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const [row] = await ctx.db
        .select()
        .from(schema.customers)
        .where(
          and(
            eq(schema.customers.id, input.id),
            eq(schema.customers.organizationId, orgId),
          ),
        )
        .limit(1);
      if (!row) return null;

      // Quick counts so the detail page can render summary tiles without
      // waiting on the larger queries below.
      const [palletCount] = await ctx.db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.pallets)
        .where(
          and(
            eq(schema.pallets.organizationId, orgId),
            eq(schema.pallets.customerId, row.id),
            eq(schema.pallets.status, "stored"),
          ),
        );
      const [outboundCount] = await ctx.db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.outboundOrders)
        .where(
          and(
            eq(schema.outboundOrders.organizationId, orgId),
            eq(schema.outboundOrders.customerId, row.id),
          ),
        );
      const [inboundCount] = await ctx.db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.inboundOrders)
        .where(
          and(
            eq(schema.inboundOrders.organizationId, orgId),
            eq(schema.inboundOrders.customerId, row.id),
          ),
        );

      return {
        customer: row,
        storedPallets: palletCount?.n ?? 0,
        outboundOrders: outboundCount?.n ?? 0,
        inboundOrders: inboundCount?.n ?? 0,
      };
    }),

  // tenantProcedure (not managerProcedure) — frontline intake needs to
  // onboard new clients as pallets arrive, matching product.create.
  create: tenantProcedure.input(profile).mutation(async ({ ctx, input }) => {
    const orgId = await requireOrgId(ctx);
    const clean = normalize(input) as typeof schema.customers.$inferInsert;
    const [row] = await ctx.db
      .insert(schema.customers)
      .values({ ...clean, organizationId: orgId, name: input.name })
      .returning();
    return row;
  }),

  update: managerProcedure
    .input(profile.partial({ name: true }).extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const { id, ...rest } = input;
      const patch = normalize(rest as z.infer<typeof profile>);
      if (Object.keys(patch).length === 0) return { ok: true };
      await ctx.db
        .update(schema.customers)
        .set(patch)
        .where(
          and(
            eq(schema.customers.id, id),
            eq(schema.customers.organizationId, orgId),
          ),
        );
      return { ok: true };
    }),

  /**
   * Soft-delete: just flips `active` off. Hard delete is risky because
   * pallets/orders may reference the row (FK is ON DELETE SET NULL,
   * which would quietly orphan the linkage).
   */
  deactivate: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const result = await ctx.db
        .update(schema.customers)
        .set({ active: false })
        .where(
          and(
            eq(schema.customers.id, input.id),
            eq(schema.customers.organizationId, orgId),
          ),
        )
        .returning({ id: schema.customers.id });
      if (result.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      }
      return { ok: true };
    }),

  /**
   * Parse a pasted spreadsheet snippet into a normalized list of
   * pallet rows + (optionally) detected billing rates. Sends the raw
   * text to OpenAI gpt-4o-mini with strict JSON output. The user
   * reviews the result in the UI before any DB writes happen — this
   * procedure is read-only and side-effect free.
   */
  parseInventorySheet: managerProcedure
    .input(
      z.object({
        customerId: z.string().uuid(),
        text: z.string().trim().min(1).max(40_000),
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
      const [customer] = await ctx.db
        .select({ id: schema.customers.id, name: schema.customers.name })
        .from(schema.customers)
        .where(
          and(
            eq(schema.customers.id, input.customerId),
            eq(schema.customers.organizationId, orgId),
          ),
        )
        .limit(1);
      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      }

      const prompt = [
        `You are extracting inventory data from a 3PL warehouse spreadsheet for the customer "${customer.name}".`,
        "The text below is a pasted Excel/CSV snippet. Each meaningful row represents ONE pallet of stock.",
        "Pull these fields per row when present:",
        '  - productName: the product label (strip leading "#1 - " or "#2 - " pallet numbering — keep just the product part, e.g. "Rocky Mountains" or "Vanilla pwbs")',
        "  - qty: integer number of items on the pallet (default 1 if not given)",
        "  - inDate: when the pallet was received (ISO YYYY-MM-DD)",
        "  - outDate: when the pallet shipped, if a ship/out date is present (ISO YYYY-MM-DD); omit if blank",
        "  - lot: lot/batch number if present, else omit",
        "  - expiry: ISO date if present, else omit",
        "Also detect billing rates if the sheet shows them, returning all in INTEGER CENTS:",
        "  - storageRateCentsPerPalletMonth: e.g. '$22.00/per pallet per month' -> 2200",
        "  - receiveRateCentsPerPallet: e.g. 'handling fee per pallet' -> 2200",
        "  - shipRateCentsPerPallet: omit if not stated (3PLs often only charge the handling fee on the way in)",
        "Skip header rows, total rows, blank rows, and rows that are clearly metadata (address, email, etc.).",
        'Return strict JSON: {"detectedRates":{...optional...},"rows":[{"productName":"...","qty":1,"inDate":"YYYY-MM-DD","outDate":"YYYY-MM-DD","lot":"...","expiry":"YYYY-MM-DD"},...]}',
        "Omit fields whose value is unknown rather than guessing.",
        "",
        "SHEET TEXT:",
        input.text,
      ].join("\n");

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
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

      let parsed: { detectedRates?: unknown; rows?: unknown[] };
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "Couldn't parse JSON from OpenAI. Try a smaller paste.",
        });
      }
      const cleanInt = (v: unknown): number | undefined => {
        if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
        return Math.max(0, Math.round(v));
      };
      const cleanStr = (v: unknown, max = 200): string | undefined => {
        if (typeof v !== "string") return undefined;
        const t = v.trim();
        return t ? t.slice(0, max) : undefined;
      };
      const cleanDate = (v: unknown): string | undefined => {
        const s = cleanStr(v, 32);
        if (!s) return undefined;
        const d = new Date(s);
        if (Number.isNaN(d.getTime())) return undefined;
        return d.toISOString().slice(0, 10);
      };

      const rates =
        parsed.detectedRates && typeof parsed.detectedRates === "object"
          ? {
              storageRateCentsPerPalletMonth: cleanInt(
                (parsed.detectedRates as Record<string, unknown>)
                  .storageRateCentsPerPalletMonth,
              ),
              receiveRateCentsPerPallet: cleanInt(
                (parsed.detectedRates as Record<string, unknown>)
                  .receiveRateCentsPerPallet,
              ),
              shipRateCentsPerPallet: cleanInt(
                (parsed.detectedRates as Record<string, unknown>)
                  .shipRateCentsPerPallet,
              ),
            }
          : undefined;
      const rows = (Array.isArray(parsed.rows) ? parsed.rows : [])
        .map((r) => {
          const o = r as Record<string, unknown>;
          const productName = cleanStr(o.productName);
          const inDate = cleanDate(o.inDate);
          if (!productName || !inDate) return null;
          return {
            productName,
            qty: cleanInt(o.qty) ?? 1,
            inDate,
            outDate: cleanDate(o.outDate),
            lot: cleanStr(o.lot, 64),
            expiry: cleanDate(o.expiry),
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      return { detectedRates: rates, rows };
    }),

  /**
   * Apply a previously-parsed (or hand-edited) inventory import:
   * for each row create a pallet tied to this customer, a pallet_item
   * with the qty/lot/expiry, and receive (+ optional ship) movements
   * stamped at the historical dates so the billing report computes
   * peak/in/out correctly. Optionally writes detected billing rates
   * onto the customer in the same transaction.
   */
  applyInventoryImport: managerProcedure
    .input(
      z.object({
        customerId: z.string().uuid(),
        warehouseId: z.string().uuid(),
        rows: z
          .array(
            z.object({
              productName: z.string().trim().min(1).max(200),
              qty: z.number().int().positive(),
              inDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
              outDate: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}$/)
                .optional(),
              lot: z.string().trim().max(64).optional(),
              expiry: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}$/)
                .optional(),
            }),
          )
          .min(1)
          .max(500),
        applyRates: z
          .object({
            storageRateCentsPerPalletMonth: z.number().int().min(0).optional(),
            receiveRateCentsPerPallet: z.number().int().min(0).optional(),
            shipRateCentsPerPallet: z.number().int().min(0).optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      // Verify customer + warehouse belong to caller's org.
      const [customer] = await ctx.db
        .select({ id: schema.customers.id })
        .from(schema.customers)
        .where(
          and(
            eq(schema.customers.id, input.customerId),
            eq(schema.customers.organizationId, orgId),
          ),
        )
        .limit(1);
      if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      const [warehouse] = await ctx.db
        .select({ id: schema.warehouses.id })
        .from(schema.warehouses)
        .where(
          and(
            eq(schema.warehouses.id, input.warehouseId),
            eq(schema.warehouses.organizationId, orgId),
          ),
        )
        .limit(1);
      if (!warehouse) throw new TRPCError({ code: "NOT_FOUND", message: "Warehouse not found" });

      return ctx.db.transaction(async (tx) => {
        // 1. Resolve product ids — find by name (case-insensitive, trimmed)
        //    or auto-create. Cache by name so duplicate rows hit the DB once.
        const productCache = new Map<string, string>();
        for (const row of input.rows) {
          const key = row.productName.trim().toLowerCase();
          if (productCache.has(key)) continue;
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
            productCache.set(key, existing.id);
            continue;
          }
          const [created] = await tx
            .insert(schema.products)
            .values({ organizationId: orgId, name: row.productName.trim() })
            .returning({ id: schema.products.id });
          if (!created) throw new Error("Failed to create product");
          productCache.set(key, created.id);
        }

        // 2. For each row: create pallet + pallet_item + movements.
        let palletsCreated = 0;
        let productsCreated = productCache.size; // initial heuristic
        for (const row of input.rows) {
          const productId = productCache.get(row.productName.trim().toLowerCase())!;
          const inDate = new Date(row.inDate);
          const outDate = row.outDate ? new Date(row.outDate) : null;
          const lpn = generateLPN();

          const [pallet] = await tx
            .insert(schema.pallets)
            .values({
              organizationId: orgId,
              warehouseId: input.warehouseId,
              customerId: input.customerId,
              lpn,
              status: outDate ? "shipped" : "stored",
            })
            .returning({ id: schema.pallets.id });
          if (!pallet) throw new Error("Failed to create pallet");

          await tx.insert(schema.labelCodes).values({
            organizationId: orgId,
            code: lpn,
            kind: "pallet",
            palletId: pallet.id,
          });

          await tx.insert(schema.palletItems).values({
            organizationId: orgId,
            palletId: pallet.id,
            productId,
            qty: row.qty,
            lot: row.lot,
            expiry: row.expiry ? new Date(row.expiry) : undefined,
          });

          // Receive movement stamped at the original receive date so
          // the billing peak calculation walks the timeline correctly.
          await tx.insert(schema.movements).values({
            organizationId: orgId,
            palletId: pallet.id,
            reason: "receive",
            createdAt: inDate,
          });
          if (outDate) {
            await tx.insert(schema.movements).values({
              organizationId: orgId,
              palletId: pallet.id,
              reason: "ship",
              createdAt: outDate,
            });
          }
          palletsCreated += 1;
        }

        // 3. Optionally update the customer's rates from the import.
        if (input.applyRates) {
          const patch: Record<string, number> = {};
          if (input.applyRates.storageRateCentsPerPalletMonth !== undefined)
            patch.storageRateCentsPerPalletMonth =
              input.applyRates.storageRateCentsPerPalletMonth;
          if (input.applyRates.receiveRateCentsPerPallet !== undefined)
            patch.receiveRateCentsPerPallet =
              input.applyRates.receiveRateCentsPerPallet;
          if (input.applyRates.shipRateCentsPerPallet !== undefined)
            patch.shipRateCentsPerPallet =
              input.applyRates.shipRateCentsPerPallet;
          if (Object.keys(patch).length > 0) {
            await tx
              .update(schema.customers)
              .set(patch)
              .where(eq(schema.customers.id, input.customerId));
          }
        }

        return { palletsCreated, productsCreated };
      });
    }),
});
