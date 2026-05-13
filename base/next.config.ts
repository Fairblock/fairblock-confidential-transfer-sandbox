import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@fairblock/stabletrust"],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      url: false,
      "@farcaster/mini-app-solana": false,
    };
    config.resolve.alias = {
      ...config.resolve.alias,
      "@farcaster/mini-app-solana": false,
    };
    return config;
  },
};

export default nextConfig;
