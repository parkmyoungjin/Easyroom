/**
 * Enhanced Authentication Error Handler
 * Provides centralized error handling for authentication and navigation errors
 */

import { AuthTimeoutError, RecoveryOption, getRecoveryOptions, isNetworkError } from './auth-timeout';
import { AuthErrorType, getErrorInfo, analyzeSupabaseError } from './error-messages';

// Enhanced logging interface
export interface AuthLogger {
  debug: (message: string, data?: any) => void;
  info: (message: string, data?: any) => void;
  warn: (message: string, data?: any) => void;
  error: (message: string, data?: any) => void;
}

// Default logger implementation
class DefaultAuthLogger implements AuthLogger {
  private isDevelopment: boolean = false;
  
  constructor() {
    // ✅ 비동기 초기화 함수를 호출합니다.
    this.initializeDevelopmentFlag();
  }
  
  private async initializeDevelopmentFlag() {
    try {
      const { getPublicEnvVar } = await import('@/lib/security/secure-environment-access');
      // ✅ try...catch로 감싸서 에러를 처리합니다.
      try {
        const nodeEnv = getPublicEnvVar('NODE_ENV', 'auth-error-handler');
        this.isDevelopment = nodeEnv === 'development';
      } catch (e) {
        this.isDevelopment = false; // 에러 발생 시 false로 폴백
      }
    } catch {
      this.isDevelopment = false;
    }
  }
  
  debug(message: string, data?: any): void {
    if (this.isDevelopment) {
      console.debug(`[AuthDebug] ${message}`, data || '');
    }
  }
  
  info(message: string, data?: any): void {
    console.info(`[AuthInfo] ${message}`, data || '');
  }
  
  warn(message: string, data?: any): void {
    console.warn(`[AuthWarn] ${message}`, data || '');
  }
  
  error(message: string, data?: any): void {
    console.error(`[AuthError] ${message}`, data || '');
  }
}

export interface AuthError {
  type: 'network' | 'auth' | 'timeout' | 'redirect' | 'unknown';
  message: string;
  code?: string;
  recoverable: boolean;
  retryAction?: () => void;
  originalError?: any;
  timestamp: number;
}

export interface ErrorHandlerOptions {
  showToast?: boolean;
  logError?: boolean;
  autoRetry?: boolean;
  maxRetries?: number;
}

export interface UserFriendlyError {
  title: string;
  message: string;
  recoveryOptions: RecoveryOption[];
  severity: 'error' | 'warning' | 'info';
}

/**
 * Centralized authentication error handler
 */
export class AuthErrorHandler {
  private static instance: AuthErrorHandler;
  private errorLog: AuthError[] = [];
  private logger: AuthLogger;
  private debugMode: boolean;

  constructor(logger?: AuthLogger) {
    this.logger = logger || new DefaultAuthLogger();
    this.debugMode = (typeof window !== 'undefined' && window.localStorage?.getItem('auth-debug') === 'true') || false;
    
    // Initialize debug mode asynchronously
    this.initializeDebugMode();
  }
  
  private async initializeDebugMode() {
    try {
      const { getPublicEnvVar } = await import('@/lib/security/secure-environment-access');
      // ✅ try...catch로 감싸서 에러를 처리합니다.
      try {
        const nodeEnv = getPublicEnvVar('NODE_ENV', 'auth-error-handler');
        this.debugMode = nodeEnv === 'development' || 
                         (typeof window !== 'undefined' && window.localStorage?.getItem('auth-debug') === 'true');
      } catch (e) {
        // 에러 발생 시 기존 값 유지 (localStorage 값에 의존)
      }
    } catch {
      // import 실패 시 기존 값 유지
    }
  }

  // ... 이하 모든 코드는 변경 없이 그대로 유지 ...
    static getInstance(logger?: AuthLogger): AuthErrorHandler {
    if (!AuthErrorHandler.instance) {
      AuthErrorHandler.instance = new AuthErrorHandler(logger);
    }
    return AuthErrorHandler.instance;
  }

  /**
   * Enables or disables debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    if (typeof window !== 'undefined') {
      if (enabled) {
        window.localStorage.setItem('auth-debug', 'true');
      } else {
        window.localStorage.removeItem('auth-debug');
      }
    }
    this.logger.info(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Gets current debug mode status
   */
  isDebugMode(): boolean {
    return this.debugMode;
  }

