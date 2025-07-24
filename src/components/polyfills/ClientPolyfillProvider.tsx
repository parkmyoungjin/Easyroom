'use client';

import { useEffect } from 'react';
import { initializeClientPolyfills } from '@/lib/polyfills/client-polyfills';

/**
 * Client-side polyfill provider component
 * Initializes browser polyfills only on client side
 */
export function ClientPolyfillProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize client polyfills when component mounts
    initializeClientPolyfills();
  }, []);

  return <>{children}</>;
}

/**
 * Hook for safe browser API access
 */
export function useBrowserAPIs() {
  useEffect(() => {
    initializeClientPolyfills();
  }, []);

  return {
    isBrowser: typeof window !== 'undefined',
    window: typeof window !== 'undefined' ? window : undefined,
    document: typeof document !== 'undefined' ? document : undefined,
    navigator: typeof navigator !== 'undefined' ? navigator : undefined,
  };
}