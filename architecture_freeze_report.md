# 아키텍처 동결 보고서: @supabase/ssr 전환 최종 검토

## 1. 프로젝트 구성 및 환경 (The Foundation)

### 1.1. 패키지 의존성

**파일 경로:** `package.json`  
**분석 목표:** `@supabase/auth-helpers-nextjs`, `@supabase/ssr`, `next` 등 핵심 라이브러리들의 정확한 버전을 파악한다.

**코드 전문:**
```json
{
  "name": "roombook",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "@supabase/auth-helpers-nextjs": "^0.10.0",
    "@supabase/ssr": "^0.6.1",
    "@supabase/supabase-js": "^2.50.5",
    "next": "^15.3.5",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    // ... 기타 의존성들
  }
}
```

**핵심 발견사항:**
- 현재 `@supabase/auth-helpers-nextjs` v0.10.0과 `@supabase/ssr` v0.6.1이 동시에 설치되어 있음
- Next.js 15.3.5, React 19.0.0 사용 중 (최신 버전)
- 전환 시 `@supabase/auth-helpers-nextjs` 제거 필요

### 1.2. 환경 변수

**파일 경로:** `.env.local`  
**분석 목표:** 공개(public) 환경 변수 구성을 확인한다.

**코드 전문 (민감 정보 제외):**
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://odxuafzdkvcioevqezkl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[REDACTED]
SUPABASE_SERVICE_ROLE_KEY=[REDACTED]

# Environment
NODE_ENV=development

# NextAuth.js
NEXTAUTH_SECRET=[REDACTED]

# Auto-generated deployment info
NEXT_PUBLIC_APP_VERSION=0.1.0-20250803.1108-81cfa657
NEXT_PUBLIC_BUILD_ID=81cfa6573a674f585123e62f5528aa34861b8b60
BUILD_TIME=2025-08-03T02:08:26.599Z
```

**핵심 발견사항:**
- 표준 Supabase 환경 변수 구성 사용
- `@supabase/ssr` 전환 시 동일한 환경 변수 사용 가능
- NextAuth.js 설정이 있지만 현재 Supabase Auth 사용 중

## 2. 서버 사이드 인증 흐름 (The Server World)

### 2.1. 미들웨어: 모든 요청의 첫 관문

**파일 경로:** `src/middleware.ts`  
**분석 목표:** 현재 세션 갱신, 라우팅 보호, 쿠키 관리가 어떻게 이루어지고 있는지 100% 파악한다. `ssr` 전환 시 이 파일이 어떻게 변경될지 예측하기 위한 핵심 자료다.

**코드 전문:**
```typescript
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse, type NextRequest } from 'next/server';
import type { Session, User } from '@supabase/supabase-js';

