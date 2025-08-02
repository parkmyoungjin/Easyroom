/**
 * Centralized Auth Error Handling System
 * 
 * This module provides a unified error handling system for all authentication-related
 * operations across the application.
 */

// ============================================================================
// AUTH ERROR TYPE DEFINITION
// ============================================================================

export interface AuthError {
  type: 'network' | 'auth' | 'unknown';
  message: string;
  code?: string;
  retryable?: boolean;
}

// ============================================================================
// ERROR RECOVERY STRATEGIES
// ============================================================================

export interface ErrorRecoveryStrategy {
  type: 'retry' | 'redirect' | 'refresh' | 'ignore';
  maxAttempts?: number;
  delay?: number;
  fallback?: () => void;
  userMessage?: string;
}

export const errorRecoveryStrategies: Record<string, ErrorRecoveryStrategy> = {
  'network': { 
    type: 'retry', 
    maxAttempts: 3, 
    delay: 1000,
    userMessage: '네트워크 연결을 확인해주세요. 잠시 후 다시 시도됩니다.'
  },
  'session_expired': { 
    type: 'refresh', 
    maxAttempts: 1,
    userMessage: '세션이 만료되어 자동으로 갱신합니다.'
  },
  'unauthorized': { 
    type: 'redirect',
    userMessage: '로그인이 필요합니다. 로그인 페이지로 이동합니다.'
  },
  'permission_denied': { 
    type: 'redirect',
    userMessage: '접근 권한이 없습니다. 메인 페이지로 이동합니다.'
  },
  'rate_limit': {
    type: 'retry',
    maxAttempts: 2,
    delay: 5000,
    userMessage: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
  },
  'invalid_credentials': {
    type: 'ignore',
    userMessage: '로그인 정보를 확인해주세요.'
  },
  'user_not_found': {
    type: 'ignore',
    userMessage: '등록되지 않은 이메일입니다. 회원가입을 먼저 진행해주세요.'
  },
  'email_already_exists': {
    type: 'ignore',
    userMessage: '이미 가입된 이메일입니다. 로그인을 시도해주세요.'
  }
};

// ============================================================================
// ERROR CATEGORIZATION
// ============================================================================

export function categorizeAuthError(error: unknown): AuthError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();

  // Network errors
  if (lowerMessage.includes('network') || 
      lowerMessage.includes('fetch') || 
      lowerMessage.includes('timeout') ||
      lowerMessage.includes('connection') ||
      lowerMessage.includes('enotfound')) {
    return {
      type: 'network',
      message: '네트워크 연결을 확인해주세요',
      code: 'NETWORK_ERROR',
      retryable: true
    };
  }

  // Session errors
  if (lowerMessage.includes('session') || 
      lowerMessage.includes('expired') || 
      lowerMessage.includes('invalid') ||
      lowerMessage.includes('jwt') ||
      lowerMessage.includes('token')) {
    return {
      type: 'auth',
      message: '세션이 만료되었습니다',
      code: 'SESSION_ERROR',
      retryable: true
    };
  }

  // Permission errors
  if (lowerMessage.includes('permission') || 
      lowerMessage.includes('unauthorized') ||
      lowerMessage.includes('forbidden') ||
      lowerMessage.includes('access denied')) {
    return {
      type: 'auth',
      message: '권한이 부족합니다',
      code: 'PERMISSION_ERROR',
      retryable: false
    };
  }

  // Specific Supabase errors
  if (lowerMessage.includes('user not found') ||
      lowerMessage.includes('invalid login credentials')) {
    return {
      type: 'unknown',
      message: '등록되지 않은 이메일입니다. 회원가입을 먼저 진행해주세요.',
      code: 'USER_NOT_FOUND',
      retryable: false
    };
  }

  if (lowerMessage.includes('user already registered') ||
      lowerMessage.includes('already been registered')) {
    return {
      type: 'unknown',
      message: '이미 가입된 이메일입니다. 로그인을 시도해주세요.',
      code: 'EMAIL_ALREADY_EXISTS',
      retryable: false
    };
  }

  if (lowerMessage.includes('rate limit') ||
      lowerMessage.includes('too many requests')) {
    return {
      type: 'network',
      message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
      code: 'RATE_LIMIT_ERROR',
      retryable: true
    };
  }

  if (lowerMessage.includes('invalid token') ||
      lowerMessage.includes('token has expired') ||
      lowerMessage.includes('invalid_otp')) {
    return {
      type: 'auth',
      message: '잘못된 코드이거나 만료된 코드입니다. 새로운 코드를 요청해주세요.',
      code: 'INVALID_OTP',
      retryable: false
    };
  }

  // Default unknown error
  return {
    type: 'unknown',
    message: '알 수 없는 오류가 발생했습니다',
    code: 'UNKNOWN_ERROR',
    retryable: true
  };
}

