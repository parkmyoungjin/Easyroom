## [정보 제공] Easyroom 프로젝트 인증 아키텍처 코드

### 1. 프로젝트 의존성 (Dependencies)

**파일명: `package.json`**
- `@supabase/auth-helpers-nextjs` 및 기타 관련 라이브러리 버전을 확인합니다.

```json
{
  "dependencies": {
    "@supabase/auth-helpers-nextjs": "^0.10.0",
    "@supabase/ssr": "^0.6.1",
    "@supabase/supabase-js": "^2.50.5",
    "@tanstack/react-query": "^5",
    "next": "^15.3.5",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-hook-form": "^7.60.0",
    "zod": "^3.25.74",
    "date-fns": "^4.1.0",
    "date-fns-tz": "^3.2.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5",
    "supabase": "^2.33.9"
  }
}
```

### 2. 환경 변수 (Environment Variables)

**파일명: `.env.local`**
- Supabase 클라이언트 설정에 필요한 공개 키 정보를 확인합니다.
- **⚠️ 중요: `SUPABASE_SERVICE_ROLE_KEY`와 같은 비밀 키는 절대 포함하지 말고, `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_ANON_KEY`만 포함시켜 주십시오.**

```env
# .env.local 파일 내용
NEXT_PUBLIC_SUPABASE_URL=https://odxuafzdkvcioevqezkl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9keHVhZnpka3ZjaW9ldnFlemtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3MzE3OTIsImV4cCI6MjA2OTMwNzc5Mn0.u-D3w7xc0NwJTltmIQkkQVd-qzclseT21VXPamNJD_A

# Environment
NODE_ENV=development

# NextAuth.js
NEXTAUTH_SECRET=vzYpWIWfgeD+C1X+HCydszSCYV1RbYe9KBUZcTJkwpk=

# Auto-generated deployment info
NEXT_PUBLIC_APP_VERSION=0.1.0-20250803.1108-81cfa657
NEXT_PUBLIC_BUILD_ID=81cfa6573a674f585123e62f5528aa34861b8b60
BUILD_TIME=2025-08-03T02:08:26.599Z
```

### 3. 핵심 인프라 (Core Infrastructure)

**파일명: `src/middleware.ts`**
- 모든 요청에 대한 세션 관리 및 라우트 보호 로직을 검토합니다.

```typescript
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

  // Server startup validation
  const serverCheck = await canServeRequest(pathname, {
    caller: `middleware_${pathname}`,
    strictMode: process.env.NODE_ENV === 'production',
  });

  if (!serverCheck.canServe) {
    return new NextResponse(/*...*/);
  }

  // Magic link redirect handling
  const magicLinkRedirect = handleMagicLinkRedirect(request);
  if (magicLinkRedirect) {
    return magicLinkRedirect;
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // ✅ [핵심 수정 1] 응답 객체를 먼저 생성
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // ✅ [핵심 수정 2] createMiddlewareClient 사용
  const supabase = createMiddlewareClient({ req: request, res: response });

  // Enhanced session handling with comprehensive error handling
  let session: Session | null = null;
  let user: User | null = null;
  let sessionError: string | null = null;
  let cookieParsingError: string | null = null;

  try {
    // Session retrieval with enhanced error handling
    const sessionResult = await supabase.auth.getSession();
    
    if (sessionResult.error) {
      const categorizedError = categorizeAuthError(sessionResult.error);
      sessionError = categorizedError.message;
      
      // Check for cookie parsing errors
      if (sessionResult.error.message?.includes('parse') || 
          sessionResult.error.message?.includes('JSON') ||
          sessionResult.error.message?.includes('SyntaxError')) {
        cookieParsingError = sessionResult.error.message;
        console.error('[Middleware] Cookie parsing error detected:', {
          error: sessionResult.error.message,
          pathname,
          errorType: 'cookie_parsing_failure',
          severity: 'high'
        });
      }
    } else {
      session = sessionResult.data.session;
      user = session?.user || null;
    }
    
    // If no session, attempt refresh
    if (!session || !user) {
      try {
        const refreshResult = await supabase.auth.refreshSession();
        
        if (refreshResult.error) {
          const categorizedError = categorizeAuthError(refreshResult.error);
          sessionError = categorizedError.message;
        } else if (refreshResult.data.session) {
          session = refreshResult.data.session;
          user = session.user;
        }
      } catch (refreshError: unknown) {
        const categorizedError = categorizeAuthError(refreshError);
        sessionError = categorizedError.message;
      }
    }
  } catch (error: unknown) {
    const categorizedError = categorizeAuthError(error);
    sessionError = categorizedError.message;
    session = null;
    user = null;
  }

  // Get user role
  let userRole: UserRole | undefined;
  if (user) {
    try {
      const { data: userInfo, error } = await supabase.rpc('get_current_user_info');
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

  // Handle cookie parsing errors by redirecting to login
  if (cookieParsingError && !user) {
    console.warn('[Middleware] Cookie parsing error detected, redirecting to login:', {
      pathname,
      cookieParsingError,
      errorType: 'cookie_parsing_redirect',
      action: 'redirect_to_login'
    });

    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  const accessResult = checkRouteAccess(pathname, authContext);
  
  // Access control with enhanced error context
  if (!accessResult.allowed && accessResult.redirectTo) {
    securityMonitor.recordEvent({
      type: 'suspicious_access',
      severity: cookieParsingError ? 'high' : 'medium',
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
        cookieParsingError: cookieParsingError || null
      }
    });

    const redirectUrl = new URL(accessResult.redirectTo, request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // ✅ [핵심 수정 4] 갱신된 쿠키가 담긴 response 객체를 반환
  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|icons/|manifest.json|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

**파일명: `src/lib/supabase/server.ts`**
- 서버 컴포넌트, 서버 액션, 라우트 핸들러에서 사용될 Supabase 클라이언트 생성 로직을 검토합니다.

```typescript
// src/lib/supabase/server.ts (최종 권장 코드)

