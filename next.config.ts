import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so a stray package-lock.json in a parent dir
  // can't make Turbopack misresolve the project root (see CLAUDE.md gotcha).
  turbopack: { root: __dirname },
};

export default nextConfig;
