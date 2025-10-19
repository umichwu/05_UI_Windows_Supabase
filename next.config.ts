import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['recharts'],
  experimental: {
    // Disable barrel optimization to prevent module resolution errors
    optimizePackageImports: ['lucide-react'],
  },
  webpack: (config) => {
    // Force recharts to use the CommonJS build instead of ES modules
    config.resolve.alias = {
      ...config.resolve.alias,
      'recharts': 'recharts/lib/index.js',
    };
    return config;
  },
};

export default nextConfig;