import "server-only";

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from 'react';
import { Database } from "@/types/database";
import type { SupabaseClient } from '@supabase/supabase-js';

export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * 서버 컴포넌트용 Supabase 클라이언트를 생성합니다. (최신 권장 방식 적용)
 * React의 `cache`를 사용하여 동일 요청 내에서 클라이언트 재사용을 최적화합니다.
 * @supabase/auth-helpers-nextjs가 쿠키 처리를 자동으로 관리합니다.
 */
export const createClient = cache(() => {
  // `cookies()`를 직접 호출하는 대신, `cookies()`를 반환하는 콜백 함수를 전달한다.
  // 이렇게 하면 auth-helpers가 Next.js의 렌더링 생명주기에 맞춰 최적화된 시점에 쿠키를 읽어온다.
  return createServerComponentClient<Database>({
    cookies: () => cookies(),
  });
});

/**
 * Supabase admin 클라이언트를 생성합니다. (service_role 사용)
 * RLS를 우회하므로, 보안이 확보된 서버 환경에서만 사용해야 합니다.
 */
export const createAdminClient = () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin client');
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};
```

**파일명: `src/lib/supabase/client.ts`**
- 클라이언트 컴포넌트에서 사용될 Supabase 클라이언트 생성 로직을 검토합니다.

```typescript
/**
 * @deprecated This file is deprecated and should not be used directly.
 * 
 * IMPORTANT: Do not import createClient from this file!
 * 
 * Instead, use the centralized SupabaseProvider:
 * 
 * ```typescript
 * import { useSupabaseClient } from '@/contexts/SupabaseProvider';
 * 
 * export function MyComponent() {
 *   const supabase = useSupabaseClient();
 *   
 *   if (!supabase) {
 *     return <div>Loading...</div>;
 *   }
 *   
 *   // Use supabase client here
 * }
 * ```
 * 
 * This ensures:
 * - Single shared client instance across the app
 * - Consistent authentication state management
 * - Proper session synchronization between tabs
 * - Automatic token refresh handling
 */

import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from "@/types/database";
import type { SupabaseClient } from '@supabase/supabase-js';

export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * @deprecated Use useSupabaseClient() hook from SupabaseProvider instead
 */
export function createClient(): TypedSupabaseClient {
  console.warn(
    '⚠️  DEPRECATED: Direct usage of createClient() is deprecated.\n' +
    'Use useSupabaseClient() from @/contexts/SupabaseProvider instead.\n' +
    'This ensures consistent authentication state across your app.'
  );
  
  return createPagesBrowserClient<Database>() as TypedSupabaseClient;
}
```

### 4. 상태 관리 및 공급자 (State Management & Providers)

**파일명: `src/contexts/SupabaseProvider.tsx`**
- Supabase 클라이언트 관리를 위한 Provider

```tsx
'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

