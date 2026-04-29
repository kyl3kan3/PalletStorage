import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { schema } from "@wms/db";
import { router, tenantProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";

/**
 * Cubby — the floating warehouse assistant. Lives bottom-left on every
 * dashboard page. The widget calls `chat.send` with the running message
 * history; we stuff a short snapshot of the org's state (counts of
 * customers / open orders / pallets, plus warehouse names) into the
 * system prompt so the bot can answer "how many pallets is X storing"
 * or "what's coming in this week" without per-message tool calls.
 */

// Cap incoming history aggressively — the widget keeps state in memory
// only, so this also bounds OpenAI cost.
const MESSAGE_MAX = 20;

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

      // Pull a small data snapshot in parallel — single round-trip per
      // message is cheap and keeps the bot grounded in the user's
      // actual data instead of hallucinating.
      const [
        customerCountRow,
        openInboundRow,
        openOutboundRow,
        storedPalletsRow,
        warehouses,
      ] = await Promise.all([
        ctx.db
          .select({ n: sql<number>`count(*)::int` })
          .from(schema.customers)
          .where(eq(schema.customers.organizationId, orgId)),
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
      ]);

      const snapshot = [
        `Customers: ${customerCountRow[0]?.n ?? 0}`,
        `Pallets currently stored: ${storedPalletsRow[0]?.n ?? 0}`,
        `Open inbound orders: ${openInboundRow[0]?.n ?? 0}`,
        `Open outbound orders: ${openOutboundRow[0]?.n ?? 0}`,
        warehouses.length
          ? `Warehouses: ${warehouses.map((w) => `${w.code} (${w.name})`).join(", ")}`
          : "No warehouses configured yet.",
      ].join("\n");

      const role = ctx.role ?? "operator";

      const system = [
        "You are Cubby, the friendly assistant inside PalletStorage — a 3PL warehouse management app. You help warehouse managers, operators, and admins get their work done.",
        "",
        "Be concise. Two or three sentences for most answers. Use plain language; warehouse staff aren't engineers.",
        "When the user asks 'how do I…', give them concrete steps and the page they should be on (e.g. \"head to /inbound and click + New inbound\").",
        "When the user asks for numbers, use the SNAPSHOT below. If the snapshot doesn't have it, say so honestly rather than guessing — they can pull a richer view from /reports.",
        "If a question is outside the warehouse domain (general trivia, code, weather), gently redirect: \"I'm built for warehouse stuff — try /reports or ask me about pallets, orders, or customers.\"",
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
