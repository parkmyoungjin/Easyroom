// FILE: src/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => request.cookies.get(name)?.value,
        set: (name, value, options) => {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove: (name, options) => {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // 사용자 세션 정보 가져오기
  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // 경로 정의 (AuthGatekeeper에서 이전)
  const publicRoutes = ['/welcome', '/login', '/signup', '/reservations/status'];
  const authRoutes = ['/welcome', '/login', '/signup'];
  const kioskRoutes = ['/kiosk'];

  console.log(`[Middleware] Processing: ${pathname}, User: ${user ? 'authenticated' : 'unauthenticated'}`);

  // 1. 키오스크 경로 - 항상 허용
  if (kioskRoutes.some(route => pathname.startsWith(route))) {
    console.log(`[Middleware] Kiosk route allowed: ${pathname}`);
    return response;
  }

  // 2. 관리자 경로 보호 로직 (일단 주석 처리 - 안전한 구현을 위해)
  /*
  if (pathname.startsWith('/admin')) {
    if (!user) {
      console.log(`[Middleware] Admin route - redirecting unauthenticated user to /welcome`);
      return NextResponse.redirect(new URL('/welcome', request.url));
    }
    
    // TODO: 사용자 프로필에서 역할 확인 (Phase 3에서 JWT claims로 최적화 예정)
    const { data: profile } = await supabase
      .rpc('get_or_create_user_profile')
      .single();
    
    if (!profile || profile.role !== 'admin') {
      console.log(`[Middleware] Admin route - non-admin user redirected to /dashboard`);
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }
  */

  // 3. 인증이 필요한 경로 보호 로직
  const protectedPaths = ['/dashboard', '/reservations', '/profile'];
  if (protectedPaths.some(path => pathname.startsWith(path))) {
    if (!user) {
      console.log(`[Middleware] Protected route - redirecting unauthenticated user to /welcome`);
      return NextResponse.redirect(new URL('/welcome', request.url));
    }
  }

  // 4. 비로그인 사용자의 일반 보호된 페이지 접근 차단
  if (!user) {
    const isPublicRoute = publicRoutes.includes(pathname);
    if (!isPublicRoute && pathname !== '/') {
      console.log(`[Middleware] Non-public route - redirecting unauthenticated user to /welcome`);
      return NextResponse.redirect(new URL('/welcome', request.url));
    }
  }

  // 5. 로그인 사용자의 인증 페이지 접근 시 리다이렉트
  if (user) {
    if (pathname === '/' || authRoutes.includes(pathname)) {
      console.log(`[Middleware] Auth route - redirecting authenticated user to /dashboard`);
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // 6. 모든 규칙에 해당하지 않으면 요청 그대로 진행
  console.log(`[Middleware] Request allowed: ${pathname}`);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};