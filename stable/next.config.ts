import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@fairblock/stabletrust"],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      url: false,
    };
    config.module.exprContextCritical = false;
    config.ignoreWarnings = [
      { module: /node_modules\/ox/ },
      { module: /node_modules\/viem/ },
    ];
    return config;
  },
};

export default nextConfig;
