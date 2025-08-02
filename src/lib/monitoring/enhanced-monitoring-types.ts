/**
 * Enhanced Monitoring Types for Security and Performance Contexts
 * Comprehensive TypeScript interfaces for monitoring systems
 * Requirements: 1.1, 1.5
 */

import type {
  AuthId,
  DatabaseUserId,
  SecurityEventType,
  SecuritySeverity,
  PerformanceOperation,
  SecurityEventContext,
  PerformanceMetricContext,
  ResourceUsage
} from '@/types/enhanced-types';

// ============================================================================
// ENHANCED SECURITY MONITORING INTERFACES
// ============================================================================

/**
 * Extended security event with additional context
 */
export interface ExtendedSecurityEvent extends SecurityEventContext {
  // Additional fields for enhanced monitoring
  requestId?: string;
  traceId?: string;
  spanId?: string;
  parentEventId?: string;
  relatedEvents?: string[];
  
  // Geographic and network context
  geoLocation?: {
    country?: string;
    region?: string;
    city?: string;
    coordinates?: [number, number]; // [latitude, longitude]
  };
  
  // Device and browser context
  deviceInfo?: {
    deviceType?: 'desktop' | 'mobile' | 'tablet' | 'unknown';
    os?: string;
    browser?: string;
    screenResolution?: string;
    timezone?: string;
  };
  
  // Application context
  applicationContext?: {
    version?: string;
    environment?: 'development' | 'staging' | 'production';
    feature?: string;
    component?: string;
    route?: string;
  };
  
  // Risk assessment
  riskAssessment?: {
    riskScore: number; // 0-100
    riskFactors: string[];
    mitigationActions?: string[];
    requiresImmedateAction: boolean;
  };
}

/**
 * Security alert configuration with enhanced thresholds
 */
export interface EnhancedSecurityAlertConfig {
  eventType: SecurityEventType;
  enabled: boolean;
  
  // Threshold configuration
  thresholds: {
    count: number;
    timeWindowMinutes: number;
    severity: SecuritySeverity;
  }[];
  
  // Alert channels
  alertChannels: {
    slack?: {
      enabled: boolean;
      webhookUrl?: string;
      channel?: string;
      mentionUsers?: string[];
    };
    email?: {
      enabled: boolean;
      recipients: string[];
      template?: string;
    };
    sms?: {
      enabled: boolean;
      phoneNumbers: string[];
    };
    webhook?: {
      enabled: boolean;
      url: string;
      headers?: Record<string, string>;
    };
  };
  
  // Escalation rules
  escalation?: {
    enabled: boolean;
    escalationLevels: {
      level: number;
      delayMinutes: number;
      channels: string[];
      recipients: string[];
    }[];
  };
  
  // Suppression rules
  suppression?: {
    enabled: boolean;
    suppressionRules: {
      condition: string; // JSON path expression
      durationMinutes: number;
    }[];
  };
}

/**
 * Security monitoring dashboard metrics
 */
export interface SecurityDashboardMetrics {
  timeRange: {
    start: Date;
    end: Date;
    granularity: 'minute' | 'hour' | 'day';
  };
  
  // Event statistics
  eventStats: {
    totalEvents: number;
    eventsByType: Record<SecurityEventType, number>;
    eventsBySeverity: Record<SecuritySeverity, number>;
    eventsOverTime: Array<{
      timestamp: Date;
      count: number;
      eventType?: SecurityEventType;
      severity?: SecuritySeverity;
    }>;
  };
  
  // Alert statistics
  alertStats: {
    totalAlerts: number;
    activeAlerts: number;
    resolvedAlerts: number;
    alertsByType: Record<SecurityEventType, number>;
    averageResolutionTime: number; // minutes
  };
  
  // Top security issues
  topIssues: Array<{
    eventType: SecurityEventType;
    count: number;
    affectedUsers: number;
    firstOccurrence: Date;
    lastOccurrence: Date;
    trend: 'increasing' | 'decreasing' | 'stable';
  }>;
  
  // Geographic distribution
  geoDistribution: Array<{
    country: string;
    eventCount: number;
    riskScore: number;
  }>;
  
