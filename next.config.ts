import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force Next.js to transpile recharts to resolve module path issues
  transpilePackages: ['recharts'],

  experimental: {
    // Completely disable package import optimization
    optimizePackageImports: [],
  },

  webpack: (config, { isServer }) => {
    // Force recharts to use CommonJS build instead of broken ES6 build
    config.resolve.alias = {
      ...config.resolve.alias,
      'recharts': require.resolve('recharts/lib/index.js'),
    };

    // Prioritize 'main' field over 'module' field in package.json
    // This ensures CommonJS is used instead of ES6
    config.resolve.mainFields = isServer
      ? ['main', 'module']
      : ['main', 'module'];

    return config;
  },
};

export default nextConfig;
