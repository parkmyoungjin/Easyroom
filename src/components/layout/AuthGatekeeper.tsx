'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuthContext } from '@/contexts/AuthContext';

interface AuthGatekeeperProps {
    children: React.ReactNode;
}

/**
 * 인증 로딩 UI - 단순하고 안정적인 스피너
 */
const AuthLoadingUI = () => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
            <motion.div
                className="text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                {/* 회전하는 스피너 */}
                <motion.div
                    className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />

                {/* 인증 확인 중 텍스트 */}
                <motion.p
                    className="text-lg text-gray-600"
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                    인증 확인 중...
                </motion.p>
            </motion.div>
        </div>
    );
};

/**
 * AuthGatekeeper - 단순하고 안정적인 인증 문지기
 * 
 * 책임:
 * 1. 인증 로딩 상태일 때만 로딩 UI 표시
 * 2. 인증 상태가 확정되면 라우팅 규칙 실행
 * 3. 데이터 로딩은 각 페이지가 개별적으로 처리
 */
export default function AuthGatekeeper({ children }: AuthGatekeeperProps) {
    const { authStatus, user, userProfile } = useAuthContext();
    const router = useRouter();
    const pathname = usePathname();

    // 라우팅 제어 로직 - 모든 Hook을 먼저 호출
    useEffect(() => {
        // 로딩 중에는 라우팅 로직을 실행하지 않음
        if (authStatus === 'loading') return;

        // 공개 경로 정의
        const publicRoutes = ['/welcome', '/login', '/signup', '/reservations/status'];
        const authRoutes = ['/welcome', '/login', '/signup'];

        // 규칙 1 (비로그인): 접근 허용 경로가 아니면 /welcome으로 리디렉션
        if (authStatus === 'unauthenticated') {
            const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith('/kiosk');

            if (!isPublicRoute) {
                router.replace('/welcome');
                return;
            }
        }

        // 규칙 2 (로그인): 루트 경로 또는 인증 관련 경로에 있으면 /dashboard로 리디렉션
        if (authStatus === 'authenticated') {
            if (pathname === '/' || authRoutes.includes(pathname)) {
                router.replace('/dashboard');
                return;
            }

            // 규칙 3 (관리자): 관리자가 아닌데 /admin 경로에 있으면 /dashboard로 리디렉션
            if (pathname.startsWith('/admin') && userProfile?.role !== 'admin') {
                router.replace('/dashboard');
                return;
            }
        }
    }, [authStatus, user, userProfile, pathname, router]);

    // 인증 로딩 중이면 로딩 UI 표시
    if (authStatus === 'loading') {
        return <AuthLoadingUI />;
    }

    // 인증이 완료되면 children 렌더링 (각 페이지가 자체 로딩 처리)
    return <>{children}</>;
}