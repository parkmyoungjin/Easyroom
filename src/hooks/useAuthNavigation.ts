// src/hooks/useAuthNavigation.ts

'use client';

import { useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigationController } from '@/hooks/useNavigationController'; // 수정된 컨트롤러를 가져옴
import { useToast } from '@/hooks/use-toast';

export function useAuthNavigation() {
  // ✅ 각 훅에서 필요한 함수와 상태만 가져옵니다.
  const { isAuthenticated, userProfile, isLoading } = useAuth();
  const { redirectToLogin, handlePostLogout: ctrlPostLogout } = useNavigationController();
  const { toast } = useToast();

  /**
   * 인증/권한을 확인하고 페이지를 이동시키는 함수.
   * UI 컴포넌트에서 이 함수를 호출하여 안전하게 페이지를 이동시킬 수 있습니다.
   */
  const navigateWithAuth = useCallback((path: string, options?: {
    requireAdmin?: boolean;
  }) => {
    const { requireAdmin = false } = options || {};

    // 데이터 로딩 중이면 아무것도 하지 않음
    if (isLoading()) {
      return;
    }

    // 1. 로그인이 되어있는가?
    if (!isAuthenticated()) {
      toast({
        title: '로그인이 필요합니다',
        description: '이 기능을 사용하려면 로그인해주세요.',
        variant: 'destructive',
      });
      // 로그인이 안되어 있으면, 컨트롤러에게 로그인 페이지로 보내달라고 요청
      redirectToLogin(path); 
      return;
    }

    // 2. (로그인 된 사용자 대상) 관리자 권한이 필요한가?
    if (requireAdmin && userProfile?.role !== 'admin') {
      toast({
        title: '권한이 없습니다',
        description: '관리자만 접근할 수 있는 페이지입니다.',
        variant: 'destructive',
      });
      // 권한이 없으면 메인 페이지로 보냄 (컨트롤러 직접 호출 대신 router.push 사용도 가능)
      ctrlPostLogout(); // 로그아웃 후 메인으로 가는 로직을 재사용
      return;
    }

    // 모든 조건을 통과하면 해당 경로로 이동
    // 여기서는 컨트롤러를 거치지 않고 직접 router를 사용해도 무방합니다.
    // (useNavigationController에서 router를 export해서 사용하거나, 여기서 직접 useRouter를 사용)
    window.location.href = path; // 가장 확실한 이동 방법

  }, [isAuthenticated, userProfile, isLoading, redirectToLogin, ctrlPostLogout, toast]);


  /**
   * 로그아웃을 처리하고 토스트 메시지를 보여준 뒤, 컨트롤러에게 후속 처리를 위임하는 함수.
   */
  const handlePostLogout = useCallback(() => {
    toast({
      title: '로그아웃 완료',
      description: '안전하게 로그아웃되었습니다.',
    });
    // 컨트롤러의 로그아웃 후처리 함수 호출
    ctrlPostLogout(); 
  }, [ctrlPostLogout, toast]);

  return {
    // ✅ UI 컴포넌트에 제공할 최종 함수들
    navigateWithAuth,
    handlePostLogout,

    // ✅ UI 상태 렌더링에 필요한 정보들
    isAuthenticated: isAuthenticated(),
    isAdmin: userProfile?.role === 'admin',
    isLoading: isLoading(),
    userProfile,
  };
}