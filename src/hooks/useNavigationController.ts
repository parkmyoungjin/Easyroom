// src/hooks/useNavigationController.ts

'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export function useNavigationController() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userProfile } = useAuth(); // 프로필 정보만 가져옵니다.

  /**
   * 로그인 후 리디렉션을 처리하는 유일한 함수.
   * 이 함수가 역할에 따라 어디로 갈지 스스로 결정합니다.
   */
  const handlePostLoginRedirect = useCallback(() => {
    // 서버 사이드 렌더링 중에는 실행되지 않도록 방어
    if (typeof window === 'undefined') return;

    // 리디렉션에 필요한 사용자 프로필이 없으면 아무것도 하지 않음
    if (!userProfile) {
      console.warn('[NavCtrl] Redirect aborted: User profile not available.');
      // 기본 페이지로 보내는 것이 안전할 수 있습니다.
      router.replace('/'); 
      return;
    }

    // 1. URL의 'redirect' 파라미터에서 리디렉션 경로를 가져옵니다.
    const urlRedirectPath = searchParams.get('redirect');

    // 2. 사용자의 역할(role)에 따라 기본 리디렉션 경로를 정합니다.
    const roleBasedPath = userProfile.role === 'admin' ? '/admin/dashboard' : '/';

    // 3. 최종 경로 결정: URL 파라미터가 있으면 그곳으로, 없으면 역할 기반 경로로.
    const finalRedirectPath = urlRedirectPath || roleBasedPath;

    console.log(`[NavCtrl] Redirecting to: ${finalRedirectPath}`);

    // 페이지를 교체하여 뒤로가기 시 로그인 페이지로 돌아가지 않도록 합니다.
    router.replace(finalRedirectPath);

  }, [userProfile, router, searchParams]);


  /**
   * 인증이 필요한 페이지 접근을 시도할 때, 실패하면 로그인 페이지로 보내는 함수.
   * @param requiredPath - 원래 가려던 경로
   */
  const redirectToLogin = useCallback((requiredPath: string) => {
    if (typeof window === 'undefined') return;

    const loginUrl = new URL('/login', window.location.origin);
    // 원래 가려던 경로를 'redirect' 파라미터로 추가합니다.
    loginUrl.searchParams.set('redirect', requiredPath);

    router.push(loginUrl.toString());
  }, [router]);


  /**
   * 로그아웃 후 메인 페이지로 이동시키는 함수.
   */
  const handlePostLogout = useCallback(() => {
    if (typeof window === 'undefined') return;
    router.push('/');
  }, [router]);

  return {
    handlePostLoginRedirect,
    redirectToLogin,
    handlePostLogout,
  };
}