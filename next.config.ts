import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Imported template HTML can be large; keep the server body limit realistic and
  // use direct/chunked storage uploads for actual project files.
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
