# 라우팅 및 인증 아키텍처 재정립을 위한 최종 분석 보고서

**TO:** 대표님  
**RE:** UI 라이브러리 및 라우트 구조 변경에 따른 인증/라우팅 아키텍처 재정립 보고서

## 목표

Mantine UI로의 전환 및 페이지 주소 구조 개편 이후 발생한 '인증 무한 로딩' 및 라우팅 문제를 해결하기 위해, 현재의 인증 및 경로 제어 시스템을 분석하고, **"어떤 사용자가, 어떤 상황에서, 어떤 페이지로 가야 하는가"**에 대한 명확하고 통일된 규칙을 수립 및 구현한다.

---

## 1. 새로운 '도로 지도': 라우트 구조

**목표:** 개편된 페이지들의 역할과 경로를 명확하게 정의합니다.

### 1-1. 페이지 경로 및 역할 설명:

- **`/`**: 라우팅 허브 페이지 - 실제 콘텐츠 없이 로딩 화면만 표시하며, middleware에서 사용자 인증 상태에 따라 적절한 경로로 강제 리디렉션
- **`/welcome`**: 비로그인 사용자를 위한 웰컴/소개 페이지 - 브랜드 소개, 기능 안내, 로그인/회원가입 버튼 제공
- **`/login`**: 로그인 및 OTP 인증 페이지 - 이메일 기반 OTP 로그인 시스템, 회원가입 완료 후 환영 메시지 표시
- **`/signup`**: 회원가입 페이지 - 새 사용자 계정 생성
- **`/dashboard`**: 로그인한 사용자를 위한 메인 허브 페이지 - Bento Grid 스타일의 개인화된 대시보드, 예약 관련 모든 기능 접근점
- **`/reservations/new`**: 새 예약 생성 페이지 - 회의실 예약 생성 폼
- **`/reservations/my`**: 내 예약 관리 페이지 - 사용자의 모든 예약 내역 조회 및 관리
- **`/reservations/status`**: 실시간 예약 현황 페이지 - 전체 예약 현황 확인
- **`/admin`**: 관리자 전용 대시보드 - 시스템 관리 및 설정 (admin 권한 필요)
- **`/kiosk/room-display`**: 공개 키오스크 페이지 - 로그인 없이 접근 가능한 전체 예약 현황 표시

---

## 2. 새로운 '교통 신호등': 미들웨어

**목표:** 모든 요청의 가장 첫 관문인 미들웨어의 현재 로직을 파악합니다.

### 2-1. `middleware.ts` 전체 코드:

```typescript
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
```

---

## 3. 새로운 '중앙 관제탑': 인증 컴포넌트

**목표:** 클라이언트 사이드에서 인증 상태를 관리하고, 상태에 따라 UI를 결정하는 핵심 컴포넌트들의 현재 로직을 파악합니다.

### 3-1. `AuthProvider.tsx` 전체 코드:

```typescript
// FILE: src/contexts/AuthContext.tsx
// 작전명: 중앙 관제탑 V2 (Operation: Central Control Tower V2)
// 원칙: 인증 상태가 모든 데이터 흐름을 통제하며, 모든 의존성은 명확하게 선언된다.

'use client';

// ✅ [핵심 수정] 모든 필요한 자재(타입, 훅, 컴포넌트)를 명확하게 import 합니다.
import React, { createContext, useContext, useEffect, useState } from 'react';
import { SupabaseClient, User, Session, AuthChangeEvent, Session as SupabaseSession } from '@supabase/supabase-js';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
import { UserProfile } from '@/types/auth';
import { ProfileRpcResult, convertRpcResultToUserProfile } from '@/lib/auth/profile-utils';


// --- 타입 정의 ---
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  authStatus: AuthStatus;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
  children: React.ReactNode;
  initialSession?: Session | null;
  initialProfile?: UserProfile | null;
}

// --- 프로필 헬퍼 함수 ---
// 이전에 정의한 getOrCreateProfile 함수는 여기에 그대로 존재한다고 가정합니다.
async function getOrCreateProfile(supabase: SupabaseClient): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase.rpc('get_or_create_user_profile');
    if (error) throw error;
    if (!data || !Array.isArray(data) || data.length === 0) return null;
    return convertRpcResultToUserProfile(data[0] as ProfileRpcResult);
  } catch (error) {
    console.error("[AuthContext] Exception in getOrCreateProfile.", error);
    return null;
  }
}


// ============================================================================
// 중앙 관제탑: AuthProvider
// ============================================================================
export const AuthProvider = ({
  children,
  initialSession = null,
  initialProfile = null
}: AuthProviderProps) => {
  const supabase = useSupabaseClient();

  // [1단계 결과물] '신뢰 기반 초기화' - 서버의 판단을 절대적으로 신뢰
  const [user, setUser] = useState<User | null>(initialSession?.user ?? null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(initialProfile ?? null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>(
    initialSession ? 'authenticated' : 'unauthenticated'
  );

  useEffect(() => {
    // Supabase 클라이언트가 준비되지 않으면 아무것도 하지 않습니다.
    if (!supabase) return;

    // [2단계 결과물] '단순화된 useEffect' - 오직 상태 '변화'만을 처리
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: SupabaseSession | null) => {
        console.log(`[AuthProvider] State change detected: ${event}, hasSession: ${!!session}`);

        if (session) {
          // 세션이 존재하면 -> authenticated 상태로 전환
          const profile = await getOrCreateProfile(supabase);
          
          if (profile) {
            setUser(session.user);
            setUserProfile(profile);
            setAuthStatus('authenticated');
            console.log("[AuthProvider] Successfully authenticated with profile");
          } else {
            // 프로필 조회/생성 실패는 심각한 문제이므로 로그아웃 처리
            console.error("[AuthProvider] Profile fetch failed. Signing out.");
            await supabase.auth.signOut();
            setUser(null);
            setUserProfile(null);
            setAuthStatus('unauthenticated');
          }
        } else {
          // 세션이 없다면 -> unauthenticated 상태로 전환
          console.log("[AuthProvider] No session - setting unauthenticated");
          setUser(null);
          setUserProfile(null);
          setAuthStatus('unauthenticated');
        }
      }
    );

    // 컴포넌트 언마운트 시 구독을 해지합니다.
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const value = { user, userProfile, authStatus };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};


// --- 컨텍스트 훅 ---
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useAuthContext = useAuth;
```

