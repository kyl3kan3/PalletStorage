import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { schema } from "@wms/db";
import { generateLPN } from "@wms/core";
import { router, managerProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";

/**
 * Dev / demo helpers. Right now: seeding a dedicated demo org with a
 * realistic chunk of WMS data so every screen in the app has something
 * to render.
 *
 * Safety: this mutation refuses to run unless the caller's email is the
 * dedicated TEST_ACCOUNT_EMAIL (defaults to "test@test.com"). Real
 * tenants can't accidentally pollute their own data even if someone
 * guesses the procedure name.
 */
const TEST_ACCOUNT_EMAIL = process.env.TEST_ACCOUNT_EMAIL ?? "test@test.com";

export const devRouter = router({
  /**
   * Populate warehouses, locations, products, pallets, inbound +
   * outbound orders in a spread of statuses, movements, and cycle
   * counts for the signed-in user's org. Caller must be signed in as
   * the TEST_ACCOUNT_EMAIL and be manager-or-admin.
   */
  seed: managerProcedure
    .input(
      z
        .object({
          force: z.boolean().default(false),
        })
        .default({}),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);

      // Gate: only the dedicated test account can seed fake data.
      const [caller] = await ctx.db
        .select({ email: schema.users.email })
        .from(schema.users)
        .where(eq(schema.users.clerkUserId, ctx.userId))
        .limit(1);
      if (!caller || caller.email.toLowerCase() !== TEST_ACCOUNT_EMAIL.toLowerCase()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Seeding is restricted to the ${TEST_ACCOUNT_EMAIL} account.`,
        });
      }

      if (!input.force) {
        const rows = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.products)
          .where(eq(schema.products.organizationId, orgId));
        const count = rows[0]?.count ?? 0;
        if (count > 5) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Org already has products — refusing to seed. Call with { force: true } to re-run.",
          });
        }
      }

      return ctx.db.transaction(async (tx) => {
        // ── Warehouses ────────────────────────────────────────────
        const [wh1] = await tx
          .insert(schema.warehouses)
          .values({
            organizationId: orgId,
            code: "DC-SEA",
            name: "Seattle DC",
            timezone: "America/Los_Angeles",
          })
          .onConflictDoUpdate({
            target: [schema.warehouses.organizationId, schema.warehouses.code],
            set: { name: sql`excluded.name` },
          })
          .returning();
        const [wh2] = await tx
          .insert(schema.warehouses)
          .values({
            organizationId: orgId,
            code: "DC-PDX",
            name: "Portland DC",
            timezone: "America/Los_Angeles",
          })
          .onConflictDoUpdate({
            target: [schema.warehouses.organizationId, schema.warehouses.code],
            set: { name: sql`excluded.name` },
          })
          .returning();

        // ── Locations ─────────────────────────────────────────────
        const locRows: typeof schema.locations.$inferInsert[] = [];
        for (const wh of [wh1!, wh2!]) {
          for (const aisle of ["A", "B", "C"]) {
            for (const bay of [1, 2, 3]) {
              for (const level of [1, 2]) {
                locRows.push({
                  organizationId: orgId,
                  warehouseId: wh.id,
                  code: `${aisle}-${String(bay).padStart(2, "0")}-${level}`,
                  path: `${wh.code}.${aisle}.${String(bay).padStart(2, "0")}.01.${level}`,
                  type: "rack",
                  maxWeightKg: "1200",
                  velocityClass: aisle,
                });
              }
            }
          }
          locRows.push({
            organizationId: orgId,
            warehouseId: wh.id,
            code: "DOCK-IN",
            path: `${wh.code}.IN.01.01.1`,
            type: "dock",
          });
          locRows.push({
            organizationId: orgId,
            warehouseId: wh.id,
            code: "STAGE-OUT",
            path: `${wh.code}.OUT.01.01.1`,
            type: "staging",
          });
        }
        const locations = await tx
          .insert(schema.locations)
          .values(locRows)
          .onConflictDoNothing()
          .returning();

        const wh1Locs = locations.filter((l) => l.warehouseId === wh1!.id);
        const wh1Rack = wh1Locs.filter((l) => l.type === "rack");
        const wh1Staging = wh1Locs.find((l) => l.type === "staging");

        // ── Products ──────────────────────────────────────────────
        const productDefs: Array<{
          sku: string;
          name: string;
          velocity: "A" | "B" | "C";
          priceCents: number;
          weight: number;
          expiresInDays?: number;
        }> = [
          { sku: "SKU-00421", name: "Organic Quinoa 2kg", velocity: "A", priceCents: 1499, weight: 2.1 },
          { sku: "SKU-00137", name: "Cold-Press Olive Oil 1L", velocity: "A", priceCents: 1999, weight: 1.1, expiresInDays: 180 },
          { sku: "SKU-01902", name: "Dried Apricots 500g", velocity: "B", priceCents: 899, weight: 0.55, expiresInDays: 90 },
          { sku: "SKU-00815", name: "Dark Chocolate Bars 12-pack", velocity: "A", priceCents: 2499, weight: 1.5, expiresInDays: 45 },
          { sku: "SKU-00333", name: "Raw Almonds 1kg", velocity: "B", priceCents: 1799, weight: 1.05, expiresInDays: 120 },
          { sku: "SKU-00712", name: "Buckwheat Honey 500g", velocity: "C", priceCents: 1199, weight: 0.6 },
          { sku: "SKU-00999", name: "Pickled Ginger Jar", velocity: "C", priceCents: 599, weight: 0.3, expiresInDays: 365 },
          { sku: "SKU-01234", name: "Stainless Steel Water Bottle", velocity: "B", priceCents: 2299, weight: 0.45 },
          { sku: "SKU-02200", name: "Cotton T-Shirt (M)", velocity: "A", priceCents: 1999, weight: 0.2 },
          { sku: "SKU-02201", name: "Cotton T-Shirt (L)", velocity: "A", priceCents: 1999, weight: 0.22 },
          { sku: "SKU-05010", name: "Rubber Dock Seal 4ft", velocity: "C", priceCents: 4500, weight: 6.5 },
          { sku: "SKU-05011", name: "Polyurethane Caster 6in", velocity: "C", priceCents: 2100, weight: 1.4 },
          { sku: "SKU-07700", name: "LED Shop Light 4ft", velocity: "B", priceCents: 3499, weight: 1.8 },
          { sku: "SKU-08801", name: "Nitrile Gloves Box (100)", velocity: "A", priceCents: 1899, weight: 0.55 },
          { sku: "SKU-09900", name: "Kraft Box 12x12x12", velocity: "A", priceCents: 249, weight: 0.15 },
          { sku: "SKU-09901", name: "Bubble Wrap Roll 50ft", velocity: "B", priceCents: 999, weight: 2.0 },
          { sku: "SKU-11111", name: "Vanilla Bean Pods 50ct", velocity: "C", priceCents: 4999, weight: 0.2, expiresInDays: 30 },
          { sku: "SKU-22222", name: "Espresso Beans 1kg", velocity: "A", priceCents: 2399, weight: 1.0, expiresInDays: 60 },
          { sku: "SKU-33333", name: "Cold Brew Concentrate 1L", velocity: "B", priceCents: 1499, weight: 1.1, expiresInDays: 14 },
          { sku: "SKU-44444", name: "Matcha Powder 100g", velocity: "B", priceCents: 2999, weight: 0.12, expiresInDays: 200 },
        ];
        const products = await tx
          .insert(schema.products)
          .values(
            productDefs.map((p) => ({
              organizationId: orgId,
              sku: p.sku,
              name: p.name,
              velocityClass: p.velocity,
              unitPriceCents: p.priceCents,
              weightKg: p.weight.toString(),
            })),
          )
          .onConflictDoUpdate({
            target: [schema.products.organizationId, schema.products.sku],
            set: {
              name: sql`excluded.name`,
              velocityClass: sql`excluded.velocity_class`,
              unitPriceCents: sql`excluded.unit_price_cents`,
              weightKg: sql`excluded.weight_kg`,
            },
          })
          .returning();

        // ── Pallets (stored in wh1) ───────────────────────────────
        const pallets: (typeof schema.pallets.$inferSelect)[] = [];
        for (let i = 0; i < 24; i++) {
          const [p] = await tx
            .insert(schema.pallets)
            .values({
              organizationId: orgId,
              warehouseId: wh1!.id,
              lpn: generateLPN(),
              status: "stored",
              currentLocationId: wh1Rack[i % wh1Rack.length]!.id,
              weightKg: "350",
            })
            .returning();
          pallets.push(p!);
        }

        // ── Pallet items (one or two SKUs per pallet) ─────────────
        const itemRows: typeof schema.palletItems.$inferInsert[] = [];
        const now = Date.now();
        const day = 24 * 3600 * 1000;
        for (let i = 0; i < pallets.length; i++) {
          const pallet = pallets[i]!;
          const primary = products[i % products.length]!;
          const pdef = productDefs[i % productDefs.length]!;
          itemRows.push({
            organizationId: orgId,
            palletId: pallet.id,
            productId: primary.id,
            qty: 40 + ((i * 7) % 60),
            lot: `L${String(i).padStart(4, "0")}`,
            expiry: pdef.expiresInDays
              ? new Date(now + (pdef.expiresInDays - (i % 20)) * day)
              : null,
          });
          // 40% of pallets have a second SKU too
          if (i % 5 < 2) {
            const second = products[(i + 3) % products.length]!;
            const sdef = productDefs[(i + 3) % productDefs.length]!;
            itemRows.push({
              organizationId: orgId,
              palletId: pallet.id,
              productId: second.id,
              qty: 12 + (i % 18),
              expiry: sdef.expiresInDays ? new Date(now + sdef.expiresInDays * day) : null,
            });
          }
        }
        await tx.insert(schema.palletItems).values(itemRows);

        // ── Inbound orders (various statuses) ─────────────────────
        const suppliers = ["Sunrise Organics", "Acme Foods Co", "Pacific Produce", "Northwest Wholesale"];
        const inboundOrders: (typeof schema.inboundOrders.$inferSelect)[] = [];
        for (let i = 0; i < 10; i++) {
          const status = (i < 3 ? "open" : i < 5 ? "receiving" : i < 9 ? "closed" : "cancelled") as
            | "open"
            | "receiving"
            | "closed"
            | "cancelled";
          const [o] = await tx
            .insert(schema.inboundOrders)
            .values({
              organizationId: orgId,
              warehouseId: wh1!.id,
              reference: `PO-${7000 + i}`,
              supplier: suppliers[i % suppliers.length]!,
              status,
              expectedAt: new Date(now + (i - 5) * day),
              closedAt: status === "closed" ? new Date(now - (10 - i) * day) : null,
              closeReason:
                status === "closed" && i % 3 === 0
                  ? "Short-shipped — supplier notified"
                  : null,
            })
            .returning();
          inboundOrders.push(o!);
        }
        // Inbound lines (2-4 per order)
        for (let i = 0; i < inboundOrders.length; i++) {
          const o = inboundOrders[i]!;
          const lineCount = 2 + (i % 3);
          for (let j = 0; j < lineCount; j++) {
            const product = products[(i * 3 + j) % products.length]!;
            const qtyExpected = 20 + j * 10 + (i % 15);
            const isShort = o.status === "closed" && i % 3 === 0 && j === 0;
            const qtyReceived =
              o.status === "open"
                ? 0
                : o.status === "receiving"
                  ? Math.floor(qtyExpected * 0.5)
                  : isShort
                    ? qtyExpected - (5 + (j % 4))
                    : qtyExpected;
            await tx.insert(schema.inboundLines).values({
              organizationId: orgId,
              inboundOrderId: o.id,
              productId: product.id,
              qtyExpected,
              qtyReceived,
            });
          }
        }

        // ── Outbound orders (various statuses) ────────────────────
        const customers = ["Bluebird Cafes", "Harvest Table Market", "Sunset Grocers", "Green Leaf Co-op"];
        const outboundOrders: (typeof schema.outboundOrders.$inferSelect)[] = [];
        for (let i = 0; i < 12; i++) {
          const status = (i < 2
            ? "open"
            : i < 4
              ? "picking"
              : i < 6
                ? "packed"
                : i < 10
                  ? "shipped"
                  : "cancelled") as
            | "open"
            | "picking"
            | "packed"
            | "shipped"
            | "cancelled";
          const [o] = await tx
            .insert(schema.outboundOrders)
            .values({
              organizationId: orgId,
              warehouseId: wh1!.id,
              reference: `SO-${24000 + i}`,
              customer: customers[i % customers.length]!,
              status,
              shipBy: new Date(now + (i - 3) * day),
              shippedAt: status === "shipped" ? new Date(now - (12 - i) * day) : null,
              packedAt: status === "shipped" || status === "packed"
                ? new Date(now - (13 - i) * day)
                : null,
              cancelledAt: status === "cancelled" ? new Date(now - day) : null,
              cancelReason: status === "cancelled" ? "Customer requested cancellation" : null,
            })
            .returning();
          outboundOrders.push(o!);
        }
        // Outbound lines (2-4 per order)
        for (let i = 0; i < outboundOrders.length; i++) {
          const o = outboundOrders[i]!;
          const lineCount = 2 + (i % 3);
          for (let j = 0; j < lineCount; j++) {
            const product = products[(i * 2 + j + 5) % products.length]!;
            const qtyOrdered = 10 + j * 5 + (i % 10);
            const qtyPicked =
              o.status === "open"
                ? 0
                : o.status === "picking"
                  ? Math.floor(qtyOrdered * 0.4)
                  : o.status === "cancelled"
                    ? 0
                    : qtyOrdered;
            await tx.insert(schema.outboundLines).values({
              organizationId: orgId,
              outboundOrderId: o.id,
              productId: product.id,
              qtyOrdered,
              qtyPicked,
            });
          }
        }

        // ── Movements (mock the history so reports have data) ─────
        const movementRows: typeof schema.movements.$inferInsert[] = [];
        for (let i = 0; i < pallets.length; i++) {
          const pallet = pallets[i]!;
          const receivedAt = new Date(now - (30 - (i % 30)) * day - 3 * 3600 * 1000);
          const putawayAt = new Date(receivedAt.getTime() + (30 + (i % 120)) * 60 * 1000);
          movementRows.push({
            organizationId: orgId,
            palletId: pallet.id,
            fromLocationId: null,
            toLocationId: pallet.currentLocationId,
            reason: "receive",
            refType: "seed",
            createdAt: receivedAt,
          });
          movementRows.push({
            organizationId: orgId,
            palletId: pallet.id,
            fromLocationId: null,
            toLocationId: pallet.currentLocationId,
            reason: "putaway",
            refType: "seed",
            createdAt: putawayAt,
          });
        }
        // Ship movements for shipped outbounds (pick a pallet per order)
        for (const o of outboundOrders.filter((x) => x.status === "shipped")) {
          const pallet = pallets[Math.abs(hash(o.reference)) % pallets.length]!;
          movementRows.push({
            organizationId: orgId,
            palletId: pallet.id,
            fromLocationId: wh1Staging?.id ?? pallet.currentLocationId,
            toLocationId: null,
            reason: "ship",
            refType: "outbound_order",
            refId: o.id,
            createdAt: o.shippedAt ?? new Date(),
          });
        }
        await tx.insert(schema.movements).values(movementRows);

        // ── Cycle counts (one closed with variance, one reviewing) ─
        const [ccClosed] = await tx
          .insert(schema.cycleCounts)
          .values({
            organizationId: orgId,
            warehouseId: wh1!.id,
            locationId: wh1Rack[0]!.id,
            status: "closed",
            submittedAt: new Date(now - 3 * day),
            approvedAt: new Date(now - 2 * day),
          })
          .returning();
        const [ccReviewing] = await tx
          .insert(schema.cycleCounts)
          .values({
            organizationId: orgId,
            warehouseId: wh1!.id,
            locationId: wh1Rack[1]!.id,
            status: "reviewing",
            submittedAt: new Date(now - day),
          })
          .returning();

        return {
          ok: true,
          summary: {
            warehouses: 2,
            locations: locations.length,
            products: products.length,
            pallets: pallets.length,
            inboundOrders: inboundOrders.length,
            outboundOrders: outboundOrders.length,
            movements: movementRows.length,
            cycleCounts: [ccClosed, ccReviewing].filter(Boolean).length,
          },
        };
      });
    }),
});

/** Deterministic tiny string hash for picking stable sample pallets. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
