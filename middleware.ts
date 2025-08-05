// middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // 더 안정적인 세션 확인을 위해 getSession() 사용
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user || null;
  const { pathname } = request.nextUrl;

  console.log('[Middleware] Processing request:', { 
    pathname, 
    hasSession: !!session, 
    hasUser: !!user,
    userId: user?.id || 'none'
  });

  // ============================================================================
  // 작전명: 최전선 사수 - 철옹성 방어선 구축
  // ============================================================================

  // 🛡️ 최우선 방어선: 루트(/) 경로 완전 차단 및 강제 리디렉션
  if (pathname === '/') {
    console.log('[Middleware] FRONTLINE DEFENSE: Root path detected, initiating forced redirect');
    console.log('[Middleware] Session details:', {
      hasSession: !!session,
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email
    });
    
    // 세션 유무 확인
    if (session && user) {
      // 세션이 있으면 dashboard로 강제 리디렉션
      console.log('[Middleware] REDIRECT: Authenticated user -> /dashboard', {
        userId: user.id,
        email: user.email
      });
      return NextResponse.redirect(new URL('/dashboard', request.url), 307);
    } else {
      // 세션이 없으면 welcome으로 강제 리디렉션
      console.log('[Middleware] REDIRECT: Unauthenticated user -> /welcome');
      return NextResponse.redirect(new URL('/welcome', request.url), 307);
    }
  }

  // ============================================================================
  // 보조 방어선: 기타 경로 보호
  // ============================================================================

  // 보호된 경로 (인증 필요)
  const protectedRoutes = [
    '/dashboard',
    '/reservations/my', 
    '/reservations/new', 
    '/reservations/edit', 
    '/admin'
  ];

  // 인증 전용 경로 (로그인한 사용자는 접근 불가)
  const authOnlyRoutes = ['/login', '/signup'];

  // 보조 방어선 1: 비로그인 사용자가 보호된 경로 접근 시도
  if (!user && protectedRoutes.some(route => pathname.startsWith(route))) {
    console.log('[Middleware] SECONDARY DEFENSE: Unauthenticated user blocked from protected route:', pathname);
    return NextResponse.redirect(new URL('/welcome', request.url), 307);
  }

  // 보조 방어선 2: 로그인한 사용자가 인증 전용 경로 접근 시도
  if (user && authOnlyRoutes.some(route => pathname.startsWith(route))) {
    console.log('[Middleware] SECONDARY DEFENSE: Authenticated user blocked from auth-only route:', pathname);
    return NextResponse.redirect(new URL('/dashboard', request.url), 307);
  }

  console.log('[Middleware] Request allowed:', pathname);
  return response;
}

// ============================================================================
// 사격 통제: Middleware 실행 범위 설정
// ============================================================================
export const config = {
  matcher: [
    /*
     * 🎯 모든 페이지 요청을 포괄하는 패턴
     * - '/' 경로를 포함한 모든 경로에서 미들웨어 실행
     * - API, 정적 파일, 이미지 파일 등은 제외하여 성능 최적화
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}