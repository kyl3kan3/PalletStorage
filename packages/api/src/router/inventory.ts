import { z } from "zod";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { schema } from "@wms/db";
import { router, tenantProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";

/**
 * Inventory router — read-only views of what the system thinks is in
 * the warehouses. Two queries:
 *
 *   - byPallet: one row per pallet_item, joined with pallet/product/
 *     location/warehouse so the operator can scan a flat table and
 *     see exactly where every unit lives.
 *   - byProduct: aggregated per product so the user can answer
 *     'how much Vanilla do I have, total' without scrolling pallets.
 *
 * Tenant-scoped via requireOrgId. Optional warehouseId filter on
 * byPallet so the dashboard can drill into a single site.
 */
export const inventoryRouter = router({
  byPallet: tenantProcedure
    .input(
      z
        .object({
          warehouseId: z.string().uuid().optional(),
          customerId: z.string().uuid().optional(),
          q: z.string().trim().default(""),
          status: z
            .enum(["in_transit", "received", "stored", "picked", "shipped", "damaged"])
            .optional(),
          limit: z.number().int().min(1).max(2000).default(500),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const q = input.q ? `%${input.q}%` : null;
      return ctx.db
        .select({
          palletItemId: schema.palletItems.id,
          palletId: schema.pallets.id,
          palletLpn: schema.pallets.lpn,
          palletStatus: schema.pallets.status,
          warehouseId: schema.warehouses.id,
          warehouseCode: schema.warehouses.code,
          warehouseName: schema.warehouses.name,
          locationCode: schema.locations.code,
          locationPath: schema.locations.path,
          locationType: schema.locations.type,
          productId: schema.products.id,
          productSku: schema.products.sku,
          productName: schema.products.name,
          qty: schema.palletItems.qty,
          lot: schema.palletItems.lot,
          expiry: schema.palletItems.expiry,
          palletCreatedAt: schema.pallets.createdAt,
          customerId: schema.pallets.customerId,
          customerName: schema.customers.name,
        })
        .from(schema.palletItems)
        .innerJoin(schema.pallets, eq(schema.pallets.id, schema.palletItems.palletId))
        .innerJoin(schema.products, eq(schema.products.id, schema.palletItems.productId))
        .innerJoin(schema.warehouses, eq(schema.warehouses.id, schema.pallets.warehouseId))
        .leftJoin(schema.locations, eq(schema.locations.id, schema.pallets.currentLocationId))
        .leftJoin(schema.customers, eq(schema.customers.id, schema.pallets.customerId))
        .where(
          and(
            eq(schema.palletItems.organizationId, orgId),
            input.warehouseId ? eq(schema.pallets.warehouseId, input.warehouseId) : undefined,
            input.customerId
              ? eq(schema.pallets.customerId, input.customerId)
              : undefined,
            input.status ? eq(schema.pallets.status, input.status) : undefined,
            q
              ? or(
                  ilike(schema.products.name, q),
                  ilike(schema.products.sku, q),
                  ilike(schema.pallets.lpn, q),
                  ilike(schema.locations.code, q),
                  ilike(schema.palletItems.lot, q),
                  ilike(schema.customers.name, q),
                )
              : undefined,
          ),
        )
        .orderBy(schema.products.name, schema.pallets.lpn)
        .limit(input.limit);
    }),

  byProduct: tenantProcedure
    .input(
      z
        .object({
          warehouseId: z.string().uuid().optional(),
          customerId: z.string().uuid().optional(),
          q: z.string().trim().default(""),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const q = input.q ? `%${input.q}%` : null;
      return ctx.db
        .select({
          productId: schema.products.id,
          sku: schema.products.sku,
          name: schema.products.name,
          stored: sql<number>`coalesce(sum(case when ${schema.pallets.status} = 'stored' then ${schema.palletItems.qty} else 0 end),0)::int`,
          received: sql<number>`coalesce(sum(case when ${schema.pallets.status} = 'received' then ${schema.palletItems.qty} else 0 end),0)::int`,
          inTransit: sql<number>`coalesce(sum(case when ${schema.pallets.status} = 'in_transit' then ${schema.palletItems.qty} else 0 end),0)::int`,
          picked: sql<number>`coalesce(sum(case when ${schema.pallets.status} = 'picked' then ${schema.palletItems.qty} else 0 end),0)::int`,
          damaged: sql<number>`coalesce(sum(case when ${schema.pallets.status} = 'damaged' then ${schema.palletItems.qty} else 0 end),0)::int`,
          total: sql<number>`coalesce(sum(${schema.palletItems.qty}),0)::int`,
          palletCount: sql<number>`count(distinct ${schema.pallets.id})::int`,
        })
        .from(schema.products)
        .leftJoin(
          schema.palletItems,
          and(
            eq(schema.palletItems.productId, schema.products.id),
            eq(schema.palletItems.organizationId, orgId),
          ),
        )
        .leftJoin(
          schema.pallets,
          and(
            eq(schema.pallets.id, schema.palletItems.palletId),
            input.warehouseId
              ? eq(schema.pallets.warehouseId, input.warehouseId)
              : undefined,
            input.customerId
              ? eq(schema.pallets.customerId, input.customerId)
              : undefined,
          ),
        )
        .where(
          and(
            eq(schema.products.organizationId, orgId),
            q
              ? or(ilike(schema.products.name, q), ilike(schema.products.sku, q))
              : undefined,
          ),
        )
        .groupBy(schema.products.id, schema.products.sku, schema.products.name)
        .orderBy(schema.products.name);
    }),
});
