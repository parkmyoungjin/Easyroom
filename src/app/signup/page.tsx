'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation'; // next/router 대신 next/navigation 사용
import { useAuth } from '@/hooks/useAuth';
import { SignupForm } from '@/features/auth/components/SignupForm';

// 로딩 스피너 (login 페이지와 동일)
const LoadingSpinner = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">페이지를 준비 중입니다...</p>
      </div>
    </div>
);

export default function SignupPage() {
  const { authStatus } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // ✅ 이미 로그인된 사용자는 메인 페이지로 보냅니다.
    if (authStatus === 'authenticated') {
      router.replace('/'); // history에 남기지 않고 이동
    }
  }, [authStatus, router]);

  // 인증 상태 확인 중이거나, 이미 인증된 상태면 로딩을 보여줍니다.
  if (authStatus === 'loading' || authStatus === 'authenticated') {
    return <LoadingSpinner />;
  }

  // 로그인되지 않은 사용자만 회원가입 폼을 봅니다.
  return <SignupForm />;
}