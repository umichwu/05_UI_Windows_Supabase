import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Only optimize specific packages, not recharts
    // By providing an explicit list, Next.js won't auto-optimize all packages
    optimizePackageImports: [
      '@radix-ui/react-avatar',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slot',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      'lucide-react',
    ],
  },

  webpack: (config) => {
    // Force recharts to resolve to CommonJS version
    config.resolve.alias = {
      ...config.resolve.alias,
      'recharts': 'recharts/lib/index.js',
    };

    return config;
  },
};

export default nextConfig;
