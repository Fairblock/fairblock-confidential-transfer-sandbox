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
    return config;
  },
};

export default nextConfig;
