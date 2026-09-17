import type { Metadata, Viewport } from 'next';
import { AppProvider } from '@/components/app-provider';
import { I18nProvider } from '@/components/i18n-provider';
import { Shell } from '@/components/shell';
import './globals.css';
const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
export const metadata: Metadata = {
  title: { default: 'AmbatuApp — A little chaos. A lot of fun.', template: '%s · AmbatuApp' },
  description:
    'Your little corner of internet chaos. Play the classics, find your favorite sounds, and meet the Ambaverse.',
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f8f7f2',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {adsenseClient && (
          <script
            id="google-adsense-script"
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body>
        <I18nProvider>
          <AppProvider>
            <Shell>{children}</Shell>
          </AppProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
