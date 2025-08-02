// src/hooks/useAuth.ts
'use client';

import { useCallback } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
import type { UserMetadata } from '@/types/auth';

// ============================================================================
// SIMPLIFIED ERROR HANDLING - Let auth-helpers handle complexity
// ============================================================================

// Simple error categorization function for auth operations
const categorizeAuthOperationError = (error: unknown): {
  type: 'network' | 'auth' | 'unknown';
  message: string;
} => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();
  
  // Log error for debugging without exposing sensitive data
  console.error('[useAuth] Operation error:', {
    type: error instanceof Error ? error.constructor.name : typeof error,
    message: errorMessage,
    timestamp: new Date().toISOString(),
    // Don't log stack traces or sensitive data in production
    ...(process.env.NODE_ENV === 'development' && { 
      stack: error instanceof Error ? error.stack : undefined 
    })
  });
  
  // Network errors
  if (lowerMessage.includes('network') || 
      lowerMessage.includes('fetch') || 
      lowerMessage.includes('timeout') ||
      lowerMessage.includes('connection') ||
      lowerMessage.includes('offline')) {
    return {
      type: 'network',
      message: '네트워크 연결을 확인해주세요'
    };
  }
  
  // Authentication errors
  if (lowerMessage.includes('auth') || 
      lowerMessage.includes('invalid') ||
      lowerMessage.includes('expired') ||
      lowerMessage.includes('unauthorized') ||
      lowerMessage.includes('user not found') ||
      lowerMessage.includes('already registered') ||
      lowerMessage.includes('rate limit') ||
      lowerMessage.includes('otp')) {
    return {
      type: 'auth',
      message: errorMessage // Use original message for auth errors as they're usually user-friendly
    };
  }
  
  return {
    type: 'unknown',
    message: '알 수 없는 오류가 발생했습니다'
  };
};