interface SupabaseContextType {
  /** Supabase client created with auth-helpers createPagesBrowserClient */
  client: SupabaseClient<Database> | null;
  /** Indicates if the client is ready for use */
  isReady: boolean;
  /** Any initialization error that occurred */
  error: Error | null;
}

interface SupabaseProviderProps {
  children: ReactNode;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export function SupabaseProvider({ children }: SupabaseProviderProps) {
  const [client, setClient] = useState<SupabaseClient<Database> | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize client on mount using auth-helpers standard pattern
  useEffect(() => {
    let isMounted = true;

    const initializeClient = () => {
      try {
        console.log('[SupabaseProvider] Starting client initialization');
        
        // Use auth-helpers standard client creation
        const supabaseClient = createPagesBrowserClient<Database>();
        
        if (!isMounted) {
          console.warn('[SupabaseProvider] Component unmounted during initialization');
          return;
        }

        setClient(supabaseClient);
        setIsReady(true);
        setError(null);
        
        console.log('[SupabaseProvider] Client initialized successfully');
        
      } catch (err) {
        if (!isMounted) {
          return;
        }
        
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Supabase client';
        const clientError = new Error(errorMessage);
        
        setError(clientError);
        setIsReady(false);
        
        console.error('[SupabaseProvider] Client initialization failed:', err);
      }
    };

    initializeClient();

    return () => {
      isMounted = false;
    };
  }, []);

  const contextValue = useMemo(() => ({
    client,
    isReady,
    error
  }), [client, isReady, error?.message]);

  return (
    <SupabaseContext.Provider value={contextValue}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase(): SupabaseContextType {
  const context = useContext(SupabaseContext);
  
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  
  return context;
}

/**
 * Hook that returns the Supabase client
 * SSR-safe version that returns null during server-side rendering
 */
export function useSupabaseClient(): SupabaseClient<Database> | null {
  // SSR safety check
  if (typeof window === 'undefined') {
    return null;
  }
  
  const { client, isReady, error } = useSupabase();
  
  if (error) {
    console.warn('[useSupabaseClient] Client error:', error.message);
    return null;
  }
  
  if (!isReady || !client) {
    return null;
  }
  
  return client;
}
```

**파일명: `src/contexts/AuthContext.tsx`**
- 새로운 인증 방식과 통합된 AuthProvider가 '단일 진실 공급원' 및 '공급자 책임 원칙'을 잘 준수하는지 검토합니다.

```tsx
// src/contexts/AuthContext.tsx
// 작전명: 원자적 프로필 관리 (Operation: Atomic Profile Management)
// 
// 핵심 아키텍처:
// 1. 단일 관문 (Single Gate): 모든 인증 상태 변경은 onAuthStateChange 리스너를 통해서만 처리
// 2. 원자적 프로필 생성: get_or_create_user_profile RPC 함수를 통한 트랜잭션 기반 프로필 관리
// 3. 방어적 렌더링: 모든 데이터 접근에 안전한 패턴 적용으로 렌더링 오류 방지

'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { SupabaseClient, User, Session } from '@supabase/supabase-js';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
import { UserProfile } from '@/types/auth';
import { ProfileRpcResult, convertRpcResultToUserProfile } from '@/lib/auth/profile-utils';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextType {
  /** Current authenticated user from Supabase Auth */
  user: User | null;
  /** User profile data from database */
  userProfile: UserProfile | null;
  /** Current authentication status */
  authStatus: AuthStatus;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
  children: React.ReactNode;
  initialSession?: Session | null;
  initialProfile?: UserProfile | null;
}

/**
 * 사용자 프로필을 원자적으로 조회하거나 생성합니다.
 * 모든 복잡성은 데이터베이스의 'get_or_create_user_profile' RPC 함수에 위임됩니다.
 */
async function getOrCreateProfile(supabase: SupabaseClient): Promise<UserProfile> {
  const { data, error } = await supabase.rpc('get_or_create_user_profile').single();
  const typedData = data as ProfileRpcResult | null;

  if (error) {
    console.error("CRITICAL: get_or_create_user_profile RPC failed.", error);
    throw error;
  }

  if (!typedData) {
    throw new Error("CRITICAL: get_or_create_user_profile RPC returned no data despite success status.");
  }

  return convertRpcResultToUserProfile(typedData);
}

export const AuthProvider = ({ 
  children, 
  initialSession = null, 
  initialProfile = null 
}: AuthProviderProps) => {
  const supabase = useSupabaseClient();
  
  // ✅ [핵심 수정] useState의 초기값을 서버에서 받은 props로 설정
  const [user, setUser] = useState<User | null>(initialSession?.user ?? null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(initialProfile ?? null);
  
  // ✅ [핵심 수정] authStatus의 초기값도 props에 따라 결정
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() => {
    if (initialSession && initialProfile) {
      console.log('[AuthProvider] Initialized with server data: authenticated');
      return 'authenticated';
    }
    console.log('[AuthProvider] No initial data: loading');
    return 'loading';
  });

  // 실행 잠금(Execution Lock)
  const isProcessing = useRef(false);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;
    console.log('[AuthProvider] Lifecycle: useEffect mounted. Subscribing. isMounted=true');

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) {
        console.log(`[AuthProvider] Handler Entry: Unmounted. Ignoring event '${event}'.`);
        return;
      }

      if (isProcessing.current) {
        console.log(`[AuthProvider] Lock Engaged: Ignoring concurrent event '${event}'.`);
        return;
      }

      isProcessing.current = true;
      console.log(`[AuthProvider] Lock Engaged for event '${event}'.`);

      try {
        if (session?.user) {
          const profile = await getOrCreateProfile(supabase);

          if (!isMounted) {
            console.log(`[AuthProvider] Post-Await Check: Unmounted during profile fetch for '${event}'. Halting state update.`);
            return;
          }

          setUser(session.user);
          setUserProfile(profile);
          setAuthStatus('authenticated');
          console.log(`[AuthProvider] Processed '${event}': State set to 'authenticated'.`);
        } else {
          if (!isMounted) {
            console.log(`[AuthProvider] Post-Await Check: Unmounted during logout for '${event}'. Halting state update.`);
            return;
          }

          setUser(null);
          setUserProfile(null);
          setAuthStatus('unauthenticated');
          console.log(`[AuthProvider] Processed '${event}': State set to 'unauthenticated'.`);
        }
      } catch (error) {
        console.error(`[AuthProvider] Exception caught during event '${event}'. Transitioning to unauthenticated.`, error);
        if (isMounted) {
          setUser(null);
          setUserProfile(null);
          setAuthStatus('unauthenticated');
        }
      } finally {
        isProcessing.current = false;
        console.log(`[AuthProvider] Lock Released for event '${event}'.`);
      }
    });

