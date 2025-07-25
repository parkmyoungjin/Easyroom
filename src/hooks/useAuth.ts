// hooks/useAuth.ts (모든 기능 보존 및 모든 오류 수정 최종본)

'use client'

import { useEffect, useState, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { UserMetadata, UserProfile } from '@/types/auth'
import { createAuthId } from '@/types/enhanced-types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true) 
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initializeAuth = async () => {
      setLoading(true);
      const supabase = await createClient();

      const getOrCreateProfile = async (authUser: User): Promise<UserProfile | null> => {
        try {
          const { data: userProfileData, error: selectError } = await supabase
            .from('users').select('*').eq('auth_id', authUser.id).single();
          if (selectError && selectError.code !== 'PGRST116') throw selectError;

          if (userProfileData) {
            return {
              id: userProfileData.auth_id, authId: createAuthId(userProfileData.auth_id), dbId: userProfileData.id,
              employeeId: userProfileData.employee_id, email: userProfileData.email, name: userProfileData.name,
              department: userProfileData.department, role: userProfileData.role,
              createdAt: userProfileData.created_at, updatedAt: userProfileData.updated_at,
            };
          }

          console.log('[DEBUG] Profile not found, attempting to create via RPC...');
          const metadata = authUser.user_metadata as UserMetadata || {};
          const { error: rpcError } = await supabase.rpc('upsert_user_profile', {
            p_auth_id: authUser.id, p_email: authUser.email, p_user_name: metadata.fullName,
            p_user_department: metadata.department, p_user_employee_id: null
          });
          if (rpcError) throw rpcError;
          
          const { data: newUserProfileData, error: finalSelectError } = await supabase
            .from('users').select('*').eq('auth_id', authUser.id).single();
          if (finalSelectError) throw finalSelectError;
          
          return {
            id: newUserProfileData.auth_id, authId: createAuthId(newUserProfileData.auth_id), dbId: newUserProfileData.id,
            employeeId: newUserProfileData.employee_id, email: newUserProfileData.email, name: newUserProfileData.name,
            department: newUserProfileData.department, role: newUserProfileData.role,
            createdAt: newUserProfileData.created_at, updatedAt: newUserProfileData.updated_at,
          };
        } catch (e) {
          console.error("[FATAL] Failed to get or create user profile:", e);
          return null;
        }
      };

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log(`[Auth Listener] Event: ${event}`);
        const authUser = session?.user ?? null;
        if (authUser) {
          const profile = await getOrCreateProfile(authUser);
          if (profile) {
            setUser(authUser); setUserProfile(profile); setAuthStatus('authenticated'); setError(null);
          } else {
            setUser(authUser); setUserProfile(null); setAuthStatus('authenticated'); setError('사용자 프로필을 가져오는 데 실패했습니다.');
          }
        } else {
          setUser(null); setUserProfile(null); setAuthStatus('unauthenticated'); setError(null);
        }
        setLoading(false);
      });

      return () => { subscription.unsubscribe(); };
    };

    let cleanup: (() => void) | undefined;
    initializeAuth().then(cleanupFn => {
      if (typeof cleanupFn === 'function') cleanup = cleanupFn;
    });
    return () => { cleanup?.(); };
  }, []);


  // ✅ [수정된 부분] signIn 함수
  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = await createClient();
    const { withTimeout, DEFAULT_TIMEOUT_CONFIG } = await import('@/lib/utils/auth-timeout');
    const { getAuthErrorHandler } = await import('@/lib/utils/auth-error-handler');

    // 1. 비동기 작업을 별도의 함수(loginOperation)로 정의합니다.
    const loginOperation = async () => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const errorHandler = getAuthErrorHandler();
          errorHandler.handleAuthError(error, { logError: true });
          if (error.message.includes('Email not confirmed')) {
            throw new Error('이메일 인증이 완료되지 않았습니다. 이메일을 확인해주세요.');
          }
          throw error;
        }
        return data;
      } catch (error) {
        const errorHandler = getAuthErrorHandler();
        errorHandler.handleAuthError(error, { logError: true });
        throw error;
      }
    };
    
    // 2. withTimeout에는 함수를 '호출한 결과(Promise)'를 전달합니다.
    return withTimeout(
      loginOperation(), // ✅ ()를 붙여서 함수를 실행하고 그 결과(Promise)를 전달합니다.
      DEFAULT_TIMEOUT_CONFIG.loginTimeout,
      'login_timeout'
    );
  }, []);

  const signOut = useCallback(async () => {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const checkEmailExists = useCallback(async (email: string): Promise<boolean> => {
    const { checkEmailExists: enhancedCheckEmailExists } = await import('@/lib/email-validation/email-validation-service');
    const result = await enhancedCheckEmailExists(email);
    if (result.error) {
      const error = new Error(result.error.message);
      (error as any).type = result.error.type; (error as any).userMessage = result.error.userMessage;
      (error as any).canRetry = result.error.canRetry; (error as any).technicalDetails = result.error.technicalDetails;
      throw error;
    }
    return result.exists;
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string, department: string, role: 'employee' | 'admin' = 'employee') => {
    const supabase = await createClient();
    const userMetadata: Partial<UserMetadata> = { fullName, department, role };
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: userMetadata, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      if (error.message.includes('User already registered')) throw new Error('이미 가입된 이메일입니다. 로그인해주세요.');
      throw error;
    }
    if (!data.user && !error) throw new Error('이미 가입된 이메일입니다. 로그인해주세요.');
    return data;
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      console.error('Magic Link 전송 에러:', error);
      throw error;
    }
  }, []);

  const updateProfile = useCallback(async (updates: Partial<Pick<UserMetadata, 'fullName' | 'department' | 'role'>>) => {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.updateUser({ data: updates });
    if (error) throw error;
    return data;
  }, []); 

  const requireAuth = useCallback((redirectTo?: string) => {
    if (!userProfile) { if (redirectTo) window.location.href = redirectTo; return false; }
    return true;
  }, [userProfile]);

  const hasPermission = useCallback((requiredRole: 'admin' | 'employee') => {
    if (!userProfile) return false;
    if (requiredRole === 'admin') return userProfile.role === 'admin';
    return true;
  }, [userProfile]);

  const isAdmin = useCallback(() => userProfile?.role === 'admin', [userProfile]);
  const isAuthenticated = useCallback(() => authStatus === 'authenticated' && !!userProfile, [authStatus, userProfile]);
  const isLoading = useCallback(() => authStatus === 'loading', [authStatus]);
  const resendEmailConfirmation = useCallback(async (email: string) => {
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
    if (error) throw error;
  }, []);

  const checkEmailConfirmation = useCallback(async () => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return { isConfirmed: !!user?.email_confirmed_at, confirmedAt: user?.email_confirmed_at || null, email: user?.email || null };
  }, []);

  const handlePostLoginRedirect = useCallback(() => {
    console.warn('[useAuth] handlePostLoginRedirect is deprecated.');
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const redirectPath = urlParams.get('redirect');
    window.location.href = redirectPath && redirectPath.startsWith('/') ? redirectPath : '/';
  }, []);

  const redirectToLogin = useCallback((currentPath?: string) => {
    if (typeof window === 'undefined') return;
    const loginUrl = new URL('/login', window.location.origin);
    if (currentPath && currentPath !== '/login') loginUrl.searchParams.set('redirect', currentPath);
    window.location.href = loginUrl.toString();
  }, []);

  const handlePostLogout = useCallback(() => { if (typeof window === 'undefined') return; window.location.href = '/'; }, []);

  const signInWithEmployeeId = useCallback(async (employeeId: string, password: string) => {
    const email = `${employeeId}@company.com`; return signIn(email, password);
  }, [signIn]);

  return {
    user, userProfile, loading, error, authStatus,
    signIn, signInWithMagicLink, signOut, signUp, updateProfile,
    resendEmailConfirmation, checkEmailConfirmation, checkEmailExists,
    signInWithEmployeeId, requireAuth, hasPermission, isAdmin,
    isAuthenticated, isLoading, handlePostLoginRedirect, redirectToLogin,
    handlePostLogout,
  };
}