'use client';

import { useEffect, useState } from 'react';

interface StaticPageFallbackProps {
  children: React.ReactNode;
  requiresAuth?: boolean;
  fallback?: React.ReactNode;
}

/**
 * Fallback component for static pages that don't require authentication
 * Ensures pages can render during SSG/SSR without authentication context
 */
export function StaticPageFallback({ 
  children, 
  requiresAuth = false, 
  fallback 
}: StaticPageFallbackProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // For static pages that don't require auth, render immediately
  if (!requiresAuth) {
    return <>{children}</>;
  }

  // For auth-required pages, wait for client-side hydration
  if (!isClient) {
    return fallback || <StaticPageLoadingSkeleton />;
  }

  return <>{children}</>;
}

/**
 * Loading skeleton for static pages
 */
function StaticPageLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48"></div>
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 404 페이지용 특별한 fallback
 */
export function NotFoundPageFallback({ children }: { children: React.ReactNode }) {
  return (
    <StaticPageFallback requiresAuth={false}>
      {children}
    </StaticPageFallback>
  );
}

/**
 * About 페이지 등 정적 페이지용 fallback
 */
export function PublicPageFallback({ children }: { children: React.ReactNode }) {
  return (
    <StaticPageFallback requiresAuth={false}>
      {children}
    </StaticPageFallback>
  );
}