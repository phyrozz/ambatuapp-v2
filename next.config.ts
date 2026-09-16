import type { NextConfig } from 'next';
const config: NextConfig = {
  trailingSlash: true,
  images: { unoptimized: true },
  devIndicators: false,
};
export default config;
