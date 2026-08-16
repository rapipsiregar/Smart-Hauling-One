import type { NextConfig } from "next";

// The local FastAPI on this same device. In production both run on the Jetson,
// so this defaults to localhost; in dev compose it points at the edge backend
// container.
const EDGE_BACKEND = process.env.EDGE_BACKEND_ORIGIN || "http://127.0.0.1:8100";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Next bakes rewrites into routes-manifest.json at BUILD time, so the origin
  // above is fixed once built -- setting the env var before `next start` does
  // nothing. On a real Jetson that is fine: one device, one backend, always
  // localhost. It only bites when several gates share this checkout on one
  // machine for a demo, where a single .next would silently point every gate's
  // UI at whichever backend was built last. Giving each its own output keeps
  // them apart.
  distDir: process.env.EDGE_NEXT_DIST || ".next",
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${EDGE_BACKEND}/api/:path*` }];
  },
};

export default nextConfig;
