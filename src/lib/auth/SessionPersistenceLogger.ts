/**
 * Session Persistence Logger
 * 
 * Provides comprehensive logging and error handling for session persistence operations.
 * Implements detailed debugging information for production troubleshooting and
 * error recovery action recommendations based on error types.
 * 
 * Requirements: 3.5, 5.4, 5.5
 */

import { logger } from '@/lib/utils/logger';
import {
  SessionPersistenceErrorType,
  SessionPersistenceErrorCategory,
  SessionPersistenceErrorSeverity,
  SessionPersistenceLogContext,
  SessionPersistenceErrorDetails,
  SessionPersistenceDebugInfo
} from './SessionPersistenceTypes';

// ============================================================================
// SESSION PERSISTENCE LOGGER CLASS
// ============================================================================

export class SessionPersistenceLogger {
  private static instance: SessionPersistenceLogger;
  private errorHistory: SessionPersistenceErrorDetails[] = [];
  private operationHistory: Array<{
    operation: string;
    timestamp: Date;
    duration: number;
    success: boolean;
    context: Partial<SessionPersistenceLogContext>;
  }> = [];
  
  private readonly MAX_ERROR_HISTORY = 50;
  private readonly MAX_OPERATION_HISTORY = 100;

  private constructor() {
    // Singleton pattern
  }

  public static getInstance(): SessionPersistenceLogger {
    if (!SessionPersistenceLogger.instance) {
      SessionPersistenceLogger.instance = new SessionPersistenceLogger();
    }
    return SessionPersistenceLogger.instance;
  }

  // ============================================================================
  // MAIN LOGGING METHODS
  // ============================================================================

  /**
   * Log session persistence operation start
   */
  logOperationStart(operation: string, context: Partial<SessionPersistenceLogContext>): string {
    const operationId = this.generateOperationId();
    const fullContext: SessionPersistenceLogContext = {
      timestamp: new Date(),
      operation,
      phase: 'initialization',
      ...context
    };

    logger.debug(`[SessionPersistence] Starting operation: ${operation}`, {
      operationId,
      context: this.sanitizeContext(fullContext)
    });

    return operationId;
  }

  /**
   * Log session persistence operation success
   */
  logOperationSuccess(
    operationId: string,
    operation: string,
    duration: number,
    context: Partial<SessionPersistenceLogContext>
  ): void {
    const fullContext: SessionPersistenceLogContext = {
      timestamp: new Date(),
      operation,
      operationDuration: duration,
      phase: 'synchronization',
      ...context
    };

    // Add to operation history
    this.addToOperationHistory(operation, duration, true, fullContext);

    logger.info(`[SessionPersistence] Operation completed successfully: ${operation}`, {
      operationId,
      duration: `${duration}ms`,
      context: this.sanitizeContext(fullContext)
    });

    // Log performance metrics if duration is significant
    if (duration > 1000) {
      logger.warn(`[SessionPersistence] Slow operation detected: ${operation}`, {
        operationId,
        duration: `${duration}ms`,
        recommendation: 'Consider performance optimization'
      });
    }
  }

  /**
   * Log session persistence error with comprehensive details
   */
  logError(
    error: Error | SessionPersistenceErrorDetails,
    context: Partial<SessionPersistenceLogContext>
  ): SessionPersistenceErrorDetails {
    let errorDetails: SessionPersistenceErrorDetails;

    if (this.isSessionPersistenceErrorDetails(error)) {
      errorDetails = error;
    } else {
      errorDetails = this.createErrorDetails(error, context);
    }

    // Add to error history
    this.addToErrorHistory(errorDetails);

    // Log based on severity
    this.logBySeverity(errorDetails);

    // Log security event for critical errors
    if (errorDetails.severity === SessionPersistenceErrorSeverity.CRITICAL) {
      logger.security({
        type: 'error',
        action: 'session_persistence_critical_error',
        userId: errorDetails.context.userId,
        success: false,
        details: {
          errorType: errorDetails.type,
          category: errorDetails.category,
          message: errorDetails.message,
          recoveryAction: errorDetails.recoveryAction
        },
        timestamp: new Date().toISOString()
      });
    }

    return errorDetails;
  }

