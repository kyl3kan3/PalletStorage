import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { timingSafeEqual } from "node:crypto";
import { exchangeAuthCode } from "@wms/api/quickbooks/client";
import { db, schema } from "@wms/db";
import { eq } from "drizzle-orm";

/**
 * Intuit redirects here after the admin approves the connection.
 * Query params: code, state, realmId.
 *
 * The state must match the nonce cookie written by /api/quickbooks/authorize
 * — a missing or mismatching state indicates CSRF or link tampering and
 * we reject with 400 before touching the database.
 */
export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.redirect(new URL("/sign-in", req.url));

  const code = req.nextUrl.searchParams.get("code");
  const realmId = req.nextUrl.searchParams.get("realmId");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !realmId || !state) {
    return NextResponse.json({ error: "missing code/realmId/state" }, { status: 400 });
  }

  const expected = req.cookies.get("qb_oauth_state")?.value;
  if (!expected || !constantTimeEqual(expected, state)) {
    return NextResponse.json({ error: "invalid oauth state" }, { status: 400 });
  }
  // State encodes orgId:nonce; verify the Clerk org matches what we started.
  const [stateOrgId] = state.split(":");
  if (stateOrgId !== orgId) {
    return NextResponse.json({ error: "oauth state org mismatch" }, { status: 400 });
  }

  // Intuit requires the redirect_uri on the token exchange to match the
  // one we sent on /authorize exactly. We stashed it in a cookie there.
  const redirectUri =
    req.cookies.get("qb_redirect_uri")?.value ??
    new URL("/api/quickbooks/callback", req.url).toString();

  const tokens = await exchangeAuthCode(code, redirectUri);

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

  const res = NextResponse.redirect(new URL("/settings/integrations?connected=quickbooks", req.url));
  res.cookies.set("qb_oauth_state", "", { path: "/", maxAge: 0 });
  res.cookies.set("qb_redirect_uri", "", { path: "/", maxAge: 0 });
  return res;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
