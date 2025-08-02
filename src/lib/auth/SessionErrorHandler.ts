// src/lib/auth/SessionErrorHandler.ts

export interface SessionErrorStrategy {
  type: 'network' | 'session' | 'permission' | 'unknown';
  shouldRetry: boolean;
  retryDelay: number;
  maxRetries: number;
  fallbackAction: () => void;
}

export interface SessionCheckMetrics {
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  averageResponseTime: number;
  lastSuccessTime: Date | null;
  lastFailureTime: Date | null;
  consecutiveFailures: number;
}

export const SESSION_ERROR_STRATEGIES: Record<string, SessionErrorStrategy> = {
  'AuthSessionMissingError': {
    type: 'session',
    shouldRetry: true,
    retryDelay: 2000,
    maxRetries: 2, // Limited retries for missing session
    fallbackAction: () => console.log('[SessionErrorHandler] Session missing, stopping polling')
  },
  'NetworkError': {
    type: 'network',
    shouldRetry: true,
    retryDelay: 5000,
    maxRetries: 3,
    fallbackAction: () => console.log('[SessionErrorHandler] Network error, will retry with backoff')
  },
  'AuthInvalidTokenError': {
    type: 'session',
    shouldRetry: false,
    retryDelay: 0,
    maxRetries: 0,
    fallbackAction: () => console.log('[SessionErrorHandler] Invalid token, clearing session')
  },
  'AuthApiError': {
    type: 'session',
    shouldRetry: true,
    retryDelay: 3000,
    maxRetries: 2,
    fallbackAction: () => console.log('[SessionErrorHandler] API error, limited retries')
  }
};

export class SessionErrorHandler {
  private metrics: SessionCheckMetrics;

  constructor() {
    this.metrics = {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      averageResponseTime: 0,
      lastSuccessTime: null,
      lastFailureTime: null,
      consecutiveFailures: 0
    };
  }

  categorizeError(error: unknown): {
    type: 'network' | 'session' | 'permission' | 'unknown';
    message: string;
    code?: string;
    retryable: boolean;
    strategy?: SessionErrorStrategy;
  } {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    
    // Check for specific error strategies first
    const strategy = SESSION_ERROR_STRATEGIES[errorName];
    if (strategy) {
      return {
        type: strategy.type,
        message: this.getLocalizedMessage(strategy.type),
        code: errorName,
        retryable: strategy.shouldRetry,
        strategy
      };
    }

    // Fallback to pattern matching
    if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('timeout')) {
      return {
        type: 'network',
        message: '네트워크 연결을 확인해주세요',
        code: 'NETWORK_ERROR',
        retryable: true,
        strategy: SESSION_ERROR_STRATEGIES['NetworkError']
      };
    }
    
    if (errorMessage.includes('session') || errorMessage.includes('expired') || errorMessage.includes('invalid')) {
      return {
        type: 'session',
        message: '세션이 만료되었습니다',
        code: 'SESSION_ERROR',
        retryable: true,
        strategy: SESSION_ERROR_STRATEGIES['AuthSessionMissingError']
      };
    }
    
    if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
      return {
        type: 'permission',
        message: '권한이 부족합니다',
        code: 'PERMISSION_ERROR',
        retryable: false
      };
    }
    
    return {
      type: 'unknown',
      message: '알 수 없는 오류가 발생했습니다',
      code: 'UNKNOWN_ERROR',
      retryable: true
    };
  }

  recordSessionCheck(startTime: Date, success: boolean, error?: unknown): void {
    const endTime = new Date();
    const responseTime = endTime.getTime() - startTime.getTime();
    
    this.metrics.totalChecks++;
    
    if (success) {
      this.metrics.successfulChecks++;
      this.metrics.lastSuccessTime = endTime;
      this.metrics.consecutiveFailures = 0;
    } else {
      this.metrics.failedChecks++;
      this.metrics.lastFailureTime = endTime;
      this.metrics.consecutiveFailures++;
      
      if (error) {
        const categorizedError = this.categorizeError(error);
        // Only log errors in development or for critical failures
        if (process.env.NODE_ENV === 'development' || categorizedError.type === 'permission') {
          console.warn(`[SessionErrorHandler] Session check failed (${categorizedError.type}):`, categorizedError.message);
        }
        
        // Execute fallback action if strategy exists
        if (categorizedError.strategy) {
          categorizedError.strategy.fallbackAction();
        }
        
        // Check if we should stop polling due to consecutive failures
        if (this.shouldStopPolling()) {
          console.log('[SessionErrorHandler] Session missing, stopping polling');
        }
      }
    }
    
    // Update average response time
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalChecks - 1) + responseTime) / this.metrics.totalChecks;
  }

  shouldStopPolling(): boolean {
    // Stop polling if too many consecutive failures
    return this.metrics.consecutiveFailures >= 5;
  }

  getMetrics(): Readonly<SessionCheckMetrics> {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      averageResponseTime: 0,
      lastSuccessTime: null,
      lastFailureTime: null,
      consecutiveFailures: 0
    };
  }

  private getLocalizedMessage(type: string): string {
    switch (type) {
      case 'network':
        return '네트워크 연결을 확인해주세요';
      case 'session':
        return '세션이 만료되었습니다';
      case 'permission':
        return '권한이 부족합니다';
      default:
        return '알 수 없는 오류가 발생했습니다';
    }
  }
}