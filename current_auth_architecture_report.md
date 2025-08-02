# 현재 인증 아키텍처 현황 분석 보고서

## 1. 상태 공급자 (State Provider): `AuthContext.tsx`

**파일 경로:** `src/contexts/AuthContext.tsx`

**분석 목표:** 현재 `useState`, `useRef`, `useEffect`를 사용하여 인증 상태가 어떻게 정의, 관리, 변경되는지 전체적인 로직 흐름을 파악한다.

**코드 전문:**

```typescript
// src/contexts/AuthContext.tsx
// 작전명: 단일 관문 (Operation: Single Gate)
// 모든 인증 상태 변경은 onAuthStateChange 리스너를 통해서만 처리됩니다.

'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
import { UserProfile } from '@/types/auth';
import { createAuthId, createDatabaseUserId } from '@/types/enhanced-types';

// ============================================================================
// TYPES AND INTERFACES - Simplified for Single Gate Architecture
// ============================================================================

/**
 * Authentication status with clear state definitions
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * Main AuthContext interface - Simplified for Single Gate
 */
interface AuthContextType {
  /** Current authenticated user from Supabase Auth */
  user: User | null;
  /** User profile data from database */
  userProfile: UserProfile | null;
  /** Current authentication status */
  authStatus: AuthStatus;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// PROFILE HELPER FUNCTION - 프로필 조회 및 생성 로직
// ============================================================================

/**
 * 사용자 프로필을 조회하거나 생성합니다.
 * Single Gate 아키텍처에서 사용되는 핵심 헬퍼 함수입니다.
 */
async function getOrCreateProfile(supabase: SupabaseClient, user: User): Promise<UserProfile | null> {
  try {
    // 1. 기존 사용자 프로필 조회
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', user.id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    if (data) {
      return {
        authId: createAuthId(data.auth_id),
        dbId: createDatabaseUserId(data.id),
        employeeId: data.employee_id,
        email: data.email,
        name: data.name,
        department: data.department,
        role: data.role,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    }

    // 2. 신규 사용자 프로필 생성
    const { error: rpcError } = await supabase.rpc('upsert_user_profile', {
      p_auth_id: user.id,
      p_email: user.email || '',
      p_user_name: user.user_metadata?.fullName || '',
      p_user_department: user.user_metadata?.department || '',
      p_user_employee_id: null
    });
    
    if (rpcError) throw rpcError;
    
    // 3. 생성된 프로필 조회
    const { data: newData, error: finalError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', user.id)
      .single();
    
    if (finalError) throw finalError;
    
    return {
      authId: createAuthId(newData.auth_id),
      dbId: createDatabaseUserId(newData.id),
      employeeId: newData.employee_id,
      email: newData.email,
      name: newData.name,
      department: newData.department,
      role: newData.role,
      createdAt: newData.created_at,
      updatedAt: newData.updated_at
    };
  } catch (error) {
    console.error('[AuthProvider] Failed to get or create user profile:', error);
    return null;
  }
}

// ============================================================================
// SINGLE GATE AUTH PROVIDER - 단일 관문 인증 제공자
// ============================================================================

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const supabase = useSupabaseClient();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');

  // --- 실행 잠금(Execution Lock) ---
  const isProcessing = useRef(false);

  useEffect(() => {
    // Supabase 클라이언트가 준비되지 않았다면 아무것도 하지 않는다.
    if (!supabase) {
      console.log('[AuthGate] Supabase client not ready, waiting...');
      return;
    }

    console.log('[AuthGate] Initializing Single Gate architecture...');

    // --- 단일 관문(Single Gate) ---
    // 모든 인증 상태 변경은 이 리스너를 통해서만 처리된다.
    // 최초 구독 시, 현재 세션 상태를 기반으로 첫 이벤트가 즉시 발생한다.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[AuthGate] Event Received: ${event}. Processing...`);
      
      if (isProcessing.current) {
        console.log(`[AuthGate] Lock Engaged: Ignoring concurrent event '${event}'.`);
        return;
      }

      isProcessing.current = true;
      console.log(`[AuthGate] Lock Engaged for event '${event}'.`);

      try {
        if (session?.user) {
          console.log(`[AuthGate] Processing authenticated user for event '${event}'`);
          const profile = await getOrCreateProfile(supabase, session.user);
          
          setUser(session.user);
          setUserProfile(profile);
          setAuthStatus('authenticated');
          
          console.log(`[AuthGate] Processed '${event}': State set to 'authenticated'.`);
        } else {
          console.log(`[AuthGate] Processing unauthenticated state for event '${event}'`);
          
          setUser(null);
          setUserProfile(null);
          setAuthStatus('unauthenticated');
          
          console.log(`[AuthGate] Processed '${event}': State set to 'unauthenticated'.`);
        }
      } catch (error) {
        console.error(`[AuthGate] Error processing event '${event}':`, error);
        setUser(null);
        setUserProfile(null);
        setAuthStatus('unauthenticated');
      } finally {
        isProcessing.current = false;
        console.log(`[AuthGate] Lock Released for event '${event}'.`);
      }
    });

    // 컴포넌트 언마운트 시 구독을 해지하여 메모리 누수를 방지한다.
    return () => {
      console.log('[AuthGate] Unsubscribing auth state listener.');
      subscription?.unsubscribe();
    };
  }, [supabase]);

  const value = { user, userProfile, authStatus };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ============================================================================
// CONTEXT HOOKS - 컨텍스트 사용을 위한 훅들
// ============================================================================

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * 기존 코드와의 호환성을 위한 별칭
 */
export const useAuthContext = useAuth;
```

## 2. 클라이언트 공급자 (Client Provider): `SupabaseProvider.tsx`

**파일 경로:** `src/contexts/SupabaseProvider.tsx`

**분석 목표:** Supabase 클라이언트 인스턴스가 생성되고 하위 컴포넌트에 제공되는 방식과, `AuthProvider`와의 의존 관계를 확인한다.

**코드 전문:**

```typescript
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
```

## 3. UI 분기 지점 (UI Gatekeeper): `AuthGatekeeper.tsx`

**파일 경로:** `src/components/layout/AuthGatekeeper.tsx`

**분석 목표:** `AuthProvider`로부터 받은 인증 상태 값에 따라, 실제 사용자에게 보여지는 UI(로딩 화면, 페이지 콘텐츠 등)가 어떻게 결정되는지 확인한다.

**코드 전문:**

```typescript
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
```