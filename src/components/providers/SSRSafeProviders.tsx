'use client';

import { ReactNode } from 'react';
import { SSRErrorBoundary } from '@/components/error-boundaries/SSRErrorBoundary';
import { AuthLoadingState } from '@/components/loading/AuthLoadingState';
import { logger } from '@/lib/utils/logger';

interface SSRSafeProvidersProps {
  children: ReactNode;
  enableAuthLoading?: boolean;
  enableErrorBoundary?: boolean;
  loadingFallback?: ReactNode;
  errorFallback?: ReactNode;
}

/**
 * Comprehensive SSR-safe provider wrapper that handles:
 * - Error boundaries for hydration mismatches
 * - Loading states during authentication initialization
 * - Graceful fallbacks for static pages
 */
export function SSRSafeProviders({
  children,
  enableAuthLoading = true,
  enableErrorBoundary = true,
  loadingFallback,
  errorFallback
}: SSRSafeProvidersProps) {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Log authentication-related errors
    logger.error('SSR/Auth error caught by boundary', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });

    // Report to monitoring service if available
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'exception', {
        description: error.message,
        fatal: false
      });
    }
  };

  let content = children;

  // Wrap with auth loading state if enabled
  if (enableAuthLoading) {
    content = (
      <AuthLoadingState fallback={loadingFallback}>
        {content}
      </AuthLoadingState>
    );
  }

  // Wrap with error boundary if enabled
  if (enableErrorBoundary) {
    content = (
      <SSRErrorBoundary 
        fallback={errorFallback}
        onError={handleError}
      >
        {content}
      </SSRErrorBoundary>
    );
  }

  return <>{content}</>;
}

/**
 * Pre-configured wrapper for authenticated pages
 */
export function AuthenticatedPageWrapper({ children }: { children: ReactNode }) {
  return (
    <SSRSafeProviders
      enableAuthLoading={true}
      enableErrorBoundary={true}
      loadingFallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-sm text-muted-foreground">인증 확인 중...</p>
          </div>
        </div>
      }
    >
      {children}
    </SSRSafeProviders>
  );
}

/**
 * Pre-configured wrapper for public pages
 */
export function PublicPageWrapper({ children }: { children: ReactNode }) {
  return (
    <SSRSafeProviders
      enableAuthLoading={false}
      enableErrorBoundary={true}
      errorFallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center max-w-md mx-auto p-6">
            <h2 className="text-lg font-semibold mb-2">페이지를 불러올 수 없습니다</h2>
            <p className="text-sm text-muted-foreground mb-4">
              페이지를 새로고침하거나 잠시 후 다시 시도해주세요.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              새로고침
            </button>
          </div>
        </div>
      }
    >
      {children}
    </SSRSafeProviders>
  );
}