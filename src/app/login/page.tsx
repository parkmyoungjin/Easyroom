// src/app/login/page.tsx
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { Alert } from '@mantine/core';
import { MailCheck } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';


// --- 개선된 로딩 스피너 컴포넌트 ---
const LoadingSpinner = ({ message = "인증 상태 확인 중..." }: { message?: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      <p className="mt-2 text-gray-600">{message}</p>
    </div>
  </div>
);

function LoginContent() {
  const searchParams = useSearchParams();
  
  const fromSignup = searchParams.get('from') === 'signup';
  const signupEmail = searchParams.get('email'); // OTP 전환을 위한 이메일

  // AuthGatekeeper에서 모든 인증 및 리디렉션을 처리하므로
  // 여기서는 리디렉션 로직을 제거하고 콘텐츠만 렌더링
  
  return (
    <AppLayout variant="minimal">
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-60px)]">
        
        {/* 회원가입 직후에만 보이는 환영 메시지 - OTP 전환 안내 */}
        {fromSignup && (
          <div className="w-full max-w-md mb-6">
            <Alert 
              color="green" 
              title="회원가입 완료!"
              icon={<MailCheck size={16} />}
              styles={{
                root: { borderColor: '#10b981', backgroundColor: '#f0fdf4' },
                title: { color: '#059669', fontWeight: 'bold' },
                body: { color: '#059669' }
              }}
            >
              {signupEmail ? (
                <>
                  <strong>{signupEmail}</strong>로 회원가입이 완료되었습니다.<br />
                  이제 OTP 코드로 로그인할 수 있습니다. 아래에서 이메일을 입력하고 OTP 코드를 받아보세요.
                </>
              ) : (
                '가입이 완료되었습니다. 이제 OTP 코드로 로그인할 수 있습니다.'
              )}
            </Alert>
          </div>
        )}
        
        <LoginForm initialEmail={signupEmail || undefined} />
      </div>
    </AppLayout>
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