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

  // createUserProfile 함수는 변경 없이 그대로 유지합니다.
  const createUserProfile = useCallback(async (authUser: User): Promise<UserProfile> => {
    console.log('[DEBUG] createUserProfile 시작. 사용자:', authUser.email);
    const metadata = authUser.user_metadata as UserMetadata || {};

    try {
      const supabase = await createClient();

      console.log('[DEBUG] 1단계: upsert_user_profile RPC 호출 시도...');
      const { error: rpcError } = await supabase.rpc('upsert_user_profile', {
        p_auth_id: authUser.id,
        p_email: authUser.email,
        p_user_name: metadata.fullName,
        p_user_department: metadata.department,
        p_user_employee_id: null
      });

      if (rpcError) {
        console.error('[ERROR] 1-1단계: upsert_user_profile RPC 실패!', rpcError);
        throw rpcError;
      }
      console.log('[DEBUG] 1단계: RPC 호출 성공.');

      console.log('[DEBUG] 2단계: users 테이블에서 프로필 조회 시도...');
      const { data: userProfileData, error: selectError } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authUser.id)
        .single();

      if (selectError) {
        console.error('[ERROR] 2-1단계: 프로필 조회 실패!', selectError);
        throw selectError;
      }
      console.log('[DEBUG] 2단계: 프로필 조회 성공. 데이터:', userProfileData);

      if (!userProfileData) {
        throw new Error('프로필 조회 후 데이터가 null입니다.');
      }

      const finalProfile: UserProfile = {
        id: userProfileData.auth_id,
        authId: createAuthId(userProfileData.auth_id),
        dbId: userProfileData.id,
        employeeId: userProfileData.employee_id,
        email: userProfileData.email,
        name: userProfileData.name,
        department: userProfileData.department,
        role: userProfileData.role,
        createdAt: userProfileData.created_at,
        updatedAt: userProfileData.updated_at,
      };
    
      console.log('[DEBUG] 3단계: UserProfile 객체 생성 성공.');
      return finalProfile;

    } catch (error) {
      console.error('[FATAL] createUserProfile 함수 내 최종 에러:', error);
      throw new Error(`createUserProfile failed: ${JSON.stringify(error)}`);
    }
  }, []);


  // ==================================================================
  // ✅✅✅ useEffect 로직 개선안 ✅✅✅
  // ==================================================================
  useEffect(() => {
    // 로딩 상태 시작
    setAuthStatus('loading');
    setLoading(true);

    let authListener: { unsubscribe: () => void; } | null = null;

    const setupAuthListener = async () => {
      const supabase = await createClient();
      
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log(`[Auth Listener] Event: ${event}`);
        const authUser = session?.user ?? null;

        // ✅ 리스너 로직 개선: session 객체의 존재 여부로 상태를 결정합니다.
        // 이렇게 하면 SIGNED_IN, TOKEN_REFRESHED, INITIAL_SESSION을 모두 포괄합니다.
        if (session && authUser) {
          console.log(`[Auth Listener] 인증 상태 업데이트 필요. 사용자: ${authUser.email}`);
          try {
            // ✅ 상태 업데이트 로직을 별도 함수로 분리하여 재사용성을 높입니다.
            await updateUserState(authUser);
          } catch (profileError) {
            console.error('[Auth Listener] 프로필 생성/갱신 실패:', profileError);
            setUser(authUser);
            setUserProfile(null);
            setAuthStatus('authenticated');
            setError('사용자 프로필을 불러오는 데 실패했습니다.');
          }
        } else {
          // session이 없으면 로그아웃 상태입니다.
          setUser(null);
          setUserProfile(null);
          setAuthStatus('unauthenticated');
          console.log('[Auth Listener] 비인증 상태로 설정.');
        }
        
        setLoading(false);
      });

      authListener = data.subscription;
    };

    setupAuthListener();

    // ✅ 컴포넌트가 언마운트될 때 리스너를 확실하게 정리합니다.
    return () => {
      authListener?.unsubscribe();
    };
  }, [createUserProfile]); // ✅ 의존성 배열을 유지합니다. (수정)

  // ✅ 상태 업데이트 로직을 함수로 분리 (가독성 및 재사용성 향상)
  const updateUserState = useCallback(async (authUser: User) => {
    const profile = await createUserProfile(authUser);
    setUser(authUser);
    setUserProfile(profile);
    setAuthStatus('authenticated');
    console.log('[Auth] 상태 업데이트 완료.');
  }, [createUserProfile]);


  // (이하 나머지 함수들은 이전과 동일하게 유지합니다.)
    const signIn = useCallback(async (email: string, password: string) => {
    const supabase = await createClient();
    const { withTimeout, DEFAULT_TIMEOUT_CONFIG } = await import('@/lib/utils/auth-timeout');
    const { getAuthErrorHandler } = await import('@/lib/utils/auth-error-handler');
    
    const loginOperation = async () => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

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

    return withTimeout(
      loginOperation(),
      DEFAULT_TIMEOUT_CONFIG.loginTimeout,
      'login_timeout'
    );
  }, []);

  const signOut = useCallback(async () => {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  }, []);

  const checkEmailExists = useCallback(async (email: string): Promise<boolean> => {
    const { checkEmailExists: enhancedCheckEmailExists } = await import('@/lib/email-validation/email-validation-service');
    const result = await enhancedCheckEmailExists(email);
    
    if (result.error) {
      const error = new Error(result.error.message);
      (error as any).type = result.error.type;
      (error as any).userMessage = result.error.userMessage;
      (error as any).canRetry = result.error.canRetry;
      (error as any).technicalDetails = result.error.technicalDetails;
      throw error;
    }
    return result.exists;
  }, []);

  const signUp = useCallback(async (
    email: string,
    password: string,
    fullName: string, 
    department: string, 
    role: 'employee' | 'admin' = 'employee'
  ) => {
    const supabase = await createClient();
    const userMetadata: Partial<UserMetadata> = { fullName, department, role };
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userMetadata,
        emailRedirectTo: `${window.location.origin}/auth/callback`
      },
    });

    if (error) {
      if (error.message.includes('User already registered')) {
        throw new Error('이미 가입된 이메일입니다. 로그인해주세요.');
      }
      throw error;
    }

    if (!data.user && !error) {
      throw new Error('이미 가입된 이메일입니다. 로그인해주세요.');
    }
    return data;
  }, []);

  const updateProfile = useCallback(async (updates: Partial<Pick<UserMetadata, 'fullName' | 'department' | 'role'>>) => {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.updateUser({ data: updates });

    if (error) throw error;

    if (data.user) {
      // ✅ 사용자 정보 업데이트 시, updateUserState 함수를 재사용합니다.
      await updateUserState(data.user);
    }
    return data;
  }, [updateUserState]); // ✅ 의존성 배열에 updateUserState 추가
  
    const requireAuth = useCallback((redirectTo?: string) => {
    if (!userProfile) {
      if (redirectTo) window.location.href = redirectTo;
      return false;
    }
    return true;
  }, [userProfile]);

  const hasPermission = useCallback((requiredRole: 'admin' | 'employee') => {
    if (!userProfile) return false;
    if (requiredRole === 'admin') return userProfile.role === 'admin';
    return true;
  }, [userProfile]);

  const isAdmin = useCallback(() => {
    return userProfile?.role === 'admin';
  }, [userProfile]);

  const isAuthenticated = useCallback(() => {
    return authStatus === 'authenticated' && !!userProfile;
  }, [authStatus, userProfile]);

  const isLoading = useCallback(() => {
    return authStatus === 'loading' || loading;
  }, [authStatus, loading]);

  const resendEmailConfirmation = useCallback(async (email: string) => {
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    });
    if (error) throw error;
  }, []);

  const checkEmailConfirmation = useCallback(async () => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return {
      isConfirmed: !!user?.email_confirmed_at,
      confirmedAt: user?.email_confirmed_at || null,
      email: user?.email || null
    };
  }, []);

  const handlePostLoginRedirect = useCallback(() => {
    console.warn('[useAuth] handlePostLoginRedirect is deprecated. Use NavigationController instead.');
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const redirectPath = urlParams.get('redirect');
    window.location.href = redirectPath && redirectPath.startsWith('/') ? redirectPath : '/';
  }, []);

  const redirectToLogin = useCallback((currentPath?: string) => {
    if (typeof window === 'undefined') return;
    const loginUrl = new URL('/login', window.location.origin);
    if (currentPath && currentPath !== '/login') {
      loginUrl.searchParams.set('redirect', currentPath);
    }
    window.location.href = loginUrl.toString();
  }, []);

  const handlePostLogout = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.location.href = '/';
  }, []);

  const signInWithEmployeeId = useCallback(async (employeeId: string, password: string) => {
    const email = `${employeeId}@company.com`;
    return signIn(email, password);
  }, [signIn]);

  return {
    user,
    userProfile,
    loading,
    error,
    authStatus,
    signIn,
    signOut,
    signUp,
    updateProfile,
    resendEmailConfirmation,
    checkEmailConfirmation,
    checkEmailExists,
    signInWithEmployeeId,
    requireAuth,
    hasPermission,
    isAdmin,
    isAuthenticated,
    isLoading,
    handlePostLoginRedirect,
    redirectToLogin,
    handlePostLogout,
  };
}