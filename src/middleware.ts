// FILE: src/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// CORS를 위한 허용 출처 목록
const allowedOrigins = [
  'https://easy-room-git-optimization-01-de-cce2b8-parkmyoungjins-projects.vercel.app', // 현재 프리뷰 도메인
  'https://easyroom-app.vercel.app', // 프로덕션 도메인
  'http://localhost:3000', // 로컬 개발 환경
  'https://vercel.live' // Vercel Live 협업 도구
];

export async function middleware(request: NextRequest) {
  // [핵심 수정] CORS 사전 요청(Preflight) 처리
  const origin = request.headers.get('origin');

  if (request.method === 'OPTIONS') {
    // 허용된 출처인지 확인
    if (origin && allowedOrigins.includes(origin)) {
      return new NextResponse(null, {
        status: 204, // No Content
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400', // 24시간
        },
      });
    }

    // 허용되지 않은 출처는 거부
    return new NextResponse('CORS preflight request failed', { status: 403 });
  }

  // [기존] GET 요청이 아닌 경우 통과 (OPTIONS는 위에서 처리했으므로 이제 안전)
  if (request.method !== 'GET') {
    return NextResponse.next();
  }

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

  // 2. 관리자 경로 보호 로직
  if (pathname.startsWith('/admin')) {
    if (!user) {
      console.log(`[Middleware] Admin route - redirecting unauthenticated user to /welcome`);
      return NextResponse.redirect(new URL('/welcome', request.url));
    }

    // 사용자 프로필에서 역할 확인 (Phase 3에서 JWT claims로 최적화 예정)
    try {
      const { data: profiles } = await supabase.rpc('get_or_create_user_profile');
      const profile = profiles?.[0];

      if (!profile || (profile as any).role !== 'admin') {
        console.log(`[Middleware] Admin route - non-admin user redirected to /dashboard`);
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    } catch (error) {
      console.error(`[Middleware] Error checking admin role:`, error);
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

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
    // 루트 경로(/)도 비로그인 사용자는 welcome으로 리다이렉트
    if (!isPublicRoute) {
      console.log(`[Middleware] Non-public route (${pathname}) - redirecting unauthenticated user to /welcome`);
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
  /**
   * 미들웨어 실행에서 제외할 경로 목록:
   * - api/: API 라우트
   * - _next/static: Next.js 정적 파일
   * - _next/image: Next.js 이미지 최적화 파일
   * - assets/: public/assets 폴더의 모든 리소스
   * - sw.js: 서비스 워커 파일 (명시적 제외)
   * - 모든 아이콘/이미지 파일 확장자 (명시적 제외)
   * 
   * 아키텍처 원칙: "사용자의 '의도'가 담긴 요청은 미들웨어가 검사하고, 
   *                시스템의 '기능'을 위한 요청은 미들웨어가 통과시킨다."
   */
  matcher: ['/((?!api|_next/static|_next/image|assets|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|ico)$).*)']
};