'use client';

import { useAuth } from '@/hooks/useAuth';
import { useAuthContext } from '@/contexts/AuthContext';

import { SignupForm } from '@/features/auth/components/SignupForm';
import { Alert } from '@mantine/core';
import { AlertCircle, RefreshCw } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';

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
  // AuthGatekeeper가 모든 라우팅을 처리하므로 페이지는 순수한 콘텐츠만 렌더링
  return (
    <AppLayout variant="minimal">
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-60px)]">
        <SignupForm />
      </div>
    </AppLayout>
  );
}