import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Force recharts to resolve to CommonJS version (main) instead of ES modules (module)
    // This prevents module resolution errors in production builds
    config.resolve.alias = {
      ...config.resolve.alias,
    };

    // Modify how webpack resolves package.json fields
    // Prioritize 'main' over 'module' for recharts to use stable CommonJS build
    config.resolve.mainFields = isServer
      ? ['main', 'module', 'browser']
      : ['browser', 'main', 'module'];

    return config;
  },
};

export default nextConfig;
