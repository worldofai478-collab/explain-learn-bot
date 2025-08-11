import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // ✅ This disables ESLint errors during build
  },
};

export default nextConfig;
