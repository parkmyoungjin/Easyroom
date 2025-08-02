/**
 * Authentication System Health Monitor
 * Provides monitoring and alerting for authentication system health
 */

'use client';

import { AuthState } from '@/types/auth-optimization';

export interface AuthHealthMetrics {
  pollingErrors: number;
  storageErrors: number;
  callbackErrors: number;
  stateChanges: number;
  averagePollingInterval: number;
  lastSuccessfulPoll: number;
  lastError: string | null;
  uptime: number;
  memoryUsage: {
    callbackCount: number;
    pollingActive: boolean;
  };
}

export interface AuthHealthAlert {
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: number;
  metric?: keyof AuthHealthMetrics;
  value?: any;
}

export type AuthHealthCallback = (alert: AuthHealthAlert) => void;

/**
 * Monitors authentication system health and provides alerting
 */
export class AuthHealthMonitor {
  private static instance: AuthHealthMonitor | null = null;
  private static readonly STORAGE_KEY = 'easyroom_auth_health_metrics';
  
  private metrics: AuthHealthMetrics;
  private alertCallbacks: Set<AuthHealthCallback> = new Set();
  private startTime: number;
  private lastPollingTimes: number[] = [];
  private maxPollingHistory = 10;
  
  // Thresholds for alerts
  private readonly thresholds = {
    maxPollingErrors: 5,
    maxStorageErrors: 3,
    maxCallbackErrors: 10,
    maxPollingInterval: 2000, // 2 seconds
    minPollingInterval: 100, // 100ms
    maxCallbacks: 50,
    staleDataThreshold: 30000 // 30 seconds
  };

