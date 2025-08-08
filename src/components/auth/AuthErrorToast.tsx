'use client';

import { useEffect } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';

// Using console for now instead of sonner
const toast = {
  success: (title: string, options?: { description?: string; duration?: number }) => {
    console.log(`✅ ${title}`, options?.description || '');
  },
  error: (title: string, options?: { description?: string; duration?: number }) => {
    console.error(`❌ ${title}`, options?.description || '');
  },
  info: (message: string, options?: { description?: string; duration?: number; action?: { label: string; onClick: () => void } }) => {
    console.info(`ℹ️ ${message}`, options?.description || '');
  }
};

/**
 * AuthErrorToast Component
 * 
 * Single Gate 아키텍처에서는 에러 처리를 단순화했습니다.
 * 이 컴포넌트는 현재 비활성화되어 있습니다.
 */
export default function AuthErrorToast() {
  // Single Gate 아키텍처에서는 에러 토스트를 사용하지 않습니다.
  return null;
}

/**
 * AuthSuccessToast Component
 * 
 * Shows success messages for authentication events
 */
export function AuthSuccessToast() {
  const { user, authStatus } = useAuthContext();

  useEffect(() => {
    // Show success message when user signs in
    if (authStatus === 'authenticated' && user?.email) {
      toast.success("로그인 성공", {
        description: `${user.email}로 로그인되었습니다.`,
        duration: 3000,
      });
    }
  }, [authStatus, user]);

  useEffect(() => {
    // Show message when user signs out
    if (authStatus === 'unauthenticated' && !user) {
      // Only show if we were previously authenticated
      const wasAuthenticated = sessionStorage.getItem('was_authenticated');
      if (wasAuthenticated) {
        toast.success("로그아웃 완료", {
          description: "안전하게 로그아웃되었습니다.",
          duration: 3000,
        });
        sessionStorage.removeItem('was_authenticated');
      }
    } else if (authStatus === 'authenticated') {
      // Mark as authenticated for logout detection
      sessionStorage.setItem('was_authenticated', 'true');
    }
  }, [authStatus, user]);

  return null;
}

/**
 * AuthNetworkStatusToast Component
 * 
 * Shows network status changes that affect authentication
 */
export function AuthNetworkStatusToast() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      toast.success("연결 복구됨", {
        description: "인터넷 연결이 복구되었습니다. 인증 상태를 확인합니다.",
        duration: 3000,
      });
    };

    const handleOffline = () => {
      toast.error("연결 끊어짐", {
        description: "인터넷 연결이 끊어졌습니다. 일부 기능이 제한될 수 있습니다.",
        duration: 5000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return null;
}

/**
 * Combined AuthToastManager Component
 * 
 * Manages all authentication-related toast notifications
 */
export function AuthToastManager() {
  return (
    <>
      <AuthErrorToast />
      <AuthSuccessToast />
      <AuthNetworkStatusToast />
    </>
  );
}