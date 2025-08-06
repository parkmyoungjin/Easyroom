import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/app/globals.css';
import Providers from '@/app/providers';
import { Toaster } from 'sonner';
import { ClientPolyfillManager } from '@/lib/polyfills/ClientPolyfillManager';
import { SupabaseProvider } from '@/contexts/SupabaseProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { AuthToastManager } from '@/components/auth/AuthErrorToast';

import { GlobalNotification } from '@/components/layout/GlobalNotification';
import AuthGatekeeper from '@/components/layout/AuthGatekeeper';
import { UpdateNotification } from '@/components/pwa/UpdateNotification';
import { AppInitializer } from '@/components/layout/AppInitializer';
// ✅ [1단계] 서버용 클라이언트와 타입을 import
import { createClient } from '@/lib/supabase/server';


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

// ✅ 단순화된 RootLayout - 오직 세션만 가져온다
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ✅ 서버에서는 오직 세션 정보만 가져온다
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background antialiased`}>
        <ClientPolyfillManager enableServiceWorker={true} enablePWAComponents={true}>
          <Providers>
            <SupabaseProvider>
              {/* ✅ [핵심 수정] AuthProvider가 가장 바깥쪽을 감싸야 합니다. */}
              <AuthProvider initialSession={session}>
                {/* AppInitializer와 AuthGatekeeper는 AuthProvider의 자식입니다. */}
                <AppInitializer>
                  <AuthGatekeeper>
                    {children}
                  </AuthGatekeeper>
                </AppInitializer>
                <AuthToastManager />
                <UpdateNotification />
                <GlobalNotification />
              </AuthProvider>
              <Toaster />
            </SupabaseProvider>
          </Providers>
        </ClientPolyfillManager>
      </body>
    </html>
  );
}