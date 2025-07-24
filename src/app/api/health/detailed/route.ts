/**
 * Detailed Health Check API Endpoint
 * 상세한 시스템 상태 정보 제공
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { environmentManager } from '@/lib/security/environment-manager';
import { securityMonitor } from '@/lib/monitoring/security-monitor';
import { performanceMonitor } from '@/lib/monitoring/performance-monitor';

import { logger } from '@/lib/utils/logger';

export interface DetailedHealthResult {
  timestamp: string;
  uptime: number;
  version: string;
  nodeEnv: string;
  system: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    monitoring: {
      securityEvents: number;
      performanceMetrics: number;
      activeAlerts: number;
    };
  };
  database: {
    connectionStatus: 'connected' | 'disconnected' | 'error';
    responseTime: number;
    activeConnections?: number;
    lastQuery: string;
  };
  security: {
    recentEvents: Array<{
      type: string;
      severity: string;
      count: number;
      lastOccurrence: string;
    }>;
    activeAlerts: Array<{
      id: string;
      type: string;
      severity: string;
      count: number;
    }>;
    systemStatus: string;
  };
  performance: {
    averageResponseTime: number;
    successRate: number;
    slowestOperations: Array<{
      operation: string;
      duration: number;
      timestamp: string;
    }>;
    trends: {
      trend: string;
      hourlyData: Array<{
        hour: string;
        averageDuration: number;
        operationCount: number;
      }>;
    };
  };
  environment: {
    validationStatus: 'valid' | 'invalid' | 'warnings';
    requiredVariables: Array<{
      name: string;
      status: 'present' | 'missing' | 'invalid';
    }>;
    warnings: string[];
    errors: string[];
  };
  endpoints: {
    publicReservations: {
      authenticated: 'healthy' | 'degraded' | 'unhealthy';
      anonymous: 'healthy' | 'degraded' | 'unhealthy';
    };
    admin: {
      status: 'healthy' | 'degraded' | 'unhealthy';
    };
  };
}

/**
 * 상세한 시스템 상태 정보 제공
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    logger.info('상세 시스템 상태 확인 시작');

    // 모든 상태 정보를 병렬로 수집
    const [
      systemInfo,
      databaseInfo,
      securityInfo,
      performanceInfo,
      environmentInfo,
      endpointInfo
    ] = await Promise.allSettled([
      getSystemInfo(),
      getDatabaseInfo(),
      getSecurityInfo(),
      getPerformanceInfo(),
      getEnvironmentInfo(),
      getEndpointInfo()
    ]);

    const result: DetailedHealthResult = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      nodeEnv: process.env.NODE_ENV || 'development',
      system: getSettledValue(systemInfo, getDefaultSystemInfo()),
      database: getSettledValue(databaseInfo, getDefaultDatabaseInfo()),
      security: getSettledValue(securityInfo, getDefaultSecurityInfo()),
      performance: getSettledValue(performanceInfo, getDefaultPerformanceInfo()),
      environment: getSettledValue(environmentInfo, getDefaultEnvironmentInfo()),
      endpoints: getSettledValue(endpointInfo, getDefaultEndpointInfo())
    };

    const duration = Date.now() - startTime;
    
    logger.info('상세 시스템 상태 확인 완료', {
      duration,
      systemStatus: result.system,
      securityAlerts: result.security.activeAlerts.length,
      performanceIssues: result.performance.slowestOperations.length
    });

    return NextResponse.json(result);

  } catch (error) {
    logger.error('상세 시스템 상태 확인 실패', { error });
    
    return NextResponse.json(
      { 
        error: 'Failed to retrieve detailed health information',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * 시스템 정보 수집
 */
async function getSystemInfo() {
  const securityHealth = securityMonitor.getSystemHealth();
  const performanceResources = performanceMonitor.getResourceUsage();
  
  // Node.js 메모리 사용량
  const memoryUsage = process.memoryUsage();
  
  return {
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
      percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
    },
    monitoring: {
      securityEvents: securityHealth.eventsCount,
      performanceMetrics: performanceResources.metricsCount,
      activeAlerts: securityHealth.alertsCount
    }
  };
}

/**
 * 데이터베이스 정보 수집
 */
async function getDatabaseInfo() {
  const startTime = performance.now();
  
  try {
    const supabase = await createClient();
    
    // 간단한 쿼리로 연결 테스트
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    const responseTime = Math.round(performance.now() - startTime);
    
    if (error) {
      return {
        connectionStatus: 'error' as const,
        responseTime,
        lastQuery: new Date().toISOString()
      };
    }
    
    return {
      connectionStatus: 'connected' as const,
      responseTime,
      lastQuery: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      connectionStatus: 'disconnected' as const,
      responseTime: Math.round(performance.now() - startTime),
      lastQuery: new Date().toISOString()
    };
  }
}

/**
 * 보안 정보 수집
 */
