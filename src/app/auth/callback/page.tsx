'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

// 즉시 실행되는 디버깅 로그
console.log('🔥 [AuthCallback] Page module loaded!');
console.log('🔥 [AuthCallback] Current URL:', typeof window !== 'undefined' ? window.location.href : 'SSR');

export default function AuthCallbackPage() {
  console.log('🔥 [AuthCallback] Component rendering...');
  const router = useRouter();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('인증을 처리하는 중입니다...');

  useEffect(() => {
    const handleAuthCallback = async () => {
      console.log('[AuthCallback] 🚀 Starting authentication callback processing...');

      try {
        // Add timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          console.error('[AuthCallback] ⏰ Timeout reached, forcing error state');
          setStatus('error');
          setMessage('인증 처리 시간이 초과되었습니다.');
        }, 10000); // 10 second timeout

        // Check for URL hash tokens (Magic Link)
        const hash = window.location.hash;
        const searchParams = new URLSearchParams(window.location.search);

        console.log('[AuthCallback] 📍 Current URL:', window.location.href);
        console.log('[AuthCallback] 🔗 URL hash:', hash);
        console.log('[AuthCallback] 🔍 Search params:', searchParams.toString());

        // Handle Magic Link tokens in hash
        if (hash.includes('access_token') && hash.includes('type=magiclink')) {
          console.log('[AuthCallback] 🎯 Processing Magic Link tokens from hash...');

          const hashParams = new URLSearchParams(hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          const type = hashParams.get('type');

          console.log('[AuthCallback] 🔑 Parsed tokens:', {
            accessToken: accessToken ? accessToken.substring(0, 20) + '...' : null,
            refreshToken: refreshToken ? 'present' : 'null',
            type
          });

          if (accessToken && type === 'magiclink') {
            console.log('[AuthCallback] 📦 Importing Supabase client...');
            const { createClient } = await import('@/lib/supabase/client');
            const supabase = await createClient();

            console.log('[AuthCallback] 🔐 Setting session with Magic Link tokens...');
            setMessage('Magic Link 토큰으로 세션을 설정하는 중...');

            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || ''
            });

            console.log('[AuthCallback] 📊 Session result:', { data: !!data, error });

            if (!error && data.session) {
              console.log('[AuthCallback] ✅ Magic Link session set successfully');
              console.log('[AuthCallback] 👤 User:', data.session.user?.id);

              clearTimeout(timeoutId);
              setStatus('success');
              setMessage('Magic Link 인증이 완료되었습니다.');

              // Clear hash and redirect to verified page
              window.history.replaceState(null, '', '/auth/callback');

              setTimeout(() => {
                console.log('[AuthCallback] 🚀 Redirecting to verified page...');
                router.push('/auth/callback/verified');
              }, 1500);
              return;
            } else {
              console.error('[AuthCallback] ❌ Magic Link session error:', error);
              clearTimeout(timeoutId);
              throw error || new Error('Session creation failed');
            }
          } else {
            console.error('[AuthCallback] ❌ Invalid Magic Link tokens');
            clearTimeout(timeoutId);
            throw new Error('유효하지 않은 Magic Link 토큰입니다.');
          }
        }

        // Handle OAuth code flow (signup, password login)
        const code = searchParams.get('code');
        if (code) {
          console.log('[AuthCallback] 🔐 Processing OAuth code...');

          const { createClient } = await import('@/lib/supabase/client');
          const supabase = await createClient();

          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (!error) {
            console.log('[AuthCallback] ✅ OAuth session set successfully');
            clearTimeout(timeoutId);
            setStatus('success');
            setMessage('인증이 완료되었습니다.');

            setTimeout(() => {
              router.push('/auth/callback/verified');
            }, 1500);
            return;
          } else {
            console.error('[AuthCallback] ❌ OAuth session error:', error);
            clearTimeout(timeoutId);
            throw error;
          }
        }

        // No valid authentication parameters
        console.error('[AuthCallback] ❌ No valid authentication parameters found');
        console.log('[AuthCallback] 📋 Available params:', {
          hasHash: !!hash,
          hasAccessToken: hash.includes('access_token'),
          hasType: hash.includes('type='),
          hasCode: !!searchParams.get('code')
        });

        clearTimeout(timeoutId);
        throw new Error('유효한 인증 정보를 찾을 수 없습니다.');

      } catch (error) {
        console.error('[AuthCallback] 💥 Authentication callback error:', error);
        setStatus('error');
        setMessage(`인증 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);

        // Redirect to error page after delay
        setTimeout(() => {
          console.log('[AuthCallback] 🔄 Redirecting to error page...');
          const errorUrl = new URL('/auth/auth-error', window.location.origin);
          errorUrl.searchParams.set('message', '인증 중 오류가 발생했습니다.');
          window.location.href = errorUrl.toString();
        }, 3000);
      }
    };

    // Add small delay to ensure DOM is ready
    const timer = setTimeout(handleAuthCallback, 100);
    return () => clearTimeout(timer);
  }, [router]);

  console.log('🔥 [AuthCallback] Rendering with status:', status, 'message:', message);

  return (
    <>
      {/* 캐시 방지 메타 태그 */}
      <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
      <meta httpEquiv="Pragma" content="no-cache" />
      <meta httpEquiv="Expires" content="0" />

      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            {status === 'processing' && (
              <>
                <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin" />
                <CardTitle className="mt-4 text-2xl font-bold tracking-tight">
                  인증 처리 중
                </CardTitle>
              </>
            )}
            {status === 'success' && (
              <>
                <div className="mx-auto h-12 w-12 text-green-500 flex items-center justify-center">
                  ✓
                </div>
                <CardTitle className="mt-4 text-2xl font-bold tracking-tight text-green-600">
                  인증 성공
                </CardTitle>
              </>
            )}
            {status === 'error' && (
              <>
                <div className="mx-auto h-12 w-12 text-red-500 flex items-center justify-center">
                  ✗
                </div>
                <CardTitle className="mt-4 text-2xl font-bold tracking-tight text-red-600">
                  인증 실패
                </CardTitle>
              </>
            )}
            <CardDescription className="mt-2">
              {message}
              <br />
              <small style={{ color: '#666', fontSize: '12px' }}>
                Debug: {new Date().toISOString()}
              </small>
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </>
  );
}