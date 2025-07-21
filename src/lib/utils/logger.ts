/**
 * 안전한 로깅 유틸리티
 * 프로덕션에서는 민감한 정보를 로깅하지 않습니다
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isClient = typeof window !== 'undefined';

export const logger = {
  // ✅ 개발 환경에서만 디버그 정보 출력
  debug: (...args: any[]) => {
    if (isDevelopment && isClient) {
      console.log('[DEBUG]', ...args);
    }
  },

  // ✅ 일반 정보 로깅 (프로덕션에서도 필요한 경우만)
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info('[INFO]', ...args);
    }
  },

  // ✅ 경고 (프로덕션에서는 숨김)
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn('[WARN]', ...args);
    }
  },

  // ✅ 에러 (민감한 정보 제거 후 로깅)
  error: (message: string, error?: any) => {
    if (isDevelopment) {
      console.error('[ERROR]', message, error);
    } else {
      // 프로덕션에서는 민감한 정보 제거하고 일반적인 메시지만
      console.error('[ERROR]', message);
    }
  },

  // ✅ 서버 전용 로깅 (클라이언트에서는 실행되지 않음)
  server: {
    error: (message: string, error?: any) => {
      if (!isClient) {
        // 서버에서는 상세한 에러 정보 로깅 (서버 로그에만 기록됨)
        console.error('[SERVER ERROR]', message, error);
      }
    },
    
    info: (message: string, data?: any) => {
      if (!isClient && isDevelopment) {
        console.info('[SERVER INFO]', message, data);
      }
    }
  },

  // ✅ 완전히 안전한 사용자 액션 로깅
  userAction: (action: string, success: boolean = true) => {
    if (isDevelopment) {
      console.log(`[USER ACTION] ${action}: ${success ? 'SUCCESS' : 'FAILED'}`);
    }
  },

  // ✅ 예약 관련 전용 로깅 함수들
  reservation: {
    // 권한 검증 로깅
    permissionCheck: (result: boolean, context: {
      action: string;
      reservationId: string;
      reservationUserId: string;
      currentUserId: string;
      userRole: string;
      reason?: string;
    }) => {
      const sanitizedContext = {
        action: context.action,
        reservationId: context.reservationId,
        hasReservationUserId: !!context.reservationUserId,
        hasCurrentUserId: !!context.currentUserId,
        userRole: context.userRole,
        reason: context.reason,
        idsMatch: context.reservationUserId === context.currentUserId,
      };

      if (isDevelopment) {
        console.log(`[PERMISSION CHECK] ${context.action.toUpperCase()}: ${result ? 'ALLOWED' : 'DENIED'}`, sanitizedContext);
      }
    },

    // API 호출 로깅
    apiCall: (method: string, endpoint: string, payload?: any, response?: any, error?: any) => {
      const logData = {
        method,
        endpoint,
        timestamp: new Date().toISOString(),
        hasPayload: !!payload,
        hasResponse: !!response,
        hasError: !!error,
        payloadSize: payload ? JSON.stringify(payload).length : 0,
      };

      if (isDevelopment) {
        if (error) {
          console.error(`[API ERROR] ${method} ${endpoint}`, logData, error);
        } else {
          console.log(`[API CALL] ${method} ${endpoint}`, logData);
        }
      }
    },

    // 예약 상태 변경 로깅
    statusChange: (reservationId: string, fromStatus: string, toStatus: string, reason?: string) => {
      const logData = {
        reservationId,
        fromStatus,
        toStatus,
        reason,
        timestamp: new Date().toISOString(),
      };

      if (isDevelopment) {
        console.log(`[RESERVATION STATUS] ${fromStatus} → ${toStatus}`, logData);
      }
    },

    // 사용자 ID 매핑 로깅
    userIdMapping: (context: {
      authId: string;
      dbId?: string;
      profileId: string;
      mappingSuccess: boolean;
      issues?: string[];
    }) => {
      const sanitizedContext = {
        hasAuthId: !!context.authId,
        hasDbId: !!context.dbId,
        hasProfileId: !!context.profileId,
        mappingSuccess: context.mappingSuccess,
        issueCount: context.issues?.length || 0,
        issues: context.issues,
      };

      if (isDevelopment) {
        console.log(`[USER ID MAPPING] ${context.mappingSuccess ? 'SUCCESS' : 'FAILED'}`, sanitizedContext);
      }
    },

    // 예약 수정/취소 프로세스 로깅
    process: (action: 'edit' | 'cancel', step: string, reservationId: string, success: boolean, details?: any) => {
      const logData = {
        action,
        step,
        reservationId,
        success,
        timestamp: new Date().toISOString(),
        hasDetails: !!details,
      };

      if (isDevelopment) {
        const status = success ? 'SUCCESS' : 'FAILED';
        console.log(`[RESERVATION ${action.toUpperCase()}] ${step}: ${status}`, logData);
        
        if (details && !success) {
          console.error(`[RESERVATION ${action.toUpperCase()} ERROR]`, sanitizeForLogging(details));
        }
      }
    }
  }
};

// ✅ 민감한 데이터 필터링 함수
export const sanitizeForLogging = (data: any): any => {
  if (!isDevelopment) {
    return '[REDACTED]';
  }

  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sanitized = { ...data };
  
  // 민감한 필드 제거
  const sensitiveFields = [
    'password', 'token', 'authid', 'email', 
    'employee_id', 'phone', 'address', 'social_security_number'
  ];

  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
};

export default logger; 