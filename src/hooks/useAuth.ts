// src/hooks/useAuth.ts
'use client';

import { useCallback } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import type { UserMetadata } from '@/types/auth';

export function useAuth() {
  const { supabase, user, userProfile, authStatus } = useAuthContext();

  // --- 기존 함수들은 그대로 둡니다 ---
  const signInWithMagicLink = useCallback(async (email: string) => { /*...*/ }, [supabase]);
  const signUp = useCallback(async (email: string, password: string, fullName: string, department: string) => { /*...*/ }, [supabase]);
  const signOut = useCallback(async () => { /*...*/ }, [supabase]);
  const resendEmailConfirmation = useCallback(async (email: string) => { /*...*/ }, [supabase]);
  const isAdmin = useCallback(() => userProfile?.role === 'admin', [userProfile]);
  const isAuthenticated = useCallback(() => authStatus === 'authenticated' && !!userProfile, [authStatus, userProfile]);
  const isLoading = useCallback(() => authStatus === 'loading' || !supabase, [authStatus, supabase]);

  // ✅ [수정] signIn (이메일+비밀번호) 함수를 여기에 추가합니다.
  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      console.warn('signIn called before supabase client is ready.');
      throw new Error('인증 서비스가 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }
    // signInWithPassword를 사용합니다.
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
        // Supabase의 에러 메시지를 기반으로 사용자 친화적인 메시지를 생성할 수 있습니다.
        if (error.message.includes('Invalid login credentials')) {
            throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
        }
        if (error.message.includes('Email not confirmed')) {
            throw new Error('이메일 인증이 필요합니다. 메일함을 확인해주세요.');
        }
        throw error; // 그 외의 에러는 그대로 던집니다.
    }
    return data;
  }, [supabase]); // 종속성 배열에 supabase 추가

  return {
    user,
    userProfile,
    authStatus,
    loading: isLoading(),
    signInWithMagicLink,
    signUp,
    signOut,
    isAdmin,
    isAuthenticated,
    isLoading,
    resendEmailConfirmation,
    // ✅ [수정] 반환 객체에 signIn 함수를 포함시킵니다.
    signIn,
  };
}