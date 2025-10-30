import './globals.css';
import { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { LayoutWrapper } from '@/components/layout-wrapper';

export const metadata = {
  title: 'Taste.fun',
  description: 'Discover, fund, and validate collective needs',
  manifest: '/manifest.json',
  themeColor: '#121212',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Taste.fun',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="theme-color" content="#121212" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <Providers>
          <LayoutWrapper>{children}</LayoutWrapper>
        </Providers>
      </body>
    </html>
  );
}
