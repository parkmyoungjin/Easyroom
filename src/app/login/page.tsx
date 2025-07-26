// src/app/login/page.tsx
'use client';

import { Suspense, useEffect } from 'react';
// ✅ useSearchParams 훅을 import 합니다.
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MailCheck } from 'lucide-react';

// --- 로딩 스피너 컴포넌트는 기존과 동일 ---
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      <p className="mt-2 text-gray-600">페이지를 준비 중입니다...</p>
    </div>
  </div>
);

function LoginContent() {
  const router = useRouter();
  // ✅ useSearchParams 훅을 호출하여 URL 파라미터를 읽습니다.
  const searchParams = useSearchParams();
  const { authStatus, userProfile } = useAuth();
  
  // ✅ 'from' 파라미터가 'signup'인지 확인합니다.
  const fromSignup = searchParams.get('from') === 'signup';

  useEffect(() => {
    if (authStatus === 'authenticated' && userProfile) {
      console.log('[LoginPage] Authenticated! Redirecting to /');
      router.replace('/'); // ✅ window.location.href 대신 router.replace 사용
    }
  }, [authStatus, userProfile, router]);

  // 로딩 중이거나 이미 로그인된 상태면 스피너를 보여줍니다.
  if (authStatus === 'loading' || (authStatus === 'authenticated' && userProfile)) {
    return <LoadingSpinner />;
  }
  
  return (
    // ✅ 전체 구조를 감싸서 Alert 메시지를 LoginForm 위에 배치할 수 있도록 합니다.
    <div className="flex flex-col items-center justify-center min-h-screen">
      {/* ✅ 회원가입 직후에만 보이는 환영 메시지 */}
      {fromSignup && (
        <div className="w-full max-w-md mb-6">
          <Alert variant="default" className="border-green-500 bg-green-50 dark:bg-green-900/20">
            <MailCheck className="h-5 w-5 text-green-600" />
            <AlertTitle className="font-bold text-green-700">회원가입 완료!</AlertTitle>
            <AlertDescription className="text-green-600">
              인증 메일이 발송되었습니다. 메일함을 확인하여 로그인을 완료해주세요.
            </AlertDescription>
          </Alert>
        </div>
      )}
      <LoginForm />
    </div>
  );
}

// Suspense로 감싸야 useSearchParams를 사용할 수 있습니다.
export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <LoginContent />
    </Suspense>
  );
}