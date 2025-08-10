'use client';

import { SignupForm } from '@/features/auth/components/SignupForm';
import AppLayout from '@/components/layout/AppLayout';

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