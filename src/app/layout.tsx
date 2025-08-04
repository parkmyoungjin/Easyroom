import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/app/globals.css';
import Providers from '@/app/providers';
import { Toaster } from 'sonner';
import { ClientPolyfillManager } from '@/lib/polyfills/ClientPolyfillManager';
import { SupabaseProvider } from '@/contexts/SupabaseProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { AuthToastManager } from '@/components/auth/AuthErrorToast';
import AuthGatekeeper from '@/components/layout/AuthGatekeeper';
// ✅ [1단계] 서버용 클라이언트와 타입을 import
import { createClient } from '@/lib/supabase/server';
import { UserProfile } from '@/types/auth';
import { ProfileRpcResult, convertRpcResultToUserProfile } from '@/lib/auth/profile-utils';

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

// ✅ [2단계] RootLayout을 async 함수로 변경
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ✅ [3단계] 서버에서 초기 데이터를 가져온다
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  let initialProfile: UserProfile | null = null;
  
  if (session) {
    try {
      const { data: profileData, error } = await supabase.rpc('get_or_create_user_profile').single();
      
      if (profileData && !error) {
        // 공통 변환 유틸리티 함수를 사용하여 일관된 데이터 변환
        initialProfile = convertRpcResultToUserProfile(profileData as ProfileRpcResult);
        console.log('[RootLayout] Server: Initial profile loaded for user:', session.user.email);
      } else {
        console.error('[RootLayout] Server: Failed to load profile:', error);
      }
    } catch (error) {
      console.error('[RootLayout] Server: Exception during profile fetch:', error);
    }
  } else {
    console.log('[RootLayout] Server: No session found');
  }
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background antialiased`}>
        <ClientPolyfillManager enableServiceWorker={true} enablePWAComponents={true}>
          {/* ✅ Operation: Structural Integrity - 영구적 생명주기 보장 */}
          {/* 1계층: 영구 공급 계층 - 앱이 종료될 때까지 절대 사라지지 않는다 */}
          <Providers>
            <SupabaseProvider>
              {/* ✅ [4. 최종 단계] 가져온 초기 데이터를 AuthProvider에 props로 주입 */}
              <AuthProvider initialSession={session} initialProfile={initialProfile}>
                {/* 2계층: 상태 소비 및 분기 계층 - 인증 상태에 따른 UI 분기만 담당 */}
                <AuthGatekeeper>
                  {children}
                </AuthGatekeeper>
                <AuthToastManager />
                <Toaster />
              </AuthProvider>
            </SupabaseProvider>
          </Providers>
        </ClientPolyfillManager>
      </body>
    </html>
  );
}