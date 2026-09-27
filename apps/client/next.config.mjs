/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/gateway/:path*', destination: `${process.env.GATEWAY_INTERNAL_URL || 'http://127.0.0.1:3003'}/:path*` }];
  },
};

export default nextConfig;
