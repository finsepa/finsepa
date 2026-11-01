import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // The dev filesystem cache left SSR serving pre-edit modules (hydration mismatches until restart).
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