// ============================================================================
// ERROR RECOVERY MANAGER
// ============================================================================

export class AuthErrorRecoveryManager {
  private retryAttempts = new Map<string, number>();
  private retryTimeouts = new Map<string, NodeJS.Timeout>();

  /**
   * Handle an authentication error with appropriate recovery strategy
   */
  async handleError(
    error: AuthError,
    context: {
      operation: string;
      userId?: string;
      onRetry?: () => Promise<void>;
      onRedirect?: (path: string) => void;
      onRefresh?: () => Promise<void>;
    }
  ): Promise<boolean> {
    const strategy = this.getRecoveryStrategy(error);
    const attemptKey = `${context.operation}_${context.userId || 'anonymous'}`;

    console.log(`[AuthErrorRecovery] Handling ${error.type} error for ${context.operation}:`, {
      error: error.message,
      strategy: strategy.type,
      attempts: this.retryAttempts.get(attemptKey) || 0
    });

    switch (strategy.type) {
      case 'retry':
        return this.handleRetryStrategy(error, strategy, attemptKey, context);
      
      case 'refresh':
        return this.handleRefreshStrategy(error, strategy, context);
      
      case 'redirect':
        return this.handleRedirectStrategy(error, strategy, context);
      
      case 'ignore':
        return this.handleIgnoreStrategy(error, strategy);
      
      default:
        return false;
    }
  }

  /**
   * Get recovery strategy for an error
   */
  private getRecoveryStrategy(error: AuthError): ErrorRecoveryStrategy {
    // Check specific error codes first
    if (error.code && errorRecoveryStrategies[error.code.toLowerCase()]) {
      return errorRecoveryStrategies[error.code.toLowerCase()];
    }

    // Check error types
    const typeStrategy = errorRecoveryStrategies[error.type];
    if (typeStrategy) {
      return typeStrategy;
    }

    // Default strategy
    return {
      type: 'ignore',
      userMessage: error.message
    };
  }

