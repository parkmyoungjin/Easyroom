// src/lib/auth/PerformanceMonitor.ts

export interface PerformanceMetrics {
  renderCount: number;
  lastRenderTime: number;
  memoryUsage: number;
  intervalCleanupCount: number;
  listenerCleanupCount: number;
  sessionCheckResponseTimes: number[];
  averageSessionCheckTime: number;
  maxSessionCheckTime: number;
  minSessionCheckTime: number;
  lastContextValue: any;
  // Enhanced performance metrics for task 10
  cookieOperationMetrics: CookieOperationMetrics;
  middlewareCompatibilityMetrics: MiddlewareCompatibilityMetrics;
  sessionPersistenceMetrics: SessionPersistenceMetrics;
  debounceMetrics: DebounceMetrics;
}

export interface CookieOperationMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageOperationTime: number;
  maxOperationTime: number;
  minOperationTime: number;
  operationTimes: number[];
  generationAttempts: number;
  validationAttempts: number;
  clearingOperations: number;
  lastOperationTime: Date | null;
}

export interface MiddlewareCompatibilityMetrics {
  totalTests: number;
  successfulTests: number;
  failedTests: number;
  averageResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  responseTimes: number[];
  compatibilitySuccessRate: number;
  lastTestTime: Date | null;
  errorPatterns: Map<string, number>;
}

export interface SessionPersistenceMetrics {
  totalSyncAttempts: number;
  successfulSyncs: number;
  failedSyncs: number;
  averageSyncTime: number;
  maxSyncTime: number;
  minSyncTime: number;
  syncTimes: number[];
  persistenceSuccessRate: number;
  consecutiveFailures: number;
  maxConsecutiveFailures: number;
  recoveryAttempts: number;
  successfulRecoveries: number;
  lastSyncTime: Date | null;
  failurePatterns: Map<string, number>;
}

export interface DebounceMetrics {
  totalDebounceEvents: number;
  debouncedEvents: number;
  debounceEffectiveness: number; // Percentage of events that were debounced
  scenarioMetrics: Map<string, {
    totalEvents: number;
    debouncedEvents: number;
    averageDebounceTime: number;
    lastEventTime: Date | null;
  }>;
}

export interface PerformanceThresholds {
  maxSessionCheckTime: number;
  maxMemoryUsage: number;
  maxRenderCount: number;
  maxCookieOperationTime: number;
  maxMiddlewareResponseTime: number;
  maxSyncTime: number;
  minSuccessRate: number;
  maxConsecutiveFailures: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private readonly maxResponseTimeHistory = 10; // Keep last 10 response times
  private readonly maxOperationTimeHistory = 20; // Keep last 20 operation times
  private performanceWarningThresholds: PerformanceThresholds;

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    this.performanceWarningThresholds = {
      maxSessionCheckTime: 5000, // 5 seconds
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB
      maxRenderCount: 100,
      maxCookieOperationTime: 2000, // 2 seconds
      maxMiddlewareResponseTime: 3000, // 3 seconds
      maxSyncTime: 4000, // 4 seconds
      minSuccessRate: 0.8, // 80%
      maxConsecutiveFailures: 5,
      ...thresholds
    };

