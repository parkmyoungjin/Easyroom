'use client';

import { useAuthContext } from '@/contexts/AuthContext';
import { AuthLoadingUI } from './AuthLoadingUI';

interface AuthLoadingWrapperProps {
    children: React.ReactNode;
}

/**
 * AuthLoadingWrapper - 인증 로딩 상태 관리
 * 
 * 책임:
 * 1. 인증 로딩 상태일 때만 로딩 UI 표시
 * 2. 인증 상태가 확정되면 children 렌더링
 * 3. 라우팅 제어는 미들웨어에서 처리
 */
export default function AuthLoadingWrapper({ children }: AuthLoadingWrapperProps) {
    const { authStatus } = useAuthContext();

    // 인증 로딩 중에만 로딩 UI 표시
    if (authStatus === 'loading') {
        return <AuthLoadingUI />;
    }

    // 인증 완료 후 children 렌더링 (라우팅은 미들웨어에서 처리됨)
    return <>{children}</>;
}