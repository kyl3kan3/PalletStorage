/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@wms/api", "@wms/core", "@wms/db"],
  // Emit a minimal self-contained server under .next/standalone so the
  // Docker runtime stage can COPY it without the full node_modules tree.
  output: "standalone",
  // Moved out of `experimental` in Next 15.5+.
  typedRoutes: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

// Clerk hosts auth flows, JS, and images on a handful of *.clerk.* domains;
// allow them explicitly. We still ship CSP in Report-Only first so Clerk
// updates that introduce new sources surface as console reports rather than
// breaking sign-in. Switch the header name to "Content-Security-Policy"
// once one full deploy cycle has been clean.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  // Next.js dev needs 'unsafe-eval'; styled-jsx + Clerk widgets need 'unsafe-inline'.
  // Tighten with nonces in a follow-up once the CSP is enforced.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://*.clerk.com",
  "img-src 'self' data: blob: https://img.clerk.com https://*.clerk.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://api.openai.com https://api.intuit.com https://sandbox.api.intuit.com",
  "worker-src 'self' blob:",
  "frame-src 'self' https://*.clerk.com https://challenges.cloudflare.com",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "Content-Security-Policy-Report-Only", value: csp },
];

export default nextConfig;