  /**
   * Log recovery attempt
   */
  logRecoveryAttempt(
    strategy: string,
    context: Partial<SessionPersistenceLogContext>
  ): string {
    const recoveryId = this.generateOperationId();
    const fullContext: SessionPersistenceLogContext = {
      timestamp: new Date(),
      operation: `recovery_${strategy}`,
      phase: 'recovery',
      recoveryStrategy: strategy,
      ...context
    };

    logger.info(`[SessionPersistence] Starting recovery attempt: ${strategy}`, {
      recoveryId,
      context: this.sanitizeContext(fullContext)
    });

    return recoveryId;
  }

  /**
   * Log recovery result
   */
  logRecoveryResult(
    recoveryId: string,
    strategy: string,
    success: boolean,
    duration: number,
    context: Partial<SessionPersistenceLogContext>
  ): void {
    const fullContext: SessionPersistenceLogContext = {
      timestamp: new Date(),
      operation: `recovery_${strategy}`,
      phase: 'recovery',
      operationDuration: duration,
      recoveryStrategy: strategy,
      recoverySuccess: success,
      ...context
    };

    // Add to operation history
    this.addToOperationHistory(`recovery_${strategy}`, duration, success, fullContext);

    if (success) {
      logger.info(`[SessionPersistence] Recovery successful: ${strategy}`, {
        recoveryId,
        duration: `${duration}ms`,
        context: this.sanitizeContext(fullContext)
      });
    } else {
      logger.warn(`[SessionPersistence] Recovery failed: ${strategy}`, {
        recoveryId,
        duration: `${duration}ms`,
        context: this.sanitizeContext(fullContext),
        recommendation: this.getRecoveryRecommendation(strategy, fullContext)
      });
    }
  }

  /**
   * Log middleware compatibility test
   */
  logMiddlewareTest(
    success: boolean,
    responseTime: number,
    context: Partial<SessionPersistenceLogContext>
  ): void {
    const fullContext: SessionPersistenceLogContext = {
      timestamp: new Date(),
      operation: 'middleware_compatibility_test',
      phase: 'validation',
      middlewareCompatible: success,
      middlewareResponseTime: responseTime,
      operationDuration: responseTime,
      ...context
    };

    if (success) {
      logger.debug(`[SessionPersistence] Middleware compatibility test passed`, {
        responseTime: `${responseTime}ms`,
        context: this.sanitizeContext(fullContext)
      });
    } else {
      logger.warn(`[SessionPersistence] Middleware compatibility test failed`, {
        responseTime: `${responseTime}ms`,
        context: this.sanitizeContext(fullContext),
        recommendation: 'Cookie regeneration may be required'
      });
    }
  }

  /**
   * Log cookie operation
   */
  logCookieOperation(
    operation: 'generation' | 'validation' | 'clearing',
    success: boolean,
    duration: number,
    context: Partial<SessionPersistenceLogContext>
  ): void {
    const fullContext: SessionPersistenceLogContext = {
      timestamp: new Date(),
      operation: `cookie_${operation}`,
      phase: 'synchronization',
      operationDuration: duration,
      ...context
    };

    // Add to operation history
    this.addToOperationHistory(`cookie_${operation}`, duration, success, fullContext);

    if (success) {
      logger.debug(`[SessionPersistence] Cookie ${operation} successful`, {
        duration: `${duration}ms`,
        context: this.sanitizeContext(fullContext)
      });
    } else {
      logger.warn(`[SessionPersistence] Cookie ${operation} failed`, {
        duration: `${duration}ms`,
        context: this.sanitizeContext(fullContext),
        recommendation: this.getCookieOperationRecommendation(operation, fullContext)
      });
    }
  }

