'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useCallback } from 'react';

export function useAuthNavigation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userProfile, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  // 인증이 필요한 페이지로 이동
  const navigateWithAuth = useCallback((path: string, options?: {
    requireAuth?: boolean;
    requireAdmin?: boolean;
    fallbackPath?: string;
    showToast?: boolean;
  }) => {
    const {
      requireAuth = true,
      requireAdmin = false,
      fallbackPath = '/login',
      showToast = true
    } = options || {};

    // 로딩 중이면 대기
    if (isLoading()) {
      return;
    }

    // 인증이 필요한 경우
    if (requireAuth && !isAuthenticated()) {
      if (showToast) {
        toast({
          title: '로그인이 필요합니다',
          description: '이 기능을 사용하려면 로그인해주세요.',
          variant: 'destructive',
        });
      }
      
      // 원래 경로를 쿼리 파라미터로 저장
      const loginUrl = new URL(fallbackPath, window.location.origin);
      loginUrl.searchParams.set('redirect', path);
      router.push(loginUrl.toString());
      return;
    }

    // 관리자 권한이 필요한 경우
    if (requireAdmin && userProfile?.role !== 'admin') {
      if (showToast) {
        toast({
          title: '권한이 없습니다',
          description: '관리자만 접근할 수 있는 페이지입니다.',
          variant: 'destructive',
        });
      }
      router.push('/');
      return;
    }

    // 정상적으로 이동
    router.push(path);
  }, [router, userProfile, isAuthenticated, isLoading, toast]);

  // 로그인 후 리디렉션 처리
  const handlePostLoginRedirect = useCallback(() => {
    // Client-side only execution to avoid SSR issues
    if (typeof window === 'undefined') return;
    
    const redirectPath = searchParams.get('redirect');
    if (redirectPath && redirectPath.startsWith('/')) {
      router.push(redirectPath);
    } else {
      router.push('/'); // 메인 페이지로 리디렉션 (dashboard 대신)
    }
  }, [router, searchParams]);

  // 로그아웃 후 처리
  const handlePostLogout = useCallback((showToast = true) => {
    if (showToast) {
      toast({
        title: '로그아웃 완료',
        description: '안전하게 로그아웃되었습니다.',
      });
    }
    router.push('/');
  }, [router, toast]);

  // 인증 상태에 따른 조건부 네비게이션
  const getNavigationOptions = useCallback(() => {
    return {
      canAccessReservations: isAuthenticated(),
      canAccessAdmin: userProfile?.role === 'admin',
      canAccessMyReservations: isAuthenticated(),
      showAuthPrompts: !isAuthenticated(),
      isLoading: isLoading()
    };
  }, [userProfile, isAuthenticated, isLoading]);

  return {
    navigateWithAuth,
    handlePostLoginRedirect,
    handlePostLogout,
    getNavigationOptions,
    isAuthenticated: isAuthenticated(),
    isAdmin: userProfile?.role === 'admin',
    isLoading: isLoading(),
    userProfile
  };
}