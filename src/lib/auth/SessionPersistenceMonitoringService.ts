/**
 * Session Persistence Monitoring Service
 * 
 * Centralized service for monitoring session persistence performance,
 * success rates, and failure patterns across the application.
 * 
 * Requirements: 4.5, 5.1, 5.4
 */

import { PerformanceMonitor } from './PerformanceMonitor';
import { getPerformanceConfig, type SessionPersistencePerformanceConfig } from './SessionPersistencePerformanceConfig';

// ============================================================================
// MONITORING INTERFACES
// ============================================================================

export interface SessionPersistenceReport {
  timestamp: Date;
  reportId: string;
  timeRange: {
    start: Date;
    end: Date;
    durationMs: number;
  };
  summary: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    overallSuccessRate: number;
    averageOperationTime: number;
  };
  cookieOperations: {
    totalOperations: number;
    successRate: number;
    averageTime: number;
    slowestOperation: number;
    generationAttempts: number;
    validationAttempts: number;
    clearingOperations: number;
  };
  middlewareCompatibility: {
    totalTests: number;
    successRate: number;
    averageResponseTime: number;
    slowestResponse: number;
    commonErrors: Array<{ error: string; count: number; percentage: number }>;
  };
  sessionPersistence: {
    totalSyncs: number;
    successRate: number;
    averageSyncTime: number;
    slowestSync: number;
    consecutiveFailures: number;
    maxConsecutiveFailures: number;
    recoveryAttempts: number;
    recoverySuccessRate: number;
    commonFailures: Array<{ failure: string; count: number; percentage: number }>;
  };
  debounceEffectiveness: {
    totalEvents: number;
    debouncedEvents: number;
    effectiveness: number;
    scenarioBreakdown: Array<{
      scenario: string;
      totalEvents: number;
      debouncedEvents: number;
      effectiveness: number;
      averageDebounceTime: number;
    }>;
  };
  performanceWarnings: string[];
  recommendations: string[];
}

export interface MonitoringAlert {
  id: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'performance' | 'reliability' | 'security' | 'user-experience';
  title: string;
  description: string;
  metrics: Record<string, number>;
  recommendations: string[];
  autoResolved: boolean;
  resolutionTime?: Date;
}

// ============================================================================
// MONITORING SERVICE
// ============================================================================

export class SessionPersistenceMonitoringService {
  private performanceMonitor: PerformanceMonitor;
  private config: SessionPersistencePerformanceConfig;
  private reportHistory: SessionPersistenceReport[] = [];
  private activeAlerts: Map<string, MonitoringAlert> = new Map();
  private reportingInterval: NodeJS.Timeout | null = null;
  private lastReportTime: Date | null = null;
  private readonly maxReportHistory = 50;

  constructor(performanceMonitor?: PerformanceMonitor, config?: SessionPersistencePerformanceConfig) {
    this.performanceMonitor = performanceMonitor || new PerformanceMonitor();
    this.config = config || getPerformanceConfig();
    
    // Start automatic reporting if enabled
    if (this.config.monitoring.logPerformanceMetrics) {
      this.startPeriodicReporting();
    }

    console.log('[SessionPersistenceMonitoringService] Initialized with config:', {
      reportingInterval: this.config.optimizations.performanceReportingInterval,
      logLevel: this.config.monitoring.performanceLogLevel,
      trackingEnabled: this.config.optimizations.enablePerformanceTracking
    });
  }

  // ============================================================================
  // REPORT GENERATION
  // ============================================================================