  /**
   * Handles authentication errors and returns structured error information
   */
  handleAuthError(error: any, options: ErrorHandlerOptions = {}): AuthError {
    const authError = this.analyzeError(error);
    
    // Enhanced logging with context
    if (options.logError !== false) {
      this.logError(authError);
    }

    // Debug mode logging
    if (this.debugMode) {
      this.logger.debug('Processing authentication error', {
        errorType: authError.type,
        errorCode: authError.code,
        recoverable: authError.recoverable,
        hasRetryAction: !!authError.retryAction,
        stackTrace: authError.originalError?.stack
      });
    }

    // Auto-retry logic for recoverable errors
    if (options.autoRetry && authError.recoverable && authError.retryAction) {
      const maxRetries = options.maxRetries || 1;
      this.logger.info(`Auto-retry enabled for ${authError.type} error (max: ${maxRetries})`);
      
      // Schedule retry after a short delay
      setTimeout(() => {
        try {
          authError.retryAction!();
        } catch (retryError) {
          this.logger.error('Auto-retry failed', retryError);
        }
      }, 1000);
    }

    return authError;
  }

  /**
   * Analyzes error and creates structured AuthError
   */
  private analyzeError(error: any): AuthError {
    const timestamp = Date.now();
    
    // Handle timeout errors
    if (error instanceof Error && error.name === 'AuthTimeoutError') {
      const timeoutError = error as AuthTimeoutError;
      return {
        type: 'timeout',
        message: error.message,
        code: timeoutError.type,
        recoverable: timeoutError.recoverable,
        retryAction: timeoutError.retryAction,
        originalError: error,
        timestamp
      };
    }

    // Handle network errors
    if (isNetworkError(error)) {
      return {
        type: 'network',
        message: error?.message || 'Network connection error',
        code: 'NETWORK_ERROR',
        recoverable: true,
        retryAction: () => window.location.reload(),
        originalError: error,
        timestamp
      };
    }

    // Handle Supabase authentication errors
    if (error && typeof error === 'object') {
      const supabaseErrorType = analyzeSupabaseError(error);
      const errorInfo = getErrorInfo(supabaseErrorType);
      
      return {
        type: 'auth',
        message: errorInfo.message,
        code: supabaseErrorType,
        recoverable: supabaseErrorType !== 'TOKEN_INVALID',
        retryAction: this.getRetryActionForAuthError(supabaseErrorType),
        originalError: error,
        timestamp
      };
    }

    // Handle redirect errors
    if (error?.message?.includes('redirect') || error?.message?.includes('navigation')) {
      return {
        type: 'redirect',
        message: error.message || 'Navigation error occurred',
        code: 'REDIRECT_ERROR',
        recoverable: true,
        retryAction: () => window.location.href = '/',
        originalError: error,
        timestamp
      };
    }

    // Handle unknown errors
    return {
      type: 'unknown',
      message: error?.message || 'An unknown error occurred',
      code: 'UNKNOWN_ERROR',
      recoverable: true,
      retryAction: () => window.location.reload(),
      originalError: error,
      timestamp
    };
  }

  /**
   * Gets retry action for specific authentication error types
   */
  private getRetryActionForAuthError(errorType: AuthErrorType): (() => void) | undefined {
    switch (errorType) {
      case 'EMAIL_NOT_CONFIRMED':
        return () => window.location.href = '/auth/verify-email';
      case 'TOKEN_EXPIRED':
        return () => window.location.href = '/login';
      case 'SESSION_ERROR':
        return () => window.location.reload();
      case 'NETWORK_ERROR':
        return () => window.location.reload();
      default:
        return undefined;
    }
  }

  /**
   * Converts AuthError to user-friendly error message
   */
  getUserFriendlyError(authError: AuthError): UserFriendlyError {
    let title: string;
    let message: string;
    let recoveryOptions: RecoveryOption[] = [];
    let severity: 'error' | 'warning' | 'info' = 'error';

    switch (authError.type) {
      case 'timeout':
        if (authError.originalError instanceof Error && authError.originalError.name === 'AuthTimeoutError') {
          const timeoutError = authError.originalError as AuthTimeoutError;
          title = this.getTimeoutTitle(timeoutError.type);
          message = authError.message;
          recoveryOptions = getRecoveryOptions(timeoutError);
          severity = 'warning';
        } else {
          title = '시간 초과';
          message = authError.message;
          recoveryOptions = this.getDefaultRecoveryOptions(authError);
          severity = 'warning';
        }
        break;

      case 'network':
        title = '네트워크 연결 오류';
        message = '인터넷 연결을 확인하고 다시 시도해주세요.';
        recoveryOptions = [
          {
            label: '다시 시도',
            action: authError.retryAction || (() => window.location.reload()),
            primary: true
          },
          {
            label: '네트워크 상태 확인',
            action: () => window.open('https://www.google.com', '_blank')
          }
        ];
        severity = 'error';
        break;

      case 'auth':
        const errorInfo = getErrorInfo(authError.code as AuthErrorType);
        title = errorInfo.title;
        message = errorInfo.message;
        severity = errorInfo.severity;
        recoveryOptions = this.getAuthRecoveryOptions(authError);
        break;

      case 'redirect':
        title = '페이지 이동 오류';
        message = '페이지 이동 중 문제가 발생했습니다.';
        recoveryOptions = [
          {
            label: '메인 페이지로 이동',
            action: () => window.location.href = '/',
            primary: true
          },
          {
            label: '새로고침',
            action: () => window.location.reload()
          }
        ];
        severity = 'warning';
        break;

      default:
        title = '오류 발생';
        message = authError.message || '알 수 없는 오류가 발생했습니다.';
        recoveryOptions = this.getDefaultRecoveryOptions(authError);
        severity = 'error';
    }

    return {
      title,
      message,
      recoveryOptions,
      severity
    };
  }

