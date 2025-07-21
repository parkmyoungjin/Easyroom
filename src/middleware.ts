import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // API 경로는 건드리지 않음
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 사용자 세션 새로고침
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 현재 경로
  const currentPath = request.nextUrl.pathname;

  // 간단한 인증 체크만 수행
  // 로그인이 필요한 경로들
  const protectedPaths = ['/admin', '/reservations/new', '/reservations/my'];
  const isProtectedPath = protectedPaths.some(path => currentPath.startsWith(path));

  // 인증이 필요한 경로인데 로그인하지 않은 경우
  if (isProtectedPath && !user) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', currentPath);
    return NextResponse.redirect(redirectUrl);
  }

  // 이미 로그인한 사용자가 로그인/회원가입 페이지에 접근하는 경우
  if (user && isAuthPath(currentPath)) {
    const redirectUrl = new URL('/', request.url); // 메인 페이지로 리디렉션
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

/**
 * 인증 관련 페이지인지 확인
 */
function isAuthPath(path: string): boolean {
  const authPaths = ['/login', '/signup'];
  // /auth/callback은 예외 처리 (인증 완료 후 UI 표시를 위해)
  if (path.startsWith('/auth/callback')) {
    return false;
  }
  return authPaths.some(authPath => path.startsWith(authPath));
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
