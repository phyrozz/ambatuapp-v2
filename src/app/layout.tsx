import type { Metadata, Viewport } from 'next';
import { I18nProvider } from '@/components/i18n-provider';
import { MaintenanceRedirect } from '@/components/maintenance-redirect';
import { MAINTENANCE_ALLOWED_PATH } from '@/lib/maintenance-mode';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'AmbatuApp', template: '%s · AmbatuApp' },
  description:
    'Your little corner of internet chaos. Meet the Ambaverse and get bussing!',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/app-icon.svg', apple: '/app-icon-180.png' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'AmbatuApp' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f8f7f2',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Temporary maintenance mode: remove this script and the MaintenanceRedirect wrapper to restore the site. */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){window.__ambatuMaintenance=true;if(!new RegExp(${JSON.stringify(MAINTENANCE_ALLOWED_PATH)}).test(location.pathname))location.replace('/maintenance/')})()` }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('ambatuapp-theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch(e){}})()` }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var pwa=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;var homeLink=new URLSearchParams(location.search).get('home')==='1';if(!window.__ambatuMaintenance&&pwa&&location.pathname==='/'&&!homeLink)location.replace('/scroll/')}catch(e){}})()` }} />
        <meta
          name="6a97888e-site-verification"
          content="aad370aac4185df449de5028f75c18fd"
        />
      </head>
      <body>
        <MaintenanceRedirect>
          <I18nProvider>
            {children}
          </I18nProvider>
        </MaintenanceRedirect>
      </body>
    </html>
  );
}
