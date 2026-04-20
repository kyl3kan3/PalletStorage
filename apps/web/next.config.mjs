/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@wms/api", "@wms/core", "@wms/db"],
  // Emit a minimal self-contained server under .next/standalone so the
  // Docker runtime stage can COPY it without the full node_modules tree.
  output: "standalone",
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
