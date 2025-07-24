import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { checkRouteAccess } from '@/lib/routes/matcher'
import { AuthContext, UserRole } from '@/types/routes'
// ✅ getPublicEnvVar 대신 getPublicEnvVarSecure를 import 합니다.
import { getPublicEnvVarSecure } from '@/lib/security/secure-environment-access' 
import { securityMonitor } from '@/lib/monitoring/security-monitor'
import { canServeRequest } from '@/lib/startup/server-startup-validator'

export async function middleware(request: NextRequest) {
  const { pathname } = new URL(request.url);

  const serverCheck = await canServeRequest(pathname, {
    caller: `middleware_${pathname}`,
    strictMode: process.env.NODE_ENV === 'production'
  });

  if (!serverCheck.canServe) {
    return new NextResponse(
      JSON.stringify({
        error: 'Service Temporarily Unavailable',
        message: serverCheck.reason || 'Server environment validation failed',
        code: 'ENV_VALIDATION_FAILED'
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60'
        }
      }
    );
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  // ✅ getPublicEnvVar를 getPublicEnvVarSecure로 변경하고 3개의 인자를 전달합니다.
  const supabaseUrl = await getPublicEnvVarSecure('NEXT_PUBLIC_SUPABASE_URL', 'middleware', pathname);
  const supabaseAnonKey = await getPublicEnvVarSecure('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'middleware', pathname);

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userRole: UserRole | undefined;
  if (user?.user_metadata?.role) {
    userRole = user.user_metadata.role === 'admin' ? 'admin' : 'user';
  }

  const authContext: AuthContext = {
    isAuthenticated: !!user,
    userRole,
    userId: user?.id,
  };

  const accessResult = checkRouteAccess(pathname, authContext);

  if (!accessResult.allowed && accessResult.redirectTo) {
    securityMonitor.recordEvent({
      type: 'suspicious_access',
      severity: 'medium',
      userId: user?.id,
      endpoint: pathname,
      userAgent: request.headers.get('user-agent') || 'unknown',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      details: {
        attemptedPath: pathname,
        redirectTo: accessResult.redirectTo,
        userRole: userRole || 'none',
        isAuthenticated: !!user
      }
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
      metadata: {
        userRole: userRole || 'user',
        accessGranted: true
      }
    });
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|icons/|manifest.json|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}