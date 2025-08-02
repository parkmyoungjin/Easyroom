# '방탄 계약' 설계를 위한 `AuthContext.tsx` 분석 보고서

## 파일 경로: `src/contexts/AuthContext.tsx`

## 분석 목표

1. `getOrCreateProfile` 함수의 모든 코드 경로를 분석하여, `null`을 반환하거나 예외를 던지지 않고 실패할 수 있는 숨겨진 엣지 케이스를 식별한다.
2. `onAuthStateChange` 핸들러의 `try...catch` 블록이 `getOrCreateProfile`에서 발생하는 모든 예외를 안정적으로 처리할 수 있는지 최종 검증한다.

## 코드 전문

```typescript
// src/contexts/AuthContext.tsx
// 작전명: 단일 관문 (Operation: Single Gate)
// 모든 인증 상태 변경은 onAuthStateChange 리스너를 통해서만 처리됩니다.

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
// PROFILE HELPER FUNCTION - 프로필 조회 및 생성 로직
// ============================================================================

/**
 * 사용자 프로필을 조회하거나 생성합니다.
 * Exception Barrier 아키텍처: 실패 시 에러를 호출자에게 명시적으로 전파합니다.
 */
async function getOrCreateProfile(supabase: SupabaseClient, user: User): Promise<UserProfile> {
  try {
    // 1. 기존 사용자 프로필 조회
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (data) {
      return {
        authId: createAuthId(data.auth_id),
        dbId: createDatabaseUserId(data.id),
        employeeId: data.employee_id,
        email: data.email,
        name: data.name,
        department: data.department,
        role: data.role,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    }

    // 2. 신규 사용자 프로필 생성
    const { error: rpcError } = await supabase.rpc('upsert_user_profile', {
      p_auth_id: user.id,
      p_email: user.email || '',
      p_user_name: user.user_metadata?.fullName || '',
      p_user_department: user.user_metadata?.department || '',
      p_user_employee_id: null
    });

    if (rpcError) throw rpcError;

    // 3. 생성된 프로필 조회
    const { data: newData, error: finalError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', user.id)
      .single();

    if (finalError) throw finalError;

    // 최종 프로필 데이터 검증
    if (!newData) {
      throw new Error('최종 프로필 조회에 실패했습니다.');
    }

    return {
      authId: createAuthId(newData.auth_id),
      dbId: createDatabaseUserId(newData.id),
      employeeId: newData.employee_id,
      email: newData.email,
      name: newData.name,
      department: newData.department,
      role: newData.role,
      createdAt: newData.created_at,
      updatedAt: newData.updated_at
    };
  } catch (error) {
    console.error('[AuthProvider] CRITICAL: Failed to get or create user profile. Re-throwing error.', error);
    // ✅ [핵심 수정] 에러를 조용히 삼키는 대신, 호출자에게 다시 던진다.
    throw error;
  }
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
          // ✅ 이제 getOrCreateProfile이 실패하면 이 try-catch가 잡게 된다.
          const profile = await getOrCreateProfile(supabase, session.user);

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
 * 기존 코드와의 호출성을 위한 별칭
 */
export const useAuthContext = useAuth;
```

## 🚨 치명적 취약점 발견

### 1. **숨겨진 엣지 케이스: 타입 변환 함수의 잠재적 실패**

**위험 지점**: `createAuthId(data.auth_id)`와 `createDatabaseUserId(data.id)` 호출

```typescript
return {
  authId: createAuthId(data.auth_id),        // ⚠️ 잠재적 위험
  dbId: createDatabaseUserId(data.id),       // ⚠️ 잠재적 위험
  // ...
};
```

**문제**: 만약 `createAuthId` 또는 `createDatabaseUserId` 함수가 내부적으로 예외를 던지거나 `undefined`를 반환한다면, 반환되는 `UserProfile` 객체가 불완전해집니다.

### 2. **데이터베이스 응답의 불완전성**

**위험 지점**: 데이터베이스에서 반환된 `data` 객체의 필수 필드 누락

```typescript
if (data) {
  return {
    authId: createAuthId(data.auth_id),
    dbId: createDatabaseUserId(data.id),
    employeeId: data.employee_id,    // ⚠️ null일 수 있음
    email: data.email,               // ⚠️ null일 수 있음  
    name: data.name,                 // ⚠️ null일 수 있음
    department: data.department,     // ⚠️ null일 수 있음
    // ...
  };
}
```

**문제**: 데이터베이스 스키마상 nullable 필드들이 실제로 `null`인 경우, 하위 컴포넌트에서 `userProfile.name.toUpperCase()` 같은 호출 시 렌더링 크래시 발생

### 3. **RPC 함수 의존성**

**위험 지점**: `upsert_user_profile` RPC 함수 호출

```typescript
const { error: rpcError } = await supabase.rpc('upsert_user_profile', {
  p_auth_id: user.id,
  p_email: user.email || '',
  p_user_name: user.user_metadata?.fullName || '',
  p_user_department: user.user_metadata?.department || '',
  p_user_employee_id: null
});
```

**문제**: 이 RPC 함수가 데이터베이스에 존재하지 않거나 실패할 경우, 신규 사용자의 프로필 생성이 완전히 실패합니다.

## 🎯 방탄 계약 구현 필요사항

1. **타입 변환 함수 안전성 보장**
2. **필수 필드 존재 검증**  
3. **RPC 함수 실패에 대한 대체 로직**
4. **완전한 UserProfile 객체 보장**