  // User behavior analysis
  userBehaviorAnalysis: {
    suspiciousUsers: Array<{
      userId: DatabaseUserId;
      riskScore: number;
      eventCount: number;
      lastActivity: Date;
      riskFactors: string[];
    }>;
    
    normalBehaviorBaseline: {
      averageSessionDuration: number;
      typicalAccessPatterns: string[];
      commonGeoLocations: string[];
    };
  };
}

// ============================================================================
// ENHANCED PERFORMANCE MONITORING INTERFACES
// ============================================================================

/**
 * Extended performance metric with additional context
 */
export interface ExtendedPerformanceMetric extends PerformanceMetricContext {
  // Additional performance context
  requestId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  
  // Database performance
  databaseMetrics?: {
    queryCount: number;
    totalQueryTime: number;
    slowQueries: Array<{
      query: string;
      duration: number;
      parameters?: any[];
    }>;
    connectionPoolStats?: {
      activeConnections: number;
      idleConnections: number;
      waitingRequests: number;
    };
  };
  
  // Cache performance
  cacheMetrics?: {
    hitRate: number;
    missRate: number;
    evictionCount: number;
    cacheSize: number;
    operations: Array<{
      operation: 'get' | 'set' | 'delete' | 'evict';
      key: string;
      duration: number;
      hit?: boolean;
    }>;
  };
  
  // Network performance
  networkMetrics?: {
    requestSize: number;
    responseSize: number;
    dnsLookupTime?: number;
    tcpConnectTime?: number;
    tlsHandshakeTime?: number;
    firstByteTime?: number;
  };
  
  // Application performance
  applicationMetrics?: {
    renderTime?: number;
    domContentLoadedTime?: number;
    windowLoadTime?: number;
    firstContentfulPaint?: number;
    largestContentfulPaint?: number;
    cumulativeLayoutShift?: number;
  };
  
  // Error context
  errorContext?: {
    hasError: boolean;
    errorType?: string;
    errorMessage?: string;
    stackTrace?: string;
    errorCode?: string;
  };
}

/**
 * Performance alert configuration with SLA thresholds
 */
export interface EnhancedPerformanceAlertConfig {
  operation: PerformanceOperation;
  enabled: boolean;
  
  // SLA thresholds
  slaThresholds: {
    p50: number; // 50th percentile threshold (ms)
    p95: number; // 95th percentile threshold (ms)
    p99: number; // 99th percentile threshold (ms)
    errorRate: number; // Error rate threshold (%)
    throughput: number; // Minimum requests per second
  };
  
  // Alert conditions
  alertConditions: {
    consecutiveViolations: number;
    evaluationWindow: number; // minutes
    severity: 'warning' | 'critical';
  };
  
  // Notification settings
  notifications: {
    channels: string[];
    suppressionWindow: number; // minutes
    escalationDelay: number; // minutes
  };
}

/**
 * Performance monitoring dashboard metrics
 */
export interface PerformanceDashboardMetrics {
  timeRange: {
    start: Date;
    end: Date;
    granularity: 'minute' | 'hour' | 'day';
  };
  
  // Overall performance statistics
  overallStats: {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    throughput: number; // requests per second
    
    // Percentile statistics
    percentiles: {
      p50: number;
      p95: number;
      p99: number;
      p99_9: number;
    };
  };
  
  // Performance by operation
  operationStats: Record<PerformanceOperation, {
    requestCount: number;
    averageResponseTime: number;
    errorRate: number;
    percentiles: {
      p50: number;
      p95: number;
      p99: number;
    };
    trend: 'improving' | 'degrading' | 'stable';
  }>;
  
  // Performance over time
  performanceTimeSeries: Array<{
    timestamp: Date;
    averageResponseTime: number;
    requestCount: number;
    errorCount: number;
    operation?: PerformanceOperation;
  }>;
  
  // Slowest operations
  slowestOperations: Array<{
    operation: PerformanceOperation;
    endpoint?: string;
    averageResponseTime: number;
    maxResponseTime: number;
    requestCount: number;
    lastOccurrence: Date;
  }>;
  
  // Error analysis
  errorAnalysis: {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsByOperation: Record<PerformanceOperation, number>;
    errorTrends: Array<{
      timestamp: Date;
      errorCount: number;
      errorRate: number;
    }>;
  };
  