  /**
   * Handle retry strategy with exponential backoff
   */
  private async handleRetryStrategy(
    error: AuthError,
    strategy: ErrorRecoveryStrategy,
    attemptKey: string,
    context: { onRetry?: () => Promise<void> }
  ): Promise<boolean> {
    const currentAttempts = this.retryAttempts.get(attemptKey) || 0;
    const maxAttempts = strategy.maxAttempts || 3;

    if (currentAttempts >= maxAttempts) {
      console.log(`[AuthErrorRecovery] Max retry attempts (${maxAttempts}) reached for ${attemptKey}`);
      this.retryAttempts.delete(attemptKey);
      return false;
    }

    this.retryAttempts.set(attemptKey, currentAttempts + 1);

    // Calculate delay with exponential backoff
    const baseDelay = strategy.delay || 1000;
    const delay = Math.min(baseDelay * Math.pow(2, currentAttempts), 10000);

    console.log(`[AuthErrorRecovery] Scheduling retry ${currentAttempts + 1}/${maxAttempts} in ${delay}ms`);

    // Clear any existing timeout
    const existingTimeout = this.retryTimeouts.get(attemptKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule retry
    const timeout = setTimeout(async () => {
      this.retryTimeouts.delete(attemptKey);
      
      if (context.onRetry) {
        try {
          await context.onRetry();
          // Success - reset retry count
          this.retryAttempts.delete(attemptKey);
        } catch (retryError) {
          console.error(`[AuthErrorRecovery] Retry failed:`, retryError);
          // Will be handled by the next error handler call
        }
      }
    }, delay);

    this.retryTimeouts.set(attemptKey, timeout);
    return true;
  }

  /**
   * Handle refresh strategy
   */
  private async handleRefreshStrategy(
    error: AuthError,
    strategy: ErrorRecoveryStrategy,
    context: { onRefresh?: () => Promise<void> }
  ): Promise<boolean> {
    console.log(`[AuthErrorRecovery] Attempting session refresh`);

    if (context.onRefresh) {
      try {
        await context.onRefresh();
        return true;
      } catch (refreshError) {
        console.error(`[AuthErrorRecovery] Session refresh failed:`, refreshError);
        return false;
      }
    }

    return false;
  }

  /**
   * Handle redirect strategy
   */
  private handleRedirectStrategy(
    error: AuthError,
    strategy: ErrorRecoveryStrategy,
    context: { onRedirect?: (path: string) => void }
  ): boolean {
    const redirectPath = error.code === 'PERMISSION_ERROR' ? '/' : '/login';
    
    console.log(`[AuthErrorRecovery] Redirecting to ${redirectPath}`);

    if (context.onRedirect) {
      context.onRedirect(redirectPath);
      return true;
    }

    return false;
  }

  /**
   * Handle ignore strategy
   */
  private handleIgnoreStrategy(
    error: AuthError,
    strategy: ErrorRecoveryStrategy
  ): boolean {
    console.log(`[AuthErrorRecovery] Ignoring error: ${error.message}`);
    return false; // Don't handle automatically, let the UI show the error
  }

  /**
   * Clear all retry attempts and timeouts
   */
  clearAll(): void {
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
    this.retryAttempts.clear();
  }

  /**
   * Get current retry status for an operation
   */
  getRetryStatus(operation: string, userId?: string): {
    attempts: number;
    isRetrying: boolean;
    nextRetryAt?: Date;
  } {
    const attemptKey = `${operation}_${userId || 'anonymous'}`;
    const attempts = this.retryAttempts.get(attemptKey) || 0;
    const isRetrying = this.retryTimeouts.has(attemptKey);

    return {
      attempts,
      isRetrying,
      nextRetryAt: isRetrying ? new Date(Date.now() + 1000) : undefined // Approximate
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const authErrorRecoveryManager = new AuthErrorRecoveryManager();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if an error is network-related
 */
export function isNetworkError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();
  
  return lowerMessage.includes('network') ||
         lowerMessage.includes('fetch') ||
         lowerMessage.includes('timeout') ||
         lowerMessage.includes('connection') ||
         lowerMessage.includes('enotfound') ||
         lowerMessage.includes('offline');
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: AuthError): boolean {
  return error.retryable === true && (error.type === 'network' || error.type === 'auth');
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: AuthError): string {
  const strategy = errorRecoveryStrategies[error.code?.toLowerCase() || error.type];
  return strategy?.userMessage || error.message;
}

/**
 * Create a standardized error for logging
 */
export function createErrorLogEntry(
  error: AuthError,
  context: {
    operation: string;
    userId?: string;
    userAgent?: string;
    timestamp?: Date;
  }
) {
  return {
    timestamp: context.timestamp || new Date(),
    operation: context.operation,
    userId: context.userId,
    userAgent: context.userAgent,
    errorType: error.type,
    errorCode: error.code,
    errorMessage: error.message,
    retryable: error.retryable,
    severity: error.code === 'PERMISSION_ERROR' ? 'high' : 
              error.type === 'network' ? 'low' : 'medium'
  };
}