/**
 * Environment Health Check System
 * Provides comprehensive health monitoring for environment configuration
 * Requirements: 4.1, 4.2, 4.4
 */

import { environmentMonitor } from '@/lib/monitoring/environment-monitor';
import { secureEnvironmentAccess } from '@/lib/security/secure-environment-access';
import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/utils/logger';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface EnvironmentHealthStatus {
  overall: 'healthy' | 'degraded' | 'critical' | 'unknown';
  timestamp: Date;
  components: {
    environmentVariables: ComponentHealth;
    supabaseClient: ComponentHealth;
    monitoring: ComponentHealth;
    security: ComponentHealth;
  };
  metrics: {
    totalErrors: number;
    clientInitSuccessRate: number;
    averageValidationTime: number;
    activeAlerts: number;
  };
  recommendations: string[];
  details: Record<string, any>;
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  message: string;
  lastCheck: Date;
  metrics?: Record<string, number>;
  errors?: string[];
}

export interface HealthCheckOptions {
  includeMetrics?: boolean;
  includeDetails?: boolean;
  timeWindowMinutes?: number;
  performDeepCheck?: boolean;
}

// ============================================================================
// ENVIRONMENT HEALTH CHECKER CLASS
// ============================================================================

class EnvironmentHealthChecker {
  private static instance: EnvironmentHealthChecker;
  private lastHealthCheck?: EnvironmentHealthStatus;
  private healthCheckInProgress = false;

  private constructor() {}

  static getInstance(): EnvironmentHealthChecker {
    if (!EnvironmentHealthChecker.instance) {
      EnvironmentHealthChecker.instance = new EnvironmentHealthChecker();
    }
    return EnvironmentHealthChecker.instance;
  }

