import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(process.cwd(), "..") },
  outputFileTracingRoot: path.resolve(process.cwd(), ".."),
  output: "standalone",
  /* config options here */

  reactStrictMode: false,
};

export default nextConfig;