  /**
   * Gets timeout-specific title
   */
  private getTimeoutTitle(timeoutType: string): string {
    switch (timeoutType) {
      case 'login_timeout':
        return '로그인 시간 초과';
      case 'redirect_timeout':
        return '페이지 이동 시간 초과';
      case 'auth_timeout':
        return '인증 확인 시간 초과';
      default:
        return '시간 초과';
    }
  }

  /**
   * Gets recovery options for authentication errors
   */
  private getAuthRecoveryOptions(authError: AuthError): RecoveryOption[] {
    const options: RecoveryOption[] = [];

    if (authError.retryAction) {
      options.push({
        label: '다시 시도',
        action: authError.retryAction,
        primary: true
      });
    }

    switch (authError.code) {
      case 'EMAIL_NOT_CONFIRMED':
        options.push({
          label: '이메일 인증하기',
          action: () => window.location.href = '/auth/verify-email'
        });
        break;
      case 'TOKEN_EXPIRED':
        options.push({
          label: '다시 로그인',
          action: () => window.location.href = '/login',
          primary: !authError.retryAction
        });
        break;
      case 'SESSION_ERROR':
        options.push({
          label: '새로고침',
          action: () => window.location.reload(),
          primary: !authError.retryAction
        });
        break;
    }

    return options;
  }

  /**
   * Gets default recovery options
   */
  private getDefaultRecoveryOptions(authError: AuthError): RecoveryOption[] {
    const options: RecoveryOption[] = [];

    if (authError.retryAction) {
      options.push({
        label: '다시 시도',
        action: authError.retryAction,
        primary: true
      });
    }

    options.push({
      label: '새로고침',
      action: () => window.location.reload(),
      primary: !authError.retryAction
    });

    return options;
  }

  /**
   * Logs error for debugging with enhanced context
   */
  private logError(authError: AuthError): void {
    this.errorLog.push(authError);
    
    // Keep only last 50 errors
    if (this.errorLog.length > 50) {
      this.errorLog = this.errorLog.slice(-50);
    }

    // Enhanced logging with context
    const logContext = {
      type: authError.type,
      message: authError.message,
      code: authError.code,
      recoverable: authError.recoverable,
      timestamp: new Date(authError.timestamp).toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'SSR',
      url: typeof window !== 'undefined' ? window.location.href : 'SSR',
      sessionId: this.getSessionId(),
      errorCount: this.errorLog.length,
      originalError: this.debugMode ? authError.originalError : authError.originalError?.message
    };

    // Use appropriate log level based on error type
    switch (authError.type) {
      case 'timeout':
        this.logger.warn('Authentication timeout occurred', logContext);
        break;
      case 'network':
        this.logger.error('Network error in authentication', logContext);
        break;
      case 'auth':
        this.logger.error('Authentication error', logContext);
        break;
      case 'redirect':
        this.logger.warn('Navigation error', logContext);
        break;
      default:
        this.logger.error('Unknown authentication error', logContext);
    }

    // Additional debug logging for development
    if (this.debugMode) {
      this.logger.debug('Full error stack trace', {
        stack: authError.originalError?.stack,
        errorObject: authError.originalError
      });
    }
  }