  /**
   * Generates a comprehensive performance report
   */
  generateReport(): SessionPersistenceReport {
    const now = new Date();
    const reportId = `report-${now.getTime()}-${Math.random().toString(36).substr(2, 9)}`;
    const metrics = this.performanceMonitor.getMetrics();
    
    const timeRange = {
      start: this.lastReportTime || new Date(now.getTime() - this.config.optimizations.performanceReportingInterval),
      end: now,
      durationMs: this.lastReportTime ? now.getTime() - this.lastReportTime.getTime() : this.config.optimizations.performanceReportingInterval
    };

    // Calculate summary metrics
    const totalOperations = metrics.cookieOperationMetrics.totalOperations + 
                           metrics.middlewareCompatibilityMetrics.totalTests + 
                           metrics.sessionPersistenceMetrics.totalSyncAttempts;
    
    const successfulOperations = metrics.cookieOperationMetrics.successfulOperations + 
                                metrics.middlewareCompatibilityMetrics.successfulTests + 
                                metrics.sessionPersistenceMetrics.successfulSyncs;

    const failedOperations = totalOperations - successfulOperations;
    const overallSuccessRate = totalOperations > 0 ? successfulOperations / totalOperations : 0;

    // Calculate average operation time across all operation types
    const allOperationTimes = [
      ...metrics.cookieOperationMetrics.operationTimes,
      ...metrics.middlewareCompatibilityMetrics.responseTimes,
      ...metrics.sessionPersistenceMetrics.syncTimes
    ];
    const averageOperationTime = allOperationTimes.length > 0 ? 
      allOperationTimes.reduce((sum, time) => sum + time, 0) / allOperationTimes.length : 0;

    // Generate common error patterns
    const middlewareErrors = Array.from(metrics.middlewareCompatibilityMetrics.errorPatterns.entries())
      .map(([error, count]) => ({
        error,
        count,
        percentage: (count / Math.max(metrics.middlewareCompatibilityMetrics.failedTests, 1)) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const persistenceFailures = Array.from(metrics.sessionPersistenceMetrics.failurePatterns.entries())
      .map(([failure, count]) => ({
        failure,
        count,
        percentage: (count / Math.max(metrics.sessionPersistenceMetrics.failedSyncs, 1)) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Generate debounce scenario breakdown
    const scenarioBreakdown = Array.from(metrics.debounceMetrics.scenarioMetrics.entries())
      .map(([scenario, scenarioMetrics]) => ({
        scenario,
        totalEvents: scenarioMetrics.totalEvents,
        debouncedEvents: scenarioMetrics.debouncedEvents,
        effectiveness: scenarioMetrics.totalEvents > 0 ? 
          (scenarioMetrics.debouncedEvents / scenarioMetrics.totalEvents) * 100 : 0,
        averageDebounceTime: scenarioMetrics.averageDebounceTime
      }))
      .sort((a, b) => b.totalEvents - a.totalEvents);

    // Generate performance warnings and recommendations
    const { warnings, recommendations } = this.performanceMonitor.getPerformanceReport();

    const report: SessionPersistenceReport = {
      timestamp: now,
      reportId,
      timeRange,
      summary: {
        totalOperations,
        successfulOperations,
        failedOperations,
        overallSuccessRate,
        averageOperationTime
      },
      cookieOperations: {
        totalOperations: metrics.cookieOperationMetrics.totalOperations,
        successRate: metrics.cookieOperationMetrics.totalOperations > 0 ? 
          metrics.cookieOperationMetrics.successfulOperations / metrics.cookieOperationMetrics.totalOperations : 0,
        averageTime: metrics.cookieOperationMetrics.averageOperationTime,
        slowestOperation: metrics.cookieOperationMetrics.maxOperationTime,
        generationAttempts: metrics.cookieOperationMetrics.generationAttempts,
        validationAttempts: metrics.cookieOperationMetrics.validationAttempts,
        clearingOperations: metrics.cookieOperationMetrics.clearingOperations
      },
      middlewareCompatibility: {
        totalTests: metrics.middlewareCompatibilityMetrics.totalTests,
        successRate: metrics.middlewareCompatibilityMetrics.compatibilitySuccessRate,
        averageResponseTime: metrics.middlewareCompatibilityMetrics.averageResponseTime,
        slowestResponse: metrics.middlewareCompatibilityMetrics.maxResponseTime,
        commonErrors: middlewareErrors
      },
      sessionPersistence: {
        totalSyncs: metrics.sessionPersistenceMetrics.totalSyncAttempts,
        successRate: metrics.sessionPersistenceMetrics.persistenceSuccessRate,
        averageSyncTime: metrics.sessionPersistenceMetrics.averageSyncTime,
        slowestSync: metrics.sessionPersistenceMetrics.maxSyncTime,
        consecutiveFailures: metrics.sessionPersistenceMetrics.consecutiveFailures,
        maxConsecutiveFailures: metrics.sessionPersistenceMetrics.maxConsecutiveFailures,
        recoveryAttempts: metrics.sessionPersistenceMetrics.recoveryAttempts,
        recoverySuccessRate: metrics.sessionPersistenceMetrics.recoveryAttempts > 0 ? 
          metrics.sessionPersistenceMetrics.successfulRecoveries / metrics.sessionPersistenceMetrics.recoveryAttempts : 0,
        commonFailures: persistenceFailures
      },
      debounceEffectiveness: {
        totalEvents: metrics.debounceMetrics.totalDebounceEvents,
        debouncedEvents: metrics.debounceMetrics.debouncedEvents,
        effectiveness: metrics.debounceMetrics.debounceEffectiveness,
        scenarioBreakdown
      },
      performanceWarnings: warnings,
      recommendations
    };

    // Store report in history
    this.reportHistory.push(report);
    if (this.reportHistory.length > this.maxReportHistory) {
      this.reportHistory.shift();
    }

    this.lastReportTime = now;

    // Check for alerts
    this.checkForAlerts(report);

    return report;
  }

  // ============================================================================
  // ALERT MANAGEMENT
  // ============================================================================

  /**
   * Checks performance report for conditions that should trigger alerts
   */
  private checkForAlerts(report: SessionPersistenceReport): void {
    const alerts: MonitoringAlert[] = [];

    // Check overall success rate
    if (report.summary.overallSuccessRate < this.config.performanceThresholds.minSuccessRate && 
        report.summary.totalOperations > 10) {
      alerts.push({
        id: `low-success-rate-${Date.now()}`,
        timestamp: new Date(),
        severity: 'high',
        category: 'reliability',
        title: 'Low Overall Success Rate',
        description: `Overall success rate (${(report.summary.overallSuccessRate * 100).toFixed(1)}%) is below threshold (${(this.config.performanceThresholds.minSuccessRate * 100).toFixed(1)}%)`,
        metrics: {
          successRate: report.summary.overallSuccessRate,
          threshold: this.config.performanceThresholds.minSuccessRate,
          totalOperations: report.summary.totalOperations
        },
        recommendations: [
          'Review error patterns in middleware compatibility and session persistence',
          'Check network connectivity and server response times',
          'Consider adjusting retry logic and recovery strategies'
        ],
        autoResolved: false
      });
    }

    // Check consecutive failures
    if (report.sessionPersistence.consecutiveFailures >= this.config.performanceThresholds.maxConsecutiveFailures) {
      alerts.push({
        id: `consecutive-failures-${Date.now()}`,
        timestamp: new Date(),
        severity: 'critical',
        category: 'reliability',
        title: 'High Consecutive Failures',
        description: `${report.sessionPersistence.consecutiveFailures} consecutive session persistence failures detected`,
        metrics: {
          consecutiveFailures: report.sessionPersistence.consecutiveFailures,
          threshold: this.config.performanceThresholds.maxConsecutiveFailures
        },
        recommendations: [
          'Investigate session persistence failure patterns',
          'Check middleware compatibility and cookie generation',
          'Consider implementing additional recovery strategies',
          'Review network stability and server health'
        ],
        autoResolved: false
      });
    }

    // Check performance degradation
    if (report.summary.averageOperationTime > this.config.performanceThresholds.maxCookieOperationTime) {
      alerts.push({
        id: `slow-operations-${Date.now()}`,
        timestamp: new Date(),
        severity: 'medium',
        category: 'performance',
        title: 'Slow Operation Performance',
        description: `Average operation time (${report.summary.averageOperationTime.toFixed(2)}ms) exceeds threshold (${this.config.performanceThresholds.maxCookieOperationTime}ms)`,
        metrics: {
          averageTime: report.summary.averageOperationTime,
          threshold: this.config.performanceThresholds.maxCookieOperationTime
        },
        recommendations: [
          'Optimize cookie generation and validation processes',
          'Review debounce configuration for high-frequency events',
          'Consider implementing operation batching',
          'Check for memory leaks or resource contention'
        ],
        autoResolved: false
      });
    }

    // Check debounce effectiveness
    if (report.debounceEffectiveness.effectiveness < 50 && report.debounceEffectiveness.totalEvents > 20) {
      alerts.push({
        id: `low-debounce-effectiveness-${Date.now()}`,
        timestamp: new Date(),
        severity: 'low',
        category: 'performance',
        title: 'Low Debounce Effectiveness',
        description: `Debounce effectiveness (${report.debounceEffectiveness.effectiveness.toFixed(1)}%) is low, indicating potential performance issues`,
        metrics: {
          effectiveness: report.debounceEffectiveness.effectiveness,
          totalEvents: report.debounceEffectiveness.totalEvents,
          debouncedEvents: report.debounceEffectiveness.debouncedEvents
        },
        recommendations: [
          'Review debounce timing configuration for different scenarios',
          'Analyze event patterns to optimize debounce strategies',
          'Consider implementing adaptive debouncing based on usage patterns'
        ],
        autoResolved: false
      });
    }

    // Process new alerts
    alerts.forEach(alert => {
      this.activeAlerts.set(alert.id, alert);
      this.logAlert(alert);
    });

    // Auto-resolve alerts if conditions improve
    this.checkForAlertResolution(report);
  }

  /**
   * Checks if any active alerts can be auto-resolved
   */
  private checkForAlertResolution(report: SessionPersistenceReport): void {
    const now = new Date();
    
    this.activeAlerts.forEach((alert, alertId) => {
      let shouldResolve = false;

      switch (alert.title) {
        case 'Low Overall Success Rate':
          shouldResolve = report.summary.overallSuccessRate >= this.config.performanceThresholds.minSuccessRate;
          break;
        case 'High Consecutive Failures':
          shouldResolve = report.sessionPersistence.consecutiveFailures < this.config.performanceThresholds.maxConsecutiveFailures;
          break;
        case 'Slow Operation Performance':
          shouldResolve = report.summary.averageOperationTime <= this.config.performanceThresholds.maxCookieOperationTime;
          break;
        case 'Low Debounce Effectiveness':
          shouldResolve = report.debounceEffectiveness.effectiveness >= 50;
          break;
      }

      if (shouldResolve) {
        alert.autoResolved = true;
        alert.resolutionTime = now;
        this.logAlertResolution(alert);
        this.activeAlerts.delete(alertId);
      }
    });
  }

  // ============================================================================
  // LOGGING AND REPORTING
  // ============================================================================

  /**
   * Logs an alert based on configuration
   */
  private logAlert(alert: MonitoringAlert): void {
    if (!this.config.monitoring.enablePerformanceWarnings) {
      return;
    }

    const logMessage = `[SessionPersistenceMonitoring] ALERT: ${alert.title} - ${alert.description}`;
    const logData = {
      alertId: alert.id,
      severity: alert.severity,
      category: alert.category,
      metrics: alert.metrics,
      recommendations: alert.recommendations
    };

    switch (alert.severity) {
      case 'critical':
        console.error(logMessage, logData);
        break;
      case 'high':
        console.error(logMessage, logData);
        break;
      case 'medium':
        console.warn(logMessage, logData);
        break;
      case 'low':
        if (this.config.monitoring.performanceLogLevel === 'debug') {
          console.log(logMessage, logData);
        }
        break;
    }
  }

  /**
   * Logs alert resolution
   */
  private logAlertResolution(alert: MonitoringAlert): void {
    if (this.config.monitoring.performanceLogLevel === 'debug' || alert.severity === 'critical') {
      console.log(`[SessionPersistenceMonitoring] RESOLVED: ${alert.title} (${alert.id})`);
    }
  }

  /**
   * Starts periodic performance reporting
   */
  private startPeriodicReporting(): void {
    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
    }

    this.reportingInterval = setInterval(() => {
      const report = this.generateReport();
      
      if (this.config.monitoring.logPerformanceMetrics) {
        this.logPerformanceReport(report);
      }
    }, this.config.optimizations.performanceReportingInterval);

    console.log(`[SessionPersistenceMonitoringService] Started periodic reporting every ${this.config.optimizations.performanceReportingInterval}ms`);
  }

  /**
   * Logs performance report based on configuration
   */
  private logPerformanceReport(report: SessionPersistenceReport): void {
    const logLevel = this.config.monitoring.performanceLogLevel;
    
    const summary = {
      reportId: report.reportId,
      timeRange: `${report.timeRange.durationMs}ms`,
      overallSuccessRate: `${(report.summary.overallSuccessRate * 100).toFixed(1)}%`,
      totalOperations: report.summary.totalOperations,
      averageOperationTime: `${report.summary.averageOperationTime.toFixed(2)}ms`,
      activeAlerts: this.activeAlerts.size,
      warnings: report.performanceWarnings.length,
      recommendations: report.recommendations.length
    };

    switch (logLevel) {
      case 'debug':
        console.log('[SessionPersistenceMonitoring] Performance Report:', {
          summary,
          cookieOperations: report.cookieOperations,
          middlewareCompatibility: report.middlewareCompatibility,
          sessionPersistence: report.sessionPersistence,
          debounceEffectiveness: report.debounceEffectiveness
        });
        break;
      case 'info':
        console.log('[SessionPersistenceMonitoring] Performance Summary:', summary);
        break;
      case 'warn':
        if (report.performanceWarnings.length > 0 || this.activeAlerts.size > 0) {
          console.warn('[SessionPersistenceMonitoring] Performance Issues:', {
            summary,
            warnings: report.performanceWarnings,
            activeAlerts: Array.from(this.activeAlerts.values()).map(alert => ({
              id: alert.id,
              severity: alert.severity,
              title: alert.title
            }))
          });
        }
        break;
      case 'error':
        const criticalAlerts = Array.from(this.activeAlerts.values()).filter(alert => alert.severity === 'critical');
        if (criticalAlerts.length > 0) {
          console.error('[SessionPersistenceMonitoring] Critical Performance Issues:', {
            summary,
            criticalAlerts: criticalAlerts.map(alert => ({
              id: alert.id,
              title: alert.title,
              description: alert.description,
              recommendations: alert.recommendations
            }))
          });
        }
        break;
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Gets the latest performance report
   */
  getLatestReport(): SessionPersistenceReport | null {
    return this.reportHistory.length > 0 ? this.reportHistory[this.reportHistory.length - 1] : null;
  }

  /**
   * Gets all report history
   */
  getReportHistory(): SessionPersistenceReport[] {
    return [...this.reportHistory];
  }

  /**
   * Gets active alerts
   */
  getActiveAlerts(): MonitoringAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Gets performance trends over time
   */
  getPerformanceTrends(metricName: keyof SessionPersistenceReport['summary']): Array<{ timestamp: Date; value: number }> {
    return this.reportHistory.map(report => ({
      timestamp: report.timestamp,
      value: report.summary[metricName] as number
    }));
  }

  /**
   * Updates monitoring configuration
   */
  updateConfig(newConfig: Partial<SessionPersistencePerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart reporting if interval changed
    if (newConfig.optimizations?.performanceReportingInterval) {
      this.startPeriodicReporting();
    }

    console.log('[SessionPersistenceMonitoringService] Configuration updated');
  }

  /**
   * Stops monitoring service
   */
  stop(): void {
    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
      this.reportingInterval = null;
    }
    
    console.log('[SessionPersistenceMonitoringService] Stopped');
  }

  /**
   * Resets all monitoring data
   */
  reset(): void {
    this.reportHistory = [];
    this.activeAlerts.clear();
    this.lastReportTime = null;
    this.performanceMonitor.reset();
    
    console.log('[SessionPersistenceMonitoringService] Reset all monitoring data');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let monitoringServiceInstance: SessionPersistenceMonitoringService | null = null;

/**
 * Gets the singleton monitoring service instance
 */
export function getMonitoringService(): SessionPersistenceMonitoringService {
  if (!monitoringServiceInstance) {
    monitoringServiceInstance = new SessionPersistenceMonitoringService();
  }
  return monitoringServiceInstance;
}

/**
 * Creates a new monitoring service instance (for testing or custom configurations)
 */
export function createMonitoringService(
  performanceMonitor?: PerformanceMonitor,
  config?: SessionPersistencePerformanceConfig
): SessionPersistenceMonitoringService {
  return new SessionPersistenceMonitoringService(performanceMonitor, config);
}