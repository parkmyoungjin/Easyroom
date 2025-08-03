type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'security' | 'audit';

interface LogData {
  [key: string]: any;
}

interface SecurityEvent {
  type: 'authentication' | 'authorization' | 'data_access' | 'api_call' | 'error' | 'suspicious_activity';
  action: string;
  userId?: string;
  userRole?: string;
  resource?: string;
  endpoint?: string;
  success: boolean;
  details?: LogData;
  timestamp: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface AuditEvent {
  type: 'create' | 'read' | 'update' | 'delete' | 'system';
  entity: string;
  entityId?: string;
  action: string;
  userId?: string;
  userRole?: string;
  changes?: LogData;
  previousState?: LogData;
  newState?: LogData;
  success: boolean;
  timestamp: string;
  metadata?: LogData;
}

// Log level hierarchy (higher number = higher priority)
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  security: 4,
  audit: 4
} as const;

class Logger {
  private readonly logLevel: LogLevel;
  
  constructor() {
    // Get log level from environment variable, default to 'info' for production, 'debug' for development
    const envLogLevel = process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel;
    const defaultLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
    this.logLevel = envLogLevel || defaultLevel;
  }

  private get isDevelopment(): boolean {
    // Use process.env directly to avoid circular dependency
    // This is safe since NODE_ENV is a standard environment variable
    return process.env.NODE_ENV === 'development';
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.logLevel];
  }

  private sanitizeData(data: LogData): LogData {
    const sanitized = { ...data };
    
    // 민감한 정보 제거
    const sensitiveKeys = [
      'password', 'token', 'key', 'secret', 'auth_id', 
      'user_id', 'id', 'email', 'phone', 'access_token', 'value'
    ];
    
    Object.keys(sanitized).forEach(key => {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
      
      // 특별히 쿠키 상세 정보에서 value 제거 (프로덕션 보안 강화)
      if (key === 'cookieDetails' && Array.isArray(sanitized[key])) {
        sanitized[key] = sanitized[key].map((cookie: any) => ({
          name: cookie.name,
          hasValue: cookie.hasValue,
          valueLength: cookie.valueLength,
          // value 자체는 제거하여 민감 정보 노출 방지
        }));
      }
    });
    
    return sanitized;
  }

  debug(message: string, data?: LogData) {
    if (this.shouldLog('debug')) {
      console.log(`🔍 [DEBUG] ${message}`, data ? this.sanitizeData(data) : '');
    }
  }

  info(message: string, data?: LogData) {
    if (this.shouldLog('info')) {
      console.info(`ℹ️ [INFO] ${message}`, data ? this.sanitizeData(data) : '');
    }
  }

  warn(message: string, data?: LogData) {
    if (this.shouldLog('warn')) {
      console.warn(`⚠️ [WARN] ${message}`, data ? this.sanitizeData(data) : '');
    }
  }

  error(message: string, error?: Error | LogData) {
    if (this.shouldLog('error')) {
      console.error(`❌ [ERROR] ${message}`, error);
    }
  }

  // 프로덕션에서도 중요한 에러는 로깅
  critical(message: string, error?: Error | LogData) {
    console.error(`🚨 [CRITICAL] ${message}`, error);
  }

  /**
   * 보안 관련 이벤트 로깅
   */
  security(event: SecurityEvent) {
    if (!this.shouldLog('security')) return;
    
    const logEntry = {
      level: 'SECURITY',
      timestamp: event.timestamp,
      type: event.type,
      action: event.action,
      success: event.success,
      userId: event.userId || 'anonymous',
      userRole: event.userRole || 'unknown',
      resource: event.resource,
      endpoint: event.endpoint,
      sessionId: event.sessionId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      details: event.details ? this.sanitizeData(event.details) : undefined
    };

    // 보안 이벤트는 항상 로깅 (프로덕션 포함)
    console.log(`🔒 [SECURITY] ${event.action}`, logEntry);

    // 실패한 보안 이벤트는 더 강조
    if (!event.success) {
      console.warn(`🚨 [SECURITY-FAILURE] ${event.action}`, logEntry);
    }
  }

  /**
   * 감사 추적 이벤트 로깅
   */
  audit(event: AuditEvent) {
    if (!this.shouldLog('audit')) return;
    
    const logEntry = {
      level: 'AUDIT',
      timestamp: event.timestamp,
      type: event.type,
      entity: event.entity,
      entityId: event.entityId,
      action: event.action,
      success: event.success,
      userId: event.userId || 'system',
      userRole: event.userRole || 'unknown',
      changes: event.changes ? this.sanitizeData(event.changes) : undefined,
      previousState: event.previousState ? this.sanitizeData(event.previousState) : undefined,
      newState: event.newState ? this.sanitizeData(event.newState) : undefined,
      metadata: event.metadata ? this.sanitizeData(event.metadata) : undefined
    };

    // 감사 이벤트는 항상 로깅 (프로덕션 포함)
    console.log(`📋 [AUDIT] ${event.entity}.${event.action}`, logEntry);

    // 실패한 감사 이벤트는 더 강조
    if (!event.success) {
      console.error(`❌ [AUDIT-FAILURE] ${event.entity}.${event.action}`, logEntry);
    }
  }

  /**
   * API 호출 로깅 (보안 감사용)
   */
  apiCall(endpoint: string, method: string, userId?: string, success: boolean = true, details?: LogData) {
    this.security({
      type: 'api_call',
      action: `${method} ${endpoint}`,
      userId,
      endpoint,
      success,
      details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 인증 이벤트 로깅
   */
  authEvent(action: string, userId?: string, success: boolean = true, details?: LogData) {
    this.security({
      type: 'authentication',
      action,
      userId,
      success,
      details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 권한 검증 이벤트 로깅
   */
  authzEvent(action: string, resource: string, userId?: string, userRole?: string, success: boolean = true, details?: LogData) {
    this.security({
      type: 'authorization',
      action,
      resource,
      userId,
      userRole,
      success,
      details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 데이터 접근 이벤트 로깅
   */
  dataAccess(action: string, entity: string, entityId?: string, userId?: string, success: boolean = true, details?: LogData) {
    this.security({
      type: 'data_access',
      action: `${action} ${entity}`,
      resource: entity,
      userId,
      success,
      details: { entityId, ...details },
      timestamp: new Date().toISOString()
    });

    // 감사 추적도 함께 기록
    this.audit({
      type: action.toLowerCase() as 'create' | 'read' | 'update' | 'delete',
      entity,
      entityId,
      action,
      userId,
      success,
      timestamp: new Date().toISOString(),
      metadata: details
    });
  }

  /**
   * 의심스러운 활동 로깅
   */
  suspiciousActivity(action: string, userId?: string, details?: LogData) {
    this.security({
      type: 'suspicious_activity',
      action,
      userId,
      success: false, // 의심스러운 활동은 항상 실패로 기록
      details,
      timestamp: new Date().toISOString()
    });

    // 의심스러운 활동은 critical 레벨로도 로깅
    this.critical(`Suspicious activity detected: ${action}`, { userId, details });
  }
}

export const logger = new Logger();