export async function middleware(request: NextRequest) {
  const { pathname } = new URL(request.url);

  // 응답 객체를 먼저 생성
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // ✅ [핵심] createMiddlewareClient를 사용하여 쿠키 관리
  const supabase = createMiddlewareClient({ req: request, res: response });

  let session: Session | null = null;
  let user: User | null = null;
  let sessionError: string | null = null;
  let cookieParsingError: string | null = null;

  try {
    // 세션 조회 시도
    const sessionResult = await supabase.auth.getSession();
    
    if (sessionResult.error) {
      sessionError = sessionResult.error.message;
      // 쿠키 파싱 에러 감지
      if (sessionResult.error.message?.includes('parse') || 
          sessionResult.error.message?.includes('JSON')) {
        cookieParsingError = sessionResult.error.message;
      }
    } else {
      session = sessionResult.data.session;
      user = session?.user || null;
    }
    
    // 세션이 없으면 리프레시 시도
    if (!session || !user) {
      const refreshResult = await supabase.auth.refreshSession();
      
      if (refreshResult.error) {
        sessionError = refreshResult.error.message;
      } else if (refreshResult.data.session) {
        session = refreshResult.data.session;
        user = session.user;
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    sessionError = errorMessage;
    
    // 쿠키 파싱 에러 감지
    if (errorMessage?.includes('parse') || 
        errorMessage?.includes('JSON') ||
        errorMessage?.includes('SyntaxError')) {
      cookieParsingError = errorMessage;
    }
    
    session = null;
    user = null;
  }

  // 사용자 역할 조회
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
      userRole = 'user';
    }
  }

  // 라우트 접근 권한 확인
  const authContext: AuthContext = {
    isAuthenticated: !!user,
    userRole,
    userId: user?.id,
  };

  // 쿠키 파싱 에러 시 로그인으로 리다이렉트
  if (cookieParsingError && !user) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  const accessResult = checkRouteAccess(pathname, authContext);
  
  if (!accessResult.allowed && accessResult.redirectTo) {
    const redirectUrl = new URL(accessResult.redirectTo, request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // ✅ [핵심] 갱신된 쿠키가 담긴 response 객체를 반환
  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|icons/|manifest.json|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

**핵심 발견사항:**
- `createMiddlewareClient({ req: request, res: response })` 패턴 사용
- 쿠키 파싱 에러에 대한 상세한 에러 처리 로직
- 세션 갱신 및 사용자 역할 조회 로직
- `@supabase/ssr` 전환 시 `createServerClient` 사용으로 변경 필요

### 2.2. 서버용 클라이언트 팩토리

**파일 경로:** `src/lib/supabase/server.ts`  
**분석 목표:** 서버 컴포넌트(`layout.tsx` 등)가 Supabase와 통신하는 방식을 파악한다.

**코드 전문:**
```typescript
import "server-only";

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from 'react';
import { Database } from "@/types/database";
import type { SupabaseClient } from '@supabase/supabase-js';

export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * 서버 컴포넌트용 Supabase 클라이언트를 생성합니다.
 * React의 `cache`를 사용하여 동일 요청 내에서 클라이언트 재사용을 최적화합니다.
 */
export const createClient = cache(() => {
  return createServerComponentClient<Database>({
    cookies: () => cookies(),
  });
});

/**
 * Supabase admin 클라이언트를 생성합니다. (service_role 사용)
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

**핵심 발견사항:**
- `createServerComponentClient` 사용으로 서버 컴포넌트 최적화
- React `cache`를 통한 요청별 클라이언트 재사용
- `cookies: () => cookies()` 콜백 패턴으로 Next.js 렌더링 생명주기 최적화
- `@supabase/ssr` 전환 시 `createServerClient` 사용으로 변경 필요

### 2.3. API 라우트용 클라이언트 팩토리

**파일 경로:** `src/lib/supabase/actions.ts`  
**분석 목표:** API 라우트 핸들러가 Supabase와 통신하는 방식을 파악한다.

**코드 전문:**
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
 * API 라우트 핸들러용 Supabase 클라이언트 생성
 */
export function createRouteClient(): TypedSupabaseClient {
  return createRouteHandlerClient<Database>({ cookies }) as TypedSupabaseClient;
}

/**
 * 서버 액션용 Supabase 클라이언트 생성
 */
export async function createActionClient(): Promise<TypedSupabaseClient> {
  return createServerActionClient<Database>({ cookies }) as TypedSupabaseClient;
}

/**
 * 관리자 권한 API 작업용 Supabase 클라이언트 생성
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

**핵심 발견사항:**
- `createRouteHandlerClient`와 `createServerActionClient` 분리 사용
- API 라우트와 서버 액션에 대한 명확한 구분
- 관리자 클라이언트는 service role 키 사용
- `@supabase/ssr` 전환 시 모두 `createServerClient` 사용으로 통합 가능

## 3. 클라이언트 사이드 인증 흐름 (The Client World)

### 3.1. 클라이언트용 클라이언트 팩토리 (레거시)

**파일 경로:** `src/lib/supabase/client.ts`  
**분석 목표:** 중앙화 이전에 사용되었던, 현재는 `@deprecated` 처리된 클라이언트 생성 방식을 확인하여, 혹시 모를 잔존 의존성이 있는지 최종 확인한다.

**코드 전문:**
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

**핵심 발견사항:**
- 완전히 deprecated 처리되어 있음
- 중앙화된 SupabaseProvider 사용을 강제
- `createPagesBrowserClient` 사용
- `@supabase/ssr` 전환 시 이 파일은 완전 제거 가능

### 3.2. 중앙 클라이언트 공급자 (심장)

**파일 경로:** `src/contexts/SupabaseProvider.tsx`  
**분석 목표:** 브라우저 환경에서 Supabase 클라이언트가 어떻게 생성되고 관리되는지 파악한다. `ssr` 전환 시 이 파일이 가장 크게 변경될 것이다.

**코드 전문:**
```typescript
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

export interface SupabaseStatus {
  isReady: boolean;
  error: Error | null;
  isLoading: boolean;
  hasError: boolean;
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
        // Use auth-helpers standard client creation
        const supabaseClient = createPagesBrowserClient<Database>();
        
        if (!isMounted) return;

        setClient(supabaseClient);
        setIsReady(true);
        setError(null);
        
        console.log('[SupabaseProvider] Client initialized successfully');
        
      } catch (err) {
        if (!isMounted) return;
        
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

  // Optimized memoization to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    client,
    isReady,
    error
  }), [
    client,
    isReady,
    error?.message
  ]);

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
  // SSR safety check - return null during server-side rendering
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

/**
 * Hook that returns client readiness status with proper typing
 */
export function useSupabaseStatus(): SupabaseStatus {
  const { isReady, error } = useSupabase();
  
  return {
    isReady,
    error,
    isLoading: !isReady && !error,
    hasError: !!error
  };
}
```

**핵심 발견사항:**
- `createPagesBrowserClient<Database>()` 사용으로 클라이언트 생성
- 초기화 상태 관리 (isReady, error)
- SSR 안전성 확보 (`typeof window === 'undefined'` 체크)
- 메모이제이션을 통한 불필요한 리렌더링 방지
- `@supabase/ssr` 전환 시 `createBrowserClient` 사용으로 변경 필요

### 3.3. 중앙 인증 상태 공급자 (두뇌)

**파일 경로:** `src/contexts/AuthContext.tsx`  
**분석 목표:** 서버로부터 받은 초기 데이터와 클라이언트의 `onAuthStateChange` 이벤트를 결합하여 인증 상태를 관리하는, 우리 아키텍처의 가장 핵심적인 로직을 문서화한다.

**코드 전문:**
```typescript
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
  
  // ✅ [핵심] useState의 초기값을 서버에서 받은 props로 설정
  const [user, setUser] = useState<User | null>(initialSession?.user ?? null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(initialProfile ?? null);
  
  // ✅ [핵심] authStatus의 초기값도 props에 따라 결정
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

**핵심 발견사항:**
- 서버-클라이언트 동기화를 위한 `initialSession`, `initialProfile` props 지원
- `onAuthStateChange` 이벤트 기반 상태 관리
- 원자적 프로필 생성을 위한 `get_or_create_user_profile` RPC 사용
- 실행 잠금을 통한 동시성 제어
- 컴포넌트 언마운트 시 안전한 정리
- `@supabase/ssr` 전환 시 동일한 로직 유지 가능

## 4. 아키텍처 접점 (The Connection Points)

### 4.1. 최상위 레이아웃

**파일 경로:** `src/app/layout.tsx`  
**분석 목표:** 서버에서 초기 데이터를 가져와 `AuthProvider`에 주입하는, '서버-클라이언트 동기화'의 핵심 구현부를 확인한다.

**코드 전문:**
```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/app/globals.css';
import Providers from '@/app/providers';
import { Toaster } from '@/components/ui/toaster';
import { ClientPolyfillManager } from '@/lib/polyfills/ClientPolyfillManager';
import { SupabaseProvider } from '@/contexts/SupabaseProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { AuthToastManager } from '@/components/auth/AuthErrorToast';
import AuthGatekeeper from '@/components/layout/AuthGatekeeper';
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
  // ... 메타데이터 설정
};

// ✅ [핵심] RootLayout을 async 함수로 변경
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ✅ [핵심] 서버에서 초기 데이터를 가져온다
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  let initialProfile: UserProfile | null = null;
  
  if (session) {
    try {
      const { data: profileData, error } = await supabase.rpc('get_or_create_user_profile').single();
      
      if (profileData && !error) {
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
          <Providers>
            <SupabaseProvider>
              {/* ✅ [핵심] 가져온 초기 데이터를 AuthProvider에 props로 주입 */}
              <AuthProvider initialSession={session} initialProfile={initialProfile}>
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
```

**핵심 발견사항:**
- async 함수로 서버에서 초기 데이터 가져오기
- `createClient()` (서버용)를 사용하여 세션 및 프로필 조회
- `initialSession`, `initialProfile` props를 통한 서버-클라이언트 동기화
- 에러 처리 및 로깅 포함
- `@supabase/ssr` 전환 시 동일한 패턴 유지 가능

### 4.2. UI 분기 지점

**파일 경로:** `src/components/layout/AuthGatekeeper.tsx`  
**분석 목표:** `AuthProvider`가 제공하는 상태를 소비하여 UI를 분기하는 방식을 확인한다.

**코드 전문:**
```typescript
"use client";

import React from 'react';
import { useAuthContext } from '@/contexts/AuthContext';

/**
 * 전체 화면 로딩 컴포넌트
 * AuthProvider가 초기 인증 상태를 확인하는 동안 표시됩니다.
 */
const FullScreenLoader = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center space-y-4">
        {/* 로딩 스피너 */}
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        
        {/* 로딩 텍스트 */}
        <div className="text-sm text-muted-foreground">
          인증 상태를 확인하고 있습니다...
        </div>
      </div>
    </div>
  );
};

const AuthGatekeeper = ({ children }: { children: React.ReactNode }) => {
  const { authStatus } = useAuthContext();

  console.log('[AuthGatekeeper] Current auth status:', authStatus);

  // 아직 초기 인증 상태 확인이 완료되지 않았다면, 전체 화면 로더를 보여준다.
  if (authStatus === 'loading') {
    console.log('[AuthGatekeeper] Showing loading screen');
    return <FullScreenLoader />;
  }

  // 인증 확인이 끝나면, 보호받는 자식 컴포넌트(실제 페이지)를 렌더링한다.
  console.log('[AuthGatekeeper] Rendering children - auth status:', authStatus);
  return <>{children}</>;
};

export default AuthGatekeeper;
```

**핵심 발견사항:**
- `useAuthContext`를 통한 인증 상태 소비
- `authStatus`에 따른 UI 분기 (loading vs children)
- 전체 화면 로딩 컴포넌트 제공
- 단순한 상태 소비자 역할만 수행
- `@supabase/ssr` 전환 시 변경 불필요

## 5. 데이터 및 타입 정의 (The Language)

### 5.1. 핵심 데이터 타입

**파일 경로:** `src/types/auth.ts` 및 `src/types/database.ts`  
**분석 목표:** `UserProfile`, `Database` 등 시스템 전반에서 사용되는 핵심 타입들을 확인하여, 데이터 구조의 일관성을 파악한다.

**코드 전문 (두 파일 모두):**
```typescript
// --- src/types/auth.ts ---
import type { AuthId, DatabaseUserId } from './enhanced-types';

/**
 * Supabase Auth user_metadata 구조 (Magic Link 이메일 기반 인증)
 */
export interface UserMetadata {
  fullName: string
  department: string
  role?: 'admin' | 'employee'
}

/**
 * 클라이언트에서 사용하는 사용자 프로필 타입 (이메일 기반)
 * Enhanced with branded types for type safety
 */
export interface UserProfile {
  authId: AuthId;      // Branded AuthId
  dbId: DatabaseUserId; // Branded DatabaseUserId (이제 필수)
  employeeId?: string;
  email: string;
  name: string;
  department: string;
  role: 'admin' | 'employee';
  createdAt: string;
  updatedAt?: string;
}

/**
 * Enhanced user profile with full type safety
 */
export interface EnhancedUserProfile {
  authId: AuthId
  databaseId: DatabaseUserId
  email: string
  name: string
  department: string
  role: 'admin' | 'employee'
  isActive: boolean
  createdAt: Date
  updatedAt?: Date
  lastValidated?: Date
}

/**
 * 로그인 요청 타입 (이메일 기반)
 */
export interface LoginRequest {
  email: string
  password: string
}

/**
 * 회원가입 요청 타입 (Magic Link 이메일 기반)
 */
export interface SignupRequest {
  email: string
  fullName: string
  department: string
  role?: 'admin' | 'employee'
}

export interface CreateUserData {
  email: string
  fullName: string
  department: string
  role?: 'employee' | 'admin'
}

// --- src/types/database.ts ---
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          auth_id: string
          employee_id: string | null
          name: string
          email: string
          department: string
          role: 'employee' | 'admin'
          created_at: string
          updated_at: string
        }
        Insert: {
          auth_id: string
          employee_id?: string | null
          name: string
          email: string
          department: string
          role?: 'employee' | 'admin'
        }
        Update: {
          auth_id?: string
          employee_id?: string | null
          name?: string
          email?: string
          department?: string
          role?: 'employee' | 'admin'
          updated_at?: string
        }
      }
      rooms: {
        Row: {
          id: string
          name: string
          description?: string
          capacity: number
          location?: string
          amenities: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        // ... Insert, Update 타입들
      }
      reservations: {
        Row: {
          id: string
          room_id: string
          user_id: string
          title: string
          purpose?: string
          start_time: string
          end_time: string
          status: 'confirmed' | 'cancelled'
          cancellation_reason?: string
          created_at: string
          updated_at: string
        }
        // ... Insert, Update 타입들
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_email_exists: {
        Args: { p_email: string };
        Returns: boolean;
      }
      get_current_user_info: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          auth_id: string;
          email: string;
          name: string;
          department: string;
          role: string;
        }[];
      }
      get_public_reservations: {
        Args: {
          start_date: string;
          end_date: string;
          page_limit?: number;
          page_offset?: number;
        };
        Returns: PublicReservation[];
      }
      // ... 기타 RPC 함수들
    }
    Enums: {
      user_role: 'employee' | 'admin'
      reservation_status: 'confirmed' | 'cancelled'
    }
  }
}

// 타입 별칭들
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type User = Tables<'users'>
export type Room = Tables<'rooms'>
export type Reservation = Tables<'reservations'>

// PublicReservation 타입 정의
export type PublicReservation = {
  id: string
  room_id: string
  user_id: string
  title: string
  purpose: string | null
  department: string
  user_name: string
  start_time: string
  end_time: string
  is_mine: boolean
}

// Enhanced types with branded type safety
export interface EnhancedUser {
  id: DatabaseUserId
  auth_id: AuthId
  employee_id: string | null
  name: string
  email: string
  department: string
  role: 'employee' | 'admin'
  created_at: Date
  updated_at: Date
}
```

**핵심 발견사항:**
- Branded types (`AuthId`, `DatabaseUserId`) 사용으로 타입 안전성 강화
- Supabase 스키마와 일치하는 Database 인터페이스
- RPC 함수들의 명확한 타입 정의
- Enhanced types와 기본 types의 분리
- `@supabase/ssr` 전환 시 타입 정의는 변경 불필요

### 5.2. 프로필 관련 유틸리티

**파일 경로:** `src/lib/auth/profile-utils.ts`  
**분석 목표:** RPC 결과를 `UserProfile` 타입으로 변환하는 등, 데이터 변환 로직을 확인한다.

**코드 전문:**
```typescript
import { UserProfile } from '@/types/auth';
import { createAuthId, createDatabaseUserId } from '@/types/enhanced-types';

/**
 * RPC 결과 타입 정의
 * SQL 함수의 RETURNS TABLE과 정확히 일치해야 함
 */
export type ProfileRpcResult = {
  authId: string;
  dbId: string;
  employeeId: string | null;
  email: string;
  name: string;
  department: string;
  role: 'admin' | 'employee';
  createdAt: string;
  updatedAt: string | null;
};

/**
 * RPC 결과를 UserProfile 타입으로 변환
 * 서버와 클라이언트에서 동일한 변환 로직 사용
 */
export function convertRpcResultToUserProfile(data: ProfileRpcResult): UserProfile {
  return {
    authId: createAuthId(data.authId),
    dbId: createDatabaseUserId(data.dbId),
    
    // employeeId는 null일 수 있으므로 명시적으로 유지
    employeeId: data.employeeId || undefined,
    
    // email은 non-nullable로 가정하지만 방어적으로 처리
    email: (data.email && typeof data.email === 'string') 
      ? data.email 
      : 'unknown@example.com',
    
    // [핵심 보증] name은 절대 null이나 빈 문자열이 아님을 보증
    name: (data.name && typeof data.name === 'string' && data.name.trim()) 
      ? data.name.trim() 
      : '알 수 없는 사용자',
    
    // [핵심 보증] department는 절대 null이나 빈 문자열이 아님을 보증
    department: (data.department && typeof data.department === 'string' && data.department.trim()) 
      ? data.department.trim() 
      : '소속 없음',
    
    // [핵심 보증] role은 절대 null이 아니며 유효한 값임을 보증
    role: (data.role === 'admin' || data.role === 'employee') 
      ? data.role 
      : 'employee',
    
    createdAt: data.createdAt,
    updatedAt: data.updatedAt || undefined,
  };
}
```

**핵심 발견사항:**
- RPC 결과와 클라이언트 타입 간의 명확한 변환 로직
- Branded types 생성 함수 사용
- 방어적 프로그래밍으로 데이터 무결성 보장
- 서버와 클라이언트에서 공통 사용 가능
- `@supabase/ssr` 전환 시 변경 불필요

## 6. 전환 영향 분석 및 권장사항

### 6.1. 주요 변경 지점

1. **미들웨어 (`src/middleware.ts`)**
   - `createMiddlewareClient` → `createServerClient` 변경
   - 쿠키 처리 방식 변경 필요

2. **서버 클라이언트 (`src/lib/supabase/server.ts`)**
   - `createServerComponentClient` → `createServerClient` 변경
   - 쿠키 처리 방식 통일

3. **API 라우트 클라이언트 (`src/lib/supabase/actions.ts`)**
   - `createRouteHandlerClient`, `createServerActionClient` → `createServerClient` 통일

4. **브라우저 클라이언트 (`src/contexts/SupabaseProvider.tsx`)**
   - `createPagesBrowserClient` → `createBrowserClient` 변경

### 6.2. 유지 가능한 부분

1. **AuthContext 로직** - 완전히 유지 가능
2. **타입 정의** - 변경 불필요
3. **프로필 유틸리티** - 변경 불필요
4. **UI 컴포넌트** - 변경 불필요
5. **서버-클라이언트 동기화 패턴** - 유지 가능

### 6.3. 전환 우선순위

1. **1단계**: 패키지 의존성 업데이트
2. **2단계**: 서버 사이드 클라이언트 팩토리 변경
3. **3단계**: 미들웨어 변경
4. **4단계**: 브라우저 클라이언트 변경
5. **5단계**: 레거시 파일 제거

### 6.4. 위험 요소

1. **쿠키 처리 방식 변경**으로 인한 세션 불일치 가능성
2. **미들웨어 동작 변경**으로 인한 라우팅 문제 가능성
3. **클라이언트 초기화 타이밍** 변경으로 인한 상태 동기화 문제

### 6.5. 테스트 전략

1. **인증 플로우 테스트**: 로그인/로그아웃/세션 갱신
2. **서버-클라이언트 동기화 테스트**: 초기 로딩 시 상태 일치
3. **미들웨어 테스트**: 라우트 보호 및 리다이렉트
4. **브라우저 호환성 테스트**: 쿠키 처리 및 세션 관리

## 7. 결론

현재 시스템은 `@supabase/auth-helpers-nextjs` 기반으로 견고하게 구축되어 있으며, 서버-클라이언트 동기화, 원자적 프로필 관리, 방어적 렌더링 등 핵심 아키텍처 패턴이 잘 구현되어 있습니다. 

`@supabase/ssr`로의 전환은 주로 클라이언트 팩토리 함수들의 변경에 집중되며, 핵심 비즈니스 로직과 상태 관리 로직은 대부분 유지할 수 있습니다. 

단계적 전환을 통해 안전하게 마이그레이션할 수 있으며, 특히 서버-클라이언트 동기화 패턴은 그대로 유지하여 사용자 경험의 연속성을 보장할 수 있습니다.