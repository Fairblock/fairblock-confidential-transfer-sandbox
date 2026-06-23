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
    // Suppress the "Critical dependency: expression in require()" warning
    // from ox/tempo used by viem's tempo chain definitions (unused by this app).
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /ox\/_esm\/tempo/ },
    ];

    return config;
  },
};

export default nextConfig;
