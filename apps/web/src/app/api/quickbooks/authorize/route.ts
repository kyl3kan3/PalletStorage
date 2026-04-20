import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { randomBytes } from "node:crypto";
import { buildAuthorizeUrl } from "@wms/api/quickbooks/client";

/**
 * GET /api/quickbooks/authorize — kicks off the QuickBooks OAuth dance.
 *
 * Sets a short-lived httpOnly cookie with a random nonce used as the
 * OAuth `state` parameter. The callback route validates the nonce
 * against the cookie; this closes a CSRF hole where an attacker could
 * trick an admin into linking an arbitrary QuickBooks company to their
 * org by luring them to a pre-built consent URL.
 */
export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.redirect(new URL("/sign-in", req.url));

  // 16 random bytes → 32 hex chars; ample entropy for a CSRF nonce.
  const nonce = randomBytes(16).toString("hex");
  const state = `${orgId}:${nonce}`;

  const res = NextResponse.redirect(buildAuthorizeUrl(state));
  res.cookies.set("qb_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60, // 10 minutes — plenty for a consent roundtrip
  });
  return res;
}
