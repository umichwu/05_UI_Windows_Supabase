import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile recharts for compatibility
  transpilePackages: ['recharts'],
};

export default nextConfig;
