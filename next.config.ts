import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: { root: process.cwd() },
  output: process.env.NEXT_STANDALONE === '1' ? 'standalone' : undefined,
  serverExternalPackages: ['playwright', 'playwright-core'],
};
export default nextConfig;