async function getSecurityInfo() {
  const systemHealth = securityMonitor.getSystemHealth();
  const activeAlerts = securityMonitor.getActiveAlerts();
  const recentStats = securityMonitor.getSecurityStats(60); // 지난 1시간
  
  // 이벤트 타입별 집계
  const eventSummary = Object.entries(recentStats.eventsByType).map(([type, count]) => {
    const recentEvents = securityMonitor.getRecentEvents(100)
      .filter(e => e.type === type)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return {
      type,
      severity: recentEvents[0]?.severity || 'low',
      count: Number(count),
      lastOccurrence: recentEvents[0]?.timestamp ? recentEvents[0].timestamp.toISOString() : new Date().toISOString()
    };
  });
  
  return {
    recentEvents: eventSummary,
    activeAlerts: activeAlerts.map(alert => ({
      id: alert.id,
      type: alert.eventType,
      severity: alert.severity,
      count: alert.count
    })),
    systemStatus: systemHealth.status
  };
}

/**
 * 성능 정보 수집
 */
async function getPerformanceInfo() {
  const stats = performanceMonitor.getPerformanceStats(60);
  const trends = performanceMonitor.getPerformanceTrends(undefined, 6); // 지난 6시간
  
  return {
    averageResponseTime: Math.round(stats.averageDuration),
    successRate: Math.round(stats.successRate * 100) / 100,
    slowestOperations: stats.slowestOperations.slice(0, 5).map(op => ({
      operation: op.operation,
      duration: Math.round(op.duration),
      timestamp: op.timestamp
    })),
    trends: {
      trend: trends.trend,
      hourlyData: trends.hourlyAverages.slice(-6).map(hour => ({
        hour: hour.hour,
        averageDuration: Math.round(hour.averageDuration),
        operationCount: hour.operationCount
      }))
    }
  };
}

/**
 * 환경 변수 정보 수집
 */
async function getEnvironmentInfo() {
  const validation = environmentManager.validateEnvironment();
  
  const requiredVariables = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  
  const variableStatus = requiredVariables.map(varName => {
    const value = process.env[varName];
    let status: 'present' | 'missing' | 'invalid' = 'missing';
    
    if (value) {
      if (varName === 'NEXT_PUBLIC_SUPABASE_URL') {
        try {
          new URL(value);
          status = 'present';
        } catch {
          status = 'invalid';
        }
      } else {
        status = value.length > 10 ? 'present' : 'invalid';
      }
    }
    
    return {
      name: varName,
      status
    };
  });
  
  return {
    validationStatus: validation.valid ? 
      (validation.warnings.length > 0 ? 'warnings' as const : 'valid' as const) : 
      'invalid' as const,
    requiredVariables: variableStatus,
    warnings: validation.warnings,
    errors: validation.errors
  };
}

/**
 * 엔드포인트 상태 정보 수집
 */
async function getEndpointInfo() {
  // 실제 환경에서는 각 엔드포인트에 대한 헬스체크를 수행
  // 여기서는 간단한 상태 확인만 수행
  
  try {
    const supabase = await createClient();
    
    // 공개 예약 엔드포인트 테스트
    const anonymousTest = await supabase.rpc('get_public_reservations_anonymous', {
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 60000).toISOString()
    });
    
    return {
      publicReservations: {
        authenticated: 'healthy' as const,
        anonymous: anonymousTest.error ? 'degraded' as const : 'healthy' as const
      },
      admin: {
        status: 'healthy' as const // 실제로는 관리자 엔드포인트 테스트 필요
      }
    };
    
  } catch (error) {
    return {
      publicReservations: {
        authenticated: 'unhealthy' as const,
        anonymous: 'unhealthy' as const
      },
      admin: {
        status: 'unhealthy' as const
      }
    };
  }
}

/**
 * Promise.allSettled 결과에서 값 추출
 */
function getSettledValue<T>(result: PromiseSettledResult<T>, defaultValue: T): T {
  return result.status === 'fulfilled' ? result.value : defaultValue;
}

/**
 * 기본값들
 */
function getDefaultSystemInfo() {
  return {
    memory: { used: 0, total: 0, percentage: 0 },
    monitoring: { securityEvents: 0, performanceMetrics: 0, activeAlerts: 0 }
  };
}

function getDefaultDatabaseInfo() {
  return {
    connectionStatus: 'error' as const,
    responseTime: 0,
    lastQuery: new Date().toISOString()
  };
}

function getDefaultSecurityInfo() {
  return {
    recentEvents: [],
    activeAlerts: [],
    systemStatus: 'critical' as const
  };
}

function getDefaultPerformanceInfo() {
  return {
    averageResponseTime: 0,
    successRate: 0,
    slowestOperations: [],
    trends: { trend: 'stable' as const, hourlyData: [] }
  };
}

function getDefaultEnvironmentInfo() {
  return {
    validationStatus: 'invalid' as const,
    requiredVariables: [],
    warnings: [],
    errors: ['Failed to validate environment']
  };
}

function getDefaultEndpointInfo() {
  return {
    publicReservations: {
      authenticated: 'unhealthy' as const,
      anonymous: 'unhealthy' as const
    },
    admin: {
      status: 'unhealthy' as const
    }
  };
}