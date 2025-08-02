/**
 * Session Persistence State Manager
 * 
 * Manages session persistence state across browser sessions and page refreshes.
 * Provides comprehensive error tracking, performance monitoring, and recovery recommendations.
 */

import {
  SessionPersistenceState,
  SessionSyncError,
  MiddlewareTestResult,
  SessionPerformanceMetrics,
  SessionPersistenceError,
  SessionPersistenceErrorType,
  SessionPersistenceConfig,
  DEFAULT_SESSION_PERSISTENCE_CONFIG
} from './SessionPersistenceState';

export class SessionPersistenceStateManager {
  private static readonly STORAGE_KEY = 'session_persistence_state';
  public static readonly PERFORMANCE_STORAGE_KEY = 'session_performance_metrics';
  
  private state: SessionPersistenceState;
  private config: SessionPersistenceConfig;
  private performanceTracker: PerformanceTracker;
  
  constructor(config: Partial<SessionPersistenceConfig> = {}) {
    this.config = { ...DEFAULT_SESSION_PERSISTENCE_CONFIG, ...config };
    this.performanceTracker = new PerformanceTracker(this.config.enablePerformanceTracking);
    this.state = this.loadStateFromStorage() || this.createInitialState();
  }

  /**
   * Get current session persistence state
   */
  getState(): SessionPersistenceState {
    return { ...this.state };
  }

  /**
   * Update session information
   */
  updateSession(sessionId: string | null, status: SessionPersistenceState['persistenceStatus']): void {
    this.state.sessionId = sessionId;
    this.state.persistenceStatus = status;
    this.state.lastSyncTime = new Date();
    this.persistState();
  }

  /**
   * Update cookie status and tracking
   */
  updateCookieStatus(
    status: SessionPersistenceState['cookieStatus'],
    incrementAttempts: boolean = false
  ): void {
    this.state.cookieStatus = status;
    this.state.lastCookieValidation = new Date();
    
    if (incrementAttempts) {
      this.state.cookieGenerationAttempts++;
    }
    
    this.persistState();
  }

  /**
   * Update middleware compatibility status
   */
  updateMiddlewareCompatibility(compatible: boolean, testResult?: MiddlewareTestResult): void {
    this.state.middlewareCompatible = compatible;
    this.state.lastMiddlewareTest = new Date();
    
    if (testResult) {
      this.addMiddlewareTestResult(testResult);
    }
    
    this.persistState();
  }

  /**
   * Add middleware test result
   */
  addMiddlewareTestResult(result: MiddlewareTestResult): void {
    this.state.middlewareTestResults.push(result);
    
    // Keep only last 10 test results to prevent storage bloat
    if (this.state.middlewareTestResults.length > 10) {
      this.state.middlewareTestResults = this.state.middlewareTestResults.slice(-10);
    }
    
    // Update performance metrics
    this.performanceTracker.recordMiddlewareTest(result.responseTime, result.success);
    this.state.performanceMetrics = this.performanceTracker.getMetrics();
    
    this.persistState();
  }

  /**
   * Add session synchronization error
   */
  addSyncError(error: SessionSyncError): void {
    this.state.syncErrors.push({
      ...error,
      timestamp: error.timestamp || new Date()
    });
    
    // Keep only last 5 errors to prevent storage bloat
    if (this.state.syncErrors.length > 5) {
      this.state.syncErrors = this.state.syncErrors.slice(-5);
    }
    
    this.persistState();
  }

  /**
   * Record recovery attempt
   */
  recordRecoveryAttempt(): void {
    this.state.recoveryAttempts++;
    this.state.lastRecoveryTime = new Date();
    this.persistState();
  }

  /**
   * Record performance metrics for cookie operations
   */
  recordCookieOperation(operation: 'generation' | 'validation', duration: number, success: boolean): void {
    this.performanceTracker.recordCookieOperation(operation, duration, success);
    this.state.performanceMetrics = this.performanceTracker.getMetrics();
    this.persistState();
  }

  /**
   * Record session sync operation
   */
  recordSessionSync(duration: number, success: boolean): void {
    this.performanceTracker.recordSessionSync(duration, success);
    this.state.performanceMetrics = this.performanceTracker.getMetrics();
    this.persistState();
  }

