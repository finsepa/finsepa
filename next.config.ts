import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // The dev filesystem cache left SSR serving pre-edit modules (hydration mismatches until restart).
    turbopackFileSystemCacheForDev: false,
  },
  images: {
    // Next 16+ requires localPatterns when `src` includes a query (e.g. cache-bust
    // `/superinvestors/first-eagle.png?v=20260913`). Omit `search` so any query is allowed.
    localPatterns: [{ pathname: "/**" }],
  },
};

export default nextConfig;
