import type { NextConfig } from 'next';
const config: NextConfig = {
  ...(process.env.NATIVE_BUILD === '1' ? { output: 'export' as const } : {}),
  trailingSlash: true,
  images: { unoptimized: true },
  devIndicators: false,
};
export default config;
