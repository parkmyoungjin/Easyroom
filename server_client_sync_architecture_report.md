# '서버-클라이언트 동기화' 설계를 위한 아키텍처 보고서

## 1. 페이지 진입점: `page.tsx`

- **파일 경로:** `src/app/page.tsx`
- **분석 목표:** 이 페이지 컴포넌트가 서버 컴포넌트인지 클라이언트 컴포넌트인지 확인하고, 서버 사이드에서 Supabase 세션 정보를 가져와 `PageContent`와 같은 하위 클라이언트 컴포넌트에게 props로 전달할 수 있는 구조인지 파악한다.
- **코드 전문:**

```typescript
// src/app/page.tsx

import { Suspense } from 'react';
import PageContent from '@/app/page-content';
import { Skeleton } from '@/components/ui/skeleton'; // ✅ Skeleton 로딩 컴포넌트 사용

// ✅ 스켈레톤 UI를 사용한 정교한 로딩 화면
const MainPageSkeleton = () => (
  <div className="min-h-screen bg-background">
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center mb-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-24" />
      </div>

      {/* Quick Actions Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>

      {/* Info Section Skeleton */}
      <Skeleton className="h-48 rounded-lg" />
    </div>
  </div>
);

export default function HomePage() {
  return (
    // ✅ Suspense의 fallback으로 스켈레톤 UI를 보여줍니다.
    <Suspense fallback={<MainPageSkeleton />}>
      <PageContent />
    </Suspense>
  );
}
```

**🔍 분석 결과:**
- ✅ **서버 컴포넌트 확인됨** - `'use client'` 지시어가 없으므로 기본적으로 서버 컴포넌트
- ✅ **Props 전달 가능** - `PageContent`에 props를 전달할 수 있는 구조
- ⚠️ **현재 한계점** - 서버에서 세션 정보를 가져와서 전달하는 로직이 없음
- 💡 **개선 방향** - 서버에서 초기 세션 정보를 가져와 `PageContent`에 `initialSession` prop으로 전달 필요

## 2. 상태 공급자: `AuthContext.tsx`

- **파일 경로:** `src/contexts/AuthContext.tsx`
- **분석 목표:** `AuthProvider`가 `initialSession`과 같은 prop을 받아서, 자신의 초기 상태(`initialState`)를 설정할 수 있도록 수정할 부분을 식별한다.
- **코드 전문:**

