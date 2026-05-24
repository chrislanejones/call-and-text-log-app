/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // 10MB max for typical image attachments in API responses
    largePageDataBytes: 128 * 1000,
  },
};

export default nextConfig;
