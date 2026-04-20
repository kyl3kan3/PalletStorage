import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { schema, type Db } from "@wms/db";
import { router, tenantProcedure, adminProcedure } from "../trpc";
import { requireOrgId } from "./_helpers";
import {
  exchangeAuthCode,
  refreshAccessToken,
  buildAuthorizeUrl,
} from "../quickbooks/client";
import {
  exportInboundAsBill,
  exportOutboundAsInvoice,
  exportAdjustmentAsInventoryAdjustment,
} from "../quickbooks/export";

export const quickbooksRouter = router({
  /** Kick off OAuth: returns the Intuit consent URL. */
  authorizeUrl: adminProcedure.query(({ ctx }) => {
    return { url: buildAuthorizeUrl(ctx.orgId) };
  }),

  /** OAuth callback: trade the code for tokens and persist them. */
  completeAuth: adminProcedure
    .input(z.object({ code: z.string(), realmId: z.string(), state: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgId(ctx);
      const tokens = await exchangeAuthCode(input.code);
      await ctx.db
        .insert(schema.quickbooksConnections)
        .values({
          organizationId: orgId,
          realmId: input.realmId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          refreshTokenExpiresAt: new Date(Date.now() + tokens.x_refresh_token_expires_in * 1000),
        })
        .onConflictDoUpdate({
          target: schema.quickbooksConnections.organizationId,
          set: {
            realmId: input.realmId,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            refreshTokenExpiresAt: new Date(Date.now() + tokens.x_refresh_token_expires_in * 1000),
          },
        });
      return { ok: true };
    }),

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

