'use client'

import { useEffect, useState, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { UserMetadata, UserProfile } from '@/types/auth'
import { 
  shouldDetectAuthStateChange, 
  isAuthCallbackPage, 
  logAuthNavigationState 
} from '@/lib/utils/auth-navigation'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading')

  // 📝 user_metadata에서 프로필 생성 (이메일 기반)
  const createUserProfile = useCallback(async (authUser: User): Promise<UserProfile> => {
    const metadata = authUser.user_metadata as UserMetadata || {}
    
    // 기본 프로필 생성
    const baseProfile: UserProfile = {
      id: authUser.id,
      authId: authUser.id,
      employeeId: undefined, // 선택사항으로 변경
      email: authUser.email || '',
      name: metadata.fullName || '',
      department: metadata.department || '',
      role: metadata.role || 'employee',
      createdAt: authUser.created_at || '',
      updatedAt: authUser.updated_at
    }

    // 데이터베이스에서 사용자 정보 조회 및 생성
    try {
      const supabase = createClient();
      const { data: userData, error } = await supabase
        .from('users')
        .select('id, employee_id')
        .eq('auth_id', authUser.id)
        .single();

      if (!error && userData) {
        baseProfile.dbId = userData.id;
        baseProfile.employeeId = userData.employee_id || undefined;
      } else if (error?.code === 'PGRST116') {
        // 사용자 프로필이 없으면 생성 (이메일 인증 완료 후)
        if (authUser.email_confirmed_at && metadata.fullName && metadata.department) {
          const { data: newUser, error: createError } = await supabase
            .rpc('create_user_profile', {
              user_auth_id: authUser.id,
              user_email: authUser.email,
              user_name: metadata.fullName,
              user_department: metadata.department
            });

          if (!createError && newUser) {
            baseProfile.dbId = newUser;
          } else {
            console.warn('사용자 프로필 생성 실패:', createError);
          }
        }
      } else {
        console.warn('데이터베이스 사용자 조회 실패:', error);
      }
    } catch (error) {
      console.warn('데이터베이스 사용자 조회 중 오류:', error);
    }

    return baseProfile;
  }, [])

  // 세션 초기화
  const initializeAuth = useCallback(async () => {
    if (initialized) return;
    
    try {
      setError(null);
      const supabase = createClient();
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Auth session error:', error);
        setError(error.message);
        setUser(null);
        setUserProfile(null);
        setAuthStatus('unauthenticated');
      } else {
        const authUser = session?.user ?? null;
        setUser(authUser);
        setUserProfile(authUser ? await createUserProfile(authUser) : null);
        setAuthStatus(authUser ? 'authenticated' : 'unauthenticated');
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      setError(error instanceof Error ? error.message : 'Authentication initialization failed');
      setUser(null);
      setUserProfile(null);
      setAuthStatus('unauthenticated');
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [initialized, createUserProfile]);

  useEffect(() => {
    initializeAuth();

    const supabase = createClient();
    
    // 인증 상태 변경 리스너
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const authUser = session?.user ?? null;
      
      // 현재 페이지에서 인증 상태 변경 감지가 허용되는지 확인
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        
        // 콜백 페이지에서는 인증 상태 변경을 무시 (리디렉션 방지)
        if (isAuthCallbackPage(currentPath)) {
          console.log('Auth state change ignored on callback page');
          return;
        }
        
        // 인증 상태 변경 감지가 비활성화된 페이지에서는 무시
        if (!shouldDetectAuthStateChange(currentPath)) {
          console.log(`Auth state change ignored on ${currentPath} (policy disabled)`);
          return;
        }
        
        // 디버깅을 위한 네비게이션 상태 로깅
        logAuthNavigationState(currentPath);
      }
      
      setUser(authUser);
      setUserProfile(authUser ? await createUserProfile(authUser) : null);
      setAuthStatus(authUser ? 'authenticated' : 'unauthenticated');
      setLoading(false);
      setError(null);

      // 리디렉션 로직 제거 - 각 페이지에서 직접 처리
    });

    return () => subscription.unsubscribe();
  }, [createUserProfile, initializeAuth]);

  // 로그인 함수 (이메일 기반, 리디렉션 없음)
  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = createClient();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // 이메일 미인증 상태 체크
      if (error.message.includes('Email not confirmed')) {
        throw new Error('이메일 인증이 완료되지 않았습니다. 이메일을 확인해주세요.');
      }
      throw error;
    }

    return data;
  }, []);

  // 로그아웃 함수 (리디렉션 없음)
  const signOut = useCallback(async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    // 리디렉션은 호출하는 곳에서 처리
  }, []);

  // 이메일 중복 체크 함수
  const checkEmailExists = useCallback(async (email: string): Promise<boolean> => {
    const supabase = createClient();
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();
    
    return !!data; // 데이터가 있으면 true, 없으면 false
  }, []);



  // 회원가입 함수 (이메일 기반)
  const signUp = useCallback(async (
    email: string,
    password: string,
    fullName: string, 
    department: string, 
    role: 'employee' | 'admin' = 'employee'
  ) => {
    const supabase = createClient();
    
    const userMetadata: UserMetadata = {
      fullName,
      department,
      role,
    };
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userMetadata,
        emailRedirectTo: `${window.location.origin}/auth/callback`
      },
    });

    if (error) {
      // 이미 가입된 이메일인 경우 특별 처리
      if (error.message.includes('User already registered')) {
        throw new Error('이미 가입된 이메일입니다. 로그인해주세요.');
      }
      throw error;
    }

    // 회원가입 성공했지만 user가 없으면 이미 가입된 이메일일 가능성
    if (!data.user && !error) {
      throw new Error('이미 가입된 이메일입니다. 로그인해주세요.');
    }

    return data;
  }, []);

  // 프로필 업데이트 함수
  const updateProfile = useCallback(async (updates: Partial<Pick<UserMetadata, 'fullName' | 'department' | 'role'>>) => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.updateUser({
      data: updates
    });

    if (error) {
      throw error;
    }

    if (data.user) {
      setUser(data.user);
      setUserProfile(await createUserProfile(data.user));
    }

    return data;
  }, [createUserProfile]);

  // 프로그래밍 방식 인증 확인 함수
  const requireAuth = useCallback((redirectTo?: string) => {
    if (!userProfile) {
      if (redirectTo) {
        window.location.href = redirectTo;
      }
      return false;
    }
    return true;
  }, [userProfile]);

  // 사용자 권한 확인 함수
  const hasPermission = useCallback((requiredRole: 'admin' | 'employee') => {
    if (!userProfile) return false;
    if (requiredRole === 'admin') {
      return userProfile.role === 'admin';
    }
    return true; // employee 권한은 모든 인증된 사용자가 가짐
  }, [userProfile]);

  // 관리자 권한 확인 함수
  const isAdmin = useCallback(() => {
    return userProfile?.role === 'admin';
  }, [userProfile]);

  // 인증 상태 확인 함수
  const isAuthenticated = useCallback(() => {
    return authStatus === 'authenticated' && !!userProfile;
  }, [authStatus, userProfile]);

  // 로딩 상태 확인 함수
  const isLoading = useCallback(() => {
    return authStatus === 'loading' || loading;
  }, [authStatus, loading]);

  // 이메일 인증 관련 함수들
  const resendEmailConfirmation = useCallback(async (email: string) => {
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) {
      throw error;
    }
  }, []);

  const checkEmailConfirmation = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    return {
      isConfirmed: !!user?.email_confirmed_at,
      confirmedAt: user?.email_confirmed_at || null,
      email: user?.email || null
    };
  }, []);

  // 기존 호환성을 위한 래퍼 함수들 (사번 기반 → 이메일 기반 변환)
  const signInWithEmployeeId = useCallback(async (employeeId: string, password: string) => {
    // 기존 사번 기반 로그인을 이메일 기반으로 변환
    const email = `${employeeId}@company.com`;
    return signIn(email, password);
  }, [signIn]);

  const signUpWithEmployeeId = useCallback(async (
    employeeId: string, 
    fullName: string, 
    department: string, 
    role: 'employee' | 'admin' = 'employee'
  ) => {
    // 기존 사번 기반 회원가입을 이메일 기반으로 변환
    const email = `${employeeId}@company.com`;
    const password = `pnuh${employeeId}`;
    return signUp(email, password, fullName, department, role);
  }, [signUp]);

  return {
    // 기본 상태
    user,
    userProfile,
    loading,
    error,
    authStatus,
    
    // 인증 함수 (이메일 기반)
    signIn,
    signOut,
    signUp,
    updateProfile,
    
    // 이메일 인증 관련 함수
    resendEmailConfirmation,
    checkEmailConfirmation,
    checkEmailExists,
    
    // 기존 호환성 함수 (사번 기반)
    signInWithEmployeeId,
    signUpWithEmployeeId,
    
    // 유틸리티 함수
    requireAuth,
    hasPermission,
    isAdmin,
    isAuthenticated,
    isLoading,
  };
}
