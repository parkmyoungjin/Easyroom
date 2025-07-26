// src/contexts/AuthContext.tsx
'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import type { User } from '@supabase/supabase-js';
// ✅ 기존에 만들어두신 강력한 클라이언트 생성 함수를 가져옵니다.
import { createClient } from '@/lib/supabase/client';
import type { UserProfile } from '@/types/auth';
import { createAuthId, createDatabaseUserId } from '@/types/enhanced-types';

// Supabase 클라이언트 타입 추론 (Promise를 벗겨내야 함)
type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Context에 제공할 값들의 타입 정의
interface AuthContextType {
  // ✅ supabase 클라이언트가 null일 수 있음을 명시합니다. (초기화 전)
  supabase: SupabaseClient | null;
  user: User | null;
  userProfile: UserProfile | null;
  authStatus: 'loading' | 'authenticated' | 'unauthenticated';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // ✅ supabase 클라이언트를 state로 관리합니다. 초기값은 null.
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  // ✅ [핵심] 앱이 시작될 때 단 한 번만 클라이언트를 초기화합니다.
  useEffect(() => {
    createClient()
      .then(client => setSupabase(client))
      .catch(error => {
        console.error("Supabase client initialization failed:", error);
        setAuthStatus('unauthenticated'); // 클라이언트 초기화 실패 시 인증 불가 처리
      });
  }, []); // 빈 종속성 배열로 최초 렌더링 시에만 실행

  useEffect(() => {
    // ✅ supabase 클라이언트가 성공적으로 초기화된 후에만 리스너를 설정합니다.
    if (!supabase) return;

    // --- getOrCreateProfile 함수 (기존과 동일) ---
    const getOrCreateProfile = async (authUser: User): Promise<UserProfile | null> => {
        try {
            const { data, error } = await supabase.from('users').select('*').eq('auth_id', authUser.id).single();
            if (error && error.code !== 'PGRST116') throw error;
            if (data) {
                return { authId: createAuthId(data.auth_id), dbId: createDatabaseUserId(data.id), employeeId: data.employee_id, email: data.email, name: data.name, department: data.department, role: data.role, createdAt: data.created_at, updatedAt: data.updated_at };
            }
            const { error: rpcError } = await supabase.rpc('upsert_user_profile', { p_auth_id: authUser.id, p_email: authUser.email, p_user_name: authUser.user_metadata?.fullName, p_user_department: authUser.user_metadata?.department, p_user_employee_id: null });
            if (rpcError) throw rpcError;
            const { data: newData, error: finalError } = await supabase.from('users').select('*').eq('auth_id', authUser.id).single();
            if (finalError) throw finalError;
            return { authId: createAuthId(newData.auth_id), dbId: createDatabaseUserId(newData.id), employeeId: newData.employee_id, email: newData.email, name: newData.name, department: newData.department, role: newData.role, createdAt: newData.created_at, updatedAt: newData.updated_at };
        } catch (e) {
            console.error("[FATAL] Failed to get or create user profile:", e);
            return null;
        }
    };

    // --- onAuthStateChange 리스너 설정 ---
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[AuthProvider] Auth Event: ${event}`);
      const authUser = session?.user ?? null;
      
      if (authUser) {
        setAuthStatus('loading');
        const profile = await getOrCreateProfile(authUser);
        setUser(authUser);
        setUserProfile(profile);
        setAuthStatus(profile ? 'authenticated' : 'unauthenticated');
      } else {
        setUser(null);
        setUserProfile(null);
        setAuthStatus('unauthenticated');
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase]); // ✅ supabase 클라이언트가 변경될 때마다 이 effect가 실행됩니다.

  const value = useMemo(() => ({
    supabase,
    user,
    userProfile,
    authStatus,
  }), [supabase, user, userProfile, authStatus]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}