  // ============================================================================
  // ERROR ANALYSIS AND RECOMMENDATIONS
  // ============================================================================

  /**
   * Get error recovery recommendation based on error type and context
   */
  getErrorRecoveryRecommendation(errorDetails: SessionPersistenceErrorDetails): {
    action: string;
    priority: string;
    steps: string[];
    estimatedTime: string;
    successProbability: number;
  } {
    const { type, category, context } = errorDetails;

    switch (category) {
      case SessionPersistenceErrorCategory.COOKIE_GENERATION:
        return {
          action: 'regenerate_cookies',
          priority: 'high',
          steps: [
            'Clear corrupted cookies',
            'Refresh session tokens',
            'Regenerate cookies with validation',
            'Test middleware compatibility'
          ],
          estimatedTime: '2-5 seconds',
          successProbability: 0.85
        };

      case SessionPersistenceErrorCategory.MIDDLEWARE_COMPATIBILITY:
        return {
          action: 'fix_middleware_compatibility',
          priority: 'high',
          steps: [
            'Clear incompatible cookies',
            'Regenerate with enhanced validation',
            'Test middleware parsing',
            'Verify session synchronization'
          ],
          estimatedTime: '3-7 seconds',
          successProbability: 0.75
        };

      case SessionPersistenceErrorCategory.SESSION_SYNC:
        return {
          action: 'resync_session',
          priority: 'medium',
          steps: [
            'Validate current session',
            'Refresh session if needed',
            'Synchronize with middleware',
            'Verify persistence'
          ],
          estimatedTime: '1-3 seconds',
          successProbability: 0.90
        };

      case SessionPersistenceErrorCategory.RECOVERY_EXHAUSTED:
        return {
          action: 'force_reauth',
          priority: 'critical',
          steps: [
            'Clear all session data',
            'Sign out user completely',
            'Redirect to login page',
            'Log incident for analysis'
          ],
          estimatedTime: '1-2 seconds',
          successProbability: 1.0
        };

      default:
        return {
          action: 'generic_retry',
          priority: 'medium',
          steps: [
            'Wait for retry delay',
            'Attempt operation again',
            'Monitor for success',
            'Escalate if persistent'
          ],
          estimatedTime: '2-10 seconds',
          successProbability: 0.60
        };
    }
  }

