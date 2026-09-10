const path = require("path");
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { hostname: "img.ricardostatic.ch" },
      { hostname: "**.tutti.ch" },
      { hostname: "**.cdn.tutti.ch" },
    ],
    unoptimized: false,
  },
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, ".."),
  experimental: {
    externalDir: true,
  },
  transpilePackages: ["ricardo-api"],
  env: {
    RITU_API_KEY: process.env.RITU_API_KEY || "dummy-key-123",
  },
};
module.exports = nextConfig;
