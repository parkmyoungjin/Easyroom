'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// ============================================================================
// TYPES AND INTERFACES - Enhanced for auth-helpers integration
// ============================================================================

/**
 * Enhanced SupabaseContext type with proper auth-helpers integration
 * Provides type-safe access to Supabase client created with createPagesBrowserClient
 */
interface SupabaseContextType {
  /** Supabase client created with auth-helpers createPagesBrowserClient */
  client: SupabaseClient<Database> | null;
  /** Indicates if the client is ready for use */
  isReady: boolean;
  /** Any initialization error that occurred */
  error: Error | null;
}

/**
 * Props for SupabaseProvider component
 */
interface SupabaseProviderProps {
  children: ReactNode;
}

/**
 * Status information for Supabase client
 */
export interface SupabaseStatus {
  /** Whether the client is ready for use */
  isReady: boolean;
  /** Any error that occurred during initialization */
  error: Error | null;
  /** Whether the client is still loading */
  isLoading: boolean;
  /** Whether there's an error */
  hasError: boolean;
}

// ============================================================================
// CONTEXT CREATION
// ============================================================================

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

// ============================================================================
// SUPABASE PROVIDER COMPONENT
// ============================================================================

export function SupabaseProvider({ children }: SupabaseProviderProps) {
  const [client, setClient] = useState<SupabaseClient<Database> | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize client on mount using auth-helpers standard pattern
  useEffect(() => {
    let isMounted = true;

    const initializeClient = () => {
      const initStartTime = Date.now();
      const initId = `init-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        console.log('[SupabaseProvider] Starting client initialization:', {
          initId,
          timestamp: new Date().toISOString(),
          userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'SSR',
          url: typeof window !== 'undefined' ? window.location.href : 'SSR'
        });
        
        // Use auth-helpers standard client creation
        const supabaseClient = createPagesBrowserClient<Database>();
        
        // Only update state if component is still mounted
        if (!isMounted) {
          console.warn('[SupabaseProvider] Component unmounted during initialization:', { initId });
          return;
        }

        const initEndTime = Date.now();
        const initDuration = initEndTime - initStartTime;

        setClient(supabaseClient);
        setIsReady(true);
        setError(null);
        
        console.log('[SupabaseProvider] Client initialized successfully:', {
          initId,
          duration: initDuration,
          timestamp: new Date().toISOString(),
          clientReady: true,
          authAvailable: !!supabaseClient.auth
        });
        
      } catch (err) {
        if (!isMounted) {
          console.warn('[SupabaseProvider] Component unmounted during error handling:', { initId });
          return;
        }
        
        const initEndTime = Date.now();
        const initDuration = initEndTime - initStartTime;
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Supabase client';
        const clientError = new Error(errorMessage);
        
        setError(clientError);
        setIsReady(false);
        
        console.error('[SupabaseProvider] Client initialization failed:', {
          initId,
          duration: initDuration,
          error: err,
          errorMessage,
          errorStack: process.env.NODE_ENV === 'development' && err instanceof Error ? err.stack : undefined,
          timestamp: new Date().toISOString(),
          context: 'createPagesBrowserClient'
        });
      }
    };

    // Initialize client immediately
    initializeClient();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, []);

  // Optimized memoization to prevent unnecessary re-renders
  // Only re-create when essential state changes
  const contextValue = useMemo(() => ({
    client,
    isReady,
    error
  }), [
    client, // Client reference should be stable after initialization
    isReady, // Boolean value
    error?.message // Only re-render when error message changes, not error object
  ]);

  return (
    <SupabaseContext.Provider value={contextValue}>
      {children}
    </SupabaseContext.Provider>
  );
}

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

export function useSupabase(): SupabaseContextType {
  const context = useContext(SupabaseContext);
  
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  
  return context;
}

/**
 * Hook that returns the Supabase client
 * SSR-safe version that returns null during server-side rendering
 */
export function useSupabaseClient(): SupabaseClient<Database> | null {
  // SSR safety check - return null during server-side rendering
  if (typeof window === 'undefined') {
    return null;
  }
  
  const { client, isReady, error } = useSupabase();
  
  if (error) {
    console.warn('[useSupabaseClient] Client error:', error.message);
    return null;
  }
  
  if (!isReady || !client) {
    return null;
  }
  
  return client;
}

/**
 * Hook that returns client readiness status with proper typing
 */
export function useSupabaseStatus(): SupabaseStatus {
  const { isReady, error } = useSupabase();
  
  return {
    isReady,
    error,
    isLoading: !isReady && !error,
    hasError: !!error
  };
}