import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['recharts'],
  experimental: {
    optimizePackageImports: ['recharts'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'recharts': 'recharts/lib/index.js',
      };
    }
    return config;
  },
};

export default nextConfig;