### 3-2. `AuthGatekeeper.tsx` 전체 코드:

**현재 상태:** AuthGatekeeper 컴포넌트는 존재하지 않습니다. 

**분석 결과:** 현재 프로젝트에서는 별도의 AuthGatekeeper 컴포넌트 없이, 각 페이지에서 개별적으로 인증 상태를 확인하고 있습니다. 예를 들어:

- `/login` 페이지: `useAuth` 훅을 사용하여 인증 상태 확인 후 리디렉션
- `/dashboard` 페이지: `useAuth` 훅으로 로딩 상태 처리 및 인증 확인
- 미들웨어: 서버 사이드에서 경로별 접근 제어

**권장사항:** 일관된 인증 가드 로직을 위해 `AuthGatekeeper` 컴포넌트 도입을 고려해야 합니다.

---

## 4. 현재 아키텍처의 문제점 분석

### 4-1. 식별된 주요 문제점:

1. **이중 리디렉션 위험**: 미들웨어와 클라이언트 컴포넌트에서 각각 리디렉션 로직 존재
2. **AuthGatekeeper 부재**: 통일된 클라이언트 사이드 인증 가드 컴포넌트 없음
3. **로딩 상태 불일치**: 서버 초기화와 클라이언트 상태 동기화 간 타이밍 이슈
4. **경로별 권한 체크 분산**: 각 페이지에서 개별적으로 권한 확인

### 4-2. 무한 로딩 발생 원인:

1. **서버-클라이언트 상태 불일치**: 서버에서 초기화된 세션과 클라이언트 AuthProvider 상태 간 동기화 지연
2. **리디렉션 루프**: 미들웨어 리디렉션과 클라이언트 리디렉션이 충돌하는 경우
3. **프로필 로딩 실패**: `getOrCreateProfile` 함수 실행 중 오류 발생 시 무한 로딩 상태

---

## 5. 제안하는 해결 방안

### 5-1. 통합 라우팅 규칙 정의:

**규칙 1**: 비로그인 사용자
- 접근 가능: `/welcome`, `/login`, `/signup`, `/kiosk/*`
- 기타 모든 경로 → `/welcome` 리디렉션

**규칙 2**: 로그인 사용자
- 접근 가능: `/dashboard`, `/reservations/*`, `/kiosk/*`
- `/login`, `/signup` → `/dashboard` 리디렉션
- `/` → `/dashboard` 리디렉션

**규칙 3**: 관리자 사용자
- 추가 접근 가능: `/admin`

**규칙 4**: 로딩 상태
- 모든 리디렉션 판단 보류, 로딩 UI 표시

### 5-2. 구현 우선순위:

1. **AuthGatekeeper 컴포넌트 생성** - 통일된 클라이언트 사이드 인증 가드
2. **미들웨어 최적화** - 서버 사이드 경로 제어 로직 정리
3. **로딩 상태 개선** - 서버-클라이언트 상태 동기화 최적화
4. **에러 핸들링 강화** - 프로필 로딩 실패 시 복구 로직

---

**보고서 작성 완료**  
**작성자**: Kiro AI Assistant  
**작성일**: 2025년 8월 6일