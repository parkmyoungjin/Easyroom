'use client';

/**
 * Startup Validation Provider
 * React provider that handles environment validation during application startup
 * Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { validateStartup, quickStartupCheck } from '@/lib/startup/environment-startup-validator';
import type { StartupValidationResult } from '@/lib/startup/environment-startup-validator';
import type { UserFriendlyError, ErrorAction } from '@/lib/error-handling/environment-error-handler';

// ============================================================================
// CONTEXT INTERFACES
// ============================================================================

interface StartupValidationContextValue {
  isValidating: boolean;
  validationResult: StartupValidationResult | null;
  error: UserFriendlyError | null;
  canContinue: boolean;
  requiresUserAction: boolean;
  retryValidation: () => Promise<void>;
  skipValidation: () => void;
  validationStartTime: number | null;
}

interface StartupValidationProviderProps {
  children: React.ReactNode;
  strictMode?: boolean;
  includeOptional?: boolean;
  failFast?: boolean;
  skipValidation?: boolean;
  onValidationComplete?: (result: StartupValidationResult) => void;
  onValidationError?: (error: UserFriendlyError) => void;
}

// ============================================================================
// CONTEXT CREATION
// ============================================================================

const StartupValidationContext = createContext<StartupValidationContextValue | null>(null);

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export function StartupValidationProvider({
  children,
  strictMode = false,
  includeOptional = true,
  failFast = true,
  skipValidation = false,
  onValidationComplete,
  onValidationError
}: StartupValidationProviderProps) {
  const [isValidating, setIsValidating] = useState(!skipValidation);
  const [validationResult, setValidationResult] = useState<StartupValidationResult | null>(null);
  const [error, setError] = useState<UserFriendlyError | null>(null);
  const [canContinue, setCanContinue] = useState(skipValidation);
  const [requiresUserAction, setRequiresUserAction] = useState(false);
  const [validationStartTime, setValidationStartTime] = useState<number | null>(null);
  const [hasValidated, setHasValidated] = useState(skipValidation);

  // ============================================================================
  // VALIDATION LOGIC
  // ============================================================================

  const performValidation = useCallback(async () => {
    if (skipValidation) {
      setCanContinue(true);
      setIsValidating(false);
      return;
    }

    setIsValidating(true);
    setError(null);
    setValidationStartTime(Date.now());

    try {
      // Quick check first if failFast is enabled
      if (failFast) {
        const quickCheck = await quickStartupCheck();
        if (!quickCheck) {
          // Perform full validation to get detailed error information
          const result = await validateStartup({
            strictMode,
            includeOptional,
            failFast: true
          });
          
          setValidationResult(result);
          setCanContinue(result.canContinue);
          setRequiresUserAction(result.requiresUserAction);
          
          if (result.userFriendlyError) {
            setError(result.userFriendlyError);
            onValidationError?.(result.userFriendlyError);
          }
          
          onValidationComplete?.(result);
          setIsValidating(false);
          return;
        }
      }

      // Perform comprehensive validation
      const result = await validateStartup({
        strictMode,
        includeOptional,
        failFast
      });

      setValidationResult(result);
      setCanContinue(result.canContinue);
      setRequiresUserAction(result.requiresUserAction);

      if (result.success) {
        setError(null);
      } else if (result.userFriendlyError) {
        setError(result.userFriendlyError);
        onValidationError?.(result.userFriendlyError);
      }

      onValidationComplete?.(result);

    } catch (validationError) {
      const errorMessage = validationError instanceof Error 
        ? validationError.message 
        : 'Unknown validation error';

        const fallbackError: UserFriendlyError = {
          title: 'Startup Validation Failed',
          message: 'There was an unexpected error during startup validation. Please try again.',
          actions: [
            // 이전 단계에서 수정한 actions 배열 (priority 제거)
            { label: 'Retry', action: 'retry' },
            { label: 'Skip Validation', action: 'reload_page' }
          ],
          severity: 'high',
          errorCode: 'STARTUP_VALIDATION_FAILED', // 'category'를 'errorCode'로 변경
          canRetry: true,
          // 'retryDelay' 속성은 타입에 없으므로 제거
          technicalDetails: errorMessage
        };
        
      setError(fallbackError);
      setCanContinue(false);
      setRequiresUserAction(true);
      onValidationError?.(fallbackError);
    } finally {
      setIsValidating(false);
      setHasValidated(true);
    }
  }, [strictMode, includeOptional, failFast, skipValidation, onValidationComplete, onValidationError]);

  // ============================================================================
  // USER ACTIONS
  // ============================================================================

  const retryValidation = useCallback(async () => {
    await performValidation();
  }, [performValidation]);

  const skipValidationAction = useCallback(() => {
    setIsValidating(false);
    setCanContinue(true);
    setRequiresUserAction(false);
    setError(null);
    setHasValidated(true);
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Perform initial validation on mount
  useEffect(() => {
    if (!hasValidated && !skipValidation) {
      performValidation();
    }
  }, [performValidation, hasValidated, skipValidation]);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const contextValue: StartupValidationContextValue = {
    isValidating,
    validationResult,
    error,
    canContinue,
    requiresUserAction,
    retryValidation,
    skipValidation: skipValidationAction,
    validationStartTime
  };

  return (
    <StartupValidationContext.Provider value={contextValue}>
      {children}
    </StartupValidationContext.Provider>
  );
}

// ============================================================================
// HOOK FOR CONSUMING CONTEXT
// ============================================================================

export function useStartupValidation(): StartupValidationContextValue {
  const context = useContext(StartupValidationContext);
  
  if (!context) {
    throw new Error('useStartupValidation must be used within a StartupValidationProvider');
  }
  
  return context;
}

// ============================================================================
// VALIDATION GUARD COMPONENT
// ============================================================================

interface StartupValidationGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showValidationErrors?: boolean;
  allowSkip?: boolean;
}

export function StartupValidationGuard({
  children,
  fallback,
  showValidationErrors = true,
  allowSkip = false
}: StartupValidationGuardProps) {
  const {
    isValidating,
    canContinue,
    error,
    requiresUserAction,
    retryValidation,
    skipValidation
  } = useStartupValidation();

  // Show loading state during validation
  if (isValidating) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold mb-2">시스템을 준비하고 있습니다...</h2>
          <p className="text-muted-foreground">환경 설정을 확인하고 있습니다</p>
        </div>
      </div>
    );
  }

  // Show error state if validation failed and requires user action
  if (!canContinue && error && requiresUserAction && showValidationErrors) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border rounded-lg p-6 text-center">
          <div className="mb-4">
            <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">{error.title}</h2>
            <p className="text-muted-foreground mb-4">{error.message}</p>
          </div>

          <div className="space-y-2">
            {error.actions.map((action, index) => (
              <button
                key={index}
                onClick={() => {
                  switch (action.action) {
                    case 'retry':
                      retryValidation();
                      break;
                    case 'reload_page':
                      window.location.reload();
                      break;
                    default:
                      break;
                  }
                }}
                className={`w-full px-4 py-2 rounded-md font-medium transition-colors ${
                  action.action === 'retry'
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {action.label}
              </button>
            ))}
            
            {allowSkip && (
              <button
                onClick={skipValidation}
                className="w-full px-4 py-2 rounded-md font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                검증 건너뛰기
              </button>
            )}
          </div>

          {error.technicalDetails && process.env.NODE_ENV === 'development' && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                기술적 세부사항
              </summary>
              <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                {error.technicalDetails}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }

  // Render children if validation passed or can continue
  return <>{children}</>;
}