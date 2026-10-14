import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(process.cwd(), "..") },
  outputFileTracingRoot: path.resolve(process.cwd(), ".."),
  output: "standalone",
  /* config options here */

  reactStrictMode: false,
  skipTrailingSlashRedirect: true,
  async redirects() {
    return [{ source: "/", destination: "/app/", permanent: false }];
  },
  async rewrites() {
    return [{ source: "/app/:path*", destination: "/app/index.html" }];
  },
  async headers() {
    return [
      {
        source: "/app/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
      {
        source: "/app/index.html",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
      {
        source: "/app/_expo/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
