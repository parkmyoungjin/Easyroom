'use client';

import { useEffect, useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
import { useComputedColorScheme, useMantineColorScheme } from '@mantine/core';

interface AuthLoadingStateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  timeout?: number; // Maximum time to show loading state (ms)
}

/**
 * SSR-compatible loading state component that handles authentication initialization
 * Shows loading UI during hydration and initial auth check
 */
export function AuthLoadingState({
  children,
  fallback,
  timeout = 8000 // Increased timeout to match AuthContext timeout
}: AuthLoadingStateProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<'hydrating' | 'supabase' | 'auth' | 'ready'>('hydrating');

  const { authStatus } = useAuthContext();
  const supabase = useSupabaseClient();

  // With new SSR architecture, Supabase client is always ready
  const isSupabaseReady = !!supabase;
  const isSupabaseLoading = false;
  const supabaseError = null;

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
    setLoadingPhase('supabase');
  }, []);

  // Track loading phases for better UX
  useEffect(() => {
    if (!isHydrated) {
      setLoadingPhase('hydrating');
    } else if (isSupabaseLoading || !isSupabaseReady) {
      setLoadingPhase('supabase');
    } else if (authStatus === 'loading') {
      setLoadingPhase('auth');
    } else {
      setLoadingPhase('ready');
    }
  }, [isHydrated, isSupabaseLoading, isSupabaseReady, authStatus]);

  // Handle timeout with progressive messaging
  useEffect(() => {
    if (loadingPhase === 'ready') {
      setHasTimedOut(false);
      return;
    }

    const timer = setTimeout(() => {
      console.warn('[AuthLoadingState] Loading timeout reached, phase:', loadingPhase);
      setHasTimedOut(true);
    }, timeout);

    return () => clearTimeout(timer);
  }, [timeout, loadingPhase]);

  // Show loading state if:
  // 1. Not hydrated yet (SSR safety)
  // 2. Supabase is still loading
  // 3. Auth status is loading and hasn't timed out
  // 4. No critical errors present
  const shouldShowLoading =
    !isHydrated ||
    isSupabaseLoading ||
    (authStatus === 'loading' && !hasTimedOut && !supabaseError);

  if (shouldShowLoading) {
    return fallback || <DefaultAuthLoadingUI phase={loadingPhase} hasTimedOut={hasTimedOut} />;
  }

  // If we've timed out or have errors, show children (let error boundaries handle errors)
  return <>{children}</>;
}

/**
 * Default loading UI for authentication states with phase-specific messaging
 */
function DefaultAuthLoadingUI({
  phase,
  hasTimedOut
}: {
  phase: 'hydrating' | 'supabase' | 'auth' | 'ready';
  hasTimedOut: boolean;
}) {
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true });
  
  const getLoadingMessage = () => {
    if (hasTimedOut) {
      return '로딩 시간이 초과되었습니다. 페이지를 새로고침해주세요.';
    }

    switch (phase) {
      case 'hydrating':
        return '페이지를 준비 중입니다...';
      case 'supabase':
        return '서비스 연결 중...';
      case 'auth':
        return '인증 확인 중...';
      default:
        return '로딩 중...';
    }
  };

  return (
    <div 
      className="flex items-center justify-center min-h-screen"
      style={{
        background: computed === 'dark' 
          ? 'linear-gradient(135deg, #1a1b23 0%, #2d3748 100%)'
          : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
      }}
    >
      <div className="text-center">
        {hasTimedOut ? (
          <div className="mb-4" style={{ color: '#ef4444' }}>
            <svg className="h-8 w-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        ) : (
          <div 
            className="animate-spin rounded-full h-8 w-8 mx-auto mb-4"
            style={{
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: 'transparent',
               borderBottomColor: computed === 'dark' ? '#60a5fa' : '#2563eb'
            }}
          ></div>
        )}
        <p 
          className="text-sm"
          style={{
            color: hasTimedOut 
              ? '#ef4444' 
              : computed === 'dark' 
                ? '#94a3b8' 
                : '#64748b'
          }}
        >
          {getLoadingMessage()}
        </p>
        {hasTimedOut && (
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded transition-colors"
            style={{
              backgroundColor: computed === 'dark' ? '#3b82f6' : '#2563eb',
              color: 'white'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = computed === 'dark' ? '#2563eb' : '#1d4ed8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = computed === 'dark' ? '#3b82f6' : '#2563eb';
            }}
          >
            새로고침
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Skeleton loading component for auth-dependent content
 */
export function AuthContentSkeleton() {
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true });
  
  return (
    <div className="animate-pulse">
      <div 
        className="h-4 rounded w-3/4 mb-4"
        style={{
          backgroundColor: computed === 'dark' ? '#374151' : '#e5e7eb'
        }}
      ></div>
      <div 
        className="h-4 rounded w-1/2 mb-4"
        style={{
          backgroundColor: computed === 'dark' ? '#374151' : '#e5e7eb'
        }}
      ></div>
      <div 
        className="h-4 rounded w-5/6"
        style={{
          backgroundColor: computed === 'dark' ? '#374151' : '#e5e7eb'
        }}
      ></div>
    </div>
  );
}

/**
 * Higher-order component that wraps components with auth loading state
 */
export function withAuthLoadingState<P extends object>(
  Component: React.ComponentType<P>,
  loadingFallback?: React.ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <AuthLoadingState fallback={loadingFallback}>
        <Component {...props} />
      </AuthLoadingState>
    );
  };
}