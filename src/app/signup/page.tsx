'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useAuthContext } from '@/contexts/AuthContext';
import { useSupabase } from '@/contexts/SupabaseProvider';
import { SignupForm } from '@/features/auth/components/SignupForm';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// 개선된 로딩 스피너
const LoadingSpinner = ({ message = "인증 상태 확인 중..." }: { message?: string }) => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">{message}</p>
      </div>
    </div>
);

export default function SignupPage() {
  const { authStatus } = useAuth();

  const router = useRouter();



  useEffect(() => {
    // 이미 로그인된 사용자는 메인 페이지로 보냅니다.
    if (authStatus === 'authenticated') {
      router.replace('/'); // history에 남기지 않고 이동
    }
  }, [authStatus, router]);

  // 인증 상태 확인 중이거나, 이미 인증된 상태면 로딩을 보여줍니다.
  if (authStatus === 'loading') {
    return <LoadingSpinner message="인증 상태 확인 중..." />;
  }
  
  if (authStatus === 'authenticated') {
    return <LoadingSpinner message="메인 페이지로 이동 중..." />;
  }

  // 로그인되지 않은 사용자만 회원가입 폼을 봅니다.
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <SignupForm />
    </div>
  );
}