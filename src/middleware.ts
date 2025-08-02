// Enhanced middleware with proper types and error handling

import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse, type NextRequest } from 'next/server';
import type { Session, User } from '@supabase/supabase-js';
import { checkRouteAccess } from '@/lib/routes/matcher';
import { AuthContext, UserRole } from '@/types/routes';

import { securityMonitor } from '@/lib/monitoring/security-monitor';
import { canServeRequest } from '@/lib/startup/server-startup-validator';
import { handleMagicLinkRedirect } from '@/lib/auth/migration-compatibility';
import { categorizeAuthError } from '@/lib/auth/error-handler';

export async function middleware(request: NextRequest) {
  const { pathname } = new URL(request.url);

  // --- 기존 로직들은 모두 그대로 유지합니다 ---
  const serverCheck = await canServeRequest(pathname, {
    caller: `middleware_${pathname}`,
    strictMode: process.env.NODE_ENV === 'production',
  });

  if (!serverCheck.canServe) {
    return new NextResponse(/*...*/);
  }
  const magicLinkRedirect = handleMagicLinkRedirect(request);
  if (magicLinkRedirect) {
    return magicLinkRedirect;
  }
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // ✅ [핵심 수정 1] 응답 객체를 먼저 생성하는 것은 동일하게 유지합니다.
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // ✅ [핵심 수정 2] createServerClient 대신 createMiddlewareClient를 사용합니다.
  // 이 함수는 req, res 객체만으로 쿠키 관리를 완벽하게 처리합니다.
  const supabase = createMiddlewareClient({ req: request, res: response });

  // Enhanced session handling with comprehensive error handling and debugging
  let session: Session | null = null;
  let user: User | null = null;
  let sessionError: string | null = null;
  let cookieParsingError: string | null = null;
  
  // Cookie inspection for debugging (without exposing sensitive data)
  const inspectCookies = () => {
    const cookies = request.cookies.getAll();
    const authCookies = cookies.filter(cookie => 
      cookie.name.includes('supabase') || 
      cookie.name.includes('sb-') ||
      cookie.name.includes('auth')
    );
    
    return authCookies.map(cookie => ({
      name: cookie.name,
      hasValue: !!cookie.value,
      valueLength: cookie.value?.length || 0,
      startsWithValidChar: cookie.value ? /^[\{\[]/.test(cookie.value) : false,
      endsWithValidChar: cookie.value ? /[\}\]]$/.test(cookie.value) : false,
      looksLikeJson: cookie.value ? /^[\{\[].*[\}\]]$/.test(cookie.value) : false,
      containsQuotes: cookie.value ? cookie.value.includes('"') : false,
      firstChar: cookie.value ? cookie.value.charAt(0) : null,
      lastChar: cookie.value ? cookie.value.charAt(cookie.value.length - 1) : null
    }));
  };

  try {
    // Log initial cookie state for debugging
    const cookieInfo = inspectCookies();
    console.log('[Middleware] Cookie inspection:', {
      pathname,
      totalCookies: request.cookies.getAll().length,
      authCookies: cookieInfo.length,
      cookieDetails: cookieInfo
    });

    // First attempt: getSession() with enhanced error handling
    const sessionResult = await supabase.auth.getSession();
    
    if (sessionResult.error) {
      // Categorize session retrieval errors
      const categorizedError = categorizeAuthError(sessionResult.error);
      sessionError = categorizedError.message;
      
      // Check if this is a cookie parsing error
      if (sessionResult.error.message?.includes('parse') || 
          sessionResult.error.message?.includes('JSON') ||
          sessionResult.error.message?.includes('SyntaxError')) {
        cookieParsingError = sessionResult.error.message;
        console.error('[Middleware] Cookie parsing error detected:', {
          error: sessionResult.error.message,
          pathname,
          cookieInfo: cookieInfo,
          errorType: 'cookie_parsing_failure',
          severity: 'high'
        });
      } else {
        console.warn('[Middleware] Session retrieval error:', {
          error: categorizedError,
          pathname,
          errorType: 'session_retrieval_failure',
          severity: 'medium'
        });
      }
    } else {
      session = sessionResult.data.session;
      user = session?.user || null;
      
      if (session && user) {
        console.log('[Middleware] Session retrieved successfully:', {
          pathname,
          userId: user.id,
          hasValidSession: true,
          sessionExpiry: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null
        });
      }
    }
    
    // If no session or user, attempt refresh with enhanced error handling
    if (!session || !user) {
      console.log('[Middleware] No valid session found, attempting refresh...', {
        pathname,
        hadSession: !!session,
        hadUser: !!user,
        cookieParsingError: !!cookieParsingError
      });
      
      try {
        const refreshResult = await supabase.auth.refreshSession();
        
        if (refreshResult.error) {
          const categorizedError = categorizeAuthError(refreshResult.error);
          sessionError = categorizedError.message;
          
          // Check if refresh also failed due to cookie issues
          if (refreshResult.error.message?.includes('parse') || 
              refreshResult.error.message?.includes('JSON') ||
              refreshResult.error.message?.includes('SyntaxError')) {
            cookieParsingError = refreshResult.error.message;
            console.error('[Middleware] Cookie parsing error during refresh:', {
              error: refreshResult.error.message,
              pathname,
              cookieInfo: cookieInfo,
              errorType: 'refresh_cookie_parsing_failure',
              severity: 'high'
            });
          } else {
            console.warn('[Middleware] Session refresh failed:', {
              error: categorizedError,
              pathname,
              errorType: 'session_refresh_failure',
              severity: 'medium'
            });
          }
        } else if (refreshResult.data.session) {
          session = refreshResult.data.session;
          user = session.user;
          console.log('[Middleware] Session refreshed successfully:', {
            pathname,
            userId: user.id,
            refreshedSession: true
          });
        } else {
          console.log('[Middleware] No session available after refresh:', {
            pathname,
            noSessionAfterRefresh: true
          });
        }
      } catch (refreshError: unknown) {
        const categorizedError = categorizeAuthError(refreshError);
        sessionError = categorizedError.message;
        
        // Check if this is a cookie-related error during refresh
        const errorMessage = refreshError instanceof Error ? refreshError.message : String(refreshError);
        if (errorMessage?.includes('parse') || 
            errorMessage?.includes('JSON') ||
            errorMessage?.includes('SyntaxError')) {
          cookieParsingError = errorMessage;
          console.error('[Middleware] Cookie parsing exception during refresh:', {
            error: errorMessage,
            stack: refreshError instanceof Error ? refreshError.stack : undefined,
            pathname,
            cookieInfo: cookieInfo,
            errorType: 'refresh_cookie_parsing_exception',
            severity: 'critical'
          });
        } else {
          console.error('[Middleware] Session refresh exception:', {
            error: categorizedError,
            pathname,
            errorType: 'session_refresh_exception',
            severity: 'high'
          });
        }
      }
    }
  } catch (error: unknown) {
    const categorizedError = categorizeAuthError(error);
    sessionError = categorizedError.message;
    
    // Enhanced error categorization for cookie parsing issues
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage?.includes('parse') || 
        errorMessage?.includes('JSON') ||
        errorMessage?.includes('SyntaxError') ||
        errorMessage?.includes('Unexpected token')) {
      cookieParsingError = errorMessage;
      console.error('[Middleware] Critical cookie parsing exception:', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        pathname,
        cookieInfo: inspectCookies(),
        userAgent: request.headers.get('user-agent'),
        errorType: 'critical_cookie_parsing_exception',
        severity: 'critical',
        requiresAttention: true
      });
    } else {
      console.error('[Middleware] Session check exception:', {
        error: categorizedError,
        pathname,
        errorType: 'session_check_exception',
        severity: 'high'
      });
    }
    
    // Ensure clean state on any exception
    session = null;
    user = null;
  }

  // Log final authentication state with error context
  if (cookieParsingError) {
    console.warn('[Middleware] Authentication failed due to cookie parsing issues:', {
      pathname,
      cookieParsingError,
      sessionError,
      willRedirectToLogin: true,
      errorType: 'authentication_failure_cookie_parsing'
    });
  } else if (sessionError && !user) {
    console.warn('[Middleware] Authentication failed:', {
      pathname,
      sessionError,
      errorType: 'authentication_failure_general'
    });
  }

  // Enhanced authentication state logging with error context
  console.log('[Middleware] Auth check:', { 
    pathname, 
    hasUser: !!user, 
    userId: user?.id,
    userEmail: user?.email,
    hasSession: !!session,
    sessionExpiry: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    sessionError: sessionError || null,
    cookieParsingError: cookieParsingError || null,
    authenticationStatus: user ? 'authenticated' : 'unauthenticated',
    errorCategory: cookieParsingError ? 'cookie_parsing' : sessionError ? 'session_error' : 'none'
  });

  let userRole: UserRole | undefined;
  if (user) {
    try {
      // public.users 테이블에서 실제 사용자 role 가져오기 (이 부분은 그대로 동작합니다)
      const { data: userInfo, error } = await supabase.rpc('get_current_user_info');
      // ... (기존 역할 조회 로직)
      if (!error && userInfo && userInfo.length > 0) {
        userRole = userInfo[0].role === 'admin' ? 'admin' : 'user';
      } else {
        userRole = 'user';
      }
    } catch (error) {
      console.warn('[Middleware] Failed to get user role:', error);
      userRole = 'user';
    }
  }

  const authContext: AuthContext = {
    isAuthenticated: !!user,
    userRole,
    userId: user?.id,
  };

  // Handle cookie parsing errors gracefully by redirecting to login
  if (cookieParsingError && !user) {
    console.warn('[Middleware] Cookie parsing error detected, redirecting to login:', {
      pathname,
      cookieParsingError,
      errorType: 'cookie_parsing_redirect',
      action: 'redirect_to_login'
    });

    // Record the cookie parsing issue for monitoring
    securityMonitor.recordEvent({
      type: 'auth_failure',
      severity: 'high',
      userId: undefined,
      endpoint: pathname,
      userAgent: request.headers.get('user-agent') || 'unknown',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      details: {
        errorType: 'cookie_parsing_failure',
        errorMessage: cookieParsingError,
        attemptedPath: pathname,
        redirectTo: '/login',
        requiresAttention: true,
        suggestedAction: 'Clear corrupted cookies and regenerate session'
      }
    });

    // Redirect to login to allow AuthContext to regenerate proper cookies
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  const accessResult = checkRouteAccess(pathname, authContext);
  
  // ✅ [디버깅] /reservations/new 경로에 대한 상세 로깅
  if (pathname === '/reservations/new') {
    console.log('[Middleware] DEBUG - New reservation page access:', {
      isAuthenticated: !!user,
      userRole,
      userId: user?.id,
      sessionValid: !!session && session.expires_at && session.expires_at > Date.now() / 1000,
      accessResult: {
        allowed: accessResult.allowed,
        reason: accessResult.reason,
        redirectTo: accessResult.redirectTo
      }
    });
  }
  
  // Enhanced access control with cookie parsing error context
  if (!accessResult.allowed && accessResult.redirectTo) {
    // Record security event with enhanced error context
    securityMonitor.recordEvent({
      type: 'suspicious_access',
      severity: cookieParsingError ? 'high' : 'medium', // Higher severity for cookie issues
      userId: user?.id,
      endpoint: pathname,
      userAgent: request.headers.get('user-agent') || 'unknown',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      details: {
        attemptedPath: pathname,
        redirectTo: accessResult.redirectTo,
        userRole: userRole || 'none',
        isAuthenticated: !!user,
        accessDeniedReason: accessResult.reason,
        sessionError: sessionError || null,
        cookieParsingError: cookieParsingError || null,
        errorCategory: cookieParsingError ? 'cookie_parsing_failure' : sessionError ? 'session_error' : 'access_denied',
        requiresInvestigation: !!cookieParsingError
      }
    });

    // Log redirect with error context for debugging
    console.log('[Middleware] Redirecting due to access denial:', {
      pathname,
      redirectTo: accessResult.redirectTo,
      reason: accessResult.reason,
      cookieParsingError: !!cookieParsingError,
      sessionError: !!sessionError,
      userAuthenticated: !!user
    });

    const redirectUrl = new URL(accessResult.redirectTo, request.url);
    return NextResponse.redirect(redirectUrl);
  }

  if (authContext.isAuthenticated && (pathname.startsWith('/admin') || pathname.startsWith('/dashboard'))) {
    securityMonitor.recordEvent({
      type: 'authenticated_api_access',
      severity: 'low',
      userId: user?.id,
      endpoint: pathname,
      userAgent: request.headers.get('user-agent') || 'unknown',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      details: {
        accessPath: pathname,
        userRole: userRole || 'user',
        sessionValid: !!session,
        authenticationMethod: 'session_cookie',
        hadCookieIssues: !!cookieParsingError || !!sessionError
      }
    });
  }

  // ✅ [핵심 수정 4] 갱신된 쿠키가 담긴 response 객체를 반환합니다.
  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|icons/|manifest.json|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};