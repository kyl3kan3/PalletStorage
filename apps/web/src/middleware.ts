import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublic = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/trpc/(.*)",
  "/api/webhooks/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Root "/" now lives at /floor. Redirect at the edge so the legacy
  // (dashboard) layout never gets a chance to render its Shell — the
  // page-level redirect() still streams the (dashboard) layout to the
  // client before Next.js sees the redirect signal, which momentarily
  // showed two sidebars side-by-side.
  if (req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/floor", req.url));
  }
  if (!isPublic(req)) await auth.protect();
});

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js|jpg|png|svg|woff2?)).*)", "/(api|trpc)(.*)"],
};