  private constructor() {
    this.startTime = Date.now();
    this.metrics = this.initializeMetrics();
    this.loadPersistedMetrics();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AuthHealthMonitor {
    if (!AuthHealthMonitor.instance) {
      AuthHealthMonitor.instance = new AuthHealthMonitor();
    }
    return AuthHealthMonitor.instance;
  }

  /**
   * Initialize default metrics
   */
  private initializeMetrics(): AuthHealthMetrics {
    return {
      pollingErrors: 0,
      storageErrors: 0,
      callbackErrors: 0,
      stateChanges: 0,
      averagePollingInterval: 500,
      lastSuccessfulPoll: Date.now(),
      lastError: null,
      uptime: 0,
      memoryUsage: {
        callbackCount: 0,
        pollingActive: false
      }
    };
  }

  /**
   * Load persisted metrics from localStorage
   */
  private loadPersistedMetrics(): void {
    try {
      const stored = localStorage.getItem(AuthHealthMonitor.STORAGE_KEY);
      if (stored) {
        const persistedMetrics = JSON.parse(stored);
        // Only load non-runtime metrics
        this.metrics.pollingErrors = persistedMetrics.pollingErrors || 0;
        this.metrics.storageErrors = persistedMetrics.storageErrors || 0;
        this.metrics.callbackErrors = persistedMetrics.callbackErrors || 0;
        this.metrics.stateChanges = persistedMetrics.stateChanges || 0;
      }
    } catch (error) {
      console.warn('[AuthHealthMonitor] Failed to load persisted metrics:', error);
    }
  }

  /**
   * Persist metrics to localStorage
   */
  private persistMetrics(): void {
    try {
      const metricsToStore = {
        pollingErrors: this.metrics.pollingErrors,
        storageErrors: this.metrics.storageErrors,
        callbackErrors: this.metrics.callbackErrors,
        stateChanges: this.metrics.stateChanges,
        timestamp: Date.now()
      };
      localStorage.setItem(AuthHealthMonitor.STORAGE_KEY, JSON.stringify(metricsToStore));
    } catch (error) {
      console.warn('[AuthHealthMonitor] Failed to persist metrics:', error);
    }
  }

  /**
   * Record a polling event
   */
  public recordPollingEvent(success: boolean, interval: number, error?: Error): void {
    if (success) {
      this.metrics.lastSuccessfulPoll = Date.now();
      this.lastPollingTimes.push(interval);
      
      // Keep only recent polling times
      if (this.lastPollingTimes.length > this.maxPollingHistory) {
        this.lastPollingTimes.shift();
      }
      
      // Update average polling interval
      this.metrics.averagePollingInterval = 
        this.lastPollingTimes.reduce((a, b) => a + b, 0) / this.lastPollingTimes.length;
      
      // Check for performance issues
      if (interval > this.thresholds.maxPollingInterval) {
        this.emitAlert({
          level: 'warning',
          message: `Polling interval is high: ${interval}ms`,
          timestamp: Date.now(),
          metric: 'averagePollingInterval',
          value: interval
        });
      }
    } else {
      this.metrics.pollingErrors++;
      this.metrics.lastError = error?.message || 'Unknown polling error';
      
      if (this.metrics.pollingErrors >= this.thresholds.maxPollingErrors) {
        this.emitAlert({
          level: 'error',
          message: `High number of polling errors: ${this.metrics.pollingErrors}`,
          timestamp: Date.now(),
          metric: 'pollingErrors',
          value: this.metrics.pollingErrors
        });
      }
    }
    
    this.updateUptime();
    this.persistMetrics();
  }

  /**
   * Record a storage event
   */
  public recordStorageEvent(success: boolean, operation: 'get' | 'set' | 'remove', error?: Error): void {
    if (!success) {
      this.metrics.storageErrors++;
      this.metrics.lastError = error?.message || `Storage ${operation} error`;
      
      if (this.metrics.storageErrors >= this.thresholds.maxStorageErrors) {
        this.emitAlert({
          level: 'critical',
          message: `Critical storage errors detected: ${this.metrics.storageErrors}`,
          timestamp: Date.now(),
          metric: 'storageErrors',
          value: this.metrics.storageErrors
        });
      }
    }
    
    this.persistMetrics();
  }

  /**
   * Record a callback event
   */
  public recordCallbackEvent(success: boolean, callbackCount: number, error?: Error): void {
    this.metrics.memoryUsage.callbackCount = callbackCount;
    
    if (!success) {
      this.metrics.callbackErrors++;
      this.metrics.lastError = error?.message || 'Callback execution error';
      
      if (this.metrics.callbackErrors >= this.thresholds.maxCallbackErrors) {
        this.emitAlert({
          level: 'warning',
          message: `High number of callback errors: ${this.metrics.callbackErrors}`,
          timestamp: Date.now(),
          metric: 'callbackErrors',
          value: this.metrics.callbackErrors
        });
      }
    }
    
    // Check for memory issues
    if (callbackCount > this.thresholds.maxCallbacks) {
      this.emitAlert({
        level: 'warning',
        message: `High number of active callbacks: ${callbackCount}`,
        timestamp: Date.now(),
        metric: 'memoryUsage',
        value: { callbackCount }
      });
    }
    
    this.persistMetrics();
  }

  /**
   * Record a state change event
   */
  public recordStateChange(newState: AuthState | null, source: 'polling' | 'direct'): void {
    this.metrics.stateChanges++;
    
    // Check for stale data
    if (newState && source === 'polling') {
      const stateAge = Date.now() - newState.timestamp;
      if (stateAge > this.thresholds.staleDataThreshold) {
        this.emitAlert({
          level: 'warning',
          message: `Stale authentication state detected: ${stateAge}ms old`,
          timestamp: Date.now(),
          value: stateAge
        });
      }
    }
    
    this.persistMetrics();
  }

  /**
   * Record polling status change
   */
  public recordPollingStatus(active: boolean): void {
    this.metrics.memoryUsage.pollingActive = active;
    
    if (!active) {
      this.emitAlert({
        level: 'warning',
        message: 'Authentication polling has stopped',
        timestamp: Date.now(),
        metric: 'memoryUsage',
        value: { pollingActive: active }
      });
    }
  }

  /**
   * Get current health metrics
   */
  public getMetrics(): AuthHealthMetrics {
    this.updateUptime();
    return { ...this.metrics };
  }

  /**
   * Get health status summary
   */
  public getHealthStatus(): {
    status: 'healthy' | 'warning' | 'error' | 'critical';
    issues: string[];
    score: number; // 0-100
  } {
    const issues: string[] = [];
    let score = 100;
    let status: 'healthy' | 'warning' | 'error' | 'critical' = 'healthy';

    // Check polling errors
    if (this.metrics.pollingErrors > 0) {
      issues.push(`${this.metrics.pollingErrors} polling errors`);
      score -= this.metrics.pollingErrors * 5;
      if (this.metrics.pollingErrors >= this.thresholds.maxPollingErrors) {
        status = 'error';
      }
    }

    // Check storage errors
    if (this.metrics.storageErrors > 0) {
      issues.push(`${this.metrics.storageErrors} storage errors`);
      score -= this.metrics.storageErrors * 10;
      if (this.metrics.storageErrors >= this.thresholds.maxStorageErrors) {
        status = 'critical';
      }
    }

    // Check callback errors
    if (this.metrics.callbackErrors > 0) {
      issues.push(`${this.metrics.callbackErrors} callback errors`);
      score -= this.metrics.callbackErrors * 2;
      if (this.metrics.callbackErrors >= this.thresholds.maxCallbackErrors && status !== 'critical') {
        status = status === 'healthy' ? 'warning' : status;
      }
    }

    // Check polling performance
    if (this.metrics.averagePollingInterval > this.thresholds.maxPollingInterval) {
      issues.push(`Slow polling: ${this.metrics.averagePollingInterval}ms average`);
      score -= 10;
      if (status === 'healthy') status = 'warning';
    }

    // Check for stale polling
    const timeSinceLastPoll = Date.now() - this.metrics.lastSuccessfulPoll;
    if (timeSinceLastPoll > this.thresholds.staleDataThreshold) {
      issues.push(`Stale polling: ${timeSinceLastPoll}ms since last success`);
      score -= 20;
      if (status !== 'critical') status = 'error';
    }

    // Check memory usage
    if (this.metrics.memoryUsage.callbackCount > this.thresholds.maxCallbacks) {
      issues.push(`High callback count: ${this.metrics.memoryUsage.callbackCount}`);
      score -= 5;
      if (status === 'healthy') status = 'warning';
    }

    // Ensure score doesn't go below 0
    score = Math.max(0, score);

    return { status, issues, score };
  }

  /**
   * Subscribe to health alerts
   */
  public onAlert(callback: AuthHealthCallback): () => void {
    this.alertCallbacks.add(callback);
    
    return () => {
      this.alertCallbacks.delete(callback);
    };
  }

  /**
   * Emit an alert to all subscribers
   */
  private emitAlert(alert: AuthHealthAlert): void {
    console.log(`[AuthHealthMonitor] ${alert.level.toUpperCase()}: ${alert.message}`);
    
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('[AuthHealthMonitor] Error in alert callback:', error);
      }
    });
  }

  /**
   * Update uptime metric
   */
  private updateUptime(): void {
    this.metrics.uptime = Date.now() - this.startTime;
  }

  /**
   * Reset all metrics
   */
  public resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.lastPollingTimes = [];
    this.startTime = Date.now();
    
    try {
      localStorage.removeItem(AuthHealthMonitor.STORAGE_KEY);
    } catch (error) {
      console.warn('[AuthHealthMonitor] Failed to clear persisted metrics:', error);
    }
    
    this.emitAlert({
      level: 'info',
      message: 'Health metrics have been reset',
      timestamp: Date.now()
    });
  }

  /**
   * Generate health report
   */
  public generateHealthReport(): {
    timestamp: number;
    metrics: AuthHealthMetrics;
    status: ReturnType<AuthHealthMonitor['getHealthStatus']>;
    recommendations: string[];
  } {
    const metrics = this.getMetrics();
    const status = this.getHealthStatus();
    const recommendations: string[] = [];

    // Generate recommendations based on metrics
    if (metrics.pollingErrors > 0) {
      recommendations.push('Consider increasing polling interval to reduce errors');
    }
    
    if (metrics.storageErrors > 0) {
      recommendations.push('Check localStorage availability and quota');
    }
    
    if (metrics.callbackErrors > 0) {
      recommendations.push('Review callback implementations for error handling');
    }
    
    if (metrics.averagePollingInterval > this.thresholds.maxPollingInterval) {
      recommendations.push('Optimize polling performance or increase interval');
    }
    
    if (metrics.memoryUsage.callbackCount > this.thresholds.maxCallbacks) {
      recommendations.push('Review callback lifecycle management');
    }

    if (recommendations.length === 0) {
      recommendations.push('System is operating within normal parameters');
    }

    return {
      timestamp: Date.now(),
      metrics,
      status,
      recommendations
    };
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.alertCallbacks.clear();
    this.persistMetrics();
    
    this.emitAlert({
      level: 'info',
      message: 'Health monitor destroyed',
      timestamp: Date.now()
    });
  }
}