    return () => {
      console.log('[AuthProvider] Lifecycle: useEffect unmounted. Unsubscribing. Setting isMounted=false');
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const value = { user, userProfile, authStatus };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useAuthContext = useAuth;
```

### 5. 인증 로직 (Authentication Logic)

**파일명: `src/lib/supabase/actions.ts`**
- 로그인, 회원가입, 로그아웃 등 서버 액션의 구현 방식을 검토합니다.

```typescript
import "server-only";

import { 
  createRouteHandlerClient, 
  createServerActionClient 
} from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { Database } from "@/types/database";
import type { SupabaseClient } from '@supabase/supabase-js';

export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Create Supabase client for API route handlers
 */
export function createRouteClient(): TypedSupabaseClient {
  return createRouteHandlerClient<Database>({ cookies }) as TypedSupabaseClient;
}

/**
 * Create Supabase client for server actions
 */
export async function createActionClient(): Promise<TypedSupabaseClient> {
  return createServerActionClient<Database>({ cookies }) as TypedSupabaseClient;
}

/**
 * Create Supabase admin client for privileged API operations
 * 
 * @security_warnings
 * ⚠️ CRITICAL SECURITY CONSIDERATIONS:
 * - This client bypasses ALL Row Level Security (RLS) policies
 * - Can read, write, and delete ANY data in the database
 * - Should only be used in trusted server-side contexts
 * - Always validate user permissions before admin operations
 * - Log all admin operations for security auditing
 */
export function createAdminRouteClient(context?: { endpoint?: string; userId?: string }): TypedSupabaseClient {
  const { createClient } = require("@supabase/supabase-js");
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin client');
  }

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
  
  return client as TypedSupabaseClient;
}
```

**파일명: `src/app/login/page.tsx`**
- 사용자로부터 입력을 받아 서버 액션을 호출하는 UI 컴포넌트의 구현을 검토합니다.

```tsx
// src/app/login/page.tsx
'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useAuthContext } from '@/contexts/AuthContext';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MailCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSupabase } from '@/contexts/SupabaseProvider';

const LoadingSpinner = ({ message = "인증 상태 확인 중..." }: { message?: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      <p className="mt-2 text-gray-600">{message}</p>
    </div>
  </div>
);

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authStatus, userProfile } = useAuth();
  
