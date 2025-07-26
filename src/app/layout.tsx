import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from './providers';
import { Toaster } from '@/components/ui/toaster';
import { ClientPolyfillManager } from '@/lib/polyfills/ClientPolyfillManager';
import MagicLinkHandler from '@/components/auth/MagicLinkHandler';
import { AuthProvider } from '@/contexts/AuthContext'; // ✅ 새로 만든 Provider 임포트

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'arial'],
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: '회의실 예약 시스템',
  description: '간편한 회의실 예약 시스템',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
      { url: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
      { url: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '회의실 예약',
  },
  applicationName: '회의실 예약 시스템',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background antialiased`}>
        <ClientPolyfillManager enableServiceWorker={true} enablePWAComponents={true}>
          {/* ✅ AuthProvider를 Providers 안쪽, 혹은 가장 바깥쪽에 배치합니다. */}
          {/*    Toaster나 다른 UI Provider보다 안쪽에 있는 것이 안전할 수 있습니다. */}
          <Providers>
            <AuthProvider> 
              {children}
              <Toaster />
            </AuthProvider>
          </Providers>
        </ClientPolyfillManager>
      </body>
    </html>
  );
}