  /**
   * Get recovery recommendation based on current state
   */
  getRecoveryRecommendation(): {
    action: 'retry' | 'regenerate' | 'clear' | 'reauth';
    reason: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
  } {
    const { recoveryAttempts, syncErrors, cookieStatus, middlewareCompatible } = this.state;
    
    // Critical: Too many recovery attempts
    if (recoveryAttempts >= this.config.maxRetryAttempts) {
      return {
        action: 'reauth',
        reason: 'Maximum recovery attempts exceeded',
        priority: 'critical'
      };
    }
    
    // High: Persistent middleware compatibility issues
    if (!middlewareCompatible && syncErrors.length >= 2) {
      return {
        action: 'clear',
        reason: 'Persistent middleware compatibility failures',
        priority: 'high'
      };
    }
    
    // Medium: Cookie corruption
    if (cookieStatus === 'corrupted' || cookieStatus === 'invalid') {
      return {
        action: 'regenerate',
        reason: 'Cookie corruption detected',
        priority: 'medium'
      };
    }
    
    // Low: Recent errors but recoverable
    if (syncErrors.length > 0 && syncErrors[syncErrors.length - 1].recoverable) {
      return {
        action: 'retry',
        reason: 'Recoverable sync error detected',
        priority: 'low'
      };
    }
    
    return {
      action: 'retry',
      reason: 'Standard retry recommended',
      priority: 'low'
    };
  }

  /**
   * Create enhanced session persistence error
   */
  createSessionPersistenceError(
    type: SessionPersistenceErrorType,
    message: string,
    originalError?: Error
  ): SessionPersistenceError {
    const recommendation = this.getRecoveryRecommendation();
    
    const baseError = new Error(message) as any;
    
    return Object.assign(baseError, {
      name: 'SessionPersistenceError',
      message,
      persistenceType: type,
      syncAttempt: this.state.recoveryAttempts,
      cookieStatus: this.state.cookieStatus,
      middlewareCompatible: this.state.middlewareCompatible,
      recoveryAction: recommendation.action,
      debugInfo: {
        sessionId: this.state.sessionId || undefined,
        cookieLength: 0, // Will be filled by caller if available
        lastSyncTime: this.state.lastSyncTime || undefined,
        errorStack: originalError?.stack,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        timestamp: new Date()
      },
      // Supabase AuthError properties
      __isAuthError: true,
      status: 500,
      code: type
    }) as SessionPersistenceError;
  }

  /**
   * Reset state (useful for testing or complete recovery)
   */
  resetState(): void {
    this.state = this.createInitialState();
    this.performanceTracker.reset();
    this.persistState();
  }

  /**
   * Clear expired data and optimize storage
   */
  cleanup(): void {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Remove old middleware test results
    this.state.middlewareTestResults = this.state.middlewareTestResults.filter(
      result => result.timestamp > oneHourAgo
    );
    
    // Remove old sync errors
    this.state.syncErrors = this.state.syncErrors.filter(
      error => error.timestamp > oneHourAgo
    );
    
    this.persistState();
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    averageResponseTime: number;
    successRate: number;
    totalOperations: number;
    recentErrors: SessionSyncError[];
  } {
    const metrics = this.state.performanceMetrics;
    const recentErrors = this.state.syncErrors.slice(-3);
    
    return {
      averageResponseTime: metrics.averageResponseTime,
      successRate: metrics.sessionSyncSuccessRate,
      totalOperations: metrics.totalSyncAttempts,
      recentErrors
    };
  }

  /**
   * Create initial state
   */
  private createInitialState(): SessionPersistenceState {
    return {
      sessionId: null,
      persistenceStatus: 'invalid',
      lastSyncTime: null,
      
      cookieStatus: 'missing',
      cookieGenerationAttempts: 0,
      lastCookieValidation: null,
      
      middlewareCompatible: false,
      lastMiddlewareTest: null,
      middlewareTestResults: [],
      
      syncErrors: [],
      recoveryAttempts: 0,
      lastRecoveryTime: null,
      
      performanceMetrics: this.performanceTracker.getMetrics()
    };
  }

  /**
   * Load state from localStorage
   */
  private loadStateFromStorage(): SessionPersistenceState | null {
    try {
      if (typeof window === 'undefined') return null;
      
      const stored = localStorage.getItem(SessionPersistenceStateManager.STORAGE_KEY);
      if (!stored) return null;
      
      const parsed = JSON.parse(stored);
      
      // Convert date strings back to Date objects
      if (parsed.lastSyncTime) parsed.lastSyncTime = new Date(parsed.lastSyncTime);
      if (parsed.lastCookieValidation) parsed.lastCookieValidation = new Date(parsed.lastCookieValidation);
      if (parsed.lastMiddlewareTest) parsed.lastMiddlewareTest = new Date(parsed.lastMiddlewareTest);
      if (parsed.lastRecoveryTime) parsed.lastRecoveryTime = new Date(parsed.lastRecoveryTime);
      
      // Convert middleware test result timestamps
      if (parsed.middlewareTestResults) {
        parsed.middlewareTestResults = parsed.middlewareTestResults.map((result: any) => ({
          ...result,
          timestamp: new Date(result.timestamp)
        }));
      }
      
      // Convert sync error timestamps
      if (parsed.syncErrors) {
        parsed.syncErrors = parsed.syncErrors.map((error: any) => ({
          ...error,
          timestamp: new Date(error.timestamp)
        }));
      }
      
      // Convert performance metrics timestamp
      if (parsed.performanceMetrics?.lastUpdated) {
        parsed.performanceMetrics.lastUpdated = new Date(parsed.performanceMetrics.lastUpdated);
      }
      
      return parsed;
    } catch (error) {
      console.warn('Failed to load session persistence state from storage:', error);
      return null;
    }
  }