  const fromSignup = searchParams.get('from') === 'signup';
  const signupEmail = searchParams.get('email');

  useEffect(() => {
    // 인증 완료시 즉시 리다이렉트
    if (authStatus === 'authenticated' && userProfile) {
      console.log('[LoginPage] Authentication detected, redirecting to main page');
      router.replace('/');
    }
  }, [authStatus, userProfile, router]);

  // 로딩 중이거나 이미 로그인된 상태면 스피너를 보여줍니다.
  if (authStatus === 'loading') {
    return <LoadingSpinner message="로그인 상태 확인 중..." />;
  }
  
  if (authStatus === 'authenticated' && userProfile) {
    return <LoadingSpinner message="메인 페이지로 이동 중..." />;
  }
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      {/* 회원가입 직후에만 보이는 환영 메시지 - OTP 전환 안내 */}
      {fromSignup && (
        <div className="w-full max-w-md mb-6">
          <Alert variant="default" className="border-green-500 bg-green-50 dark:bg-green-900/20">
            <MailCheck className="h-5 w-5 text-green-600" />
            <AlertTitle className="font-bold text-green-700">회원가입 완료!</AlertTitle>
            <AlertDescription className="text-green-600">
              {signupEmail ? (
                <>
                  <strong>{signupEmail}</strong>로 회원가입이 완료되었습니다.<br />
                  이제 OTP 코드로 로그인할 수 있습니다. 아래에서 이메일을 입력하고 OTP 코드를 받아보세요.
                </>
              ) : (
                '가입이 완료되었습니다. 이제 OTP 코드로 로그인할 수 있습니다.'
              )}
            </AlertDescription>
          </Alert>
        </div>
      )}
      
      <LoginForm initialEmail={signupEmail || undefined} />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <LoginContent />
    </Suspense>
  );
}
```

### 6. 보호된 페이지 예시 (Protected Page Example)

**파일명: `src/app/dashboard/page.tsx`**
- 서버 컴포넌트에서 세션 정보를 읽고, 인증되지 않은 사용자를 리다이렉트하는 로직을 검토합니다.

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import ReservationDashboard from '@/features/reservation/components/ReservationDashboard';
import MobileHeader from '@/components/ui/mobile-header';
import AuthPrompt from '@/components/ui/auth-prompt';
import { EnhancedLoadingState } from '@/components/ui/enhanced-loading-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { userProfile, loading } = useAuth();

  const navigateToLogin = () => {
    router.push('/login');
  };

  const navigateToSignup = () => {
    router.push('/signup');
  };

  const handleGoBack = () => {
    router.push('/');
  };

  // 로딩 중인 경우
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <EnhancedLoadingState
          isLoading={true}
          title="대시보드 로딩 중"
          description="사용자 정보와 대시보드 데이터를 불러오고 있습니다..."
          showNetworkStatus={true}
          className="w-full max-w-md"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader title="예약 대시보드" onBack={handleGoBack} />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Authentication prompt for non-authenticated users */}
        {!userProfile && (
          <AuthPrompt
            title="더 자세한 정보를 확인하세요"
            description="로그인하시면 개인화된 대시보드, 내 예약 정보, 상세 통계 등을 확인할 수 있습니다."
            onLogin={navigateToLogin}
            onSignup={navigateToSignup}
            className="mb-6"
          />
        )}

        {/* Header section */}
        <div className="mb-4">
          {userProfile ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900">
                안녕하세요, {userProfile?.name || '사용자'}님!
              </h1>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900">
                예약 대시보드
              </h1>
              <p className="text-gray-600">실시간 회의실 예약 현황을 확인하세요.</p>
            </>
          )}
        </div>

        {/* Dashboard component - available for both authenticated and non-authenticated users */}
        <ReservationDashboard readOnly={!userProfile} />

        {/* Information section for non-authenticated users */}
        {!userProfile && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                대시보드 기능 안내
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">현재 이용 가능</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 실시간 회의실 사용 현황</li>
                    <li>• 오늘의 전체 예약 일정</li>
                    <li>• 회의실 이용률 확인</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">로그인 후 추가 기능</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 개인화된 대시보드</li>
                    <li>• 내 예약 상세 정보</li>
                    <li>• 예약 통계 및 분석</li>
                    <li>• 빠른 예약 기능</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
```