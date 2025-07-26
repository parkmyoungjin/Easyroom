// src/hooks/useAuth.ts
'use client';

import { useCallback } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import type { UserMetadata } from '@/types/auth';

export function useAuth() {
  const { supabase, user, userProfile, authStatus } = useAuthContext();

  const isAdmin = useCallback(() => userProfile?.role === 'admin', [userProfile]);
  const isAuthenticated = useCallback(() => authStatus === 'authenticated' && !!userProfile, [authStatus, userProfile]);
  const isLoading = useCallback(() => authStatus === 'loading' || !supabase, [authStatus, supabase]);

  /**
   * ✅ [수정됨] 이메일로 로그인 링크(Magic Link)를 요청합니다.
   */
  const signInWithMagicLink = useCallback(async (email: string) => {
    if (!supabase) {
      throw new Error('인증 서비스가 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }
    // Supabase에 OTP(One-Time Password, 여기서는 매직링크) 전송을 요청합니다.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // 사용자가 링크를 클릭했을 때 돌아올 URL을 지정합니다.
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    // 에러가 발생하면 그대로 던져서 호출한 쪽(LoginForm)에서 처리하도록 합니다.
    if (error) {
      console.error('Magic Link 전송 에러:', error);
      throw error;
    }
  }, [supabase]); // supabase 클라이언트가 변경될 때만 이 함수를 재생성합니다.

  /**
   * 이메일과 비밀번호로 로그인합니다.
   */
  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('인증 서비스가 준비되지 않았습니다.');
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        if (error.message.includes('Invalid login credentials')) throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
        if (error.message.includes('Email not confirmed')) throw new Error('이메일 인증이 필요합니다. 메일함을 확인해주세요.');
        throw error;
    }
    return data;
  }, [supabase]);

  /**
   * 이메일과 비밀번호로 회원가입합니다.
   */
  const signUp = useCallback(async (email: string, password: string, fullName: string, department: string) => {
    if (!supabase) throw new Error('인증 서비스가 준비되지 않았습니다.');

    const userMetadata: Partial<UserMetadata> = { fullName, department };
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: userMetadata, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
        if (error.message.includes('User already registered')) throw new Error('이미 가입된 이메일입니다. 로그인해주세요.');
        throw error;
    }
    return data;
  }, [supabase]);

  /**
   * 로그아웃합니다.
   */
  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, [supabase]);

  /**
   * 인증 이메일을 재전송합니다.
   */
  const resendEmailConfirmation = useCallback(async (email: string) => {
    if (!supabase) throw new Error('인증 서비스가 준비되지 않았습니다.');
    
    const { error } = await supabase.auth.resend({
      type: 'signup', email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    });
    if (error) throw error;
  }, [supabase]);

  return {
    // 상태
    user,
    userProfile,
    authStatus,
    loading: isLoading(),
    // 함수
    signIn,
    signInWithMagicLink,
    signUp,
    signOut,
    resendEmailConfirmation,
    // 권한 확인
    isAdmin,
    isAuthenticated,
    isLoading,
  };
}