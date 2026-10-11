import type { NextConfig } from 'next';
const characterApi = process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '');
const proxyCharacterContributions =
  process.env.NODE_ENV === 'development' &&
  process.env.NATIVE_BUILD !== '1' &&
  Boolean(characterApi);
const config: NextConfig = {
  ...(process.env.NATIVE_BUILD === '1' ? { output: 'export' as const } : {}),
  trailingSlash: true,
  images: { unoptimized: true },
  devIndicators: false,
  ...(proxyCharacterContributions
    ? {
        async rewrites() {
          return [{
            source: '/api/public/contributions/characters/:path*',
            destination: `${characterApi}/contributions/characters/:path*`,
          }];
        },
      }
    : {}),
};
export default config;