  // Resource utilization
  resourceUtilization: {
    cpu: {
      average: number;
      peak: number;
      trend: 'increasing' | 'decreasing' | 'stable';
    };
    memory: {
      average: number;
      peak: number;
      trend: 'increasing' | 'decreasing' | 'stable';
    };
    database: {
      connectionCount: number;
      queryCount: number;
      slowQueryCount: number;
    };
  };
}

// ============================================================================
// INTEGRATED MONITORING INTERFACES
// ============================================================================

/**
 * Combined security and performance monitoring context
 */
export interface IntegratedMonitoringContext {
  // Request identification
  requestId: string;
  traceId: string;
  correlationId: string;
  
  // User context
  userId?: DatabaseUserId;
  authId?: AuthId;
  sessionId?: string;
  userRole?: 'admin' | 'employee';
  
  // Request context
  endpoint: string;
  method: string;
  userAgent?: string;
  ipAddress?: string;
  
  // Timing information
  startTime: Date;
  endTime?: Date;
  duration?: number;
  
  // Security context
  securityEvents: ExtendedSecurityEvent[];
  riskScore: number;
  
  // Performance context
  performanceMetrics: ExtendedPerformanceMetric[];
  resourceUsage: ResourceUsage;
  
  // Business context
  businessContext?: {
    feature: string;
    operation: string;
    entityType?: string;
    entityId?: string;
  };
}

/**
 * Monitoring system health status
 */
export interface MonitoringSystemHealth {
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  lastUpdated: Date;
  
  // Component health
  components: {
    securityMonitoring: {
      status: 'healthy' | 'degraded' | 'critical';
      eventsProcessed: number;
      alertsActive: number;
      lastEventTime?: Date;
      errorRate: number;
    };
    
    performanceMonitoring: {
      status: 'healthy' | 'degraded' | 'critical';
      metricsCollected: number;
      alertsActive: number;
      lastMetricTime?: Date;
      dataLoss: number; // percentage
    };
    
    alerting: {
      status: 'healthy' | 'degraded' | 'critical';
      alertsSent: number;
      failedAlerts: number;
      averageDeliveryTime: number;
    };
    
    storage: {
      status: 'healthy' | 'degraded' | 'critical';
      diskUsage: number; // percentage
      retentionCompliance: number; // percentage
      backupStatus: 'current' | 'stale' | 'failed';
    };
  };
  
  // System metrics
  systemMetrics: {
    memoryUsage: number; // percentage
    cpuUsage: number; // percentage
    diskUsage: number; // percentage
    networkLatency: number; // milliseconds
  };
  
  // Data quality metrics
  dataQuality: {
    completeness: number; // percentage
    accuracy: number; // percentage
    timeliness: number; // percentage
    consistency: number; // percentage
  };
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfiguration {
  // Global settings
  global: {
    enabled: boolean;
    environment: 'development' | 'staging' | 'production';
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    sampleRate: number; // 0.0 to 1.0
  };
  
  // Security monitoring configuration
  security: {
    enabled: boolean;
    realTimeAlerts: boolean;
    retentionDays: number;
    alertConfigs: EnhancedSecurityAlertConfig[];
    riskThresholds: {
      low: number;
      medium: number;
      high: number;
      critical: number;
    };
  };
  
  // Performance monitoring configuration
  performance: {
    enabled: boolean;
    collectResourceMetrics: boolean;
    retentionHours: number;
    alertConfigs: EnhancedPerformanceAlertConfig[];
    slaTargets: Record<PerformanceOperation, {
      responseTime: number;
      errorRate: number;
      availability: number;
    }>;
  };
  
  // Integration settings
  integrations: {
    slack?: {
      enabled: boolean;
      webhookUrl: string;
      defaultChannel: string;
    };
    
    email?: {
      enabled: boolean;
      smtpConfig: {
        host: string;
        port: number;
        secure: boolean;
        auth: {
          user: string;
          pass: string;
        };
      };
    };
    
    webhook?: {
      enabled: boolean;
      endpoints: Array<{
        name: string;
        url: string;
        headers?: Record<string, string>;
        eventTypes: string[];
      }>;
    };
  };
}