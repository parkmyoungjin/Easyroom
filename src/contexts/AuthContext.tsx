// FILE: src/contexts/AuthContext.tsx
// 순수한 정보 제공자 - AuthProvider
// 원칙: 오직 인증 상태 데이터 제공만 책임진다.

'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { SupabaseClient, User, Session } from '@supabase/supabase-js';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
import { UserProfile } from '@/types/auth';
import { ProfileRpcResult, convertRpcResultToUserProfile } from '@/lib/auth/profile-utils';


// --- 타입 정의 ---
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  authStatus: AuthStatus;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
  children: React.ReactNode;
  initialSession?: Session | null;
}

// --- 프로필 헬퍼 함수 ---
// 이전에 정의한 getOrCreateProfile 함수는 여기에 그대로 존재한다고 가정합니다.
async function getOrCreateProfile(supabase: SupabaseClient | null): Promise<UserProfile | null> {
  if (!supabase) {
    console.error("[AuthContext] Supabase client is null");
    return null;
  }

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
// 순수한 정보 제공자: AuthProvider - 최종 단순화 버전
// ============================================================================
export const AuthProvider = ({
  children,
  initialSession = null
}: AuthProviderProps) => {
  const supabase = useSupabaseClient();

  // 상태는 user와 userProfile만 관리한다. authStatus는 파생 상태이다.
  const [user, setUser] = useState<User | null>(initialSession?.user ?? null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      const profile = await getOrCreateProfile(supabase);
      if (isMounted) {
        setUserProfile(profile);
      }
    };

    const handleAuthComplete = async () => {
      if (!supabase) {
        console.error("[AuthContext] Supabase client is not available");
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      // 초기 세션이 서버로부터 주입되었는지 확인
      if (initialSession) {
        await fetchProfile();
      } else {
        // PWA/CSR 환경: 현재 세션을 확인
        const { data: { session } } = await supabase.auth.getSession();
        if (isMounted && session) {
          await fetchProfile();
        }
      }

      if (isMounted) {
        setIsLoading(false);
      }
    };

    handleAuthComplete();

    if (!supabase) {
      return () => {
        isMounted = false;
      };
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => {
        if (isMounted) {
          if (session) {
            fetchProfile();
            setUser(session.user);
          } else {
            setUser(null);
            setUserProfile(null);
          }
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, initialSession]);

  // ✅ authStatus를 상태가 아닌, 현재 데이터에 기반한 '파생 값'으로 계산한다.
  const authStatus: AuthStatus = isLoading
    ? 'loading'
    : user && userProfile ? 'authenticated' : 'unauthenticated';

  // 프로필 새로고침 함수
  const refreshProfile = async () => {
    if (supabase && user) {
      const profile = await getOrCreateProfile(supabase);
      setUserProfile(profile);
    }
  };

  const value = { user, userProfile, authStatus, refreshProfile };

  // ✅ AuthProvider는 이제 순수한 '정보 전문가' - UI 렌더링에 관여하지 않음
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