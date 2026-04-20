/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@wms/api", "@wms/core", "@wms/db"],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
