/**
 * Monitoring System Integration
 * 기존 시스템에 모니터링 기능 통합
 */

import { securityMonitor, recordAuthFailure, recordSuspiciousAccess, recordPrivilegeEscalationAttempt } from '@/lib/monitoring/security-monitor';
import { performanceMonitor, measureAuthentication, measureAuthorization, measureDatabaseQuery } from '@/lib/monitoring/performance-monitor';
import { logger } from '@/lib/utils/logger';

/**
 * 미들웨어 모니터링 통합
 */
export function integrateMiddlewareMonitoring() {
  // 기존 미들웨어에 모니터링 기능 추가를 위한 헬퍼 함수들
  
  /**
   * 인증 실패 모니터링
   */
  const monitorAuthFailure = (details: {
    userId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    endpoint: string;
    reason: string;
  }) => {
    recordAuthFailure(details);
  };

  /**
   * 의심스러운 접근 패턴 감지
   */
  const detectSuspiciousAccess = (details: {
    userId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    endpoint: string;
    requestCount?: number;
    timeWindow?: number;
  }) => {
    // 간단한 휴리스틱 기반 위험 점수 계산
    let riskScore = 0;
    
    // 짧은 시간 내 많은 요청
    if (details.requestCount && details.timeWindow) {
      const requestRate = details.requestCount / details.timeWindow;
      if (requestRate > 10) riskScore += 30; // 분당 10회 이상
      if (requestRate > 20) riskScore += 30; // 분당 20회 이상
    }
    
    // 의심스러운 User-Agent
    if (details.userAgent) {
      const suspiciousPatterns = ['bot', 'crawler', 'scanner', 'curl', 'wget'];
      if (suspiciousPatterns.some(pattern => 
        details.userAgent!.toLowerCase().includes(pattern)
      )) {
        riskScore += 25;
      }
    }
    
    // 관리자 엔드포인트 접근
    if (details.endpoint.includes('/admin/')) {
      riskScore += 20;
    }
    
    // 인증되지 않은 사용자의 보호된 리소스 접근
    if (!details.userId && details.endpoint.includes('/api/')) {
      riskScore += 15;
    }

    if (riskScore >= 40) {
      recordSuspiciousAccess({
        ...details,
        pattern: 'automated_access_pattern',
        riskScore
      });
    }
  };

  /**
   * 권한 상승 시도 감지
   */
  const detectPrivilegeEscalation = (details: {
    userId: string;
    sessionId?: string;
    ipAddress?: string;
    endpoint: string;
    attemptedAction: string;
    currentRole: string;
    requiredRole: string;
  }) => {
    recordPrivilegeEscalationAttempt(details);
  };

  return {
    monitorAuthFailure,
    detectSuspiciousAccess,
    detectPrivilegeEscalation
  };
}

/**
 * API 엔드포인트 모니터링 통합
 */
export function integrateApiMonitoring() {
  /**
   * API 요청 성능 측정 래퍼
   */
  const measureApiPerformance = async <T>(
    operation: () => Promise<T>,
    operationType: 'authentication' | 'authorization' | 'database_query' | 'rpc_function',
    metadata?: Record<string, any>
  ): Promise<T> => {
    switch (operationType) {
      case 'authentication':
        return measureAuthentication(operation, metadata);
      case 'authorization':
        return measureAuthorization(operation, metadata);
      case 'database_query':
        return measureDatabaseQuery(operation, metadata);
      case 'rpc_function':
        return performanceMonitor.measureRpcFunction(operation, metadata);
      default:
        return operation();
    }
  };

  /**
   * 데이터베이스 쿼리 모니터링
   */
  const monitorDatabaseQuery = async <T>(
    queryOperation: () => Promise<T>,
    queryInfo: {
      table?: string;
      operation: 'select' | 'insert' | 'update' | 'delete' | 'rpc';
      userId?: string;
    }
  ): Promise<T> => {
    return measureDatabaseQuery(queryOperation, queryInfo);
  };

  /**
   * RPC 함수 호출 모니터링
   */
  const monitorRpcCall = async <T>(
    rpcOperation: () => Promise<T>,
    rpcInfo: {
      functionName: string;
      parameters?: Record<string, any>;
      userId?: string;
    }
  ): Promise<T> => {
    return performanceMonitor.measureRpcFunction(rpcOperation, {
      functionName: rpcInfo.functionName,
      parameterCount: rpcInfo.parameters ? Object.keys(rpcInfo.parameters).length : 0,
      userId: rpcInfo.userId
    });
  };

  return {
    measureApiPerformance,
    monitorDatabaseQuery,
    monitorRpcCall
  };
}

/**
 * 환경 변수 보안 모니터링 통합
 */