    this.metrics = {
      renderCount: 0,
      lastRenderTime: Date.now(),
      memoryUsage: 0,
      intervalCleanupCount: 0,
      listenerCleanupCount: 0,
      sessionCheckResponseTimes: [],
      averageSessionCheckTime: 0,
      maxSessionCheckTime: 0,
      minSessionCheckTime: Infinity,
      lastContextValue: null,
      // Enhanced metrics for task 10
      cookieOperationMetrics: {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageOperationTime: 0,
        maxOperationTime: 0,
        minOperationTime: Infinity,
        operationTimes: [],
        generationAttempts: 0,
        validationAttempts: 0,
        clearingOperations: 0,
        lastOperationTime: null
      },
      middlewareCompatibilityMetrics: {
        totalTests: 0,
        successfulTests: 0,
        failedTests: 0,
        averageResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: Infinity,
        responseTimes: [],
        compatibilitySuccessRate: 0,
        lastTestTime: null,
        errorPatterns: new Map()
      },
      sessionPersistenceMetrics: {
        totalSyncAttempts: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        averageSyncTime: 0,
        maxSyncTime: 0,
        minSyncTime: Infinity,
        syncTimes: [],
        persistenceSuccessRate: 0,
        consecutiveFailures: 0,
        maxConsecutiveFailures: 0,
        recoveryAttempts: 0,
        successfulRecoveries: 0,
        lastSyncTime: null,
        failurePatterns: new Map()
      },
      debounceMetrics: {
        totalDebounceEvents: 0,
        debouncedEvents: 0,
        debounceEffectiveness: 0,
        scenarioMetrics: new Map()
      }
    };
  }



  trackRender(): void {
    this.metrics.renderCount++;
    this.metrics.lastRenderTime = Date.now();
    this.updateMemoryUsage();
  }

  trackSessionCheck(startTime: Date, endTime: Date): void {
    const responseTime = endTime.getTime() - startTime.getTime();
    
    // Add to response times history
    this.metrics.sessionCheckResponseTimes.push(responseTime);
    
    // Keep only the last N response times
    if (this.metrics.sessionCheckResponseTimes.length > this.maxResponseTimeHistory) {
      this.metrics.sessionCheckResponseTimes.shift();
    }
    
    // Update statistics
    this.updateResponseTimeStats();
  }

  trackCleanup(type: 'interval' | 'listener'): void {
    if (type === 'interval') {
      this.metrics.intervalCleanupCount++;
    } else {
      this.metrics.listenerCleanupCount++;
    }
  }

  trackContextChange(currentValue: any): boolean {
    const prevValue = this.metrics.lastContextValue;
    
    if (prevValue && JSON.stringify(prevValue) !== JSON.stringify(currentValue)) {
      this.metrics.lastContextValue = currentValue;
      return true; // Context changed
    }
    
    this.metrics.lastContextValue = currentValue;
    return false; // No change
  }

  private updateMemoryUsage(): void {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (window.performance as any)) {
      this.metrics.memoryUsage = (window.performance as any).memory?.usedJSHeapSize || 0;
    }
  }

  private updateResponseTimeStats(): void {
    const times = this.metrics.sessionCheckResponseTimes;
    if (times.length === 0) return;

    // Calculate average
    this.metrics.averageSessionCheckTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    
    // Update min/max
    this.metrics.maxSessionCheckTime = Math.max(...times);
    this.metrics.minSessionCheckTime = Math.min(...times);
  }

  getMetrics(): Readonly<PerformanceMetrics> {
    return { ...this.metrics };
  }

  getFormattedMetrics(): string {
    const metrics = this.getMetrics();
    return JSON.stringify({
      renders: metrics.renderCount,
      avgSessionTime: `${metrics.averageSessionCheckTime.toFixed(2)}ms`,
      maxSessionTime: `${metrics.maxSessionCheckTime}ms`,
      minSessionTime: metrics.minSessionCheckTime === Infinity ? 'N/A' : `${metrics.minSessionCheckTime}ms`,
      memoryMB: `${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
      cleanups: {
        intervals: metrics.intervalCleanupCount,
        listeners: metrics.listenerCleanupCount
      }
    }, null, 2);
  }

  reset(): void {
    this.metrics = {
      renderCount: 0,
      lastRenderTime: Date.now(),
      memoryUsage: 0,
      intervalCleanupCount: 0,
      listenerCleanupCount: 0,
      sessionCheckResponseTimes: [],
      averageSessionCheckTime: 0,
      maxSessionCheckTime: 0,
      minSessionCheckTime: Infinity,
      lastContextValue: null,
      // Reset enhanced metrics
      cookieOperationMetrics: {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageOperationTime: 0,
        maxOperationTime: 0,
        minOperationTime: Infinity,
        operationTimes: [],
        generationAttempts: 0,
        validationAttempts: 0,
        clearingOperations: 0,
        lastOperationTime: null
      },
      middlewareCompatibilityMetrics: {
        totalTests: 0,
        successfulTests: 0,
        failedTests: 0,
        averageResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: Infinity,
        responseTimes: [],
        compatibilitySuccessRate: 0,
        lastTestTime: null,
        errorPatterns: new Map()
      },
      sessionPersistenceMetrics: {
        totalSyncAttempts: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        averageSyncTime: 0,
        maxSyncTime: 0,
        minSyncTime: Infinity,
        syncTimes: [],
        persistenceSuccessRate: 0,
        consecutiveFailures: 0,
        maxConsecutiveFailures: 0,
        recoveryAttempts: 0,
        successfulRecoveries: 0,
        lastSyncTime: null,
        failurePatterns: new Map()
      },
      debounceMetrics: {
        totalDebounceEvents: 0,
        debouncedEvents: 0,
        debounceEffectiveness: 0,
        scenarioMetrics: new Map()
      }
    };
  }



  logPerformanceWarning(): void {
    if (process.env.NODE_ENV === 'development' && this.isPerformanceDegrading()) {
      console.warn('[PerformanceMonitor] Performance degradation detected:', this.getFormattedMetrics());
    }
  }

  // ============================================================================
  // ENHANCED PERFORMANCE TRACKING METHODS FOR TASK 10
  // ============================================================================

  /**
   * Tracks cookie operation performance
   * Requirements: 4.5, 5.1, 5.4
   */
  trackCookieOperation(
    startTime: Date, 
    endTime: Date, 
    success: boolean, 
    operationType: 'generation' | 'validation' | 'clearing'
  ): void {
    const operationTime = endTime.getTime() - startTime.getTime();
    const cookieMetrics = this.metrics.cookieOperationMetrics;

    // Update operation counts
    cookieMetrics.totalOperations++;
    if (success) {
      cookieMetrics.successfulOperations++;
    } else {
      cookieMetrics.failedOperations++;
    }

    // Update operation type specific counts
    switch (operationType) {
      case 'generation':
        cookieMetrics.generationAttempts++;
        break;
      case 'validation':
        cookieMetrics.validationAttempts++;
        break;
      case 'clearing':
        cookieMetrics.clearingOperations++;
        break;
    }

    // Update timing metrics
    cookieMetrics.operationTimes.push(operationTime);
    if (cookieMetrics.operationTimes.length > this.maxOperationTimeHistory) {
      cookieMetrics.operationTimes.shift();
    }

    // Update min/max/average
    cookieMetrics.maxOperationTime = Math.max(cookieMetrics.maxOperationTime, operationTime);
    cookieMetrics.minOperationTime = Math.min(cookieMetrics.minOperationTime, operationTime);
    cookieMetrics.averageOperationTime = cookieMetrics.operationTimes.reduce((sum, time) => sum + time, 0) / cookieMetrics.operationTimes.length;
    cookieMetrics.lastOperationTime = endTime;

    // Log performance warnings for cookie operations
    if (operationTime > this.performanceWarningThresholds.maxCookieOperationTime) {
      console.warn(`[PerformanceMonitor] Slow cookie ${operationType} operation: ${operationTime}ms`);
    }
  }

  /**
   * Tracks middleware compatibility test performance
   * Requirements: 4.5, 5.1, 5.4
   */
  trackMiddlewareCompatibilityTest(
    startTime: Date, 
    endTime: Date, 
    success: boolean, 
    errorType?: string
  ): void {
    const responseTime = endTime.getTime() - startTime.getTime();
    const middlewareMetrics = this.metrics.middlewareCompatibilityMetrics;

    // Update test counts
    middlewareMetrics.totalTests++;
    if (success) {
      middlewareMetrics.successfulTests++;
    } else {
      middlewareMetrics.failedTests++;
      
      // Track error patterns
      if (errorType) {
        const currentCount = middlewareMetrics.errorPatterns.get(errorType) || 0;
        middlewareMetrics.errorPatterns.set(errorType, currentCount + 1);
      }
    }

    // Update timing metrics
    middlewareMetrics.responseTimes.push(responseTime);
    if (middlewareMetrics.responseTimes.length > this.maxResponseTimeHistory) {
      middlewareMetrics.responseTimes.shift();
    }

    // Update min/max/average
    middlewareMetrics.maxResponseTime = Math.max(middlewareMetrics.maxResponseTime, responseTime);
    middlewareMetrics.minResponseTime = Math.min(middlewareMetrics.minResponseTime, responseTime);
    middlewareMetrics.averageResponseTime = middlewareMetrics.responseTimes.reduce((sum, time) => sum + time, 0) / middlewareMetrics.responseTimes.length;
    
    // Update success rate
    middlewareMetrics.compatibilitySuccessRate = middlewareMetrics.successfulTests / middlewareMetrics.totalTests;
    middlewareMetrics.lastTestTime = endTime;

    // Log performance warnings for middleware tests
    if (responseTime > this.performanceWarningThresholds.maxMiddlewareResponseTime) {
      console.warn(`[PerformanceMonitor] Slow middleware compatibility test: ${responseTime}ms`);
    }
  }

  /**
   * Tracks session persistence synchronization performance
   * Requirements: 4.5, 5.1, 5.4
   */
  trackSessionPersistenceSync(
    startTime: Date, 
    endTime: Date, 
    success: boolean, 
    isRecovery: boolean = false,
    failureType?: string
  ): void {
    const syncTime = endTime.getTime() - startTime.getTime();
    const persistenceMetrics = this.metrics.sessionPersistenceMetrics;

    // Update sync counts
    persistenceMetrics.totalSyncAttempts++;
    if (success) {
      persistenceMetrics.successfulSyncs++;
      persistenceMetrics.consecutiveFailures = 0; // Reset on success
    } else {
      persistenceMetrics.failedSyncs++;
      persistenceMetrics.consecutiveFailures++;
      persistenceMetrics.maxConsecutiveFailures = Math.max(
        persistenceMetrics.maxConsecutiveFailures, 
        persistenceMetrics.consecutiveFailures
      );

      // Track failure patterns
      if (failureType) {
        const currentCount = persistenceMetrics.failurePatterns.get(failureType) || 0;
        persistenceMetrics.failurePatterns.set(failureType, currentCount + 1);
      }
    }

    // Track recovery attempts
    if (isRecovery) {
      persistenceMetrics.recoveryAttempts++;
      if (success) {
        persistenceMetrics.successfulRecoveries++;
      }
    }

    // Update timing metrics
    persistenceMetrics.syncTimes.push(syncTime);
    if (persistenceMetrics.syncTimes.length > this.maxOperationTimeHistory) {
      persistenceMetrics.syncTimes.shift();
    }

    // Update min/max/average
    persistenceMetrics.maxSyncTime = Math.max(persistenceMetrics.maxSyncTime, syncTime);
    persistenceMetrics.minSyncTime = Math.min(persistenceMetrics.minSyncTime, syncTime);
    persistenceMetrics.averageSyncTime = persistenceMetrics.syncTimes.reduce((sum, time) => sum + time, 0) / persistenceMetrics.syncTimes.length;
    
    // Update success rate
    persistenceMetrics.persistenceSuccessRate = persistenceMetrics.successfulSyncs / persistenceMetrics.totalSyncAttempts;
    persistenceMetrics.lastSyncTime = endTime;

    // Log performance warnings for session persistence
    if (syncTime > this.performanceWarningThresholds.maxSyncTime) {
      console.warn(`[PerformanceMonitor] Slow session persistence sync: ${syncTime}ms`);
    }

    // Log critical failure patterns
    if (persistenceMetrics.consecutiveFailures >= this.performanceWarningThresholds.maxConsecutiveFailures) {
      console.error(`[PerformanceMonitor] Critical: ${persistenceMetrics.consecutiveFailures} consecutive session persistence failures`);
    }
  }

  /**
   * Tracks debounce effectiveness for high-frequency events
   * Requirements: 4.5, 5.1, 5.4
   */
  trackDebounceEvent(
    scenario: string, 
    wasDebounced: boolean, 
    debounceTime?: number
  ): void {
    const debounceMetrics = this.metrics.debounceMetrics;
    const now = new Date();

    // Update overall debounce metrics
    debounceMetrics.totalDebounceEvents++;
    if (wasDebounced) {
      debounceMetrics.debouncedEvents++;
    }

    // Calculate debounce effectiveness
    debounceMetrics.debounceEffectiveness = (debounceMetrics.debouncedEvents / debounceMetrics.totalDebounceEvents) * 100;

    // Update scenario-specific metrics
    if (!debounceMetrics.scenarioMetrics.has(scenario)) {
      debounceMetrics.scenarioMetrics.set(scenario, {
        totalEvents: 0,
        debouncedEvents: 0,
        averageDebounceTime: 0,
        lastEventTime: null
      });
    }

    const scenarioMetrics = debounceMetrics.scenarioMetrics.get(scenario)!;
    scenarioMetrics.totalEvents++;
    if (wasDebounced) {
      scenarioMetrics.debouncedEvents++;
    }
    scenarioMetrics.lastEventTime = now;

    // Update average debounce time if provided
    if (debounceTime !== undefined) {
      const currentAvg = scenarioMetrics.averageDebounceTime;
      const totalDebounced = scenarioMetrics.debouncedEvents;
      scenarioMetrics.averageDebounceTime = ((currentAvg * (totalDebounced - 1)) + debounceTime) / totalDebounced;
    }
  }

  /**
   * Enhanced performance degradation detection
   * Requirements: 4.5, 5.1, 5.4
   */
  isPerformanceDegrading(): boolean {
    const metrics = this.getMetrics();
    const thresholds = this.performanceWarningThresholds;

    // Check existing conditions
    if (metrics.averageSessionCheckTime > thresholds.maxSessionCheckTime) {
      return true;
    }

    if (metrics.memoryUsage > thresholds.maxMemoryUsage) {
      return true;
    }

    if (metrics.renderCount > thresholds.maxRenderCount && metrics.intervalCleanupCount === 0) {
      return true;
    }

    // Check enhanced performance conditions
    const cookieMetrics = metrics.cookieOperationMetrics;
    if (cookieMetrics.averageOperationTime > thresholds.maxCookieOperationTime) {
      return true;
    }

    const middlewareMetrics = metrics.middlewareCompatibilityMetrics;
    if (middlewareMetrics.averageResponseTime > thresholds.maxMiddlewareResponseTime) {
      return true;
    }

    if (middlewareMetrics.compatibilitySuccessRate < thresholds.minSuccessRate && middlewareMetrics.totalTests > 5) {
      return true;
    }

    const persistenceMetrics = metrics.sessionPersistenceMetrics;
    if (persistenceMetrics.averageSyncTime > thresholds.maxSyncTime) {
      return true;
    }

    if (persistenceMetrics.persistenceSuccessRate < thresholds.minSuccessRate && persistenceMetrics.totalSyncAttempts > 5) {
      return true;
    }

    if (persistenceMetrics.consecutiveFailures >= thresholds.maxConsecutiveFailures) {
      return true;
    }

    return false;
  }

  /**
   * Gets comprehensive performance report
   * Requirements: 4.5, 5.1, 5.4
   */
  getPerformanceReport(): {
    summary: string;
    metrics: PerformanceMetrics;
    warnings: string[];
    recommendations: string[];
  } {
    const metrics = this.getMetrics();
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check for performance issues and generate warnings/recommendations
    if (metrics.cookieOperationMetrics.averageOperationTime > this.performanceWarningThresholds.maxCookieOperationTime) {
      warnings.push(`Cookie operations are slow (avg: ${metrics.cookieOperationMetrics.averageOperationTime.toFixed(2)}ms)`);
      recommendations.push('Consider optimizing cookie generation and validation processes');
    }

    if (metrics.middlewareCompatibilityMetrics.compatibilitySuccessRate < this.performanceWarningThresholds.minSuccessRate) {
      warnings.push(`Low middleware compatibility success rate: ${(metrics.middlewareCompatibilityMetrics.compatibilitySuccessRate * 100).toFixed(1)}%`);
      recommendations.push('Review middleware compatibility logic and error handling');
    }

    if (metrics.sessionPersistenceMetrics.consecutiveFailures >= this.performanceWarningThresholds.maxConsecutiveFailures) {
      warnings.push(`High consecutive session persistence failures: ${metrics.sessionPersistenceMetrics.consecutiveFailures}`);
      recommendations.push('Investigate session persistence failure patterns and implement additional recovery strategies');
    }

    if (metrics.debounceMetrics.debounceEffectiveness < 50 && metrics.debounceMetrics.totalDebounceEvents > 10) {
      warnings.push(`Low debounce effectiveness: ${metrics.debounceMetrics.debounceEffectiveness.toFixed(1)}%`);
      recommendations.push('Review debounce configuration and timing for high-frequency events');
    }

    const summary = `Performance Report: ${warnings.length} warnings, ${recommendations.length} recommendations`;

    return {
      summary,
      metrics,
      warnings,
      recommendations
    };
  }

  /**
   * Updates performance thresholds at runtime
   */
  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.performanceWarningThresholds = {
      ...this.performanceWarningThresholds,
      ...newThresholds
    };
    console.log('[PerformanceMonitor] Updated performance thresholds:', newThresholds);
  }
}