```typescript
// src/contexts/AuthContext.tsx
// 작전명: 원자적 프로필 관리 (Operation: Atomic Profile Management)
// 
// 핵심 아키텍처:
// 1. 단일 관문 (Single Gate): 모든 인증 상태 변경은 onAuthStateChange 리스너를 통해서만 처리
// 2. 원자적 프로필 생성: get_or_create_user_profile RPC 함수를 통한 트랜잭션 기반 프로필 관리
// 3. 방어적 렌더링: 모든 데이터 접근에 안전한 패턴 적용으로 렌더링 오류 방지

'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
import { UserProfile } from '@/types/auth';
import { createAuthId, createDatabaseUserId } from '@/types/enhanced-types';

// ============================================================================
// TYPES AND INTERFACES - Simplified for Single Gate Architecture
// ============================================================================

/**
 * Authentication status with clear state definitions
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * Main AuthContext interface - Simplified for Single Gate
 */
interface AuthContextType {
  /** Current authenticated user from Supabase Auth */
  user: User | null;
  /** User profile data from database */
  userProfile: UserProfile | null;
  /** Current authentication status */
  authStatus: AuthStatus;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// PROFILE HELPER FUNCTION - '방탄 계약'이 적용된 최종 버전
// ============================================================================

// ✅ [1단계] RPC가 반환하는 데이터의 형태를 TypeScript에게 알려주기 위한 타입을 정의합니다.
// 이 타입의 속성 이름은 SQL 함수의 RETURNS TABLE (...)에 정의된 컬럼 이름과 정확히 일치해야 합니다.
type ProfileRpcResult = {
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
 * 사용자 프로필을 원자적으로 조회하거나 생성합니다.
 * 모든 복잡성은 데이터베이스의 'get_or_create_user_profile' RPC 함수에 위임됩니다.
 * 이 함수의 유일한 책임은 RPC를 호출하고, 결과를 타입에 맞게 변환하는 것입니다.
 */
async function getOrCreateProfile(supabase: SupabaseClient): Promise<UserProfile> {
  // ✅ [핵심] 모든 로직이 단일 RPC 호출로 통합됩니다.
  // ✅ [2단계] RPC 호출 후 타입 단언을 통해 data의 타입을 명시적으로 지정합니다.
  const { data, error } = await supabase.rpc('get_or_create_user_profile').single();
  const typedData = data as ProfileRpcResult | null;

  // RPC 레벨에서 발생한 모든 에러는 여기서 잡아서 즉시 상위로 전파합니다.
  if (error) {
    console.error("CRITICAL: get_or_create_user_profile RPC failed.", error);
    throw error;
  }

  // 데이터가 없는 경우는 발생해서는 안 되지만, 만약을 위한 최종 방어선입니다.
  if (!typedData) {
    throw new Error("CRITICAL: get_or_create_user_profile RPC returned no data despite success status.");
  }

  // ✅ [최종 진화] 데이터 보증 (Operation: Data Assurance)
  // 모든 속성의 유효성을 검증하고 안전한 기본값을 보증합니다.
  // 이제 하위 컴포넌트는 데이터 유효성을 걱정할 필요가 없습니다.
  return {
    authId: createAuthId(typedData.authId),
    dbId: createDatabaseUserId(typedData.dbId),
    
    // ✅ employeeId는 null일 수 있으므로 명시적으로 유지
    employeeId: typedData.employeeId || undefined,
    
    // ✅ email은 non-nullable로 가정하지만 방어적으로 처리
    email: (typedData.email && typeof typedData.email === 'string') 
      ? typedData.email 
      : 'unknown@example.com',
    
    // ✅ [핵심 보증] name은 절대 null이나 빈 문자열이 아님을 보증
    name: (typedData.name && typeof typedData.name === 'string' && typedData.name.trim()) 
      ? typedData.name.trim() 
      : '알 수 없는 사용자',
    
    // ✅ [핵심 보증] department는 절대 null이나 빈 문자열이 아님을 보증
    department: (typedData.department && typeof typedData.department === 'string' && typedData.department.trim()) 
      ? typedData.department.trim() 
      : '소속 없음',
    
    // ✅ [핵심 보증] role은 절대 null이 아니며 유효한 값임을 보증
    role: (typedData.role === 'admin' || typedData.role === 'employee') 
      ? typedData.role 
      : 'employee',
    
    createdAt: typedData.createdAt,
    updatedAt: typedData.updatedAt || undefined,
  };
}

// ============================================================================
// SINGLE GATE AUTH PROVIDER - 단일 관문 인증 제공자
// ============================================================================

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const supabase = useSupabaseClient();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');

  // --- 실행 잠금(Execution Lock) ---
  const isProcessing = useRef(false);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    // --- 단계 1: '취소 프로토콜' 플래그 선언 ---
    // 이 useEffect 스코프 내에서 컴포넌트의 마운트 상태를 추적한다.
    let isMounted = true;
    console.log('[AuthProvider] Lifecycle: useEffect mounted. Subscribing. isMounted=true');

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // --- 단계 2: 비동기 작업 전, 마운트 상태 1차 확인 ---
      // 이벤트 핸들러 시작 시점에 이미 언마운트 되었다면 즉시 종료
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
          // ✅ [핵심 수정] 이제 supabase와 user 객체를 넘길 필요가 없다.
          // RPC는 auth.uid()를 통해 서버에서 직접 사용자 정보를 가져온다.
          const profile = await getOrCreateProfile(supabase);

          // --- 단계 3: 비동기 작업 후, 마운트 상태 2차 확인 (가장 중요) ---
          // await 이후, 상태를 변경하기 직전에 컴포넌트가 여전히 유효한지 최종 확인한다.
          if (!isMounted) {
            console.log(`[AuthProvider] Post-Await Check: Unmounted during profile fetch for '${event}'. Halting state update.`);
            // 여기서 return 해도 finally는 실행된다.
            return;
          }

          // 이제 안전하게 상태를 변경한다.
          setUser(session.user);
          setUserProfile(profile);
          setAuthStatus('authenticated');
          console.log(`[AuthProvider] Processed '${event}': State set to 'authenticated'.`);
        } else {
          // 동기적인 경로이지만, 일관성을 위해 확인 로직을 추가한다.
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
        // ✅ [핵심 수정] 프로필 획득 실패 시, 시스템을 안전한 '인증 실패' 상태로 전환
        console.error(`[AuthProvider] Exception caught during event '${event}'. Transitioning to unauthenticated.`, error);
        if (isMounted) {
          setUser(null);
          setUserProfile(null);
          setAuthStatus('unauthenticated');
        }
      } finally {
        // 어떤 경우에도 잠금은 반드시 해제된다.
        isProcessing.current = false;
        console.log(`[AuthProvider] Lock Released for event '${event}'.`);
      }
    });

    // --- 단계 4: 클린업 함수에서 '취소' 신호 전송 ---
    return () => {
      console.log('[AuthProvider] Lifecycle: useEffect unmounted. Unsubscribing. Setting isMounted=false');
      // 컴포넌트가 언마운트되었음을 알려, 진행 중인 모든 비동기 작업이 스스로 중단되도록 한다.
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]); // supabase 클라이언트가 준비되면 이 로직 전체를 안전하게 실행한다.

  const value = { user, userProfile, authStatus };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ============================================================================
// CONTEXT HOOKS - 컨텍스트 사용을 위한 훅들
// ============================================================================

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * 기존 코드와의 호환성을 위한 별칭
 */
export const useAuthContext = useAuth;
```