export function integrateEnvironmentMonitoring() {
  /**
   * 환경 변수 접근 모니터링
   */
  const monitorEnvironmentAccess = (details: {
    variableName: string;
    caller: string;
    endpoint?: string;
    userId?: string;
    accessType: 'public' | 'server' | 'service_role';
  }) => {
    // 민감한 환경 변수 접근 감지
    const sensitiveVariables = [
      'SUPABASE_SERVICE_ROLE_KEY',
      'DATABASE_URL',
      'JWT_SECRET',
      'API_SECRET_KEY'
    ];

    if (sensitiveVariables.includes(details.variableName)) {
      logger.warn('민감한 환경 변수 접근', {
        variableName: details.variableName,
        caller: details.caller,
        endpoint: details.endpoint,
        userId: details.userId ? '[REDACTED]' : undefined,
        accessType: details.accessType
      });

      // 비정상적인 접근 패턴 감지
      if (details.accessType === 'service_role' && !details.endpoint?.includes('/admin/')) {
        recordSuspiciousAccess({
          userId: details.userId,
          endpoint: details.endpoint || 'unknown',
          pattern: 'unauthorized_service_role_access',
          riskScore: 70
        });
      }
    }
  };

  return {
    monitorEnvironmentAccess
  };
}

/**
 * 데이터 무결성 모니터링 통합
 */
export function integrateDataIntegrityMonitoring() {
  /**
   * 사용자 ID 일관성 위반 감지
   */
  const detectUserIdInconsistency = (details: {
    operation: string;
    table: string;
    recordId: string;
    expectedUserId: string;
    actualUserId: string;
    userId?: string;
  }) => {
    securityMonitor.recordDataIntegrityViolation({
      userId: details.userId,
      table: details.table,
      operation: details.operation,
      violationType: 'user_id_inconsistency',
      affectedRecords: 1
    });

    logger.error('사용자 ID 일관성 위반 감지', {
      operation: details.operation,
      table: details.table,
      recordId: details.recordId,
      expectedUserId: '[REDACTED]',
      actualUserId: '[REDACTED]'
    });
  };

  /**
   * 외래 키 제약 조건 위반 감지
   */
  const detectForeignKeyViolation = (details: {
    table: string;
    operation: string;
    constraintName: string;
    userId?: string;
  }) => {
    securityMonitor.recordDataIntegrityViolation({
      userId: details.userId,
      table: details.table,
      operation: details.operation,
      violationType: 'foreign_key_violation',
      affectedRecords: 1
    });
  };

  /**
   * 데이터 검증 실패 감지
   */
  const detectValidationFailure = (details: {
    table: string;
    operation: string;
    validationType: string;
    fieldName: string;
    userId?: string;
  }) => {
    securityMonitor.recordDataIntegrityViolation({
      userId: details.userId,
      table: details.table,
      operation: details.operation,
      violationType: `validation_failure_${details.validationType}`,
      affectedRecords: 1
    });
  };

  return {
    detectUserIdInconsistency,
    detectForeignKeyViolation,
    detectValidationFailure
  };
}

/**
 * 모니터링 대시보드 데이터 제공
 */
export function getMonitoringDashboardData() {
  const securityStats = securityMonitor.getSecurityStats(60); // 지난 1시간
  const performanceStats = performanceMonitor.getPerformanceStats(60);
  const systemHealth = securityMonitor.getSystemHealth();
  const resourceUsage = performanceMonitor.getResourceUsage();

  return {
    security: {
      totalEvents: securityStats.totalEvents,
      eventsByType: securityStats.eventsByType,
      eventsBySeverity: securityStats.eventsBySeverity,
      activeAlerts: securityStats.activeAlerts,
      systemHealth: systemHealth.status
    },
    performance: {
      totalOperations: performanceStats.totalOperations,
      averageDuration: Math.round(performanceStats.averageDuration),
      successRate: Math.round(performanceStats.successRate * 100) / 100,
      slowestOperations: performanceStats.slowestOperations.slice(0, 5).map(op => ({
        operation: op.operation,
        duration: Math.round(op.duration),
        timestamp: op.timestamp
      }))
    },
    system: {
      memoryUsage: Math.round(resourceUsage.memoryUsage * 100),
      metricsCount: resourceUsage.metricsCount,
      alertsCount: resourceUsage.alertsCount,
      healthStatus: systemHealth.status
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * 모니터링 시스템 초기화
 */
export function initializeMonitoring() {
  logger.info('모니터링 시스템 초기화 시작');

  // 정기적인 데이터 정리 (매 시간)
  setInterval(() => {
    try {
      performanceMonitor.cleanup(24); // 24시간 이상 된 데이터 정리
      logger.debug('모니터링 데이터 정리 완료');
    } catch (error) {
      logger.error('모니터링 데이터 정리 실패', { error });
    }
  }, 60 * 60 * 1000); // 1시간마다

  // 시스템 상태 주기적 확인 (매 5분)
  setInterval(() => {
    try {
      const health = securityMonitor.getSystemHealth();
      const resources = performanceMonitor.getResourceUsage();
      
      if (health.status === 'critical' || resources.memoryUsage > 0.9) {
        logger.warn('모니터링 시스템 상태 경고', {
          healthStatus: health.status,
          memoryUsage: resources.memoryUsage,
          activeAlerts: health.alertsCount
        });
      }
    } catch (error) {
      logger.error('시스템 상태 확인 실패', { error });
    }
  }, 5 * 60 * 1000); // 5분마다

  logger.info('모니터링 시스템 초기화 완료');
}

// 통합된 모니터링 함수들 내보내기
export const monitoring = {
  middleware: integrateMiddlewareMonitoring(),
  api: integrateApiMonitoring(),
  environment: integrateEnvironmentMonitoring(),
  dataIntegrity: integrateDataIntegrityMonitoring(),
  getDashboardData: getMonitoringDashboardData,
  initialize: initializeMonitoring
};