  /**
   * Persist state to localStorage
   */
  private persistState(): void {
    try {
      if (typeof window === 'undefined') return;
      
      localStorage.setItem(
        SessionPersistenceStateManager.STORAGE_KEY,
        JSON.stringify(this.state)
      );
    } catch (error) {
      console.warn('Failed to persist session persistence state:', error);
    }
  }
}

/**
 * Performance tracking utility
 */
class PerformanceTracker {
  private metrics: SessionPerformanceMetrics;
  private enabled: boolean;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
    this.metrics = this.loadMetricsFromStorage() || this.createInitialMetrics();
  }

  recordCookieOperation(operation: 'generation' | 'validation', duration: number, success: boolean): void {
    if (!this.enabled) return;

    if (operation === 'generation') {
      this.metrics.cookieGenerationTime.push(duration);
      // Keep only last 20 measurements
      if (this.metrics.cookieGenerationTime.length > 20) {
        this.metrics.cookieGenerationTime = this.metrics.cookieGenerationTime.slice(-20);
      }
    } else {
      this.metrics.cookieValidationTime.push(duration);
      if (this.metrics.cookieValidationTime.length > 20) {
        this.metrics.cookieValidationTime = this.metrics.cookieValidationTime.slice(-20);
      }
    }

    this.updateSuccessRates();
    this.updateTimingStats();
    this.metrics.lastUpdated = new Date();
    this.persistMetrics();
  }

  recordMiddlewareTest(duration: number, success: boolean): void {
    if (!this.enabled) return;

    this.metrics.middlewareTestTime.push(duration);
    if (this.metrics.middlewareTestTime.length > 20) {
      this.metrics.middlewareTestTime = this.metrics.middlewareTestTime.slice(-20);
    }

    this.updateSuccessRates();
    this.updateTimingStats();
    this.metrics.lastUpdated = new Date();
    this.persistMetrics();
  }

  recordSessionSync(duration: number, success: boolean): void {
    if (!this.enabled) return;

    this.metrics.totalSyncAttempts++;
    if (success) {
      this.metrics.successfulSyncs++;
    } else {
      this.metrics.failedSyncs++;
    }

    this.updateSuccessRates();
    this.updateTimingStats();
    this.metrics.lastUpdated = new Date();
    this.persistMetrics();
  }

  getMetrics(): SessionPerformanceMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = this.createInitialMetrics();
    this.persistMetrics();
  }

  private createInitialMetrics(): SessionPerformanceMetrics {
    return {
      cookieGenerationTime: [],
      cookieValidationTime: [],
      middlewareTestTime: [],
      
      cookieGenerationSuccessRate: 0,
      middlewareCompatibilityRate: 0,
      sessionSyncSuccessRate: 0,
      
      totalSyncAttempts: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      
      averageResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: 0,
      
      lastUpdated: new Date()
    };
  }

  private updateSuccessRates(): void {
    if (this.metrics.totalSyncAttempts > 0) {
      this.metrics.sessionSyncSuccessRate = this.metrics.successfulSyncs / this.metrics.totalSyncAttempts;
    }
  }

  private updateTimingStats(): void {
    const allTimes = [
      ...this.metrics.cookieGenerationTime,
      ...this.metrics.cookieValidationTime,
      ...this.metrics.middlewareTestTime
    ];

    if (allTimes.length > 0) {
      this.metrics.averageResponseTime = allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length;
      this.metrics.maxResponseTime = Math.max(...allTimes);
      this.metrics.minResponseTime = Math.min(...allTimes);
    }
  }

  private loadMetricsFromStorage(): SessionPerformanceMetrics | null {
    try {
      if (typeof window === 'undefined') return null;
      
      const stored = localStorage.getItem(SessionPersistenceStateManager.PERFORMANCE_STORAGE_KEY);
      if (!stored) return null;
      
      const parsed = JSON.parse(stored);
      if (parsed.lastUpdated) {
        parsed.lastUpdated = new Date(parsed.lastUpdated);
      }
      
      return parsed;
    } catch (error) {
      console.warn('Failed to load performance metrics from storage:', error);
      return null;
    }
  }

  private persistMetrics(): void {
    try {
      if (typeof window === 'undefined') return;
      
      localStorage.setItem(
        SessionPersistenceStateManager.PERFORMANCE_STORAGE_KEY,
        JSON.stringify(this.metrics)
      );
    } catch (error) {
      console.warn('Failed to persist performance metrics:', error);
    }
  }
}