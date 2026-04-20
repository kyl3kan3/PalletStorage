import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { exchangeAuthCode } from "@wms/api/quickbooks/client";
import { db, schema } from "@wms/db";
import { eq } from "drizzle-orm";

/**
 * Intuit redirects here after the admin approves the connection.
 * Query params: code, state, realmId.
 */
export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.redirect(new URL("/sign-in", req.url));

  const code = req.nextUrl.searchParams.get("code");
  const realmId = req.nextUrl.searchParams.get("realmId");
  if (!code || !realmId) return NextResponse.json({ error: "missing code/realmId" }, { status: 400 });

  const tokens = await exchangeAuthCode(code);

  const [org] = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.clerkOrgId, orgId))
    .limit(1);
  if (!org) return NextResponse.json({ error: "org not provisioned" }, { status: 400 });

  await db
    .insert(schema.quickbooksConnections)
    .values({
      organizationId: org.id,
      realmId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      refreshTokenExpiresAt: new Date(Date.now() + tokens.x_refresh_token_expires_in * 1000),
    })
    .onConflictDoUpdate({
      target: schema.quickbooksConnections.organizationId,
      set: {
        realmId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        refreshTokenExpiresAt: new Date(Date.now() + tokens.x_refresh_token_expires_in * 1000),
      },
    });

  return NextResponse.redirect(new URL("/settings/integrations?connected=quickbooks", req.url));
}
