import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Serve the cinematic static landing page at the root URL.
      { source: "/", destination: "/landing.html" },
    ];
  },
};

export default nextConfig;
