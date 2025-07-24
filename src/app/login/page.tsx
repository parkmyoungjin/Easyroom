'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigationController } from '@/hooks/useNavigationController';

// 로딩 스피너 컴포넌트는 그대로 유지
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      <p className="mt-2 text-gray-600">페이지를 준비 중입니다...</p>
    </div>
  </div>
);

// 동적 로딩도 그대로 유지
const DynamicLoginForm = dynamic(
  () => import('@/features/auth/components/LoginForm').then(mod => mod.LoginForm),
  {
    ssr: false,
    loading: () => <LoadingSpinner />,
  }
);

export default function LoginPage() {
  // ✅ 1. 필요한 훅과 상태, 함수를 명확하게 가져옵니다.
  const { isAuthenticated, isLoading } = useAuth();
  const { handlePostLoginRedirect } = useNavigationController();

  // ✅ 2. useEffect 로직을 단순화합니다.
  // 이 효과는 "인증 상태가 변경될 때마다" 실행됩니다.
  useEffect(() => {
    // 아직 인증 상태를 확인 중이면 아무것도 하지 않습니다.
    if (isLoading()) {
      return;
    }

    // 로딩이 끝났는데, 사용자가 로그인 상태라면?
    if (isAuthenticated()) {
      // 컨트롤러에게 "로그인 후 리디렉션 처리해줘"라고 요청합니다.
      handlePostLoginRedirect();
    }
  }, [isLoading, isAuthenticated, handlePostLoginRedirect]);


  // ✅ 3. 렌더링 조건을 단순화합니다.
  // 로딩 중이거나, 이미 로그인되어서 리디렉션이 곧 일어날 상태라면 스피너를 보여줍니다.
  if (isLoading() || isAuthenticated()) {
    return <LoadingSpinner />;
  }
  
  // ✅ 4. 위 모든 조건에 해당하지 않는 경우 (로딩이 끝났고, 비로그인 상태)에만 폼을 보여줍니다.
  return <DynamicLoginForm />;
}