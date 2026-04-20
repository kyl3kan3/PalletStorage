/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@wms/api", "@wms/core", "@wms/db"],
  // Emit a minimal self-contained server under .next/standalone so the
  // Docker runtime stage can COPY it without the full node_modules tree.
  output: "standalone",
  // Moved out of `experimental` in Next 15.5+.
  typedRoutes: true,
};

export default nextConfig;