  /**
   * Analyze error patterns and provide insights
   */
  analyzeErrorPatterns(): {
    mostCommonErrors: Array<{ type: SessionPersistenceErrorType; count: number; percentage: number }>;
    errorTrends: Array<{ hour: number; errorCount: number }>;
    recoverySuccessRate: number;
    recommendations: string[];
  } {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentErrors = this.errorHistory.filter(error => 
      error.context.timestamp > last24Hours
    );

    // Count error types
    const errorCounts = new Map<SessionPersistenceErrorType, number>();
    recentErrors.forEach(error => {
      errorCounts.set(error.type, (errorCounts.get(error.type) || 0) + 1);
    });

    const mostCommonErrors = Array.from(errorCounts.entries())
      .map(([type, count]) => ({
        type,
        count,
        percentage: (count / recentErrors.length) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Analyze hourly trends
    const hourlyErrors = new Array(24).fill(0);
    recentErrors.forEach(error => {
      const hour = error.context.timestamp.getHours();
      hourlyErrors[hour]++;
    });

    const errorTrends = hourlyErrors.map((count, hour) => ({ hour, errorCount: count }));

    // Calculate recovery success rate
    const recentOperations = this.operationHistory.filter(op => 
      op.timestamp > last24Hours && op.operation.startsWith('recovery_')
    );
    const successfulRecoveries = recentOperations.filter(op => op.success).length;
    const recoverySuccessRate = recentOperations.length > 0 
      ? (successfulRecoveries / recentOperations.length) * 100 
      : 0;

    // Generate recommendations
    const recommendations = this.generateRecommendations(mostCommonErrors, recoverySuccessRate);

    return {
      mostCommonErrors,
      errorTrends,
      recoverySuccessRate,
      recommendations
    };
  }

  /**
   * Get debugging information for production troubleshooting
   */
  getDebugInfo(): {
    recentErrors: SessionPersistenceErrorDetails[];
    recentOperations: Array<{
      operation: string;
      timestamp: Date;
      duration: number;
      success: boolean;
      context: Partial<SessionPersistenceLogContext>;
    }>;
    systemInfo: {
      timestamp: Date;
      userAgent: string;
      cookiesEnabled: boolean;
      localStorageEnabled: boolean;
      online: boolean;
    };
    performanceMetrics: {
      averageOperationTime: number;
      slowOperations: number;
      errorRate: number;
    };
  } {
    const now = new Date();
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentErrors = this.errorHistory.filter(error => 
      error.context.timestamp > lastHour
    ).slice(-10);

    const recentOperations = this.operationHistory.filter(op => 
      op.timestamp > lastHour
    ).slice(-20);

    // Calculate performance metrics
    const operationTimes = recentOperations.map(op => op.duration);
    const averageOperationTime = operationTimes.length > 0 
      ? operationTimes.reduce((sum, time) => sum + time, 0) / operationTimes.length 
      : 0;
    
    const slowOperations = operationTimes.filter(time => time > 1000).length;
    const errorRate = recentOperations.length > 0 
      ? (recentOperations.filter(op => !op.success).length / recentOperations.length) * 100 
      : 0;

    return {
      recentErrors,
      recentOperations,
      systemInfo: {
        timestamp: now,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        cookiesEnabled: typeof navigator !== 'undefined' ? navigator.cookieEnabled : false,
        localStorageEnabled: this.isLocalStorageEnabled(),
        online: typeof navigator !== 'undefined' ? navigator.onLine : true
      },
      performanceMetrics: {
        averageOperationTime,
        slowOperations,
        errorRate
      }
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private isSessionPersistenceErrorDetails(error: any): error is SessionPersistenceErrorDetails {
    return error && typeof error === 'object' && 'type' in error && 'category' in error;
  }

  private createErrorDetails(
    error: Error,
    context: Partial<SessionPersistenceLogContext>
  ): SessionPersistenceErrorDetails {
    const errorType = this.categorizeError(error);
    const category = this.getErrorCategory(errorType);
    const severity = this.getErrorSeverity(errorType, context);

    const fullContext: SessionPersistenceLogContext = {
      timestamp: new Date(),
      operation: 'unknown',
      phase: 'synchronization',
      stackTrace: error.stack,
      ...context
    };

    return {
      type: errorType,
      category,
      severity,
      message: error.message,
      context: fullContext,
      recoverable: this.isRecoverable(errorType, context),
      recoveryAction: this.getRecoveryAction(errorType, context),
      recoveryPriority: this.getRecoveryPriority(severity),
      debugInfo: this.createDebugInfo(error, fullContext)
    };
  }

  private categorizeError(error: Error): SessionPersistenceErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('cookie') && message.includes('generation')) {
      return SessionPersistenceErrorType.COOKIE_GENERATION_FAILED;
    }
    if (message.includes('cookie') && message.includes('validation')) {
      return SessionPersistenceErrorType.COOKIE_VALIDATION_FAILED;
    }
    if (message.includes('middleware') && message.includes('compatibility')) {
      return SessionPersistenceErrorType.MIDDLEWARE_COMPATIBILITY_FAILED;
    }
    if (message.includes('timeout')) {
      return SessionPersistenceErrorType.SESSION_SYNC_TIMEOUT;
    }
    if (message.includes('network') || message.includes('fetch')) {
      return SessionPersistenceErrorType.NETWORK_ERROR;
    }
    if (message.includes('session') && message.includes('invalid')) {
      return SessionPersistenceErrorType.INVALID_SESSION_DATA;
    }
    if (message.includes('recovery') && message.includes('exhausted')) {
      return SessionPersistenceErrorType.RECOVERY_EXHAUSTED;
    }
    
    return SessionPersistenceErrorType.PERSISTENT_SYNC_FAILURE;
  }

  private getErrorCategory(type: SessionPersistenceErrorType): SessionPersistenceErrorCategory {
    switch (type) {
      case SessionPersistenceErrorType.COOKIE_GENERATION_FAILED:
        return SessionPersistenceErrorCategory.COOKIE_GENERATION;
      case SessionPersistenceErrorType.COOKIE_VALIDATION_FAILED:
        return SessionPersistenceErrorCategory.COOKIE_VALIDATION;
      case SessionPersistenceErrorType.MIDDLEWARE_COMPATIBILITY_FAILED:
        return SessionPersistenceErrorCategory.MIDDLEWARE_COMPATIBILITY;
      case SessionPersistenceErrorType.SESSION_SYNC_TIMEOUT:
        return SessionPersistenceErrorCategory.TIMEOUT_ERROR;
      case SessionPersistenceErrorType.NETWORK_ERROR:
        return SessionPersistenceErrorCategory.NETWORK_ERROR;
      case SessionPersistenceErrorType.RECOVERY_EXHAUSTED:
        return SessionPersistenceErrorCategory.RECOVERY_EXHAUSTED;
      default:
        return SessionPersistenceErrorCategory.SESSION_SYNC;
    }
  }

  private getErrorSeverity(
    type: SessionPersistenceErrorType,
    context: Partial<SessionPersistenceLogContext>
  ): SessionPersistenceErrorSeverity {
    // Critical errors that require immediate attention
    if (type === SessionPersistenceErrorType.RECOVERY_EXHAUSTED) {
      return SessionPersistenceErrorSeverity.CRITICAL;
    }

    // High severity for persistent failures
    if (context.retryAttempt && context.retryAttempt >= 3) {
      return SessionPersistenceErrorSeverity.HIGH;
    }

    // Medium severity for middleware and cookie issues
    if ([
      SessionPersistenceErrorType.MIDDLEWARE_COMPATIBILITY_FAILED,
      SessionPersistenceErrorType.COOKIE_GENERATION_FAILED
    ].includes(type)) {
      return SessionPersistenceErrorSeverity.MEDIUM;
    }

    return SessionPersistenceErrorSeverity.LOW;
  }

  private isRecoverable(
    type: SessionPersistenceErrorType,
    context: Partial<SessionPersistenceLogContext>
  ): boolean {
    // Recovery exhausted is not recoverable
    if (type === SessionPersistenceErrorType.RECOVERY_EXHAUSTED) {
      return false;
    }

    // Too many retry attempts
    if (context.retryAttempt && context.retryAttempt >= 5) {
      return false;
    }

    return true;
  }

  private getRecoveryAction(
    type: SessionPersistenceErrorType,
    context: Partial<SessionPersistenceLogContext>
  ): 'retry' | 'regenerate' | 'clear' | 'reauth' | 'escalate' {
    if (type === SessionPersistenceErrorType.RECOVERY_EXHAUSTED) {
      return 'reauth';
    }

    if (context.retryAttempt && context.retryAttempt >= 3) {
      return 'clear';
    }

    switch (type) {
      case SessionPersistenceErrorType.COOKIE_GENERATION_FAILED:
      case SessionPersistenceErrorType.COOKIE_VALIDATION_FAILED:
        return 'regenerate';
      case SessionPersistenceErrorType.MIDDLEWARE_COMPATIBILITY_FAILED:
        return 'regenerate';
      case SessionPersistenceErrorType.NETWORK_ERROR:
        return 'retry';
      default:
        return 'retry';
    }
  }

  private getRecoveryPriority(severity: SessionPersistenceErrorSeverity): 'immediate' | 'high' | 'medium' | 'low' {
    switch (severity) {
      case SessionPersistenceErrorSeverity.CRITICAL:
        return 'immediate';
      case SessionPersistenceErrorSeverity.HIGH:
        return 'high';
      case SessionPersistenceErrorSeverity.MEDIUM:
        return 'medium';
      default:
        return 'low';
    }
  }

  private createDebugInfo(
    error: Error,
    context: SessionPersistenceLogContext
  ): SessionPersistenceDebugInfo {
    return {
      errorId: this.generateOperationId(),
      timestamp: new Date(),
      environment: process.env.NODE_ENV as 'development' | 'production' | 'test' || 'production',
      browserInfo: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        cookiesEnabled: typeof navigator !== 'undefined' ? navigator.cookieEnabled : false,
        localStorageEnabled: this.isLocalStorageEnabled(),
        sessionStorageEnabled: this.isSessionStorageEnabled()
      },
      networkInfo: {
        online: typeof navigator !== 'undefined' ? navigator.onLine : true,
        connectionType: this.getConnectionType(),
        effectiveType: this.getEffectiveConnectionType()
      },
      sessionInfo: {
        sessionId: context.sessionId,
        sessionAge: context.sessionExpiry ? Date.now() - context.sessionExpiry.getTime() : undefined,
        lastSyncTime: context.timestamp,
        syncAttempts: context.retryAttempt || 0
      },
      performanceInfo: {
        operationDuration: context.operationDuration || 0,
        memoryUsage: this.getMemoryUsage(),
        cpuUsage: undefined // CPU usage is not available in browser
      },
      errorChain: [{
        error: error.message,
        timestamp: new Date(),
        operation: context.operation
      }]
    };
  }

  private logBySeverity(errorDetails: SessionPersistenceErrorDetails): void {
    const logData = {
      errorId: errorDetails.debugInfo.errorId,
      type: errorDetails.type,
      category: errorDetails.category,
      recoveryAction: errorDetails.recoveryAction,
      context: this.sanitizeContext(errorDetails.context)
    };

    switch (errorDetails.severity) {
      case SessionPersistenceErrorSeverity.CRITICAL:
        logger.critical(`[SessionPersistence] Critical error: ${errorDetails.message}`, logData);
        break;
      case SessionPersistenceErrorSeverity.HIGH:
        logger.error(`[SessionPersistence] High severity error: ${errorDetails.message}`, logData);
        break;
      case SessionPersistenceErrorSeverity.MEDIUM:
        logger.warn(`[SessionPersistence] Medium severity error: ${errorDetails.message}`, logData);
        break;
      default:
        logger.debug(`[SessionPersistence] Low severity error: ${errorDetails.message}`, logData);
        break;
    }
  }

  private addToErrorHistory(errorDetails: SessionPersistenceErrorDetails): void {
    this.errorHistory.push(errorDetails);
    
    if (this.errorHistory.length > this.MAX_ERROR_HISTORY) {
      this.errorHistory = this.errorHistory.slice(-this.MAX_ERROR_HISTORY);
    }
  }

  private addToOperationHistory(
    operation: string,
    duration: number,
    success: boolean,
    context: SessionPersistenceLogContext
  ): void {
    this.operationHistory.push({
      operation,
      timestamp: new Date(),
      duration,
      success,
      context
    });
    
    if (this.operationHistory.length > this.MAX_OPERATION_HISTORY) {
      this.operationHistory = this.operationHistory.slice(-this.MAX_OPERATION_HISTORY);
    }
  }

  private getRecoveryRecommendation(
    strategy: string,
    context: SessionPersistenceLogContext
  ): string {
    if (context.retryAttempt && context.retryAttempt >= 3) {
      return 'Consider escalating to session clearing or re-authentication';
    }

    switch (strategy) {
      case 'cookie_generation':
        return 'Try session refresh before cookie regeneration';
      case 'middleware_compatibility':
        return 'Verify cookie format and middleware parsing logic';
      case 'session_sync':
        return 'Check network connectivity and session validity';
      default:
        return 'Monitor for patterns and consider alternative strategies';
    }
  }

  private getCookieOperationRecommendation(
    operation: 'generation' | 'validation' | 'clearing',
    context: SessionPersistenceLogContext
  ): string {
    switch (operation) {
      case 'generation':
        return 'Verify session validity and try session refresh';
      case 'validation':
        return 'Check cookie format and middleware compatibility';
      case 'clearing':
        return 'Ensure all cookie domains and paths are cleared';
      default:
        return 'Review cookie operation parameters';
    }
  }

  private generateRecommendations(
    mostCommonErrors: Array<{ type: SessionPersistenceErrorType; count: number; percentage: number }>,
    recoverySuccessRate: number
  ): string[] {
    const recommendations: string[] = [];

    // High error rate recommendations
    if (mostCommonErrors.length > 0 && mostCommonErrors[0].percentage > 50) {
      const topError = mostCommonErrors[0];
      recommendations.push(`Address primary error type: ${topError.type} (${topError.percentage.toFixed(1)}% of errors)`);
    }

    // Low recovery success rate
    if (recoverySuccessRate < 70) {
      recommendations.push(`Improve recovery strategies (current success rate: ${recoverySuccessRate.toFixed(1)}%)`);
    }

    // Cookie-related issues
    const cookieErrors = mostCommonErrors.filter(error => 
      error.type.includes('COOKIE')
    );
    if (cookieErrors.length > 0) {
      recommendations.push('Review cookie generation and validation logic');
    }

    // Middleware issues
    const middlewareErrors = mostCommonErrors.filter(error => 
      error.type.includes('MIDDLEWARE')
    );
    if (middlewareErrors.length > 0) {
      recommendations.push('Review middleware compatibility and cookie parsing logic');
    }

    // Network issues
    const networkErrors = mostCommonErrors.filter(error => 
      error.type.includes('NETWORK') || error.type.includes('TIMEOUT')
    );
    if (networkErrors.length > 0) {
      recommendations.push('Implement better network error handling and retry logic');
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('Monitor error patterns and implement proactive error prevention');
    }

    return recommendations;
  }

  private sanitizeContext(context: SessionPersistenceLogContext): Partial<SessionPersistenceLogContext> {
    // Remove sensitive information from context before logging
    const sanitized = { ...context };
    
    // Remove or mask sensitive data
    if (sanitized.sessionId) {
      sanitized.sessionId = sanitized.sessionId.substring(0, 8) + '...';
    }
    if (sanitized.userId) {
      sanitized.userId = sanitized.userId.substring(0, 8) + '...';
    }
    
    // Remove stack trace in production
    if (process.env.NODE_ENV === 'production') {
      delete sanitized.stackTrace;
    }
    
    return sanitized;
  }

  private generateOperationId(): string {
    return `sp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isLocalStorageEnabled(): boolean {
    try {
      if (typeof window === 'undefined') return false;
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  private isSessionStorageEnabled(): boolean {
    try {
      if (typeof window === 'undefined') return false;
      const test = '__sessionStorage_test__';
      sessionStorage.setItem(test, test);
      sessionStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  private getConnectionType(): string | undefined {
    if (typeof navigator === 'undefined') return undefined;
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    return connection?.type;
  }

  private getEffectiveConnectionType(): string | undefined {
    if (typeof navigator === 'undefined') return undefined;
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    return connection?.effectiveType;
  }

  private getMemoryUsage(): number | undefined {
    if (typeof performance === 'undefined' || !('memory' in performance)) return undefined;
    return (performance as any).memory?.usedJSHeapSize;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const sessionPersistenceLogger = SessionPersistenceLogger.getInstance();