/**
 * Performance Monitoring System
 * 보안 작업의 성능 모니터링 및 최적화
 */

import { logger } from '@/lib/utils/logger';

export interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: string;
  success: boolean;
  metadata?: Record<string, any>;
}

export interface PerformanceAlert {
  id: string;
  operation: string;
  threshold: number;
  actualValue: number;
  severity: 'warning' | 'critical';
  timestamp: string;
  details: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  private readonly maxMetrics = 50000;
  private readonly thresholds = {
    // 임계값 (밀리초)
    authentication: { warning: 1000, critical: 3000 },
    authorization: { warning: 500, critical: 1500 },
    database_query: { warning: 2000, critical: 5000 },
    rpc_function: { warning: 1500, critical: 4000 },
    data_validation: { warning: 800, critical: 2000 },
    environment_check: { warning: 200, critical: 500 }
  };

  /**
   * 성능 메트릭 기록
   */
  recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    const performanceMetric: PerformanceMetric = {
      ...metric,
      timestamp: new Date().toISOString()
    };

    this.metrics.push(performanceMetric);

    // 메모리 사용량 제한
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // 성능 임계값 확인
    this.checkPerformanceThreshold(performanceMetric);

    // 느린 작업 로깅
    if (metric.duration > 1000) {
      logger.warn('느린 보안 작업 감지', {
        operation: metric.operation,
        duration: metric.duration,
        success: metric.success,
        metadata: metric.metadata
      });
    }
  }

  /**
   * 인증 성능 측정
   */
  async measureAuthentication<T>(
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    return this.measureOperation('authentication', operation, metadata);
  }

  /**
   * 권한 부여 성능 측정
   */
  async measureAuthorization<T>(
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    return this.measureOperation('authorization', operation, metadata);
  }

  /**
   * 데이터베이스 쿼리 성능 측정
   */
  async measureDatabaseQuery<T>(
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    return this.measureOperation('database_query', operation, metadata);
  }

  /**
   * RPC 함수 성능 측정
   */
  async measureRpcFunction<T>(
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    return this.measureOperation('rpc_function', operation, metadata);
  }

  /**
   * 데이터 검증 성능 측정
   */
  async measureDataValidation<T>(
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    return this.measureOperation('data_validation', operation, metadata);
  }

  /**
   * 환경 변수 확인 성능 측정
   */
  async measureEnvironmentCheck<T>(
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    return this.measureOperation('environment_check', operation, metadata);
  }

  /**
   * 일반적인 작업 성능 측정
   */
  private async measureOperation<T>(
    operationType: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = performance.now();
    let success = false;
    let result: T;

    try {
      result = await operation();
      success = true;
      return result;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const duration = performance.now() - startTime;
      
      this.recordMetric({
        operation: operationType,
        duration,
        success,
        metadata: {
          ...metadata,
          error: success ? undefined : 'Operation failed'
        }
      });
    }
  }

  /**
   * 성능 임계값 확인
   */
  private checkPerformanceThreshold(metric: PerformanceMetric): void {
    const threshold = this.thresholds[metric.operation as keyof typeof this.thresholds];
    if (!threshold) return;

    let severity: 'warning' | 'critical' | null = null;
    let thresholdValue = 0;

    if (metric.duration > threshold.critical) {
      severity = 'critical';
      thresholdValue = threshold.critical;
    } else if (metric.duration > threshold.warning) {
      severity = 'warning';
      thresholdValue = threshold.warning;
    }

    if (severity) {
      const alert: PerformanceAlert = {
        id: `perf_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        operation: metric.operation,
        threshold: thresholdValue,
        actualValue: metric.duration,
        severity,
        timestamp: metric.timestamp,
        details: {
          success: metric.success,
          metadata: metric.metadata
        }
      };

      this.alerts.push(alert);
      this.triggerPerformanceAlert(alert);
    }
  }

  /**
   * 성능 알림 트리거
   */
  private triggerPerformanceAlert(alert: PerformanceAlert): void {
    logger.warn('성능 알림 발생', {
      alertId: alert.id,
      operation: alert.operation,
      severity: alert.severity,
      threshold: alert.threshold,
      actualValue: alert.actualValue,
      details: alert.details
    });

    // 심각한 성능 문제의 경우 외부 알림
    if (alert.severity === 'critical') {
      this.sendPerformanceAlert(alert);
    }
  }

  /**
   * 외부 성능 알림 전송
   */
  private async sendPerformanceAlert(alert: PerformanceAlert): Promise<void> {
    try {
      const message = `🐌 성능 알림: ${alert.operation}
심각도: ${alert.severity.toUpperCase()}
임계값: ${alert.threshold}ms
실제값: ${Math.round(alert.actualValue)}ms
시간: ${alert.timestamp}`;

      // Slack 알림 (구현 예시)
      const webhookUrl = process.env.SLACK_WEBHOOK_URL;
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: message,
            attachments: [{
              color: alert.severity === 'critical' ? 'danger' : 'warning',
              fields: [
                { title: 'Operation', value: alert.operation, short: true },
                { title: 'Duration', value: `${Math.round(alert.actualValue)}ms`, short: true },
                { title: 'Threshold', value: `${alert.threshold}ms`, short: true },
                { title: 'Success', value: alert.details.success ? 'Yes' : 'No', short: true }
              ]
            }]
          })
        });
      }
    } catch (error) {
      logger.error('성능 알림 전송 실패', { error, alertId: alert.id });
    }
  }

  /**
   * 성능 통계 조회
   */
  getPerformanceStats(timeWindow: number = 60): {
    totalOperations: number;
    averageDuration: number;
    successRate: number;
    operationStats: Record<string, {
      count: number;
      averageDuration: number;
      successRate: number;
      p95Duration: number;
      p99Duration: number;
    }>;
    slowestOperations: PerformanceMetric[];
  } {
    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindow * 60 * 1000);
    
    const recentMetrics = this.metrics.filter(m => 
      new Date(m.timestamp) >= windowStart
    );

    if (recentMetrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        successRate: 0,
        operationStats: {},
        slowestOperations: []
      };
    }

    const totalDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0);
    const successfulOperations = recentMetrics.filter(m => m.success).length;

    // 작업별 통계
    const operationGroups = recentMetrics.reduce((groups, metric) => {
      if (!groups[metric.operation]) {
        groups[metric.operation] = [];
      }
      groups[metric.operation].push(metric);
      return groups;
    }, {} as Record<string, PerformanceMetric[]>);

    const operationStats: Record<string, any> = {};
    
    Object.entries(operationGroups).forEach(([operation, metrics]) => {
      const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
      const successCount = metrics.filter(m => m.success).length;
      
      operationStats[operation] = {
        count: metrics.length,
        averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        successRate: (successCount / metrics.length) * 100,
        p95Duration: durations[Math.floor(durations.length * 0.95)] || 0,
        p99Duration: durations[Math.floor(durations.length * 0.99)] || 0
      };
    });

    // 가장 느린 작업들
    const slowestOperations = recentMetrics
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    return {
      totalOperations: recentMetrics.length,
      averageDuration: totalDuration / recentMetrics.length,
      successRate: (successfulOperations / recentMetrics.length) * 100,
      operationStats,
      slowestOperations
    };
  }

  /**
   * 성능 알림 조회
   */
  getPerformanceAlerts(limit: number = 50): PerformanceAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * 성능 트렌드 분석
   */
  getPerformanceTrends(operation?: string, hours: number = 24): {
    hourlyAverages: Array<{
      hour: string;
      averageDuration: number;
      operationCount: number;
      successRate: number;
    }>;
    trend: 'improving' | 'degrading' | 'stable';
  } {
    const now = new Date();
    const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);
    
    let relevantMetrics = this.metrics.filter(m => 
      new Date(m.timestamp) >= startTime
    );

    if (operation) {
      relevantMetrics = relevantMetrics.filter(m => m.operation === operation);
    }

    // 시간별 그룹화
    const hourlyGroups: Record<string, PerformanceMetric[]> = {};
    
    relevantMetrics.forEach(metric => {
      const hour = new Date(metric.timestamp).toISOString().slice(0, 13) + ':00:00.000Z';
      if (!hourlyGroups[hour]) {
        hourlyGroups[hour] = [];
      }
      hourlyGroups[hour].push(metric);
    });

    const hourlyAverages = Object.entries(hourlyGroups)
      .map(([hour, metrics]) => ({
        hour,
        averageDuration: metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length,
        operationCount: metrics.length,
        successRate: (metrics.filter(m => m.success).length / metrics.length) * 100
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    // 트렌드 분석
    let trend: 'improving' | 'degrading' | 'stable' = 'stable';
    
    if (hourlyAverages.length >= 2) {
      const firstHalf = hourlyAverages.slice(0, Math.floor(hourlyAverages.length / 2));
      const secondHalf = hourlyAverages.slice(Math.floor(hourlyAverages.length / 2));
      
      const firstHalfAvg = firstHalf.reduce((sum, h) => sum + h.averageDuration, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, h) => sum + h.averageDuration, 0) / secondHalf.length;
      
      const changePercent = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
      
      if (changePercent > 10) {
        trend = 'degrading';
      } else if (changePercent < -10) {
        trend = 'improving';
      }
    }

    return {
      hourlyAverages,
      trend
    };
  }

  /**
   * 시스템 리소스 사용량 모니터링
   */
  getResourceUsage(): {
    memoryUsage: number;
    metricsCount: number;
    alertsCount: number;
    oldestMetricAge: number; // minutes
  } {
    const now = new Date();
    const oldestMetric = this.metrics.length > 0 ? this.metrics[0] : null;
    const oldestMetricAge = oldestMetric 
      ? (now.getTime() - new Date(oldestMetric.timestamp).getTime()) / (1000 * 60)
      : 0;

    return {
      memoryUsage: this.metrics.length / this.maxMetrics,
      metricsCount: this.metrics.length,
      alertsCount: this.alerts.length,
      oldestMetricAge
    };
  }

  /**
   * 성능 데이터 정리
   */
  cleanup(olderThanHours: number = 24): number {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const initialCount = this.metrics.length;
    
    this.metrics = this.metrics.filter(m => 
      new Date(m.timestamp) > cutoffTime
    );

    this.alerts = this.alerts.filter(a => 
      new Date(a.timestamp) > cutoffTime
    );

    const removedCount = initialCount - this.metrics.length;
    
    if (removedCount > 0) {
      logger.info('성능 데이터 정리 완료', {
        removedMetrics: removedCount,
        remainingMetrics: this.metrics.length,
        cutoffTime: cutoffTime.toISOString()
      });
    }

    return removedCount;
  }
}

// 싱글톤 인스턴스
export const performanceMonitor = new PerformanceMonitor();

// 편의 함수들
export const measureAuthentication = performanceMonitor.measureAuthentication.bind(performanceMonitor);
export const measureAuthorization = performanceMonitor.measureAuthorization.bind(performanceMonitor);
export const measureDatabaseQuery = performanceMonitor.measureDatabaseQuery.bind(performanceMonitor);
export const measureRpcFunction = performanceMonitor.measureRpcFunction.bind(performanceMonitor);
export const measureDataValidation = performanceMonitor.measureDataValidation.bind(performanceMonitor);
export const measureEnvironmentCheck = performanceMonitor.measureEnvironmentCheck.bind(performanceMonitor);