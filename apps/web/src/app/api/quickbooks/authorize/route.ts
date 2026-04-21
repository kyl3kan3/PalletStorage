import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { randomBytes } from "node:crypto";
import { buildAuthorizeUrl } from "@wms/api/quickbooks/client";

/**
 * GET /api/quickbooks/authorize — kicks off the QuickBooks OAuth dance.
 *
 * Derives the redirect_uri from the incoming request origin rather than
 * reading an env var, so whatever domain the user is on (production,
 * vercel preview, localhost) is automatically correct. The only thing
 * the operator needs to configure on the Intuit side is that one
 * URL in the Redirect URIs allowlist.
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

  const redirectUri = new URL("/api/quickbooks/callback", req.url).toString();

  const res = NextResponse.redirect(buildAuthorizeUrl(state, redirectUri));
  res.cookies.set("qb_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60, // 10 minutes — plenty for a consent roundtrip
  });
  // Stash the redirect_uri we used so the callback can replay it verbatim
  // to Intuit's token exchange (required: must match the authorize call).
  res.cookies.set("qb_redirect_uri", redirectUri, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
  return res;
}
