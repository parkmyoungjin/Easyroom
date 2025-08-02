// src/app/auth/callback/route.ts
// 목적: Magic Link 인증을 위한 단순한 리다이렉트 페이지 (Migration compatibility)

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { 
  isMagicLinkCallback, 
  generateOTPRedirectUrl,
  extractMagicLinkParams 
} from '@/lib/auth/migration-compatibility';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const currentUrl = request.url;

  console.log('[Auth Callback] Processing Magic Link callback:', { hasCode: !!code });

  // Check if this is a magic link callback that should be redirected to OTP flow
  if (isMagicLinkCallback(currentUrl)) {
    const params = extractMagicLinkParams(currentUrl);
    
    // If there's an error in the magic link, redirect to login with error
    if (params.error) {
      console.log('[Auth Callback] Magic link error detected, redirecting to OTP login:', params.error);
      const redirectUrl = generateOTPRedirectUrl(request.nextUrl.origin, currentUrl);
      return NextResponse.redirect(redirectUrl, 302);
    }
    
    // For successful magic links, continue with existing flow but add migration context
    console.log('[Auth Callback] Processing magic link with migration context');
  }

  // Magic Link 인증을 위한 클라이언트 사이드 처리 페이지
  const authCallbackHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>인증 처리 중...</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
        <style>
          body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container {
            background: white;
            border-radius: 12px;
            padding: 32px;
            text-align: center;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            max-width: 320px;
            width: 90%;
          }
          .loading {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 16px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          h1 { 
            margin: 0 0 8px; 
            color: #1f2937; 
            font-size: 20px; 
          }
          p { 
            margin: 0; 
            color: #6b7280; 
            font-size: 14px; 
          }
          .success { display: none; }
          .error { display: none; color: #ef4444; }
        </style>
      </head>
      <body>
        <div class="container">
          <div id="loading-state">
            <div class="loading"></div>
            <h1>인증 처리 중...</h1>
            <p>잠시만 기다려주세요</p>
          </div>
          
          <div id="success-state" class="success">
            <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
            <h1>인증이 완료되었습니다</h1>
            <p>앱으로 돌아가세요</p>
          </div>
          
          <div id="error-state" class="error">
            <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
            <h1>인증에 실패했습니다</h1>
            <p>다시 시도해주세요</p>
          </div>
        </div>

        <script>
          console.log('[Auth Callback] Initializing Magic Link authentication');
          
          // Check for migration redirect first
          function checkMigrationRedirect() {
            const currentUrl = window.location.href;
            const pathname = window.location.pathname;
            
            // Only handle auth callback URLs
            if (pathname !== '/auth/callback') {
              return false;
            }
            
            // Check if this is a magic link callback that should be redirected
            const urlObj = new URL(currentUrl);
            const hashParams = new URLSearchParams(urlObj.hash.substring(1));
            const queryParams = urlObj.searchParams;
            
            const hasCode = queryParams.has('code');
            const hasAccessToken = hashParams.has('access_token') || queryParams.has('access_token');
            const hasRefreshToken = hashParams.has('refresh_token') || queryParams.has('refresh_token');
            const hasTokenType = hashParams.has('token_type') || queryParams.has('token_type');
            const hasError = hashParams.has('error') || queryParams.has('error');
            
            const isMagicLink = hasCode || (hasAccessToken && (hasRefreshToken || hasTokenType)) || hasError;
            
            if (isMagicLink) {
              console.log('[Auth Callback] Magic link detected, checking for migration redirect');
              
              // For error cases, redirect to OTP login with error context
              if (hasError) {
                const error = hashParams.get('error') || queryParams.get('error');
                console.log('[Auth Callback] Magic link error detected, redirecting to OTP login:', error);
                
                const loginUrl = new URL('/login', window.location.origin);
                loginUrl.searchParams.set('migration', 'magic-link');
                loginUrl.searchParams.set('message', 'auth-method-changed');
                if (error) {
                  loginUrl.searchParams.set('error', error);
                }
                
                window.location.href = loginUrl.toString();
                return true;
              }
              
              // For successful magic links, continue with existing flow but add migration context
              console.log('[Auth Callback] Processing magic link with migration context');
              return false; // Continue with normal processing
            }
            
            return false;
          }
          
          // Check for migration redirect before initializing Supabase
          if (checkMigrationRedirect()) {
            return; // Redirect initiated, stop processing
          }
          
          // Supabase 클라이언트 초기화
          const supabase = window.supabase.createClient(
            '${process.env.NEXT_PUBLIC_SUPABASE_URL}',
            '${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}'
          );

          let retryCount = 0;
          const maxRetries = 10; // 최대 10회 재시도 (10초)

          async function handleAuthCallback() {
            try {
              console.log('[Auth Callback] Processing authentication...');
              console.log('[Auth Callback] Current URL:', window.location.href);
              
              // URL에서 파라미터 확인
              const hashParams = new URLSearchParams(window.location.hash.substring(1));
              const queryParams = new URLSearchParams(window.location.search);
              
              // Magic Link code 확인 (가장 중요!)
              const code = queryParams.get('code');
              
              // 직접 토큰 확인 (OAuth 플로우용)
              const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
              const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
              
              console.log('[Auth Callback] Auth params:', { 
                hasCode: !!code,
                hasAccessToken: !!accessToken, 
                hasRefreshToken: !!refreshToken 
              });
              
              // 1. Magic Link code가 있으면 세션으로 교환
              if (code) {
                console.log('[Auth Callback] Exchanging Magic Link code for session...');
                
                const { data, error } = await supabase.auth.exchangeCodeForSession(code);
                
                if (error) {
                  console.error('[Auth Callback] Error exchanging code:', error);
                  showError();
                  return;
                }
                
                if (data.session) {
                  console.log('[Auth Callback] Magic Link session created successfully');
                  
                  // Enhanced: Check for session synchronization parameter
                  const syncParam = queryParams.get('sync');
                  if (syncParam === 'true') {
                    console.log('[Auth Callback] Session synchronization requested, triggering enhanced session management');
                    // The AuthContext will handle session synchronization automatically
                    // through the enhanced onAuthStateChange handler
                  }
                  
                  showSuccess();
                  
                  // Enhanced: PWA 환경을 위해 localStorage에도 저장 with sync flag
                  const sessionData = {
                    ...data.session,
                    _syncRequested: syncParam === 'true',
                    _callbackTimestamp: Date.now()
                  };
                  localStorage.setItem('supabase-auth-token', JSON.stringify(sessionData));
                  
                  // 2초 후 자동으로 창 닫기 또는 리다이렉트
                  setTimeout(() => {
                    if (window.opener) {
                      window.close();
                    } else {
                      window.location.href = '/';
                    }
                  }, 2000);
                  return;
                }
              }
              
              // 2. 직접 토큰이 URL에 있으면 세션 설정 (OAuth 플로우)
              if (accessToken && refreshToken) {
                console.log('[Auth Callback] Setting session with URL tokens...');
                
                const { data, error } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken
                });
                
                if (error) {
                  console.error('[Auth Callback] Error setting session:', error);
                  showError();
                  return;
                }
                
                if (data.session) {
                  console.log('[Auth Callback] OAuth session set successfully');
                  
                  // Enhanced: Check for session synchronization parameter
                  const syncParam = queryParams.get('sync');
                  if (syncParam === 'true') {
                    console.log('[Auth Callback] Session synchronization requested for OAuth flow');
                  }
                  
                  showSuccess();
                  
                  // Enhanced: PWA 환경을 위해 localStorage에도 저장 with sync flag
                  const sessionData = {
                    ...data.session,
                    _syncRequested: syncParam === 'true',
                    _callbackTimestamp: Date.now()
                  };
                  localStorage.setItem('supabase-auth-token', JSON.stringify(sessionData));
                  
                  // 2초 후 자동으로 창 닫기 또는 리다이렉트
                  setTimeout(() => {
                    if (window.opener) {
                      window.close();
                    } else {
                      window.location.href = '/';
                    }
                  }, 2000);
                  return;
                }
              }
              
              // 토큰이 URL에 없으면 기존 세션 확인
              const { data, error } = await supabase.auth.getSession();
              
              if (error) {
                console.error('[Auth Callback] Auth error:', error);
                showError();
                return;
              }

              if (data.session) {
                console.log('[Auth Callback] Found existing session');
                
                // Enhanced: Check for session synchronization parameter
                const syncParam = queryParams.get('sync');
                if (syncParam === 'true') {
                  console.log('[Auth Callback] Session synchronization requested for existing session');
                }
                
                showSuccess();
                
                // Enhanced: PWA 환경을 위해 localStorage에도 저장 with sync flag
                const sessionData = {
                  ...data.session,
                  _syncRequested: syncParam === 'true',
                  _callbackTimestamp: Date.now()
                };
                localStorage.setItem('supabase-auth-token', JSON.stringify(sessionData));
                
                // 2초 후 자동으로 창 닫기 또는 리다이렉트
                setTimeout(() => {
                  if (window.opener) {
                    window.close();
                  } else {
                    window.location.href = '/';
                  }
                }, 2000);
              } else {
                retryCount++;
                if (retryCount < maxRetries) {
                  console.log(\`[Auth Callback] No session found, retrying... (\${retryCount}/\${maxRetries})\`);
                  setTimeout(handleAuthCallback, 1000);
                } else {
                  console.error('[Auth Callback] Max retries reached, showing error');
                  showError();
                }
              }
            } catch (error) {
              console.error('[Auth Callback] Unexpected error:', error);
              showError();
            }
          }

          function showSuccess() {
            document.getElementById('loading-state').style.display = 'none';
            document.getElementById('success-state').style.display = 'block';
          }

          function showError() {
            document.getElementById('loading-state').style.display = 'none';
            document.getElementById('error-state').style.display = 'block';
          }

          // 페이지 로드 시 인증 처리 시작
          window.addEventListener('load', handleAuthCallback);
        </script>
      </body>
    </html>
  `;
  
  return new NextResponse(authCallbackHtml, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}