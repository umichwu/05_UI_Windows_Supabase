import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force Next.js to transpile recharts to resolve module path issues
  transpilePackages: ['recharts'],

  experimental: {
    // Empty array prevents automatic package import optimization
    // This avoids recharts path resolution errors
    optimizePackageImports: [],
  },
};

export default nextConfig;
