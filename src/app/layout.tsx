import type { Metadata, Viewport } from 'next';
import { AppProvider } from '@/components/app-provider';
import { AuthProvider } from '@/components/auth-provider';
import { I18nProvider } from '@/components/i18n-provider';
import { Shell } from '@/components/shell';
import { BirthdayGreeting } from '@/components/birthday-greeting';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'AmbatuApp', template: '%s · AmbatuApp' },
  description:
    'Your little corner of internet chaos. Meet the Ambaverse and get bussing!',
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
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('ambatuapp-theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch(e){}})()` }} />
        <meta
          name="6a97888e-site-verification"
          content="aad370aac4185df449de5028f75c18fd"
        />
      </head>
      <body>
        <I18nProvider>
          <AuthProvider>
            <AppProvider>
              <Shell>{children}</Shell>
              <BirthdayGreeting />
            </AppProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
