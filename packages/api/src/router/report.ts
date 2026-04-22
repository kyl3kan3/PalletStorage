import { z } from "zod";
import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  sql,
  sum,
} from "drizzle-orm";
import { schema } from "@wms/db";
import { router, tenantProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";

// Shared zod input for date-range reports. Both sides optional so a
// caller can omit one and get "everything before X" / "everything after X".
const dateRangeShape = {
  from: z.date().optional(),
  to: z.date().optional(),
} as const;
const dateRange = z.object(dateRangeShape).default({});

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

  /**
   * Pallet items whose expiry falls within the next `days` window, sorted
   * soonest first. Intended for the "expiring stock" dashboard card so
   * operators can proactively move, discount, or dispose of at-risk stock.
   */
  expiringStock: tenantProcedure
    .input(z.object({ days: z.number().int().min(1).max(365).default(30) }).default({}))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const cutoff = new Date(Date.now() + input.days * 24 * 3600 * 1000);
      return ctx.db
        .select({
          palletItemId: schema.palletItems.id,
          palletId: schema.pallets.id,
          lpn: schema.pallets.lpn,
          sku: schema.products.sku,
          productName: schema.products.name,
          qty: schema.palletItems.qty,
          lot: schema.palletItems.lot,
          expiry: schema.palletItems.expiry,
          locationPath: schema.locations.path,
        })
        .from(schema.palletItems)
        .innerJoin(schema.pallets, eq(schema.pallets.id, schema.palletItems.palletId))
        .innerJoin(schema.products, eq(schema.products.id, schema.palletItems.productId))
        .leftJoin(schema.locations, eq(schema.locations.id, schema.pallets.currentLocationId))
        .where(
          and(
            eq(schema.palletItems.organizationId, orgId),
            eq(schema.pallets.status, "stored"),
            isNotNull(schema.palletItems.expiry),
            lte(schema.palletItems.expiry, cutoff),
          ),
        )
        .orderBy(asc(schema.palletItems.expiry));
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

  /**
   * Shipped outbound orders within the date range. Per-order row with
   * line totals and the QBO invoice id if one was created. Used by
   * /reports/shipped and its CSV export.
   */
  shippedOrders: tenantProcedure
    .input(dateRange)
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const rows = await ctx.db
        .select({
          id: schema.outboundOrders.id,
          reference: schema.outboundOrders.reference,
          customer: schema.outboundOrders.customer,
          shippedAt: schema.outboundOrders.shippedAt,
          lineCount: sql<number>`count(${schema.outboundLines.id})::int`,
          qtyPicked: sql<number>`coalesce(sum(${schema.outboundLines.qtyPicked}),0)::int`,
          totalCents: sql<number>`coalesce(sum(${schema.outboundLines.qtyPicked} * coalesce(${schema.products.unitPriceCents},0)),0)::bigint`,
        })
        .from(schema.outboundOrders)
        .leftJoin(
          schema.outboundLines,
          eq(schema.outboundLines.outboundOrderId, schema.outboundOrders.id),
        )
        .leftJoin(schema.products, eq(schema.products.id, schema.outboundLines.productId))
        .where(
          and(
            eq(schema.outboundOrders.organizationId, orgId),
            eq(schema.outboundOrders.status, "shipped"),
            input.from ? gte(schema.outboundOrders.shippedAt, input.from) : undefined,
            input.to ? lte(schema.outboundOrders.shippedAt, input.to) : undefined,
          ),
        )
        .groupBy(
          schema.outboundOrders.id,
          schema.outboundOrders.reference,
          schema.outboundOrders.customer,
          schema.outboundOrders.shippedAt,
        )
        .orderBy(desc(schema.outboundOrders.shippedAt));
      return rows.map((r) => ({ ...r, totalCents: Number(r.totalCents) }));
    }),

  /** Closed inbound orders within the date range with qty received + variance. */
  /**
   * Inbound orders across every status (not just closed), with a
   * status filter for the UI. Powers /reports/received. Records the
   * linked supplier / customer / receiving-location as IDs only —
   * the UI joins against its own query results for the label, keeping
   * this query cheap.
   */
  receivedOrders: tenantProcedure
    .input(
      z.object({
        ...dateRangeShape,
        statuses: z
          .array(z.enum(["draft", "open", "receiving", "closed", "cancelled"]))
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      // Filter on closed_at when only closed orders are requested (the
      // default today); fall back to created_at for the broader view so
      // open / receiving / cancelled orders land in the window too.
      const onlyClosed =
        input.statuses?.length === 1 && input.statuses[0] === "closed";
      const dateCol = onlyClosed
        ? schema.inboundOrders.closedAt
        : schema.inboundOrders.createdAt;
      return ctx.db
        .select({
          id: schema.inboundOrders.id,
          reference: schema.inboundOrders.reference,
          supplier: schema.inboundOrders.supplier,
          supplierId: schema.inboundOrders.supplierId,
          customerId: schema.inboundOrders.customerId,
          receivingLocationId: schema.inboundOrders.receivingLocationId,
          status: schema.inboundOrders.status,
          closedAt: schema.inboundOrders.closedAt,
          createdAt: schema.inboundOrders.createdAt,
          expectedAt: schema.inboundOrders.expectedAt,
          closeReason: schema.inboundOrders.closeReason,
          qtyExpected: sql<number>`coalesce(sum(${schema.inboundLines.qtyExpected}),0)::int`,
          qtyReceived: sql<number>`coalesce(sum(${schema.inboundLines.qtyReceived}),0)::int`,
        })
        .from(schema.inboundOrders)
        .leftJoin(
          schema.inboundLines,
          eq(schema.inboundLines.inboundOrderId, schema.inboundOrders.id),
        )
        .where(
          and(
            eq(schema.inboundOrders.organizationId, orgId),
            input.statuses && input.statuses.length > 0
              ? inArray(schema.inboundOrders.status, input.statuses)
              : undefined,
            input.from ? gte(dateCol, input.from) : undefined,
            input.to ? lte(dateCol, input.to) : undefined,
          ),
        )
        .groupBy(
          schema.inboundOrders.id,
          schema.inboundOrders.reference,
          schema.inboundOrders.supplier,
          schema.inboundOrders.supplierId,
          schema.inboundOrders.customerId,
          schema.inboundOrders.receivingLocationId,
          schema.inboundOrders.status,
          schema.inboundOrders.closedAt,
          schema.inboundOrders.createdAt,
          schema.inboundOrders.expectedAt,
          schema.inboundOrders.closeReason,
        )
        .orderBy(desc(dateCol));
    }),

  /**
   * Operator productivity: completed picks + approved cycle counts per
   * user in the date range. Useful for staffing reviews.
   */
  operatorProductivity: tenantProcedure
    .input(dateRange)
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const from = input.from ?? new Date(Date.now() - 30 * 24 * 3600 * 1000);
      const to = input.to ?? new Date();
      const rows = await ctx.db.execute(sql`
        with pick_counts as (
          select p.assigned_user_id as user_id, count(*)::int as picks
          from ${schema.picks} p
          where p.organization_id = ${orgId}
            and p.completed_at is not null
            and p.completed_at between ${from} and ${to}
          group by p.assigned_user_id
        ),
        cc_counts as (
          select c.approved_by_user_id as user_id, count(*)::int as counts
          from ${schema.cycleCounts} c
          where c.organization_id = ${orgId}
            and c.status = 'closed'
            and c.approved_at between ${from} and ${to}
          group by c.approved_by_user_id
        )
        select
          u.id as user_id,
          u.name,
          u.email,
          coalesce(p.picks, 0) as picks,
          coalesce(c.counts, 0) as counts
        from ${schema.users} u
        left join pick_counts p on p.user_id = u.id
        left join cc_counts c on c.user_id = u.id
        where coalesce(p.picks, 0) + coalesce(c.counts, 0) > 0
        order by (coalesce(p.picks,0) + coalesce(c.counts,0)) desc
      `);
      return rows as unknown as Array<{
        user_id: string;
        name: string | null;
        email: string;
        picks: number;
        counts: number;
      }>;
    }),

  /**
   * Inventory valuation: on-hand qty × unit_price per SKU. Pallets must
   * be in 'stored' state. Products without a price are reported at $0.
   */
  inventoryValuation: tenantProcedure.query(async ({ ctx }) => {
    const orgId = await requireOrgId(ctx);
    const rows = await ctx.db
      .select({
        productId: schema.products.id,
        sku: schema.products.sku,
        name: schema.products.name,
        unitPriceCents: schema.products.unitPriceCents,
        qty: sql<number>`coalesce(sum(${schema.palletItems.qty}),0)::int`,
      })
      .from(schema.products)
      .leftJoin(
        schema.palletItems,
        eq(schema.palletItems.productId, schema.products.id),
      )
      .leftJoin(schema.pallets, eq(schema.pallets.id, schema.palletItems.palletId))
      .where(
        and(
          eq(schema.products.organizationId, orgId),
          // pallet is either stored OR NULL (products with no stock at all still list)
          sql`(${schema.pallets.status} is null or ${schema.pallets.status} = 'stored')`,
        ),
      )
      .groupBy(
        schema.products.id,
        schema.products.sku,
        schema.products.name,
        schema.products.unitPriceCents,
      )
      .orderBy(desc(sql`coalesce(sum(${schema.palletItems.qty}),0)`));
    return rows.map((r) => ({
      ...r,
      valueCents: (r.qty ?? 0) * (r.unitPriceCents ?? 0),
    }));
  }),

  /** Full movement ledger, paginated. Filter by reason and/or date. */
  movementLog: tenantProcedure
    .input(
      z.object({
        ...dateRangeShape,
        reasons: z
          .array(
            z.enum(["receive", "putaway", "move", "pick", "ship", "adjust", "cycle_count"]),
          )
          .optional(),
        limit: z.number().int().min(1).max(500).default(200),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db
        .select({
          id: schema.movements.id,
          palletId: schema.movements.palletId,
          reason: schema.movements.reason,
          fromLocationId: schema.movements.fromLocationId,
          toLocationId: schema.movements.toLocationId,
          notes: schema.movements.notes,
          createdAt: schema.movements.createdAt,
        })
        .from(schema.movements)
        .where(
          and(
            eq(schema.movements.organizationId, orgId),
            input.from ? gte(schema.movements.createdAt, input.from) : undefined,
            input.to ? lte(schema.movements.createdAt, input.to) : undefined,
            input.reasons && input.reasons.length > 0
              ? inArray(schema.movements.reason, input.reasons)
              : undefined,
          ),
        )
        .orderBy(desc(schema.movements.createdAt))
        .limit(input.limit);
    }),
});
