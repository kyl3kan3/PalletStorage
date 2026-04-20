import { z } from "zod";
import { and, count, countDistinct, eq, gte, sql, sum } from "drizzle-orm";
import { schema } from "@wms/db";
import { router, tenantProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";

/**
 * Aggregations for the Reports dashboard. Each procedure returns data ready
 * for a single chart/card — keep them narrow so the UI doesn't have to
 * re-shape query results.
 */
export const reportRouter = router({
  /** Total units on hand across all stored pallets, grouped by product. */
  stockOnHand: tenantProcedure
    .input(z.object({ limit: z.number().int().max(500).default(100) }).default({}))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db
        .select({
          productId: schema.products.id,
          sku: schema.products.sku,
          name: schema.products.name,
          qty: sum(schema.palletItems.qty).mapWith(Number),
          palletCount: countDistinct(schema.palletItems.palletId).mapWith(Number),
        })
        .from(schema.palletItems)
        .innerJoin(schema.pallets, eq(schema.pallets.id, schema.palletItems.palletId))
        .innerJoin(schema.products, eq(schema.products.id, schema.palletItems.productId))
        .where(and(eq(schema.palletItems.organizationId, orgId), eq(schema.pallets.status, "stored")))
        .groupBy(schema.products.id, schema.products.sku, schema.products.name)
        .orderBy(sql`sum(${schema.palletItems.qty}) desc`)
        .limit(input.limit);
    }),

  /**
   * Dock-to-stock time: for each received pallet, how long from the receive
   * movement to the putaway movement. Reported as average + p50/p95 over
   * the last N days.
   */
  dockToStock: tenantProcedure
    .input(z.object({ days: z.number().int().min(1).max(90).default(30) }).default({}))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const since = new Date(Date.now() - input.days * 24 * 3600 * 1000);
      // One subquery per reason, joined on pallet_id, pick the latest per pallet.
      const rows = await ctx.db.execute(sql`
        with receives as (
          select pallet_id, min(created_at) as received_at
          from ${schema.movements}
          where organization_id = ${orgId} and reason = 'receive' and created_at >= ${since}
          group by pallet_id
        ),
        putaways as (
          select pallet_id, min(created_at) as stored_at
          from ${schema.movements}
          where organization_id = ${orgId} and reason = 'putaway' and created_at >= ${since}
          group by pallet_id
        ),
        durations as (
          select extract(epoch from (p.stored_at - r.received_at)) as seconds
          from receives r join putaways p using (pallet_id)
          where p.stored_at > r.received_at
        )
        select
          count(*)::int as n,
          coalesce(avg(seconds), 0)::float as avg_seconds,
          coalesce(percentile_cont(0.5) within group (order by seconds), 0)::float as p50_seconds,
          coalesce(percentile_cont(0.95) within group (order by seconds), 0)::float as p95_seconds
        from durations
      `);
      const r = (rows as unknown as Array<{
        n: number;
        avg_seconds: number;
        p50_seconds: number;
        p95_seconds: number;
      }>)[0] ?? { n: 0, avg_seconds: 0, p50_seconds: 0, p95_seconds: 0 };
      return {
        days: input.days,
        n: r.n,
        avg_seconds: r.avg_seconds,
        p50_seconds: r.p50_seconds,
        p95_seconds: r.p95_seconds,
      };
    }),

  /** Pallet throughput by day for the last N days (received, picked, shipped). */
  throughput: tenantProcedure
    .input(z.object({ days: z.number().int().min(1).max(90).default(14) }).default({}))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const since = new Date(Date.now() - input.days * 24 * 3600 * 1000);
      const rows = await ctx.db.execute(sql`
        select
          date_trunc('day', created_at)::date as day,
          reason,
          count(*)::int as n
        from ${schema.movements}
        where organization_id = ${orgId}
          and created_at >= ${since}
          and reason in ('receive', 'pick', 'ship')
        group by 1, 2
        order by 1 asc
      `);
      return rows as unknown as Array<{ day: string; reason: string; n: number }>;
    }),

  /** Top-level counters for the dashboard hero strip. */
  summary: tenantProcedure.query(async ({ ctx }) => {
    const orgId = await requireOrgId(ctx);
    const [pallets] = await ctx.db
      .select({ n: count() })
      .from(schema.pallets)
      .where(and(eq(schema.pallets.organizationId, orgId), eq(schema.pallets.status, "stored")));
    const [openInbound] = await ctx.db
      .select({ n: count() })
      .from(schema.inboundOrders)
      .where(
        and(eq(schema.inboundOrders.organizationId, orgId), eq(schema.inboundOrders.status, "open")),
      );
    const [openOutbound] = await ctx.db
      .select({ n: count() })
      .from(schema.outboundOrders)
      .where(
        and(
          eq(schema.outboundOrders.organizationId, orgId),
          eq(schema.outboundOrders.status, "picking"),
        ),
      );
    const since24h = new Date(Date.now() - 24 * 3600 * 1000);
    const [moves24h] = await ctx.db
      .select({ n: count() })
      .from(schema.movements)
      .where(
        and(eq(schema.movements.organizationId, orgId), gte(schema.movements.createdAt, since24h)),
      );
    return {
      storedPallets: pallets?.n ?? 0,
      openInbound: openInbound?.n ?? 0,
      outboundPicking: openOutbound?.n ?? 0,
      movements24h: moves24h?.n ?? 0,
    };
  }),
});