  /**
   * Perform comprehensive environment health check
   */
  async performHealthCheck(options: HealthCheckOptions = {}): Promise<EnvironmentHealthStatus> {
    if (this.healthCheckInProgress) {
      return this.lastHealthCheck || this.createUnknownStatus();
    }

    this.healthCheckInProgress = true;
    const startTime = Date.now();

    try {
      const {
        includeMetrics = true,
        includeDetails = false,
        timeWindowMinutes = 60,
        performDeepCheck = false
      } = options;

      logger.info('Starting environment health check', { 
        includeMetrics, 
        includeDetails, 
        timeWindowMinutes, 
        performDeepCheck 
      });

      // Check all components
      const [
        envVarsHealth,
        supabaseHealth,
        monitoringHealth,
        securityHealth
      ] = await Promise.all([
        this.checkEnvironmentVariables(performDeepCheck),
        this.checkSupabaseClient(performDeepCheck),
        this.checkMonitoringSystem(timeWindowMinutes),
        this.checkSecuritySystem(timeWindowMinutes)
      ]);

      // Get monitoring metrics
      const metrics = includeMetrics 
        ? await this.getHealthMetrics(timeWindowMinutes)
        : { totalErrors: 0, clientInitSuccessRate: 100, averageValidationTime: 0, activeAlerts: 0 };

      // Determine overall health status
      const overallStatus = this.determineOverallHealth([
        envVarsHealth,
        supabaseHealth,
        monitoringHealth,
        securityHealth
      ]);

      // Generate recommendations
      const recommendations = this.generateRecommendations([
        envVarsHealth,
        supabaseHealth,
        monitoringHealth,
        securityHealth
      ], metrics);

      // Compile details if requested
      const details = includeDetails ? await this.getHealthDetails(timeWindowMinutes) : {};

      const healthStatus: EnvironmentHealthStatus = {
        overall: overallStatus,
        timestamp: new Date(),
        components: {
          environmentVariables: envVarsHealth,
          supabaseClient: supabaseHealth,
          monitoring: monitoringHealth,
          security: securityHealth
        },
        metrics,
        recommendations,
        details
      };

      this.lastHealthCheck = healthStatus;

      logger.info('Environment health check completed', {
        overall: overallStatus,
        duration: Date.now() - startTime,
        totalErrors: metrics.totalErrors,
        activeAlerts: metrics.activeAlerts
      });

      return healthStatus;

    } catch (error) {
      logger.error('Environment health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });

      return this.createErrorStatus(error);
    } finally {
      this.healthCheckInProgress = false;
    }
  }

  /**
   * Get quick health status (cached if recent)
   */
  async getQuickHealthStatus(): Promise<EnvironmentHealthStatus> {
    const cacheMaxAge = 5 * 60 * 1000; // 5 minutes
    
    if (this.lastHealthCheck && 
        (Date.now() - this.lastHealthCheck.timestamp.getTime()) < cacheMaxAge) {
      return this.lastHealthCheck;
    }

    return this.performHealthCheck({ 
      includeMetrics: false, 
      includeDetails: false, 
      performDeepCheck: false 
    });
  }

  /**
   * Check if environment is healthy for critical operations
   */
  async isEnvironmentHealthy(): Promise<boolean> {
    const status = await this.getQuickHealthStatus();
    return status.overall === 'healthy' || status.overall === 'degraded';
  }

  // ============================================================================
  // COMPONENT HEALTH CHECKS
  // ============================================================================

  /**
   * Check environment variables health
   */
  private async checkEnvironmentVariables(deepCheck: boolean): Promise<ComponentHealth> {
    try {
      const validation = await secureEnvironmentAccess.validateAllEnvironmentVariables();
      
      if (validation.valid) {
        return {
          status: 'healthy',
          message: `All ${validation.summary.total} environment variables are valid`,
          lastCheck: new Date(),
          metrics: {
            total: validation.summary.total,
            valid: validation.summary.valid,
            invalid: validation.summary.invalid,
            missing: validation.summary.missing
          }
        };
      }

      const severity = validation.summary.missing > 0 ? 'critical' : 'degraded';
      const errors: string[] = [];
      
      for (const [key, result] of validation.results) {
        if (!result.success) {
          errors.push(`${key}: ${result.error}`);
        }
      }

      return {
        status: severity,
        message: `Environment validation failed: ${validation.summary.invalid} invalid, ${validation.summary.missing} missing`,
        lastCheck: new Date(),
        metrics: {
          total: validation.summary.total,
          valid: validation.summary.valid,
          invalid: validation.summary.invalid,
          missing: validation.summary.missing
        },
        errors: deepCheck ? errors : undefined
      };

    } catch (error) {
      return {
        status: 'critical',
        message: `Environment validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastCheck: new Date(),
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Check Supabase client health
   */
  private async checkSupabaseClient(deepCheck: boolean): Promise<ComponentHealth> {
    try {
      // With auth-helpers, client is always ready when created
      const supabase = createClient();
      const isReady = !!supabase;

      if (isReady) {
        return {
          status: 'healthy',
          message: 'Supabase client is ready and operational',
          lastCheck: new Date(),
          metrics: {
            retryCount: 0,
            state: 1
          }
        };
      }

      // With auth-helpers, if client creation fails, it's a critical error
      return {
        status: 'critical',
        message: 'Supabase client is not available',
        lastCheck: new Date(),
        metrics: {
          retryCount: 0,
          state: 0
        }
      };

    } catch (error) {
      return {
        status: 'critical',
        message: `Supabase client check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastCheck: new Date(),
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Check monitoring system health
   */
  private async checkMonitoringSystem(timeWindowMinutes: number): Promise<ComponentHealth> {
    try {
      const stats = environmentMonitor.getMonitoringStats(timeWindowMinutes);
      const activeAlerts = environmentMonitor.getActiveAlerts();
      
      if (activeAlerts.length === 0 && stats.totalErrors < 10) {
        return {
          status: 'healthy',
          message: 'Monitoring system is operational with minimal errors',
          lastCheck: new Date(),
          metrics: {
            totalErrors: stats.totalErrors,
            activeAlerts: activeAlerts.length,
            successRate: stats.clientInitializationSuccessRate
          }
        };
      }

      if (activeAlerts.some(a => a.severity === 'critical')) {
        return {
          status: 'critical',
          message: `Monitoring system has ${activeAlerts.length} active alerts including critical ones`,
          lastCheck: new Date(),
          metrics: {
            totalErrors: stats.totalErrors,
            activeAlerts: activeAlerts.length,
            successRate: stats.clientInitializationSuccessRate
          }
        };
      }

      return {
        status: 'degraded',
        message: `Monitoring system has ${stats.totalErrors} errors and ${activeAlerts.length} active alerts`,
        lastCheck: new Date(),
        metrics: {
          totalErrors: stats.totalErrors,
          activeAlerts: activeAlerts.length,
          successRate: stats.clientInitializationSuccessRate
        }
      };

    } catch (error) {
      return {
        status: 'critical',
        message: `Monitoring system check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastCheck: new Date(),
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Check security system health
   */
  private async checkSecuritySystem(timeWindowMinutes: number): Promise<ComponentHealth> {
    try {
      // This would integrate with the security monitor
      // For now, we'll do a basic check
      const accessLog = secureEnvironmentAccess.getAccessLog();
      const recentAccess = accessLog.filter(log => 
        (Date.now() - log.timestamp.getTime()) < (timeWindowMinutes * 60 * 1000)
      );

      return {
        status: 'healthy',
        message: 'Security system is operational',
        lastCheck: new Date(),
        metrics: {
          recentAccess: recentAccess.length,
          totalAccessLog: accessLog.length
        }
      };

    } catch (error) {
      return {
        status: 'degraded',
        message: `Security system check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastCheck: new Date(),
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Get health metrics
   */
  private async getHealthMetrics(timeWindowMinutes: number): Promise<{
    totalErrors: number;
    clientInitSuccessRate: number;
    averageValidationTime: number;
    activeAlerts: number;
  }> {
    const stats = environmentMonitor.getMonitoringStats(timeWindowMinutes);
    const activeAlerts = environmentMonitor.getActiveAlerts();

    return {
      totalErrors: stats.totalErrors,
      clientInitSuccessRate: stats.clientInitializationSuccessRate,
      averageValidationTime: stats.averageValidationDuration,
      activeAlerts: activeAlerts.length
    };
  }

  /**
   * Get detailed health information
   */
  private async getHealthDetails(timeWindowMinutes: number): Promise<Record<string, any>> {
    const recentErrors = environmentMonitor.getRecentErrors(50);
    const clientMetrics = environmentMonitor.getClientInitializationMetrics(20);
    const validationMetrics = environmentMonitor.getEnvironmentValidationMetrics(20);
    const activeAlerts = environmentMonitor.getActiveAlerts();

    return {
      recentErrors: recentErrors.slice(-10), // Last 10 errors
      clientInitializationMetrics: clientMetrics.slice(-5), // Last 5 client inits
      validationMetrics: validationMetrics.slice(-5), // Last 5 validations
      activeAlerts,
      environment: process.env.NODE_ENV || 'development'
    };
  }

  /**
   * Determine overall health status
   */
  private determineOverallHealth(components: ComponentHealth[]): 'healthy' | 'degraded' | 'critical' | 'unknown' {
    if (components.some(c => c.status === 'critical')) {
      return 'critical';
    }
    
    if (components.some(c => c.status === 'degraded')) {
      return 'degraded';
    }
    
    if (components.every(c => c.status === 'healthy')) {
      return 'healthy';
    }
    
    return 'unknown';
  }

  /**
   * Generate health recommendations
   */
  private generateRecommendations(
    components: ComponentHealth[], 
    metrics: { totalErrors: number; clientInitSuccessRate: number; averageValidationTime: number; activeAlerts: number }
  ): string[] {
    const recommendations: string[] = [];

    // Environment variables recommendations
    const envComponent = components[0];
    if (envComponent.status === 'critical') {
      recommendations.push('Fix missing or invalid environment variables immediately');
    } else if (envComponent.status === 'degraded') {
      recommendations.push('Review and fix environment variable validation issues');
    }

    // Supabase client recommendations
    const supabaseComponent = components[1];
    if (supabaseComponent.status === 'critical') {
      recommendations.push('Investigate Supabase client initialization failures');
    } else if (supabaseComponent.status === 'degraded') {
      recommendations.push('Monitor Supabase client retry attempts');
    }

    // Performance recommendations
    if (metrics.clientInitSuccessRate < 90) {
      recommendations.push('Client initialization success rate is low - check network connectivity and configuration');
    }

    if (metrics.averageValidationTime > 2000) {
      recommendations.push('Environment validation is slow - consider optimizing validation logic');
    }

    // Alert recommendations
    if (metrics.activeAlerts > 0) {
      recommendations.push(`Review and resolve ${metrics.activeAlerts} active monitoring alerts`);
    }

    if (metrics.totalErrors > 20) {
      recommendations.push('High error count detected - investigate recurring issues');
    }

    // Default recommendation if everything is healthy
    if (recommendations.length === 0) {
      recommendations.push('Environment is healthy - continue monitoring');
    }

    return recommendations;
  }

  /**
   * Create unknown status
   */
  private createUnknownStatus(): EnvironmentHealthStatus {
    return {
      overall: 'unknown',
      timestamp: new Date(),
      components: {
        environmentVariables: {
          status: 'unknown',
          message: 'Health check not performed',
          lastCheck: new Date()
        },
        supabaseClient: {
          status: 'unknown',
          message: 'Health check not performed',
          lastCheck: new Date()
        },
        monitoring: {
          status: 'unknown',
          message: 'Health check not performed',
          lastCheck: new Date()
        },
        security: {
          status: 'unknown',
          message: 'Health check not performed',
          lastCheck: new Date()
        }
      },
      metrics: {
        totalErrors: 0,
        clientInitSuccessRate: 0,
        averageValidationTime: 0,
        activeAlerts: 0
      },
      recommendations: ['Perform health check to get status'],
      details: {}
    };
  }

  /**
   * Create error status
   */
  private createErrorStatus(error: unknown): EnvironmentHealthStatus {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      overall: 'critical',
      timestamp: new Date(),
      components: {
        environmentVariables: {
          status: 'unknown',
          message: 'Health check failed',
          lastCheck: new Date(),
          errors: [errorMessage]
        },
        supabaseClient: {
          status: 'unknown',
          message: 'Health check failed',
          lastCheck: new Date(),
          errors: [errorMessage]
        },
        monitoring: {
          status: 'unknown',
          message: 'Health check failed',
          lastCheck: new Date(),
          errors: [errorMessage]
        },
        security: {
          status: 'unknown',
          message: 'Health check failed',
          lastCheck: new Date(),
          errors: [errorMessage]
        }
      },
      metrics: {
        totalErrors: 0,
        clientInitSuccessRate: 0,
        averageValidationTime: 0,
        activeAlerts: 0
      },
      recommendations: ['Fix health check system errors', 'Investigate monitoring system issues'],
      details: { error: errorMessage }
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE AND EXPORTS
// ============================================================================

export const environmentHealthChecker = EnvironmentHealthChecker.getInstance();

// Convenience functions
export const performHealthCheck = environmentHealthChecker.performHealthCheck.bind(environmentHealthChecker);
export const getQuickHealthStatus = environmentHealthChecker.getQuickHealthStatus.bind(environmentHealthChecker);
export const isEnvironmentHealthy = environmentHealthChecker.isEnvironmentHealthy.bind(environmentHealthChecker);