import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is fully client-rendered (all data fetching happens in the browser
  // against the Jorna backend), so it exports to static files that the same
  // Cloudflare Worker serving the marketing page hosts under /app.
  output: "export",
  basePath: "/app",
  images: { unoptimized: true },
  // Emit /app/plan/index.html etc. so Cloudflare serves clean URLs.
  trailingSlash: true,
};

export default nextConfig;
