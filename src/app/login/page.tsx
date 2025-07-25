// /app/login/page.tsx  <- 이 파일의 내용을 아래 코드로 교체하세요.

'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { OptimizedAuthSystem } from '@/lib/auth/optimized-auth-system';

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      <p className="mt-2 text-gray-600">페이지를 준비 중입니다...</p>
    </div>
  </div>
);

const DynamicLoginForm = dynamic(
  () => import('@/features/auth/components/LoginForm').then(mod => mod.LoginForm),
  { ssr: false, loading: () => <LoadingSpinner /> }
);


function LoginContent() {
  const { authStatus, userProfile } = useAuth();

  // ✅ [핵심 로직] 다른 탭에서 오는 '인증 성공' 메시지를 수신 대기합니다.
  useEffect(() => {
    // 메시지를 받았을 때 실행할 동작을 정의합니다.
    const handleAuthSuccess = () => {
      console.log('다른 탭의 인증 성공 신호를 감지했습니다. 페이지를 새로고침하여 로그인 상태를 갱신합니다.');
      // 페이지를 강제로 새로고침하여, 서버로부터 최신 세션(쿠키)을 받아오고,
      // useAuth 훅이 새로운 상태를 완전히 새로 그리도록 합니다.
      window.location.href = '/';
    };

    // 새로운 최적화된 인증 시스템을 사용합니다.
    const authSystem = new OptimizedAuthSystem();
    const cleanup = authSystem.listenForAuthSuccess(handleAuthSuccess);

    // 컴포넌트가 사라질 때(페이지를 떠날 때) 리스너를 정리합니다.
    return cleanup;
  }, []); // 빈 의존성 배열로, 페이지 로드 시 단 한 번만 실행되도록 합니다.


  // 이 로직은 유지합니다: 이미 로그인한 사용자가 실수로 이 페이지에 접근하면 메인으로 보냅니다.
  useEffect(() => {
    // authStatus와 userProfile 상태값을 직접 사용하여 무한 루프를 방지합니다.
    if (authStatus === 'authenticated' && userProfile) {
      window.location.href = '/';
    }
  }, [authStatus, userProfile]);


  if (authStatus === 'loading' || (authStatus === 'authenticated' && userProfile)) {
    return <LoadingSpinner />;
  }
  
  return <DynamicLoginForm />;
}


export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <LoginContent />
    </Suspense>
  );
}