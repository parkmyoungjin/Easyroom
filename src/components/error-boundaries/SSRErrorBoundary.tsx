'use client';

import React, { Component, ReactNode } from 'react';
import { logger } from '@/lib/utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isHydrationError: boolean;
}

/**
 * SSR-compatible error boundary that handles hydration mismatches
 * and other authentication-related errors gracefully
 */
export class SSRErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isHydrationError: false
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is a hydration error
    const isHydrationError = 
      error.message.includes('Hydration') ||
      error.message.includes('hydration') ||
      error.message.includes('server HTML') ||
      error.message.includes('client-side') ||
      error.message.includes('Supabase client is not ready');

    return {
      hasError: true,
      error,
      isHydrationError
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error for debugging
    logger.error('SSRErrorBoundary caught an error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      isHydrationError: this.state.isHydrationError
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // For hydration errors, try to recover after a short delay
    if (this.state.isHydrationError) {
      setTimeout(() => {
        this.setState({
          hasError: false,
          error: null,
          isHydrationError: false
        });
      }, 100);
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback for hydration errors (minimal UI)
      if (this.state.isHydrationError) {
        return (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">인증 확인 중...</p>
            </div>
          </div>
        );
      }

      // Default fallback for other errors
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="text-red-500 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-2">문제가 발생했습니다</h2>
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
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-based wrapper for the SSR Error Boundary
 */
export function withSSRErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <SSRErrorBoundary fallback={fallback}>
        <Component {...props} />
      </SSRErrorBoundary>
    );
  };
}