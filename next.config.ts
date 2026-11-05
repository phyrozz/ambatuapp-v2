import type { NextConfig } from 'next';
const characterApi = process.env.NEXT_PUBLIC_CHARACTER_API_URL?.replace(/\/$/, '');
const proxyPublicWrites =
  process.env.NATIVE_BUILD !== '1' &&
  Boolean(characterApi);
const config: NextConfig = {
  ...(process.env.NATIVE_BUILD === '1' ? { output: 'export' as const } : {}),
  trailingSlash: true,
  images: { unoptimized: true },
  devIndicators: false,
  ...(proxyPublicWrites
    ? {
        async rewrites() {
          return [
            ...(process.env.NODE_ENV === 'development'
              ? [{
                  source: '/api/public/contributions/characters/:path*',
                  destination: `${characterApi}/contributions/characters/:path*`,
                }]
              : []),
            {
              source: '/api/public/videos/:id',
              destination: `${characterApi}/videos/:id`,
            },
          ];
        },
      }
    : {}),
};
export default config;
