import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Konva / R3F roots log a dev-only "unmount during render" warning under StrictMode double-mounting.
  reactStrictMode: false,
  // hides the round "N" Next.js developer badge in `npm run dev`
  devIndicators: false,
  // konva's optional node entry pulls in `canvas`; the browser build never needs it.
  webpack: (config) => {
    config.externals = [...(config.externals || []), { canvas: "canvas" }];
    return config;
  },
  turbopack: {
    resolveAlias: { canvas: { browser: "./src/lib/empty-module.ts" } },
  },
};

export default nextConfig;
