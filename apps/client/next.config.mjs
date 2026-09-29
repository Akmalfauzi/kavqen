/** @type {import('next').NextConfig} */
export default function nextConfig(phase) {
  return {
    reactStrictMode: true,
    // Dev and production builds must not overwrite each other's webpack chunks.
    distDir: phase === 'phase-development-server' ? '.next' : '.next-build',
    async rewrites() {
      return [{ source: '/gateway/:path*', destination: `${process.env.GATEWAY_INTERNAL_URL || 'http://127.0.0.1:3003'}/:path*` }];
    },
  };
}
