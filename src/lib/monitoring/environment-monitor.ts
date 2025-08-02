/**
 * Environment Configuration Error Logging and Monitoring System
 * Comprehensive monitoring for environment validation and Supabase client initialization
 * Requirements: 4.1, 4.2, 4.4
 */

import { logger } from '@/lib/utils/logger';
import { securityMonitor } from '@/lib/monitoring/security-monitor';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface EnvironmentError {
  type: 'missing_variable' | 'invalid_format' | 'validation_failed' | 'client_init_failed' | 'network_error' | 'configuration_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  variable?: string;
  message: string;
  context: EnvironmentErrorContext;
  timestamp: Date;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export interface EnvironmentErrorContext {
  operation: 'startup_validation' | 'client_initialization' | 'runtime_access' | 'health_check';
  caller: string;
  endpoint?: string;
  userId?: string;
  sessionId?: string;
  environment: string;
  retryAttempt?: number;
  previousErrors?: string[];
}

export interface ClientInitializationMetrics {
  attemptId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  success: boolean;
  retryCount: number;
  errorType?: string;
  errorMessage?: string;
  environment: string;
  correlationId?: string;
}

export interface EnvironmentValidationMetrics {
  validationId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  totalVariables: number;
  validVariables: number;
  invalidVariables: number;
  missingVariables: number;
  environment: string;
  correlationId?: string;
}

export interface EnvironmentAlert {
  id: string;
  type: 'repeated_failures' | 'critical_missing_variable' | 'client_init_failure_rate' | 'validation_performance_degradation';
  severity: 'medium' | 'high' | 'critical';
  count: number;
  threshold: number;
  timeWindow: number; // minutes
  firstOccurrence: Date;
  lastOccurrence: Date;
  isActive: boolean;
  details: Record<string, any>;
  environment: string;
}

export interface EnvironmentMonitoringStats {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  clientInitializationSuccessRate: number;
  averageValidationDuration: number;
  averageClientInitDuration: number;
  activeAlerts: number;
  environment: string;
  timeWindow: number; // minutes
}

// ============================================================================
// ENVIRONMENT MONITOR CLASS
// ============================================================================

class EnvironmentMonitor {
  private static instance: EnvironmentMonitor;
  private errors: EnvironmentError[] = [];
  private clientInitMetrics: ClientInitializationMetrics[] = [];
  private validationMetrics: EnvironmentValidationMetrics[] = [];
  private alerts: Map<string, EnvironmentAlert> = new Map();
  
  private readonly maxErrors = 5000;
  private readonly maxMetrics = 2000;
  private readonly alertThresholds = {
    repeated_failures: { count: 3, window: 10 }, // 3 failures in 10 minutes
    critical_missing_variable: { count: 1, window: 1 }, // 1 critical missing variable
    client_init_failure_rate: { count: 5, window: 15 }, // 5 client init failures in 15 minutes
    validation_performance_degradation: { count: 3, window: 5 } // 3 slow validations in 5 minutes
  };

  private constructor() {}

  static getInstance(): EnvironmentMonitor {
    if (!EnvironmentMonitor.instance) {
      EnvironmentMonitor.instance = new EnvironmentMonitor();
    }
    return EnvironmentMonitor.instance;
  }

  // ============================================================================
  // ERROR LOGGING METHODS
  // ============================================================================

  /**
   * Record environment configuration error
   */
  recordEnvironmentError(error: Omit<EnvironmentError, 'timestamp'>): void {
    const environmentError: EnvironmentError = {
      ...error,
      timestamp: new Date()
    };

    // Add to error log
    this.errors.push(environmentError);
    
    // Maintain memory limits
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // Log using structured logging
    this.logStructuredError(environmentError);

    // Record security event for critical errors
    if (environmentError.severity === 'critical' || environmentError.severity === 'high') {
      this.recordSecurityEvent(environmentError);
    }

    // Check for alert conditions
    this.checkAlertConditions(environmentError);
  }

  /**
   * Record missing environment variable error
   */
  recordMissingVariable(variable: string, context: EnvironmentErrorContext, severity: 'medium' | 'high' | 'critical' = 'high'): void {
    this.recordEnvironmentError({
      type: 'missing_variable',
      severity,
      variable,
      message: `Required environment variable ${variable} is not set`,
      context,
      correlationId: context.sessionId || `missing_${Date.now()}`,
      metadata: {
        requiredForOperation: context.operation,
        environment: context.environment
      }
    });
  }

  /**
   * Record environment variable validation failure
   */
  recordValidationFailure(variable: string, reason: string, context: EnvironmentErrorContext): void {
    this.recordEnvironmentError({
      type: 'validation_failed',
      severity: 'medium',
      variable,
      message: `Environment variable ${variable} validation failed: ${reason}`,
      context,
      correlationId: context.sessionId || `validation_${Date.now()}`,
      metadata: {
        validationReason: reason,
        environment: context.environment
      }
    });
  }

  /**
   * Record Supabase client initialization failure
   */
  recordClientInitializationFailure(errorType: string, errorMessage: string, context: EnvironmentErrorContext): void {
    this.recordEnvironmentError({
      type: 'client_init_failed',
      severity: 'high',
      message: `Supabase client initialization failed: ${errorMessage}`,
      context,
      correlationId: context.sessionId || `client_init_${Date.now()}`,
      metadata: {
        errorType,
        retryAttempt: context.retryAttempt || 0,
        environment: context.environment
      }
    });
  }

  /**
   * Record network-related environment error
   */
  recordNetworkError(operation: string, errorMessage: string, context: EnvironmentErrorContext): void {
    this.recordEnvironmentError({
      type: 'network_error',
      severity: 'medium',
      message: `Network error during ${operation}: ${errorMessage}`,
      context,
      correlationId: context.sessionId || `network_${Date.now()}`,
      metadata: {
        operation,
        environment: context.environment
      }
    });
  }

  // ============================================================================
  // PERFORMANCE METRICS METHODS
  // ============================================================================

  /**
   * Start tracking client initialization
   */
  startClientInitializationTracking(correlationId?: string): string {
    const attemptId = `client_init_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const metrics: ClientInitializationMetrics = {
      attemptId,
      startTime: new Date(),
      success: false,
      retryCount: 0,
      environment: process.env.NODE_ENV || 'development',
      correlationId
    };

    this.clientInitMetrics.push(metrics);
    
    // Maintain memory limits
    if (this.clientInitMetrics.length > this.maxMetrics) {
      this.clientInitMetrics = this.clientInitMetrics.slice(-this.maxMetrics);
    }

    return attemptId;
  }

  /**
   * Complete client initialization tracking
   */
  completeClientInitializationTracking(
    attemptId: string, 
    success: boolean, 
    retryCount: number = 0,
    errorType?: string,
    errorMessage?: string
  ): void {
    const metrics = this.clientInitMetrics.find(m => m.attemptId === attemptId);
    if (!metrics) return;

    const endTime = new Date();
    metrics.endTime = endTime;
    metrics.duration = endTime.getTime() - metrics.startTime.getTime();
    metrics.success = success;
    metrics.retryCount = retryCount;
    metrics.errorType = errorType;
    metrics.errorMessage = errorMessage;

    // Log performance metrics
    logger.info('Client initialization completed', {
      attemptId,
      duration: metrics.duration,
      success,
      retryCount,
      environment: metrics.environment,
      correlationId: metrics.correlationId
    });

    // Check for performance degradation
    this.checkClientInitPerformance(metrics);
  }

  /**
   * Start tracking environment validation
   */
  startEnvironmentValidationTracking(correlationId?: string): string {
    const validationId = `env_validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const metrics: EnvironmentValidationMetrics = {
      validationId,
      startTime: new Date(),
      totalVariables: 0,
      validVariables: 0,
      invalidVariables: 0,
      missingVariables: 0,
      environment: process.env.NODE_ENV || 'development',
      correlationId
    };

    this.validationMetrics.push(metrics);
    
    // Maintain memory limits
    if (this.validationMetrics.length > this.maxMetrics) {
      this.validationMetrics = this.validationMetrics.slice(-this.maxMetrics);
    }

    return validationId;
  }

  /**
   * Complete environment validation tracking
   */
  completeEnvironmentValidationTracking(
    validationId: string,
    totalVariables: number,
    validVariables: number,
    invalidVariables: number,
    missingVariables: number
  ): void {
    const metrics = this.validationMetrics.find(m => m.validationId === validationId);
    if (!metrics) return;

    const endTime = new Date();
    metrics.endTime = endTime;
    metrics.duration = endTime.getTime() - metrics.startTime.getTime();
    metrics.totalVariables = totalVariables;
    metrics.validVariables = validVariables;
    metrics.invalidVariables = invalidVariables;
    metrics.missingVariables = missingVariables;

    // Log validation metrics
    logger.info('Environment validation completed', {
      validationId,
      duration: metrics.duration,
      totalVariables,
      validVariables,
      invalidVariables,
      missingVariables,
      environment: metrics.environment,
      correlationId: metrics.correlationId
    });

    // Check for performance issues
    this.checkValidationPerformance(metrics);
  }

  // ============================================================================
  // MONITORING AND ALERTING METHODS
  // ============================================================================

  /**
   * Get environment monitoring statistics
   */
  getMonitoringStats(timeWindowMinutes: number = 60): EnvironmentMonitoringStats {
    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindowMinutes * 60 * 1000);
    
    // Filter recent errors
    const recentErrors = this.errors.filter(e => e.timestamp >= windowStart);
    
    // Calculate error statistics
    const errorsByType: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};
    
    recentErrors.forEach(error => {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
    });

    // Calculate client initialization success rate
    const recentClientInits = this.clientInitMetrics.filter(m => 
      m.startTime >= windowStart && m.endTime
    );
    const successfulInits = recentClientInits.filter(m => m.success).length;
    const clientInitializationSuccessRate = recentClientInits.length > 0 
      ? (successfulInits / recentClientInits.length) * 100 
      : 100;

    // Calculate average durations
    const recentValidations = this.validationMetrics.filter(m => 
      m.startTime >= windowStart && m.endTime && m.duration
    );
    const averageValidationDuration = recentValidations.length > 0
      ? recentValidations.reduce((sum, m) => sum + (m.duration || 0), 0) / recentValidations.length
      : 0;

    const averageClientInitDuration = recentClientInits.length > 0
      ? recentClientInits.reduce((sum, m) => sum + (m.duration || 0), 0) / recentClientInits.length
      : 0;

    return {
      totalErrors: recentErrors.length,
      errorsByType,
      errorsBySeverity,
      clientInitializationSuccessRate,
      averageValidationDuration,
      averageClientInitDuration,
      activeAlerts: Array.from(this.alerts.values()).filter(a => a.isActive).length,
      environment: process.env.NODE_ENV || 'development',
      timeWindow: timeWindowMinutes
    };
  }

  /**
   * Get recent environment errors
   */
  getRecentErrors(limit: number = 100): EnvironmentError[] {
    return this.errors.slice(-limit);
  }

  /**
   * Get client initialization metrics
   */
  getClientInitializationMetrics(limit: number = 50): ClientInitializationMetrics[] {
    return this.clientInitMetrics.slice(-limit);
  }

  /**
   * Get environment validation metrics
   */
  getEnvironmentValidationMetrics(limit: number = 50): EnvironmentValidationMetrics[] {
    return this.validationMetrics.slice(-limit);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): EnvironmentAlert[] {
    return Array.from(this.alerts.values()).filter(alert => alert.isActive);
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    for (const [key, alert] of this.alerts.entries()) {
      if (alert.id === alertId) {
        alert.isActive = false;
        logger.info('Environment alert resolved', { alertId, type: alert.type });
        return true;
      }
    }
    return false;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Log structured error with appropriate level
   */
  private logStructuredError(error: EnvironmentError): void {
    const logData = {
      errorType: error.type,
      severity: error.severity,
      variable: error.variable,
      operation: error.context.operation,
      caller: error.context.caller,
      environment: error.context.environment,
      correlationId: error.correlationId,
      retryAttempt: error.context.retryAttempt,
      metadata: error.metadata
    };

    switch (error.severity) {
      case 'critical':
        logger.critical(`Environment Error: ${error.message}`, logData);
        break;
      case 'high':
        logger.error(`Environment Error: ${error.message}`, logData);
        break;
      case 'medium':
        logger.warn(`Environment Error: ${error.message}`, logData);
        break;
      case 'low':
        logger.info(`Environment Warning: ${error.message}`, logData);
        break;
    }
  }

  /**
   * Record security event for critical environment errors
   */
  private recordSecurityEvent(error: EnvironmentError): void {
    securityMonitor.recordEvent({
      type: 'suspicious_access',
      severity: error.severity === 'critical' ? 'critical' : 'high',
      userId: error.context.userId,
      sessionId: error.context.sessionId,
      endpoint: error.context.endpoint,
      source: 'environment_monitor',
      details: {
        errorType: error.type,
        variable: error.variable,
        operation: error.context.operation,
        caller: error.context.caller,
        message: error.message
      },
      metadata: {
        correlationId: error.correlationId,
        environment: error.context.environment,
        retryAttempt: error.context.retryAttempt
      }
    });
  }

  /**
   * Check for alert conditions
   */
  private checkAlertConditions(error: EnvironmentError): void {
    // Check for repeated failures
    this.checkRepeatedFailures(error);
    
    // Check for critical missing variables
    if (error.type === 'missing_variable' && error.severity === 'critical') {
      this.createAlert('critical_missing_variable', error);
    }
  }

  /**
   * Check for repeated failures pattern
   */
  private checkRepeatedFailures(error: EnvironmentError): void {
    const threshold = this.alertThresholds.repeated_failures;
    const now = new Date();
    const windowStart = new Date(now.getTime() - threshold.window * 60 * 1000);
    
    const recentSimilarErrors = this.errors.filter(e =>
      e.timestamp >= windowStart &&
      e.type === error.type &&
      e.context.caller === error.context.caller &&
      e.severity === error.severity
    );

    if (recentSimilarErrors.length >= threshold.count) {
      this.createAlert('repeated_failures', error, recentSimilarErrors.length);
    }
  }

  /**
   * Check client initialization performance
   */
  private checkClientInitPerformance(metrics: ClientInitializationMetrics): void {
    if (!metrics.success) {
      const threshold = this.alertThresholds.client_init_failure_rate;
      const now = new Date();
      const windowStart = new Date(now.getTime() - threshold.window * 60 * 1000);
      
      const recentFailures = this.clientInitMetrics.filter(m =>
        m.startTime >= windowStart &&
        m.endTime &&
        !m.success
      );

      if (recentFailures.length >= threshold.count) {
        this.createClientInitFailureAlert(recentFailures.length);
      }
    }
  }

  /**
   * Check validation performance
   */
  private checkValidationPerformance(metrics: EnvironmentValidationMetrics): void {
    const slowThreshold = 5000; // 5 seconds
    
    if (metrics.duration && metrics.duration > slowThreshold) {
      const threshold = this.alertThresholds.validation_performance_degradation;
      const now = new Date();
      const windowStart = new Date(now.getTime() - threshold.window * 60 * 1000);
      
      const recentSlowValidations = this.validationMetrics.filter(m =>
        m.startTime >= windowStart &&
        m.endTime &&
        m.duration &&
        m.duration > slowThreshold
      );

      if (recentSlowValidations.length >= threshold.count) {
        this.createPerformanceDegradationAlert(recentSlowValidations.length, slowThreshold);
      }
    }
  }

  /**
   * Create generic alert
   */
  private createAlert(type: EnvironmentAlert['type'], error: EnvironmentError, count?: number): void {
    const alertKey = `${type}_${error.context.caller}_${error.type}`;
    const existingAlert = this.alerts.get(alertKey);
    
    if (existingAlert && existingAlert.isActive) {
      existingAlert.count = count || existingAlert.count + 1;
      existingAlert.lastOccurrence = error.timestamp;
    } else {
      const alert: EnvironmentAlert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        severity: error.severity === 'critical' ? 'critical' : 'high',
        count: count || 1,
        threshold: this.alertThresholds[type]?.count || 1,
        timeWindow: this.alertThresholds[type]?.window || 10,
        firstOccurrence: error.timestamp,
        lastOccurrence: error.timestamp,
        isActive: true,
        environment: error.context.environment,
        details: {
          errorType: error.type,
          variable: error.variable,
          caller: error.context.caller,
          operation: error.context.operation,
          message: error.message
        }
      };

      this.alerts.set(alertKey, alert);
      this.triggerAlert(alert);
    }
  }

  /**
   * Create client initialization failure alert
   */
  private createClientInitFailureAlert(failureCount: number): void {
    const alertKey = 'client_init_failure_rate';
    const existingAlert = this.alerts.get(alertKey);
    
    if (!existingAlert || !existingAlert.isActive) {
      const alert: EnvironmentAlert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'client_init_failure_rate',
        severity: 'critical',
        count: failureCount,
        threshold: this.alertThresholds.client_init_failure_rate.count,
        timeWindow: this.alertThresholds.client_init_failure_rate.window,
        firstOccurrence: new Date(),
        lastOccurrence: new Date(),
        isActive: true,
        environment: process.env.NODE_ENV || 'development',
        details: {
          failureCount,
          message: `High client initialization failure rate: ${failureCount} failures`
        }
      };

      this.alerts.set(alertKey, alert);
      this.triggerAlert(alert);
    }
  }

  /**
   * Create performance degradation alert
   */
  private createPerformanceDegradationAlert(slowCount: number, threshold: number): void {
    const alertKey = 'validation_performance_degradation';
    const existingAlert = this.alerts.get(alertKey);
    
    if (!existingAlert || !existingAlert.isActive) {
      const alert: EnvironmentAlert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'validation_performance_degradation',
        severity: 'medium',
        count: slowCount,
        threshold: this.alertThresholds.validation_performance_degradation.count,
        timeWindow: this.alertThresholds.validation_performance_degradation.window,
        firstOccurrence: new Date(),
        lastOccurrence: new Date(),
        isActive: true,
        environment: process.env.NODE_ENV || 'development',
        details: {
          slowCount,
          thresholdMs: threshold,
          message: `Environment validation performance degradation: ${slowCount} slow validations`
        }
      };

      this.alerts.set(alertKey, alert);
      this.triggerAlert(alert);
    }
  }

  /**
   * Trigger alert notification
   */
  private triggerAlert(alert: EnvironmentAlert): void {
    logger.error('Environment monitoring alert triggered', {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      count: alert.count,
      timeWindow: alert.timeWindow,
      environment: alert.environment,
      details: alert.details
    });

    // Send to external monitoring if configured
    this.sendExternalAlert(alert);
  }

  /**
   * Send alert to external monitoring systems
   */
  private async sendExternalAlert(alert: EnvironmentAlert): Promise<void> {
    try {
      // Send to Slack if webhook is configured
      const webhookUrl = process.env.SLACK_WEBHOOK_URL;
      if (webhookUrl) {
        await this.sendSlackAlert(alert, webhookUrl);
      }
    } catch (error) {
      logger.error('Failed to send external alert', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        alertId: alert.id 
      });
    }
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(alert: EnvironmentAlert, webhookUrl: string): Promise<void> {
    const emoji = {
      critical: '🚨',
      high: '⚠️',
      medium: '⚡'
    }[alert.severity];

    const message = `${emoji} Environment Alert: ${alert.type}
Environment: ${alert.environment}
Severity: ${alert.severity.toUpperCase()}
Count: ${alert.count} (threshold: ${alert.threshold})
Time Window: ${alert.timeWindow} minutes
Details: ${JSON.stringify(alert.details, null, 2)}`;

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message })
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
      }
    } catch (error) {
      logger.error('Failed to send Slack alert', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        alertId: alert.id 
      });
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE AND EXPORTS
// ============================================================================

export const environmentMonitor = EnvironmentMonitor.getInstance();

// Convenience functions
export const recordEnvironmentError = environmentMonitor.recordEnvironmentError.bind(environmentMonitor);
export const recordMissingVariable = environmentMonitor.recordMissingVariable.bind(environmentMonitor);
export const recordValidationFailure = environmentMonitor.recordValidationFailure.bind(environmentMonitor);
export const recordClientInitializationFailure = environmentMonitor.recordClientInitializationFailure.bind(environmentMonitor);
export const recordNetworkError = environmentMonitor.recordNetworkError.bind(environmentMonitor);
export const startClientInitializationTracking = environmentMonitor.startClientInitializationTracking.bind(environmentMonitor);
export const completeClientInitializationTracking = environmentMonitor.completeClientInitializationTracking.bind(environmentMonitor);
export const startEnvironmentValidationTracking = environmentMonitor.startEnvironmentValidationTracking.bind(environmentMonitor);
export const completeEnvironmentValidationTracking = environmentMonitor.completeEnvironmentValidationTracking.bind(environmentMonitor);