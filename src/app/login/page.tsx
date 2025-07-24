'use client';

import dynamic from 'next/dynamic';
import { useEffect, Suspense } from 'react'; // ✅ Suspense를 react에서 import 합니다.
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


// ✅ 실제 로직을 담고 있는 클라이언트 컴포넌트를 분리합니다.
function LoginContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const { handlePostLoginRedirect } = useNavigationController();

  useEffect(() => {
    if (isLoading()) {
      return;
    }
    if (isAuthenticated()) {
      handlePostLoginRedirect();
    }
  }, [isLoading, isAuthenticated, handlePostLoginRedirect]);

  if (isLoading() || isAuthenticated()) {
    return <LoadingSpinner />;
  }
  
  return <DynamicLoginForm />;
}


// ✅ 최종적으로 export되는 페이지 컴포넌트입니다.
export default function LoginPage() {
  // Suspense로 동적 로직을 담고 있는 컴포넌트를 감싸줍니다.
  // fallback은 LoginContent가 준비되기 전까지 보여줄 UI입니다.
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <LoginContent />
    </Suspense>
  );
}