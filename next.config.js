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
  serverExternalPackages: ["playwright"],
};
module.exports = nextConfig;
