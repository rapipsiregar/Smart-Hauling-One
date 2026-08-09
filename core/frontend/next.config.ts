import type { NextConfig } from "next";

// Where the FastAPI backend lives. Override with BACKEND_ORIGIN to point a dev
// server at a backend on another host or port; the default is the local one.
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone build lets the Docker image ship only the compiled server and
  // its pruned node_modules, instead of the full source tree.
  output: "standalone",
  // Move the dev tools indicator out of the bottom-left corner, where it
  // overlapped the sidebar's Online status / collapse controls.
  devIndicators: {
    position: "bottom-right",
  },
  // This app is the workspace root; pin it so Turbopack stops warning about
  // the parent-directory lockfile it would otherwise infer.
  turbopack: {
    root: process.cwd(),
  },
  // Allow local requests from loopback address in development
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_ORIGIN}/api/:path*`,
      },
      {
        source: "/media/:path*",
        destination: `${BACKEND_ORIGIN}/media/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "8000",
        pathname: "/media/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/media/**",
      },
    ],
  },
};

export default nextConfig;
