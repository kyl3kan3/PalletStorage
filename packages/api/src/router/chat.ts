import { z } from "zod";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { schema } from "@wms/db";
import { router, tenantProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";

/**
 * Cubby — the floating warehouse assistant. Lives bottom-left on every
 * dashboard page. The widget calls `chat.send` with the running message
 * history; we stuff a snapshot of the org's actual data (customer
 * names with stored counts, suppliers, recent inbound/outbound, warehouse
 * profile) into the system prompt so Cubby answers grounded questions
 * — "what are the companies", "show Ronnie's pallet count", "what's
 * coming in this week" — without hallucinating.
 */

const MESSAGE_MAX = 20;

// Caps on each list so the prompt stays under the model's context window
// even on a busy org. If a list is truncated we tell Cubby so it can
// say "and N more — see /customers".
const MAX_CUSTOMERS = 80;
const MAX_SUPPLIERS = 60;
const MAX_RECENT_ORDERS = 20;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000),
});

export const chatRouter = router({
  send: tenantProcedure
    .input(
      z.object({
        messages: z.array(messageSchema).min(1).max(MESSAGE_MAX),
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

      const [
        org,
        customersWithCounts,
        customerCountRow,
        suppliers,
        supplierCountRow,
        openInboundRow,
        openOutboundRow,
        storedPalletsRow,
        warehouses,
        recentInbound,
        recentOutbound,
      ] = await Promise.all([
        // The org's own profile — Cubby should know what warehouse it works for.
        ctx.db
          .select({
            name: schema.organizations.name,
            legalName: schema.organizations.legalName,
            city: schema.organizations.city,
            region: schema.organizations.region,
          })
          .from(schema.organizations)
          .where(eq(schema.organizations.id, orgId))
          .limit(1),

        // Customers with their stored-pallet counts and active flag —
        // single GROUP BY query, capped at MAX_CUSTOMERS.
        ctx.db
          .select({
            id: schema.customers.id,
            name: schema.customers.name,
            active: schema.customers.active,
            stored: sql<number>`coalesce(sum(case when ${schema.pallets.status} = 'stored' then 1 else 0 end), 0)::int`,
          })
          .from(schema.customers)
          .leftJoin(
            schema.pallets,
            and(
              eq(schema.pallets.customerId, schema.customers.id),
              eq(schema.pallets.organizationId, orgId),
            ),
          )
          .where(eq(schema.customers.organizationId, orgId))
          .groupBy(schema.customers.id, schema.customers.name, schema.customers.active)
          .orderBy(asc(schema.customers.name))
          .limit(MAX_CUSTOMERS),

        ctx.db
          .select({ n: sql<number>`count(*)::int` })
          .from(schema.customers)
          .where(eq(schema.customers.organizationId, orgId)),

        ctx.db
          .select({
            name: schema.suppliers.name,
            active: schema.suppliers.active,
          })
          .from(schema.suppliers)
          .where(eq(schema.suppliers.organizationId, orgId))
          .orderBy(asc(schema.suppliers.name))
          .limit(MAX_SUPPLIERS),

        ctx.db
          .select({ n: sql<number>`count(*)::int` })
          .from(schema.suppliers)
          .where(eq(schema.suppliers.organizationId, orgId)),

        ctx.db
          .select({ n: sql<number>`count(*)::int` })
          .from(schema.inboundOrders)
          .where(
            and(
              eq(schema.inboundOrders.organizationId, orgId),
              sql`${schema.inboundOrders.status} in ('open','receiving')`,
            ),
          ),
        ctx.db
          .select({ n: sql<number>`count(*)::int` })
          .from(schema.outboundOrders)
          .where(
            and(
              eq(schema.outboundOrders.organizationId, orgId),
              sql`${schema.outboundOrders.status} in ('open','picking','packed')`,
            ),
          ),
        ctx.db
          .select({ n: sql<number>`count(*)::int` })
          .from(schema.pallets)
          .where(
            and(
              eq(schema.pallets.organizationId, orgId),
              eq(schema.pallets.status, "stored"),
            ),
          ),
        ctx.db
          .select({
            code: schema.warehouses.code,
            name: schema.warehouses.name,
          })
          .from(schema.warehouses)
          .where(eq(schema.warehouses.organizationId, orgId))
          .limit(20),

        // Recent inbound — joined to customer name so Cubby can answer
        // "what's coming in for Ronnie's".
        ctx.db
          .select({
            reference: schema.inboundOrders.reference,
            status: schema.inboundOrders.status,
            supplier: schema.inboundOrders.supplier,
            expectedAt: schema.inboundOrders.expectedAt,
            customerName: schema.customers.name,
          })
          .from(schema.inboundOrders)
          .leftJoin(
            schema.customers,
            eq(schema.customers.id, schema.inboundOrders.customerId),
          )
          .where(eq(schema.inboundOrders.organizationId, orgId))
          .orderBy(desc(schema.inboundOrders.createdAt))
          .limit(MAX_RECENT_ORDERS),

        ctx.db
          .select({
            reference: schema.outboundOrders.reference,
            status: schema.outboundOrders.status,
            shipBy: schema.outboundOrders.shipBy,
            customerName: schema.customers.name,
          })
          .from(schema.outboundOrders)
          .leftJoin(
            schema.customers,
            eq(schema.customers.id, schema.outboundOrders.customerId),
          )
          .where(eq(schema.outboundOrders.organizationId, orgId))
          .orderBy(desc(schema.outboundOrders.createdAt))
          .limit(MAX_RECENT_ORDERS),
      ]);

      const totalCustomers = customerCountRow[0]?.n ?? 0;
      const totalSuppliers = supplierCountRow[0]?.n ?? 0;
      const orgRow = org[0];

      const customersBlock = customersWithCounts.length
        ? customersWithCounts
            .map(
              (c) =>
                `  - ${c.name}${c.active ? "" : " (inactive)"} — ${c.stored} stored pallet${c.stored === 1 ? "" : "s"}`,
            )
            .join("\n") +
          (totalCustomers > customersWithCounts.length
            ? `\n  …and ${totalCustomers - customersWithCounts.length} more — full list at /customers.`
            : "")
        : "  (none yet)";

      const suppliersBlock = suppliers.length
        ? suppliers
            .map((s) => `  - ${s.name}${s.active ? "" : " (inactive)"}`)
            .join("\n") +
          (totalSuppliers > suppliers.length
            ? `\n  …and ${totalSuppliers - suppliers.length} more — full list at /suppliers.`
            : "")
        : "  (none yet)";

      const fmtDate = (d: Date | null | undefined) =>
        d ? new Date(d).toISOString().slice(0, 10) : "no date";

      const recentInboundBlock = recentInbound.length
        ? recentInbound
            .map(
              (o) =>
                `  - ${o.reference} [${o.status}] from ${o.supplier ?? "—"}${
                  o.customerName ? ` for ${o.customerName}` : ""
                }, expected ${fmtDate(o.expectedAt)}`,
            )
            .join("\n")
        : "  (none yet)";

      const recentOutboundBlock = recentOutbound.length
        ? recentOutbound
            .map(
              (o) =>
                `  - ${o.reference} [${o.status}]${
                  o.customerName ? ` to ${o.customerName}` : ""
                }, ship-by ${fmtDate(o.shipBy)}`,
            )
            .join("\n")
        : "  (none yet)";

      const orgLine = orgRow
        ? `Warehouse company: ${orgRow.legalName ?? orgRow.name}${
            orgRow.city ? ` (${orgRow.city}${orgRow.region ? ", " + orgRow.region : ""})` : ""
          }`
        : "Warehouse company: (not configured)";

      const snapshot = [
        orgLine,
        warehouses.length
          ? `Warehouses: ${warehouses.map((w) => `${w.code} (${w.name})`).join(", ")}`
          : "Warehouses: none configured.",
        `Stored pallets right now: ${storedPalletsRow[0]?.n ?? 0}`,
        `Open inbound orders: ${openInboundRow[0]?.n ?? 0}`,
        `Open outbound orders: ${openOutboundRow[0]?.n ?? 0}`,
        "",
        `CUSTOMERS (${totalCustomers} total — 3PL clients whose pallets we store):`,
        customersBlock,
        "",
        `SUPPLIERS (${totalSuppliers} total — vendors that ship freight in):`,
        suppliersBlock,
        "",
        `RECENT INBOUND (last ${MAX_RECENT_ORDERS}):`,
        recentInboundBlock,
        "",
        `RECENT OUTBOUND (last ${MAX_RECENT_ORDERS}):`,
        recentOutboundBlock,
      ].join("\n");

      const role = ctx.role ?? "operator";

      const system = [
        "You are Cubby, the friendly assistant inside PalletStorage — a 3PL warehouse management app. You help warehouse managers, operators, and admins get their work done.",
        "",
        "Be concise. Two or three sentences for most answers. Use plain language; warehouse staff aren't engineers.",
        "When the user asks 'how do I…', give them concrete steps and the page they should be on (e.g. \"head to /inbound and click + New inbound\").",
        "When the user asks for facts about THEIR org (which customers, what's coming in, how many pallets X has), answer directly from the SNAPSHOT below — don't deflect to a page when the data is right here. If a list is truncated the snapshot says so explicitly.",
        "If something genuinely isn't in the snapshot (specific lot numbers, billing dollar amounts, historical movement detail), say so and point them to the right page (/reports, /customers/[id], etc.).",
        "If a question is outside the warehouse domain (general trivia, code, weather), gently redirect: \"I'm built for warehouse stuff — ask me about pallets, orders, or customers.\"",
        "",
        "DOMAIN PRIMER:",
        "- Customer = a 3PL CLIENT whose pallets we store. Has billing rates (storage / inbound / outbound). Lives at /customers.",
        "- Supplier = the company SHIPPING freight TO the warehouse on an inbound order (often the customer's vendor).",
        "- Pallet = a physical unit of stock with an LPN barcode, tied to a customer, storing pallet_items (qty + lot + expiry).",
        "- Inbound order: receiving doc, status walks open → receiving → closed. Lives at /inbound.",
        "- Outbound order: shipping doc, status walks open → picking → packed → shipped. Lives at /outbound.",
        "- Movements ledger: every receive/putaway/pick/ship event is logged; the billing peak-pallet calc walks this.",
        "- Billing rates are per-customer and in cents. The monthly statement at /reports/billing computes peak count + in/out fees and pushes to QuickBooks.",
        "- Money is integer cents everywhere. Never floats.",
        "",
        `CURRENT USER ROLE: ${role}. ${role === "operator" ? "Operator — frontline intake. Cannot edit billing rates, deactivate customers, or run the QB push." : role === "manager" ? "Manager — can edit customers/products and run AI imports + QuickBooks exports." : "Admin — full access including org settings."}`,
        "",
        "SNAPSHOT (current org, refreshed each message):",
        snapshot,
      ].join("\n");

      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: system },
        ...input.messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          max_tokens: 500,
          temperature: 0.4,
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
      const reply = payload.choices?.[0]?.message?.content?.trim() ?? "";
      if (!reply) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "Cubby didn't have anything to say. Try rephrasing?",
        });
      }
      return { reply };
    }),
});
