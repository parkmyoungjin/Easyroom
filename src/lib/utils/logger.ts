type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogData {
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private sanitizeData(data: LogData): LogData {
    const sanitized = { ...data };
    
    // 민감한 정보 제거
    const sensitiveKeys = [
      'password', 'token', 'key', 'secret', 'auth_id', 
      'user_id', 'id', 'email', 'phone', 'access_token'
    ];
    
    Object.keys(sanitized).forEach(key => {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  debug(message: string, data?: LogData) {
    if (this.isDevelopment) {
      console.log(`🔍 [DEBUG] ${message}`, data ? this.sanitizeData(data) : '');
    }
  }

  info(message: string, data?: LogData) {
    if (this.isDevelopment) {
      console.info(`ℹ️ [INFO] ${message}`, data ? this.sanitizeData(data) : '');
    }
  }

  warn(message: string, data?: LogData) {
    console.warn(`⚠️ [WARN] ${message}`, data ? this.sanitizeData(data) : '');
  }

  error(message: string, error?: Error | LogData) {
    console.error(`❌ [ERROR] ${message}`, error);
  }

  // 프로덕션에서도 중요한 에러는 로깅
  critical(message: string, error?: Error | LogData) {
    console.error(`🚨 [CRITICAL] ${message}`, error);
  }
}

export const logger = new Logger();