export function useAuth() {
  const { 
    user, 
    userProfile, 
    authStatus
  } = useAuthContext();
  const supabase = useSupabaseClient(); // Use centralized client from SupabaseProvider

  const isAdmin = useCallback(() => userProfile?.role === 'admin', [userProfile]);
  const isAuthenticated = useCallback(() => authStatus === 'authenticated' && !!userProfile, [authStatus, userProfile]);
  const isLoading = useCallback(() => authStatus === 'loading' || !supabase, [authStatus, supabase]);

  /**
   * Magic Link로 로그인을 요청합니다 (가입된 사용자만)
   * Simplified: Uses standard auth-helpers pattern without custom session handling
   */
  const signInWithMagicLink = useCallback(async (email: string) => {
    if (!supabase) {
      throw new Error('인증 서비스가 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: false, // 이미 가입된 사용자만 로그인
      },
    });

    if (error) {
      console.error('Magic Link 로그인 에러:', error);
      throw error;
    }

    // Simplified: Let onAuthStateChange handle all session management
    console.log('[useAuth] Magic Link sent, onAuthStateChange will handle session updates');
  }, [supabase]);

  /**
   * 이메일 기반 즉시 회원가입 (Magic Link 없이)
   */
  const signUpDirectly = useCallback(async (email: string, fullName: string, department: string) => {
    if (!supabase) throw new Error('인증 서비스가 준비되지 않았습니다.');

    // 1. API 라우트를 통해 이메일 중복 확인
    try {
      const checkResponse = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      if (checkResponse.ok) {
        const { exists } = await checkResponse.json();
        if (exists) {
          throw new Error('이미 가입된 이메일입니다. 로그인을 시도해주세요.');
        }
      }
      // API 에러가 있어도 계속 진행 (Supabase Auth에서 최종 확인)
    } catch (fetchError) {
      // 네트워크 에러나 API 에러는 무시하고 계속 진행
      console.warn('Email check API failed, proceeding with signup:', fetchError);
    }

    // 2. Supabase Auth에 임시 비밀번호로 회원가입 (바로 확인됨)
    const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'; // 복잡한 임시 비밀번호
    const userMetadata: UserMetadata = { fullName, department, role: 'employee' };
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password: tempPassword,
      options: {
        data: userMetadata,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      }
    });

    if (error) {
      console.error('회원가입 에러:', error);
      
      if (error.message.includes('User already registered') || 
          error.message.includes('already been registered')) {
        throw new Error('이미 가입된 이메일입니다. 로그인을 시도해주세요.');
      }
      
      if (error.message.includes('invalid') && error.message.includes('email')) {
        throw new Error('올바른 이메일 주소를 입력해주세요.');
      }
      
      throw error;
    }

    // 3. 즉시 로그아웃 (비밀번호 로그인 방지)
    await supabase.auth.signOut();
    
    return data;
  }, [supabase]);

  /**
   * 로그아웃합니다.
   * Simplified: Uses standard auth-helpers pattern without custom cookie clearing
   */
  const signOut = useCallback(async () => {
    if (!supabase) return;
    
    console.log('[useAuth] Starting logout process');
    
    try {
      // Simplified: Use standard signOut - auth-helpers handles all cookie management
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('[useAuth] Logout error:', error);
        throw error;
      }

      // Simplified: Let onAuthStateChange handle all session cleanup
      // No manual cookie or storage clearing needed - auth-helpers handles this
      console.log('[useAuth] Logout completed, onAuthStateChange will handle cleanup');
    } catch (error) {
      console.error('[useAuth] Logout failed:', error);
      throw error;
    }
  }, [supabase]);

  /**
   * Magic Link를 재전송합니다
   * Simplified: Uses standard auth-helpers pattern
   */
  const resendMagicLink = useCallback(async (email: string) => {
    if (!supabase) throw new Error('인증 서비스가 준비되지 않았습니다.');
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: false, // 기존 사용자만
      },
    });
    if (error) throw error;
    
    // Simplified: Let onAuthStateChange handle session updates
    console.log('[useAuth] Magic Link resent, onAuthStateChange will handle session updates');
  }, [supabase]);

  /**
   * OTP 코드를 요청합니다 (6자리 숫자 코드)
   * Simplified: Let auth-helpers handle retries and complex error recovery
   */
  const requestOTP = useCallback(async (email: string) => {
    if (!supabase) {
      throw new Error('인증 서비스가 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // 기존 사용자만 로그인 가능
      },
    });

    if (error) {
      console.error('[useAuth] OTP request error:', error);
      
      // Simple error categorization for logging
      const categorizedError = categorizeAuthOperationError(error);
      console.error('[useAuth] OTP request failed:', categorizedError);
      
      // Simple user-friendly error messages - let auth-helpers handle retries
      if (error.message.toLowerCase().includes('user not found') || 
          error.message.toLowerCase().includes('invalid login credentials')) {
        throw new Error('등록되지 않은 이메일입니다. 회원가입을 먼저 진행해주세요.');
      }
      
      if (error.message.toLowerCase().includes('email rate limit exceeded') ||
          error.message.toLowerCase().includes('rate limit')) {
        throw new Error('너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
      
      if (error.message.toLowerCase().includes('invalid') && error.message.toLowerCase().includes('email')) {
        throw new Error('올바른 이메일 주소를 입력해주세요.');
      }
      
      // For all other errors, throw as-is - auth-helpers will handle retries
      throw error;
    }
    
    console.log('[useAuth] OTP request successful');
  }, [supabase]);

  /**
   * OTP 코드를 검증하고 로그인합니다
   * Simplified: Uses standard auth-helpers pattern, relies on onAuthStateChange for session management
   */
  const verifyOTP = useCallback(async (email: string, token: string) => {
    if (!supabase) {
      throw new Error('인증 서비스가 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }

    // Simple OTP format validation (6-digit numbers)
    if (!/^\d{6}$/.test(token)) {
      throw new Error('OTP 코드는 6자리 숫자여야 합니다.');
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (error) {
      console.error('[useAuth] OTP verification error:', error);
      
      // Simple error categorization for logging
      const categorizedError = categorizeAuthOperationError(error);
      console.error('[useAuth] OTP verification failed:', categorizedError);
      
      // Simple user-friendly error messages - let auth-helpers handle retries
      if (error.message.toLowerCase().includes('invalid token') || 
          error.message.toLowerCase().includes('token has expired') ||
          error.message.toLowerCase().includes('invalid_otp')) {
        throw new Error('잘못된 OTP 코드이거나 만료된 코드입니다. 새로운 코드를 요청해주세요.');
      }
      
      if (error.message.toLowerCase().includes('email rate limit exceeded') ||
          error.message.toLowerCase().includes('rate limit')) {
        throw new Error('너무 많은 시도가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }

      if (error.message.toLowerCase().includes('user not found')) {
        throw new Error('등록되지 않은 이메일입니다. 회원가입을 먼저 진행해주세요.');
      }
      
      // For all other errors, throw as-is - auth-helpers will handle retries
      throw error;
    }

    if (!data.session || !data.user) {
      throw new Error('로그인에 실패했습니다. 다시 시도해주세요.');
    }

    // Simplified: Let onAuthStateChange handle all session management
    console.log('[useAuth] OTP verification successful, onAuthStateChange will handle session');
    
    return data;
  }, [supabase]);


  return {
    user,
    userProfile,
    authStatus,
    loading: isLoading(),
    signInWithMagicLink,
    signUpDirectly,
    signOut,
    resendMagicLink,
    requestOTP,
    verifyOTP,
    isAdmin,
    isAuthenticated,
    isLoading,
  };
}