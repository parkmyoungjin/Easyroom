// src/components/layout/AuthGatekeeper.tsx
"use client";

import React from 'react';
import { useAuthContext } from '@/contexts/AuthContext';

/**
 * Operation: Structural Integrity - AuthGatekeeper Component
 * 
 * AuthProvider의 직속 자식으로, 인증 상태를 '소비'하는 역할만 수행한다.
 * 인증 상태에 따라 로딩 화면을 보여주거나, 실제 페이지 콘텐츠(children)를 렌더링한다.
 * 
 * 이 컴포넌트는 AuthProvider의 생명주기에 전혀 영향을 주지 않으며,
 * 단순히 인증 상태를 읽어서 UI 분기 처리만 담당한다.
 */

/**
 * 전체 화면 로딩 컴포넌트
 * AuthProvider가 초기 인증 상태를 확인하는 동안 표시됩니다.
 */
const FullScreenLoader = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center space-y-4">
        {/* 로딩 스피너 */}
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        
        {/* 로딩 텍스트 */}
        <div className="text-sm text-muted-foreground">
          인증 상태를 확인하고 있습니다...
        </div>
      </div>
    </div>
  );
};

const AuthGatekeeper = ({ children }: { children: React.ReactNode }) => {
  // AuthProvider가 부모이므로, 이 훅은 항상 안전하게 호출된다.
  const { authStatus } = useAuthContext();

  console.log('[AuthGatekeeper] Current auth status:', authStatus);

  // 아직 초기 인증 상태 확인이 완료되지 않았다면, 전체 화면 로더를 보여준다.
  // 이 로직은 이제 AuthProvider 자체의 생명주기에 전혀 영향을 주지 않는다.
  if (authStatus === 'loading') {
    console.log('[AuthGatekeeper] Showing loading screen');
    return <FullScreenLoader />;
  }

  // 인증 확인이 끝나면, 보호받는 자식 컴포넌트(실제 페이지)를 렌더링한다.
  console.log('[AuthGatekeeper] Rendering children - auth status:', authStatus);
  return <>{children}</>;
};

export default AuthGatekeeper;