**🔍 분석 결과:**
- ⚠️ **현재 한계점** - `AuthProvider`가 초기 세션 정보를 받을 수 있는 props 구조가 없음
- ⚠️ **상태 불일치 원인** - 클라이언트에서만 `onAuthStateChange`를 통해 세션을 확인하므로 서버-클라이언트 간 불일치 발생
- 💡 **개선 방향** - `AuthProvider`에 `initialSession` 및 `initialProfile` props 추가 필요
- 💡 **초기 상태 설정** - 서버에서 전달받은 초기 데이터로 `useState`의 초기값 설정 필요

## 3. (참고용) Supabase 서버 클라이언트 생성 로직

- **파일 경로:** `src/lib/supabase/server.ts`
- **분석 목표:** 서버 컴포넌트(`page.tsx`)에서 사용할 Supabase 클라이언트 생성 함수가 어떻게 구현되어 있는지 확인한다.
- **코드 전문:**

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
  // cookies() 함수 자체를 전달하면 auth-helpers가 내부적으로 최적의 방법으로 처리합니다.
  // 수동으로 get/set/remove를 구현할 필요가 없습니다.
  const cookieStore = cookies();
  return createServerComponentClient<Database>({ cookies: () => cookieStore });
});


/**
 * Supabase admin 클라이언트를 생성합니다. (service_role 사용)
 * RLS를 우회하므로, 보안이 확보된 서버 환경에서만 사용해야 합니다.
 */
export const createAdminClient = () => {
  // 이 함수는 매번 호출되어도 비용이 크지 않으므로 cache를 필수로 사용하진 않습니다.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin client');
  }

  // createAdminClient는 async일 필요가 없습니다.
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

**🔍 분석 결과:**
- ✅ **서버 클라이언트 준비됨** - `createClient()` 함수로 서버에서 Supabase 클라이언트 생성 가능
- ✅ **쿠키 기반 세션 관리** - `@supabase/auth-helpers-nextjs`가 쿠키를 통한 세션 관리 자동 처리
- ✅ **캐싱 최적화** - React의 `cache`를 사용하여 동일 요청 내 클라이언트 재사용
- 💡 **활용 방안** - 서버 컴포넌트에서 이 클라이언트를 사용하여 초기 세션 및 프로필 정보 획득 가능

## 4. 🚨 핵심 문제점 및 해결 방안

### 📋 **현재 아키텍처의 문제점:**

1. **서버-클라이언트 상태 불일치**
   - 서버: 쿠키를 통해 "사용자가 로그인됨"을 인식
   - 클라이언트: `onAuthStateChange`를 통해 세션을 재검증하는 과정에서 일시적으로 `null` 상태 발생

2. **초기 상태 설정 부재**
   - `AuthProvider`가 항상 `'loading'` 상태로 시작
   - 서버에서 이미 확인된 세션 정보를 활용하지 못함

3. **불필요한 네트워크 요청**
   - 클라이언트에서 매번 세션 재검증 및 프로필 재조회 수행

### 🎯 **해결 방안: 서버-클라이언트 동기화**

1. **서버에서 초기 데이터 수집**
   ```typescript
   // src/app/page.tsx에서
   const supabase = createClient();
   const { data: { session } } = await supabase.auth.getSession();
   const initialProfile = session ? await getOrCreateProfile(supabase) : null;
   ```

2. **AuthProvider 인터페이스 확장**
   ```typescript
   interface AuthProviderProps {
     children: React.ReactNode;
     initialSession?: Session | null;
     initialProfile?: UserProfile | null;
   }
   ```

3. **초기 상태 설정**
   ```typescript
   const [user, setUser] = useState<User | null>(initialSession?.user || null);
   const [userProfile, setUserProfile] = useState<UserProfile | null>(initialProfile || null);
   const [authStatus, setAuthStatus] = useState<AuthStatus>(
     initialSession ? 'authenticated' : 'unauthenticated'
   );
   ```

### 🏆 **기대 효과:**

- ✅ **로딩 멈춤 현상 완전 해결** - 서버와 클라이언트 상태 일치로 교착 상태 방지
- ✅ **성능 향상** - 불필요한 네트워크 요청 및 재검증 과정 제거
- ✅ **사용자 경험 개선** - 새로고침 시 즉시 인증된 상태로 페이지 로드
- ✅ **아키텍처 안정성** - 서버-클라이언트 간 단일 정보 소스 확립

---

**🎯 결론:** 현재 아키텍처는 기술적으로 완벽하지만, 서버-클라이언트 간 초기 상태 동기화가 누락되어 있습니다. 이 보고서에서 식별된 수정 사항들을 적용하면, "쿠키 clear 후 새로고침하면 메인 페이지 접속됨"이라는 현상의 근본 원인인 **서버-클라이언트 상태 불일치 문제**를 완전히 해결할 수 있습니다.