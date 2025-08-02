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