  /**
   * Gets or creates a session ID for error tracking
   */
  private getSessionId(): string {
    if (typeof window === 'undefined') return 'ssr-session';
    
    let sessionId = window.sessionStorage.getItem('auth-session-id');
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      window.sessionStorage.setItem('auth-session-id', sessionId);
    }
    return sessionId;
  }

  /**
   * Gets error log for debugging
   */
  getErrorLog(): AuthError[] {
    return [...this.errorLog];
  }

  /**
   * Clears error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
    this.logger.info('Error log cleared');
  }

  /**
   * Gets error statistics for monitoring
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsByCode: Record<string, number>;
    recoverableErrors: number;
    timeRange: { oldest: string; newest: string } | null;
  } {
    if (this.errorLog.length === 0) {
      return {
        totalErrors: 0,
        errorsByType: {},
        errorsByCode: {},
        recoverableErrors: 0,
        timeRange: null
      };
    }

    const errorsByType: Record<string, number> = {};
    const errorsByCode: Record<string, number> = {};
    let recoverableErrors = 0;

    this.errorLog.forEach(error => {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
      if (error.code) {
        errorsByCode[error.code] = (errorsByCode[error.code] || 0) + 1;
      }
      if (error.recoverable) {
        recoverableErrors++;
      }
    });

    const timestamps = this.errorLog.map(e => e.timestamp).sort();
    const timeRange = {
      oldest: new Date(timestamps[0]).toISOString(),
      newest: new Date(timestamps[timestamps.length - 1]).toISOString()
    };

    return {
      totalErrors: this.errorLog.length,
      errorsByType,
      errorsByCode,
      recoverableErrors,
      timeRange
    };
  }

  /**
   * Exports error log for external analysis
   */
  exportErrorLog(): string {
    const exportData = {
      exportedAt: new Date().toISOString(),
      sessionId: this.getSessionId(),
      debugMode: this.debugMode,
      statistics: this.getErrorStatistics(),
      errors: this.errorLog.map(error => ({
        ...error,
        timestampISO: new Date(error.timestamp).toISOString(),
        // Remove potentially sensitive data
        originalError: this.debugMode ? error.originalError : undefined
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Checks if there are recent critical errors
   */
  hasRecentCriticalErrors(timeWindowMs: number = 300000): boolean { // 5 minutes default
    const cutoffTime = Date.now() - timeWindowMs;
    return this.errorLog.some(error => 
      error.timestamp > cutoffTime && 
      (error.type === 'auth' || error.type === 'network') &&
      !error.recoverable
    );
  }

  /**
   * Gets recent errors within a time window
   */
  getRecentErrors(timeWindowMs: number = 300000): AuthError[] {
    const cutoffTime = Date.now() - timeWindowMs;
    return this.errorLog.filter(error => error.timestamp > cutoffTime);
  }

  /**
   * Monitors error patterns and suggests actions
   */
  analyzeErrorPatterns(): {
    patterns: string[];
    suggestions: string[];
    severity: 'low' | 'medium' | 'high';
  } {
    const recentErrors = this.getRecentErrors();
    const patterns: string[] = [];
    const suggestions: string[] = [];
    let severity: 'low' | 'medium' | 'high' = 'low';

    if (recentErrors.length === 0) {
      return { patterns, suggestions, severity };
    }

    // Check for repeated timeout errors
    const timeoutErrors = recentErrors.filter(e => e.type === 'timeout');
    if (timeoutErrors.length >= 3) {
      patterns.push(`${timeoutErrors.length}개의 연속된 타임아웃 오류`);
      suggestions.push('네트워크 연결 상태를 확인하세요');
      suggestions.push('브라우저 캐시를 지우고 다시 시도하세요');
      severity = 'high';
    }

    // Check for repeated network errors
    const networkErrors = recentErrors.filter(e => e.type === 'network');
    if (networkErrors.length >= 2) {
      patterns.push(`${networkErrors.length}개의 네트워크 오류`);
      suggestions.push('인터넷 연결을 확인하세요');
      suggestions.push('VPN 연결을 확인하세요');
      severity = severity === 'high' ? 'high' : 'medium';
    }

    // Check for authentication failures
    const authErrors = recentErrors.filter(e => e.type === 'auth');
    if (authErrors.length >= 2) {
      patterns.push(`${authErrors.length}개의 인증 오류`);
      suggestions.push('로그아웃 후 다시 로그인해보세요');
      suggestions.push('브라우저 쿠키를 확인하세요');
      severity = severity === 'high' ? 'high' : 'medium';
    }

    // Check for redirect issues
    const redirectErrors = recentErrors.filter(e => e.type === 'redirect');
    if (redirectErrors.length >= 2) {
      patterns.push(`${redirectErrors.length}개의 페이지 이동 오류`);
      suggestions.push('브라우저를 새로고침하세요');
      suggestions.push('다른 브라우저에서 시도해보세요');
    }

    return { patterns, suggestions, severity };
  }
}

/**
 * Convenience function to get error handler instance
 */
export function getAuthErrorHandler(): AuthErrorHandler {
  return AuthErrorHandler.getInstance();
}

/**
 * Convenience function to handle authentication errors
 */
export function handleAuthError(error: any, options?: ErrorHandlerOptions): UserFriendlyError {
  const handler = getAuthErrorHandler();
  const authError = handler.handleAuthError(error, options);
  return handler.getUserFriendlyError(authError);
}