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

  const [user, setUser] = useState<User | null>(initialSession?.user ?? null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(initialProfile ?? null);

  const [authStatus, setAuthStatus] = useState<AuthStatus>(
    initialSession ? 'authenticated' : 'loading'
  );

  useEffect(() => {
    // Supabase 클라이언트가 준비되지 않으면 아무것도 하지 않습니다.
    if (!supabase) return;

    // onAuthStateChange 리스너는 이제 '정보 수집 및 보고' 역할만 합니다.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: SupabaseSession | null) => {
        console.log(`[AuthProvider] Event received: ${event}`);

        if (session) {
          // 세션이 존재하면 (SIGNED_IN, TOKEN_REFRESHED, INITIAL_SESSION 등)
          const profile = await getOrCreateProfile(supabase);

          if (profile) {
            setUser(session.user);
            setUserProfile(profile);
            setAuthStatus('authenticated');
          } else {
            // 프로필 조회/생성 실패는 심각한 문제이므로 로그아웃 처리합니다.
            console.error("[AuthProvider] Profile fetch failed. Transitioning to unauthenticated.");
            await supabase.auth.signOut(); // 세션을 명확하게 종료
            setUser(null);
            setUserProfile(null);
            setAuthStatus('unauthenticated');
          }
        } else {
          // 세션이 없으면 (SIGNED_OUT)
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