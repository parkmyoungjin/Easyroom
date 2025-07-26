// src/app/login/page.tsx

'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect, useState, useCallback } from 'react'; // useState, useCallback 추가
import { useAuth } from '@/hooks/useAuth';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/components/ui/button'; // Shadcn UI의 Button 컴포넌트
import { Loader2 } from 'lucide-react'; // 로딩 아이콘

// --- 로딩 스피너 및 로그인 폼 컴포넌트는 이전과 동일 ---
const LoadingSpinner = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">페이지를 준비 중입니다...</p>
      </div>
    </div>
  );

const DynamicLoginForm = dynamic(
  () => import('@/features/auth/components/LoginForm').then(mod => {
    // LoginForm에 수동 확인 버튼을 위한 props를 전달할 수 있도록 확장합니다.
    return (props: { onManualCheck: () => void; isChecking: boolean }) => (
      <mod.LoginForm {...props} />
    );
  }),
  { ssr: false, loading: () => <LoadingSpinner /> }
);


// --- 핵심 로직이 담긴 LoginContent 컴포넌트 ---
function LoginContent() {
  const { authStatus, userProfile } = useAuth();
  const supabase = createClientComponentClient();
  const [isChecking, setIsChecking] = useState(false); // ✅ 수동 확인 시 로딩 상태 관리

  // ✅ [핵심] 인증 상태를 확인하고 성공 시 새로고침하는 함수 (재사용을 위해 분리)
  const checkAuthAndReload = useCallback(async () => {
    setIsChecking(true);
    console.log('[LoginPage] 🕵️‍♀️ Checking auth status on server...');
    
    const { data } = await supabase.auth.getSession();

    if (data.session) {
      console.log('[LoginPage] ✅ Auth session found! Reloading page.');
      window.location.reload();
    } else {
      console.log('[LoginPage] ❌ No active session found.');
      // 여기에 "아직 인증되지 않았습니다" 라는 toast 메시지를 추가하면 더 좋습니다.
      setIsChecking(false);
    }
  }, [supabase]);


  // ✅ 1. 자동 확인: PWA가 다시 활성화될 때
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAuthAndReload();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkAuthAndReload]);


  // ✅ 2. 이미 로그인한 사용자 리디렉션 (기존과 동일)
  useEffect(() => {
    if (authStatus === 'authenticated' && userProfile) {
      window.location.href = '/';
    }
  }, [authStatus, userProfile]);


  if (authStatus === 'loading' || (authStatus === 'authenticated' && userProfile)) {
    return <LoadingSpinner />;
  }
  
  // DynamicLoginForm에 수동 확인 함수와 로딩 상태를 props로 전달합니다.
  // 실제 UI는 LoginForm 컴포넌트 내부에서 이 props를 사용하여 버튼을 렌더링해야 합니다.
  return (
    <div className="p-4">
        {/* 임시로 여기에 버튼을 추가하지만, 실제로는 LoginForm 컴포넌트 내부에 배치하는 것이 좋습니다. */}
        <div className="text-center p-6 bg-slate-100 rounded-lg">
            <h3 className="font-bold">이메일 인증을 완료하셨나요?</h3>
            <p className="text-sm text-gray-600 mt-2 mb-4">
                다른 창에서 이메일 인증을 완료한 후, 아래 버튼을 눌러 로그인을 완료하세요.
            </p>
            <Button
                onClick={checkAuthAndReload}
                disabled={isChecking}
                className="w-full"
            >
                {isChecking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isChecking ? '확인 중...' : '인증 완료 확인'}
            </Button>
        </div>
        <hr className="my-8" />
        <DynamicLoginForm onManualCheck={checkAuthAndReload} isChecking={isChecking} />
    </div>
  );
}


export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <LoginContent />
    </Suspense>
  );
}