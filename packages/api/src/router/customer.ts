import { z } from "zod";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { schema } from "@wms/db";
import { generateLPN } from "@wms/core";
import { router, tenantProcedure, managerProcedure, adminProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";
import { rateLimit } from "../rateLimit";

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
   * Soft-delete: just flips `active` off. Reversible — most teams should
   * use this. Available to managers + admins.
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
   * Hard-delete. Admin only. Refuses by default if the customer has
   * stored pallets or non-terminal orders — those would silently orphan
   * (FKs are ON DELETE SET NULL) and disappear from billing because
   * `computeBillingPeriod` filters customer_id IS NOT NULL.
   *
   * Pass `force: true` after the user explicitly acknowledges. Past
   * `quickbooks_exports` rows are intentionally NOT cleaned up — they're
   * an immutable audit of what was actually pushed to QBO.
   */
  delete: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        force: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);

      const [storedPalletsRow, openInboundRow, openOutboundRow] = await Promise.all([
        ctx.db
          .select({ n: sql<number>`count(*)::int` })
          .from(schema.pallets)
          .where(
            and(
              eq(schema.pallets.organizationId, orgId),
              eq(schema.pallets.customerId, input.id),
              eq(schema.pallets.status, "stored"),
            ),
          ),
        ctx.db
          .select({ n: sql<number>`count(*)::int` })
          .from(schema.inboundOrders)
          .where(
            and(
              eq(schema.inboundOrders.organizationId, orgId),
              eq(schema.inboundOrders.customerId, input.id),
              sql`${schema.inboundOrders.status} in ('open','receiving')`,
            ),
          ),
        ctx.db
          .select({ n: sql<number>`count(*)::int` })
          .from(schema.outboundOrders)
          .where(
            and(
              eq(schema.outboundOrders.organizationId, orgId),
              eq(schema.outboundOrders.customerId, input.id),
              sql`${schema.outboundOrders.status} in ('open','picking','packed')`,
            ),
          ),
      ]);
      const blockers = {
        storedPallets: storedPalletsRow[0]?.n ?? 0,
        openInbound: openInboundRow[0]?.n ?? 0,
        openOutbound: openOutboundRow[0]?.n ?? 0,
      };
      const total =
        blockers.storedPallets + blockers.openInbound + blockers.openOutbound;

      if (total > 0 && !input.force) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Customer has ${blockers.storedPallets} stored pallet(s), ${blockers.openInbound} open inbound, and ${blockers.openOutbound} open outbound. Resolve those or pass force=true to orphan them.`,
          cause: blockers,
        });
      }

      const result = await ctx.db
        .delete(schema.customers)
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
      return { ok: true, blockers };
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
      z
        .object({
          customerId: z.string().uuid().optional(),
          // Either text (paste / .xlsx / .pdf extract) or an image
          // data URL (phone photo / scan). At least one must be set.
          // 200k is comfortable for multi-tab spreadsheets and well
          // under gpt-4o-mini's 128k token context.
          text: z.string().trim().max(200_000).optional(),
          imageDataUrl: z
            .string()
            .regex(/^data:image\/(png|jpeg);base64,/)
            // Cap base64 length at ~8 MB so a single request can't push tens
            // of MB through the OpenAI vision endpoint (~6 MB binary).
            .max(8 * 1024 * 1024)
            .optional(),
        })
        .refine(
          (v) => Boolean(v.text || v.imageDataUrl),
          "Provide either text or imageDataUrl",
        ),
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

      let knownCustomerName: string | undefined;
      if (input.customerId) {
        const [existing] = await ctx.db
          .select({ id: schema.customers.id, name: schema.customers.name })
          .from(schema.customers)
          .where(
            and(
              eq(schema.customers.id, input.customerId),
              eq(schema.customers.organizationId, orgId),
            ),
          )
          .limit(1);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
        }
        knownCustomerName = existing.name;
      }

      // Pre-fetch known org data so the AI can prefer existing names
      // over inventing arbitrary spellings — same case-insensitive
      // match `applyInventoryImport` does at write-time, but surfaced
      // up front so duplicates don't slip through. Cap the lists so the
      // prompt stays within token budget on very large orgs.
      const knownCustomers = await ctx.db
        .select({ id: schema.customers.id, name: schema.customers.name })
        .from(schema.customers)
        .where(eq(schema.customers.organizationId, orgId))
        .orderBy(asc(schema.customers.name))
        .limit(500);
      const knownProducts = await ctx.db
        .select({ sku: schema.products.sku, name: schema.products.name })
        .from(schema.products)
        .where(eq(schema.products.organizationId, orgId))
        .orderBy(asc(schema.products.name))
        .limit(500);

      const knownCustomersBlock = knownCustomers.length
        ? `KNOWN CUSTOMERS in this org (3PL clients we already store pallets for):\n${knownCustomers
            .map((c) => `  - ${c.name}`)
            .join(
              "\n",
            )}\nIf the sheet's customer matches one of these (even loosely — e.g. "Ronnies" vs "Ronnie's Ice Cream"), return the EXACT spelling above.`
        : "";
      const knownProductsBlock = knownProducts.length
        ? `KNOWN PRODUCTS in this org:\n${knownProducts
            .map((p) => `  - ${p.name}${p.sku ? ` [SKU: ${p.sku}]` : ""}`)
            .slice(0, 500)
            .join(
              "\n",
            )}\nWhen a row's product matches one of these (by name OR SKU, fuzzy ok), reuse the EXACT name + SKU. Novel products are fine — they'll be auto-created on apply.`
        : "";

      const prompt = [
        knownCustomerName
          ? `You are extracting inventory data from a 3PL warehouse spreadsheet for the customer "${knownCustomerName}".`
          : "You are extracting inventory data from a 3PL warehouse spreadsheet. The customer (the 3PL client whose stock this is) is identified by the sheet itself — extract their info too.",
        "The text below is a pasted Excel/CSV snippet, OR an image of the same. Each meaningful pallet row represents ONE pallet of stock.",
        knownCustomersBlock,
        knownProductsBlock,
        knownCustomerName
          ? ""
          : "DETECT THE CUSTOMER (the company whose pallets are being stored) from headers / titles. Common patterns: a company name + email at the top, sometimes a 'bill to' or 'for' label. The 'pay to' / 'remit to' address is usually the WAREHOUSE — NOT the customer — so skip that. Return their info under detectedCustomer with whatever fields are visible: name, contactName, email, phone, taxId (EIN / VAT / business tax #), billingLine1, billingLine2, billingCity, billingRegion, billingPostalCode, billingCountry, notes (any special-handling text — allergens, hazmat flags, billing memo). If the sheet doesn't show an address for the customer, omit those fields.",
        "Pull these fields per row when present:",
        '  - productName: the product label (strip leading "#1 - " or "#2 - " pallet numbering — keep just the product part, e.g. "Rocky Mountains" or "Vanilla pwbs"). Match against KNOWN PRODUCTS above when possible.',
        "  - qty: integer number of items on the pallet (default 1 if not given)",
        "  - inDate: when the pallet was received (ISO YYYY-MM-DD). If a TIME is also shown (e.g. '4/30/24 9:15 am'), still return date-only; the time can go in `notes` if it matters.",
        "  - outDate: when the pallet shipped, if a ship/out date is present (ISO YYYY-MM-DD); omit if blank",
        "  - lot: lot/batch number if present, else omit",
        "  - expiry: ISO date if present, else omit",
        "Also detect billing rates if the sheet shows them, returning all in INTEGER CENTS:",
        "  - storageRateCentsPerPalletMonth: e.g. '$22.00/per pallet per month' -> 2200",
        "  - receiveRateCentsPerPallet: e.g. 'handling fee per pallet' -> 2200",
        "  - shipRateCentsPerPallet: omit if not stated (3PLs often only charge the handling fee on the way in)",
        "Skip header rows, total rows, blank rows, and metadata that isn't customer info.",
        "PROCESS EVERY PALLET ROW in the input — do not summarize, truncate, or stop early. The text below may include MULTIPLE Excel sheets/tabs separated by '--- <sheet name> ---' markers; treat each tab as part of the same dataset and emit a row for every pallet from every tab.",
        knownCustomerName
          ? 'Return strict JSON: {"detectedRates":{...optional...},"rows":[{"productName":"...","qty":1,"inDate":"YYYY-MM-DD","outDate":"YYYY-MM-DD","lot":"...","expiry":"YYYY-MM-DD"},...]}'
          : 'Return strict JSON: {"detectedCustomer":{"name":"...","email":"...","taxId":"...","billingLine1":"...","billingCity":"...","billingRegion":"...","billingPostalCode":"...","billingCountry":"...","notes":"..."},"detectedRates":{...optional...},"rows":[{"productName":"...","qty":1,"inDate":"YYYY-MM-DD","outDate":"YYYY-MM-DD","lot":"...","expiry":"YYYY-MM-DD"},...]}',
        "Omit fields whose value is unknown rather than guessing.",
      ]
        .filter(Boolean)
        .join("\n");

      // Multimodal content. Always include the prompt; append the
      // sheet text and/or the image as separate parts so vision can
      // read the image directly when the input was a photo or scan.
      const messageContent: Array<Record<string, unknown>> = [
        { type: "text", text: prompt },
      ];
      if (input.text && input.text.trim()) {
        messageContent.push({
          type: "text",
          text: `SHEET TEXT:\n${input.text}`,
        });
      }
      if (input.imageDataUrl) {
        messageContent.push({
          type: "image_url",
          image_url: { url: input.imageDataUrl, detail: "high" },
        });
      }

      // Cap OpenAI calls per org to bound spend even though this procedure
      // is already manager-gated. 20/min is generous for a human pasting
      // sheets and well below any abuse profile.
      rateLimit(`openai:${orgId}`, { max: 20, windowMs: 60_000 });

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
          // 16k is gpt-4o-mini's max output. A spreadsheet with several
          // hundred pallet rows will saturate the previous 4k cap and
          // get cut off mid-array.
          max_tokens: 16_000,
          temperature: 0,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        // Log the full upstream response for ops, but don't leak provider
        // internals or quota details to the client.
        console.error("[parseInventorySheet] OpenAI error", res.status, body.slice(0, 2000));
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "AI provider error",
        });
      }
      const payload = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content ?? "";

      let parsed: {
        detectedCustomer?: unknown;
        detectedRates?: unknown;
        rows?: unknown[];
      };
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
      const detectedCustomer = (() => {
        if (!parsed.detectedCustomer || typeof parsed.detectedCustomer !== "object") return undefined;
        const o = parsed.detectedCustomer as Record<string, unknown>;
        const name = cleanStr(o.name);
        if (!name) return undefined;
        return {
          name,
          contactName: cleanStr(o.contactName),
          email: cleanStr(o.email, 320),
          phone: cleanStr(o.phone, 64),
          taxId: cleanStr(o.taxId, 64),
          billingLine1: cleanStr(o.billingLine1),
          billingLine2: cleanStr(o.billingLine2),
          billingCity: cleanStr(o.billingCity, 100),
          billingRegion: cleanStr(o.billingRegion, 100),
          billingPostalCode: cleanStr(o.billingPostalCode, 32),
          billingCountry: cleanStr(o.billingCountry, 100),
          notes: cleanStr(o.notes, 2000),
        };
      })();

      // If the AI extracted a customer name but we already had one
      // selected, the linked one wins — but we also surface any
      // existing customer in the org with a similar name so the UI
      // can offer a "match to existing" choice on the new path.
      let existingMatch: { id: string; name: string } | undefined;
      if (!input.customerId && detectedCustomer?.name) {
        const [match] = await ctx.db
          .select({ id: schema.customers.id, name: schema.customers.name })
          .from(schema.customers)
          .where(
            and(
              eq(schema.customers.organizationId, orgId),
              ilike(schema.customers.name, detectedCustomer.name),
            ),
          )
          .limit(1);
        if (match) existingMatch = match;
      }

      return { detectedCustomer, detectedRates: rates, rows, existingMatch };
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
        // Either link to an existing customer OR pass new customer info to
        // create one. Exactly one of customerId / customerInfo must be set.
        customerId: z.string().uuid().optional(),
        customerInfo: z
          .object({
            name: z.string().trim().min(1).max(200),
            contactName: z.string().trim().max(200).optional(),
            email: z.string().trim().max(320).optional(),
            phone: z.string().trim().max(64).optional(),
            taxId: z.string().trim().max(64).optional(),
            billingLine1: z.string().trim().max(200).optional(),
            billingLine2: z.string().trim().max(200).optional(),
            billingCity: z.string().trim().max(100).optional(),
            billingRegion: z.string().trim().max(100).optional(),
            billingPostalCode: z.string().trim().max(32).optional(),
            billingCountry: z.string().trim().max(100).optional(),
            notes: z.string().trim().max(2000).optional(),
          })
          .optional(),
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
      if (!input.customerId && !input.customerInfo) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Provide either customerId or customerInfo.",
        });
      }
      // Resolve the customer. customerId path: verify it belongs to
      // org and use it. customerInfo path: try to match an existing
      // customer by name (case-insensitive) — if found, link to that
      // one; otherwise create a fresh row from the provided fields.
      let resolvedCustomerId: string;
      if (input.customerId) {
        const [existing] = await ctx.db
          .select({ id: schema.customers.id })
          .from(schema.customers)
          .where(
            and(
              eq(schema.customers.id, input.customerId),
              eq(schema.customers.organizationId, orgId),
            ),
          )
          .limit(1);
        if (!existing)
          throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
        resolvedCustomerId = existing.id;
      } else {
        const info = input.customerInfo!;
        const [match] = await ctx.db
          .select({ id: schema.customers.id })
          .from(schema.customers)
          .where(
            and(
              eq(schema.customers.organizationId, orgId),
              ilike(schema.customers.name, info.name),
            ),
          )
          .limit(1);
        if (match) {
          resolvedCustomerId = match.id;
        } else {
          const [created] = await ctx.db
            .insert(schema.customers)
            .values({
              organizationId: orgId,
              name: info.name,
              contactName: info.contactName ?? null,
              email: info.email ?? null,
              phone: info.phone ?? null,
              taxId: info.taxId ?? null,
              billingLine1: info.billingLine1 ?? null,
              billingLine2: info.billingLine2 ?? null,
              billingCity: info.billingCity ?? null,
              billingRegion: info.billingRegion ?? null,
              billingPostalCode: info.billingPostalCode ?? null,
              billingCountry: info.billingCountry ?? null,
              notes: info.notes ?? null,
            })
            .returning({ id: schema.customers.id });
          if (!created)
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create customer",
            });
          resolvedCustomerId = created.id;
        }
      }
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
        // 0. Pre-fetch this customer's existing inventory so we can
        //    skip rows that already exist. Match key = productId + lot
        //    + expiry-date + in-date (the date of the first `receive`
        //    movement). All four matching is the strongest "this is
        //    the same pallet" signal we have without an LPN on the
        //    sheet.
        const existing = await tx
          .select({
            productId: schema.palletItems.productId,
            lot: schema.palletItems.lot,
            expiry: schema.palletItems.expiry,
            receivedAt: schema.movements.createdAt,
          })
          .from(schema.palletItems)
          .innerJoin(
            schema.pallets,
            eq(schema.pallets.id, schema.palletItems.palletId),
          )
          .leftJoin(
            schema.movements,
            and(
              eq(schema.movements.palletId, schema.pallets.id),
              eq(schema.movements.reason, "receive"),
            ),
          )
          .where(
            and(
              eq(schema.palletItems.organizationId, orgId),
              eq(schema.pallets.customerId, resolvedCustomerId),
            ),
          );
        const dedupeKey = (
          productId: string,
          lot: string | null | undefined,
          expiry: Date | string | null | undefined,
          inDate: Date | string,
        ): string => {
          const lotKey = (lot ?? "").trim().toLowerCase();
          const expiryKey = expiry
            ? new Date(expiry).toISOString().slice(0, 10)
            : "";
          const inKey = new Date(inDate).toISOString().slice(0, 10);
          return `${productId}|${lotKey}|${expiryKey}|${inKey}`;
        };
        const existingKeys = new Set<string>();
        for (const e of existing) {
          if (!e.receivedAt) continue;
          existingKeys.add(
            dedupeKey(e.productId, e.lot, e.expiry, e.receivedAt),
          );
        }

        // 1. Resolve product ids — find by name (case-insensitive, trimmed)
        //    or auto-create. Cache by name so duplicate rows hit the DB once.
        const productCache = new Map<string, string>();
        for (const row of input.rows) {
          const key = row.productName.trim().toLowerCase();
          if (productCache.has(key)) continue;
          const [existingProduct] = await tx
            .select({ id: schema.products.id })
            .from(schema.products)
            .where(
              and(
                eq(schema.products.organizationId, orgId),
                sql`lower(trim(${schema.products.name})) = ${key}`,
              ),
            )
            .limit(1);
          if (existingProduct) {
            productCache.set(key, existingProduct.id);
            continue;
          }
          // Generate a placeholder SKU so the insert succeeds even if
          // the org's DB hasn't run migration 0009 (which made sku
          // nullable). User can edit it on /products afterward.
          const slug = row.productName
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "-")
            .slice(0, 24)
            .replace(/^-+|-+$/g, "");
          const placeholderSku = `IMP-${slug || "ITEM"}-${Date.now().toString(36).slice(-5)}`;
          const [created] = await tx
            .insert(schema.products)
            .values({
              organizationId: orgId,
              name: row.productName.trim(),
              sku: placeholderSku,
            })
            .returning({ id: schema.products.id });
          if (!created) throw new Error("Failed to create product");
          productCache.set(key, created.id);
        }

        // 2. For each row: skip if dupe, else create pallet + item + movements.
        let palletsCreated = 0;
        let palletsSkipped = 0;
        const productsCreated = productCache.size;
        for (const row of input.rows) {
          const productId = productCache.get(
            row.productName.trim().toLowerCase(),
          )!;
          const key = dedupeKey(productId, row.lot, row.expiry, row.inDate);
          if (existingKeys.has(key)) {
            palletsSkipped += 1;
            continue;
          }
          // Mark this key seen so a sheet that lists the same pallet
          // twice within itself doesn't double-insert either.
          existingKeys.add(key);

          const inDate = new Date(row.inDate);
          const outDate = row.outDate ? new Date(row.outDate) : null;
          const lpn = generateLPN();

          const [pallet] = await tx
            .insert(schema.pallets)
            .values({
              organizationId: orgId,
              warehouseId: input.warehouseId,
              customerId: resolvedCustomerId,
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
              .where(eq(schema.customers.id, resolvedCustomerId));
          }
        }

        return {
          palletsCreated,
          palletsSkipped,
          productsCreated,
          customerId: resolvedCustomerId,
        };
      });
    }),
});
