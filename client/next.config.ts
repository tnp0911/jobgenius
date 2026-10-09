import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow phone testing over LAN (e.g. http://192.168.x.x:3000)
  allowedDevOrigins: ["192.168.0.79"],
  output: 'standalone',
};

export default nextConfig;
