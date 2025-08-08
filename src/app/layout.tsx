import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/app/globals.css';
import Providers from '@/app/providers';
import { Toaster } from 'sonner';
import { ClientPolyfillManager } from '@/lib/polyfills/ClientPolyfillManager';
import { SupabaseProvider } from '@/contexts/SupabaseProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { AuthToastManager } from '@/components/auth/AuthErrorToast';
import { ColorSchemeScript } from '@mantine/core';

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

// ✅ 보안 강화된 RootLayout - getUser()로 안전한 인증 확인
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ✅ 서버에서 안전한 사용자 인증 확인 (JWT 토큰 실시간 검증)
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  // AuthProvider 호환성을 위해 완전한 Session 타입으로 변환
  const session = user && !error ? { 
    user, 
    access_token: '', // AuthProvider에서 실제로 사용하지 않음
    refresh_token: '',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer'
  } : null;
  return (
    <html lang="ko" suppressHydrationWarning={true}>
      <head>
        <ColorSchemeScript defaultColorScheme="auto" />
      </head>
      <body className={`${inter.className} min-h-screen antialiased`}>
        <ClientPolyfillManager enableServiceWorker={true} enablePWAComponents={true}>
          <Providers>
            <SupabaseProvider>
              {/* ✅ [핵심 수정] AuthProvider가 가장 바깥쪽을 감싸야 합니다. */}
              <AuthProvider initialSession={session}>
                {/* AppInitializer: 단순한 스플래시 화면 컴포넌트 (프로바이더 아님) */}
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