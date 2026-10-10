import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next writes agent instruction files at the repo root unless this is off.
  // The public repository carries no Markdown but its README.
  agentRules: false,
  images: { unoptimized: true },
  // A second build (local end-to-end tests against a devnet) can live next to the main one.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The gas page became the relayer page when relaying went live.
  async redirects() {
    return [{ source: "/docs/gas", destination: "/docs/relayer", permanent: true }];
  },
};

export default nextConfig;
