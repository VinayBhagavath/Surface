/** @type {import('next').NextConfig} */
const nextConfig = {
  // Genomics connectors run inside Inngest steps (Node runtime), not the edge.
  reactStrictMode: true,
};

module.exports = nextConfig;
