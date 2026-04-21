import { z } from "zod";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { schema, type Db } from "@wms/db";
import { router, tenantProcedure, adminProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";
import { refreshAccessToken } from "../quickbooks/client";
import {
  exportInboundAsBill,
  exportOutboundAsInvoice,
  exportAdjustmentAsInventoryAdjustment,
} from "../quickbooks/export";

// NOTE: OAuth kickoff lives at /api/quickbooks/authorize (full route, not
// tRPC) so the redirect_uri is derived from the request origin and we can
// set an httpOnly state cookie on the response. The callback route
// exchanges the code + persists tokens. Keeping OAuth out of tRPC means
// one less env var to misconfigure.

export const quickbooksRouter = router({
  status: tenantProcedure.query(async ({ ctx }) => {
    const orgId = await requireOrgId(ctx);
    const [conn] = await ctx.db
      .select({
        realmId: schema.quickbooksConnections.realmId,
        connectedAt: schema.quickbooksConnections.connectedAt,
      })
      .from(schema.quickbooksConnections)
      .where(eq(schema.quickbooksConnections.organizationId, orgId))
      .limit(1);
    return { connected: !!conn, realmId: conn?.realmId, connectedAt: conn?.connectedAt };
  }),

  disconnect: adminProcedure.mutation(async ({ ctx }) => {
    const orgId = await requireOrgId(ctx);
    await ctx.db
      .delete(schema.quickbooksConnections)
      .where(eq(schema.quickbooksConnections.organizationId, orgId));
    return { ok: true };
  }),

  /**
   * Export a completed inbound (receipt) as a QuickBooks Bill, mapping
   * each inbound line to a BillLine on the connected QB item.
   */
  exportInbound: tenantProcedure
    .input(z.object({ inboundOrderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const conn = await requireConnection(ctx, orgId);
      const result = await exportInboundAsBill(ctx.db, conn, orgId, input.inboundOrderId);
      await ctx.db.insert(schema.quickbooksExports).values({
        organizationId: orgId,
        sourceType: "inbound_order",
        sourceId: input.inboundOrderId,
        qboEntityType: "Bill",
        qboEntityId: result.qboId,
      });
      return result;
    }),

  /** Export a shipped outbound as a QuickBooks Invoice. */
  exportOutbound: tenantProcedure
    .input(z.object({ outboundOrderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const conn = await requireConnection(ctx, orgId);
      const result = await exportOutboundAsInvoice(ctx.db, conn, orgId, input.outboundOrderId);
      await ctx.db.insert(schema.quickbooksExports).values({
        organizationId: orgId,
        sourceType: "outbound_order",
        sourceId: input.outboundOrderId,
        qboEntityType: "Invoice",
        qboEntityId: result.qboId,
      });
      return result;
    }),

  /** Push cycle-count / adjustment movements as QB InventoryAdjustment. */
  exportAdjustment: tenantProcedure
    .input(z.object({ movementIds: z.array(z.string().uuid()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const conn = await requireConnection(ctx, orgId);
      const result = await exportAdjustmentAsInventoryAdjustment(ctx.db, conn, orgId, input.movementIds);
      return result;
    }),

  /**
   * Push a closed cycle count's variances as QB Item QtyOnHand updates.
   * Looks up the cycle_count movements by refId so the caller only
   * needs the count id (not the underlying movement ids).
   */
  exportCycleCount: tenantProcedure
    .input(z.object({ cycleCountId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const conn = await requireConnection(ctx, orgId);

      // Confirm the count is closed and belongs to this org.
      const [cc] = await ctx.db
        .select()
        .from(schema.cycleCounts)
        .where(
          and(
            eq(schema.cycleCounts.id, input.cycleCountId),
            eq(schema.cycleCounts.organizationId, orgId),
          ),
        )
        .limit(1);
      if (!cc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cycle count not found" });
      }
      if (cc.status !== "closed") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Cycle count must be approved (closed) first; current status '${cc.status}'`,
        });
      }

      const movements = await ctx.db
        .select({ id: schema.movements.id })
        .from(schema.movements)
        .where(
          and(
            eq(schema.movements.organizationId, orgId),
            eq(schema.movements.reason, "cycle_count"),
            eq(schema.movements.refType, "cycle_count"),
            eq(schema.movements.refId, input.cycleCountId),
          ),
        );
      if (movements.length === 0) {
        return {
          qboId: "no_variance",
          movements: 0,
          note: "Count was approved with zero variance — nothing to push.",
        };
      }

      const result = await exportAdjustmentAsInventoryAdjustment(
        ctx.db,
        conn,
        orgId,
        movements.map((m) => m.id),
      );

      await ctx.db.insert(schema.quickbooksExports).values({
        organizationId: orgId,
        sourceType: "cycle_count",
        sourceId: input.cycleCountId,
        qboEntityType: "InventoryAdjustment",
        qboEntityId: result.qboId,
      });

      return result;
    }),

  /**
   * Orders that are in a QBO-exportable state (closed inbounds, shipped
   * outbounds) and haven't been successfully exported yet. Powers the
   * "Ready to export" queue on /settings/integrations.
   */
  readyToExport: tenantProcedure.query(async ({ ctx }) => {
    const orgId = await requireOrgId(ctx);

    // Already-exported ids, to subtract from the candidates.
    const exported = await ctx.db
      .select({
        sourceType: schema.quickbooksExports.sourceType,
        sourceId: schema.quickbooksExports.sourceId,
      })
      .from(schema.quickbooksExports)
      .where(
        and(
          eq(schema.quickbooksExports.organizationId, orgId),
          eq(schema.quickbooksExports.status, "success"),
        ),
      );
    const exportedInbound = new Set(
      exported.filter((e) => e.sourceType === "inbound_order").map((e) => e.sourceId),
    );
    const exportedOutbound = new Set(
      exported.filter((e) => e.sourceType === "outbound_order").map((e) => e.sourceId),
    );
    const exportedCounts = new Set(
      exported.filter((e) => e.sourceType === "cycle_count").map((e) => e.sourceId),
    );

    const closedInbound = await ctx.db
      .select({
        id: schema.inboundOrders.id,
        reference: schema.inboundOrders.reference,
        supplier: schema.inboundOrders.supplier,
        closedAt: schema.inboundOrders.closedAt,
      })
      .from(schema.inboundOrders)
      .where(
        and(
          eq(schema.inboundOrders.organizationId, orgId),
          eq(schema.inboundOrders.status, "closed"),
        ),
      )
      .orderBy(desc(schema.inboundOrders.closedAt))
      .limit(50);

    const shippedOutbound = await ctx.db
      .select({
        id: schema.outboundOrders.id,
        reference: schema.outboundOrders.reference,
        customer: schema.outboundOrders.customer,
        shippedAt: schema.outboundOrders.shippedAt,
      })
      .from(schema.outboundOrders)
      .where(
        and(
          eq(schema.outboundOrders.organizationId, orgId),
          eq(schema.outboundOrders.status, "shipped"),
        ),
      )
      .orderBy(desc(schema.outboundOrders.shippedAt))
      .limit(50);

    const closedCounts = await ctx.db
      .select({
        id: schema.cycleCounts.id,
        approvedAt: schema.cycleCounts.approvedAt,
        locationId: schema.cycleCounts.locationId,
      })
      .from(schema.cycleCounts)
      .where(
        and(
          eq(schema.cycleCounts.organizationId, orgId),
          eq(schema.cycleCounts.status, "closed"),
        ),
      )
      .orderBy(desc(schema.cycleCounts.approvedAt))
      .limit(50);

    return {
      inbound: closedInbound.filter((o) => !exportedInbound.has(o.id)),
      outbound: shippedOutbound.filter((o) => !exportedOutbound.has(o.id)),
      cycleCounts: closedCounts.filter((c) => !exportedCounts.has(c.id)),
    };
  }),

  /** History of prior exports. */
  history: tenantProcedure
    .input(z.object({ limit: z.number().int().max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db
        .select()
        .from(schema.quickbooksExports)
        .where(eq(schema.quickbooksExports.organizationId, orgId))
        .limit(input.limit);
    }),

  /** Recent inbound webhook events from QuickBooks for this org. */
  webhookHistory: tenantProcedure
    .input(z.object({ limit: z.number().int().max(200).default(50) }).default({}))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      return ctx.db
        .select({
          id: schema.quickbooksWebhookEvents.id,
          entityName: schema.quickbooksWebhookEvents.entityName,
          entityId: schema.quickbooksWebhookEvents.entityId,
          operation: schema.quickbooksWebhookEvents.operation,
          lastUpdated: schema.quickbooksWebhookEvents.lastUpdated,
          receivedAt: schema.quickbooksWebhookEvents.receivedAt,
        })
        .from(schema.quickbooksWebhookEvents)
        .where(eq(schema.quickbooksWebhookEvents.organizationId, orgId))
        .orderBy(desc(schema.quickbooksWebhookEvents.receivedAt))
        .limit(input.limit);
    }),
});

async function requireConnection(ctx: { db: Db }, orgId: string) {
  const [conn] = await ctx.db
    .select()
    .from(schema.quickbooksConnections)
    .where(eq(schema.quickbooksConnections.organizationId, orgId))
    .limit(1);
  if (!conn) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "QuickBooks is not connected" });
  }
  // Transparently refresh if the access token is expiring in <5min
  if (conn.accessTokenExpiresAt.getTime() - Date.now() < 5 * 60_000) {
    const refreshed = await refreshAccessToken(conn.refreshToken);
    await ctx.db
      .update(schema.quickbooksConnections)
      .set({
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        accessTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        refreshTokenExpiresAt: new Date(Date.now() + refreshed.x_refresh_token_expires_in * 1000),
      })
      .where(eq(schema.quickbooksConnections.organizationId, orgId));
    conn.accessToken = refreshed.access_token;
    conn.refreshToken = refreshed.refresh_token;
  }
  return conn;
}

