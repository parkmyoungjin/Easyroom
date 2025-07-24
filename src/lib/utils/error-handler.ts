/**
 * 구조화된 오류 처리 시스템
 */

import { logger } from './logger';

export interface ReservationError {
  type: 'permission' | 'network' | 'validation' | 'server' | 'not_found' | 'conflict';
  code: string;
  message: string;
  details?: any;
  userMessage: string;
  retryable: boolean;
}

export interface ErrorContext {
  action: string;
  reservationId?: string;
  userId?: string;
  userRole?: string;
  timestamp: string;
  [key: string]: any;
}

export class ReservationErrorHandler {
  /**
   * API 오류를 분석하고 구조화된 오류 객체를 반환합니다
   */
  static handleApiError(error: unknown, context: ErrorContext): ReservationError {
    return this.handleReservationError(error, context);
  }

  /**
   * 예약 관련 오류를 분석하고 구조화된 오류 객체를 반환합니다
   */
  static handleReservationError(error: unknown, context: ErrorContext): ReservationError {
    const timestamp = new Date().toISOString();
    const baseContext = { ...context, timestamp };

    // Error 객체가 아닌 경우 처리
    if (!(error instanceof Error)) {
      const unknownError: ReservationError = {
        type: 'server',
        code: 'UNKNOWN_ERROR',
        message: 'Unknown error occurred',
        details: error,
        userMessage: '알 수 없는 오류가 발생했습니다.',
        retryable: true,
      };
      
      this.logError(unknownError, baseContext);
      return unknownError;
    }

    // 오류 메시지 기반 분류
    const errorMessage = error.message.toLowerCase();
    let reservationError: ReservationError;

    if (this.isPermissionError(errorMessage)) {
      reservationError = {
        type: 'permission',
        code: 'PERMISSION_DENIED',
        message: error.message,
        userMessage: '권한이 없습니다.',
        retryable: false,
      };
    } else if (this.isNetworkError(errorMessage)) {
      reservationError = {
        type: 'network',
        code: 'NETWORK_ERROR',
        message: error.message,
        userMessage: '네트워크 연결을 확인하고 다시 시도해주세요.',
        retryable: true,
      };
    } else if (this.isValidationError(errorMessage)) {
      reservationError = {
        type: 'validation',
        code: 'VALIDATION_ERROR',
        message: error.message,
        userMessage: '입력 정보를 확인해주세요.',
        retryable: false,
      };
    } else if (this.isNotFoundError(errorMessage)) {
      reservationError = {
        type: 'not_found',
        code: 'NOT_FOUND',
        message: error.message,
        userMessage: '요청한 정보를 찾을 수 없습니다.',
        retryable: false,
      };
    } else if (this.isConflictError(errorMessage)) {
      reservationError = {
        type: 'conflict',
        code: 'CONFLICT',
        message: error.message,
        userMessage: '다른 예약과 시간이 겹칩니다.',
        retryable: false,
      };
    } else {
      reservationError = {
        type: 'server',
        code: 'SERVER_ERROR',
        message: error.message,
        userMessage: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        retryable: true,
      };
    }

    reservationError.details = {
      originalError: error.name,
      stack: error.stack,
    };

    this.logError(reservationError, baseContext);
    return reservationError;
  }

  /**
   * 권한 관련 오류인지 확인
   */
  private static isPermissionError(message: string): boolean {
    const permissionKeywords = [
      'permission', '권한', 'unauthorized', 'forbidden',
      'access denied', '접근', '본인만', 'not allowed'
    ];
    return permissionKeywords.some(keyword => message.includes(keyword));
  }

  /**
   * 네트워크 관련 오류인지 확인
   */
  private static isNetworkError(message: string): boolean {
    const networkKeywords = [
      'network', 'fetch', 'connection', 'timeout',
      '네트워크', '연결', 'offline', 'unreachable'
    ];
    return networkKeywords.some(keyword => message.includes(keyword));
  }

  /**
   * 검증 관련 오류인지 확인
   */
  private static isValidationError(message: string): boolean {
    const validationKeywords = [
      'validation', 'invalid', 'required', 'format',
      '검증', '유효하지', '필수', '형식', 'zod',
      'expected', 'received', 'string must contain',
      'number must be', 'array must contain'
    ];
    return validationKeywords.some(keyword => message.includes(keyword));
  }

  /**
   * Zod validation 오류를 처리합니다
   */
  static handleZodValidationError(error: any, context: ErrorContext): ReservationError {
    const validationError: ReservationError = {
      type: 'validation',
      code: 'VALIDATION_ERROR',
      message: error.message || 'Validation failed',
      userMessage: '입력 데이터가 올바르지 않습니다.',
      retryable: false,
      details: {
        validationErrors: error.errors || [],
        originalError: error.name,
      }
    };

    this.logError(validationError, context);
    return validationError;
  }

  /**
   * 찾을 수 없음 오류인지 확인
   */
  private static isNotFoundError(message: string): boolean {
    const notFoundKeywords = [
      'not found', '찾을 수 없', 'does not exist',
      '존재하지', 'missing', '없습니다'
    ];
    return notFoundKeywords.some(keyword => message.includes(keyword));
  }

  /**
   * 충돌 관련 오류인지 확인
   */
  private static isConflictError(message: string): boolean {
    const conflictKeywords = [
      'conflict', 'duplicate', 'already exists',
      '충돌', '중복', '이미', 'overlapping'
    ];
    return conflictKeywords.some(keyword => message.includes(keyword));
  }

  /**
   * 오류를 로깅합니다
   */
  private static logError(error: ReservationError, context: ErrorContext): void {
    logger.error('구조화된 예약 오류', {
      error: {
        type: error.type,
        code: error.code,
        message: error.message,
        userMessage: error.userMessage,
        retryable: error.retryable,
      },
      context,
      details: error.details,
    });
  }

  /**
   * 사용자 친화적인 오류 메시지를 생성합니다
   */
  static getUserFriendlyMessage(error: ReservationError, action: string): {
    title: string;
    description: string;
    showRetry: boolean;
  } {
    const actionText = this.getActionText(action);
    
    let title: string;
    let description: string;

    switch (error.type) {
      case 'permission':
        title = '권한 오류';
        description = `${actionText}할 권한이 없습니다.`;
        break;
      case 'network':
        title = '네트워크 오류';
        description = error.userMessage;
        break;
      case 'validation':
        title = '입력 오류';
        description = error.userMessage;
        break;
      case 'not_found':
        title = '정보 없음';
        description = error.userMessage;
        break;
      case 'conflict':
        title = '시간 충돌';
        description = error.userMessage;
        break;
      default:
        title = `${actionText} 실패`;
        description = error.userMessage;
    }

    return {
      title,
      description,
      showRetry: error.retryable,
    };
  }

  /**
   * 액션에 따른 텍스트를 반환합니다
   */
  private static getActionText(action: string): string {
    const actionMap: Record<string, string> = {
      edit: '수정',
      cancel: '취소',
      create: '생성',
      delete: '삭제',
      update: '업데이트',
      download: '다운로드',
      download_statistics: '통계 다운로드',
      create_room: '회의실 생성',
      update_room: '회의실 업데이트',
      delete_user: '사용자 삭제',
      query_reservations: '예약 조회',
      normalize_date: '날짜 처리',
      redirect_legacy_api: 'API 리디렉션',
      get_public_reservations_anonymous: '공개 예약 조회',
      get_public_reservations_authenticated: '인증 예약 조회',
    };
    
    return actionMap[action] || action;
  }

  /**
   * 재시도 가능한 오류에 대한 재시도 핸들러를 생성합니다
   */
  static createRetryableErrorHandler<T extends any[]>(
    originalFunction: (...args: T) => Promise<void>,
    maxRetries: number = 3,
    delay: number = 1000
  ) {
    return async (...args: T): Promise<void> => {
      let lastError: Error;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await originalFunction(...args);
          return; // 성공시 종료
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          
          // 재시도 불가능한 오류인지 확인
          const structuredError = this.handleReservationError(lastError, {
            action: 'retry_attempt',
            attempt: attempt.toString(),
            maxRetries: maxRetries.toString(),
            timestamp: new Date().toISOString()
          });
          
          if (!structuredError.retryable || attempt === maxRetries) {
            throw lastError; // 재시도 불가능하거나 마지막 시도에서 실패시 오류 던지기
          }
          
          // 지연 후 재시도 (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
        }
      }
      
      throw lastError!;
    };
  }
}

/**
 * 재시도 가능한 오류에 대한 재시도 옵션을 제공하는 헬퍼 함수
 */
export function createRetryHandler(
  originalFunction: () => Promise<void>,
  maxRetries: number = 3,
  delay: number = 1000
) {
  return async (): Promise<void> => {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await originalFunction();
        return; // 성공시 종료
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === maxRetries) {
          throw lastError; // 마지막 시도에서 실패시 오류 던지기
        }
        
        // 지연 후 재시도
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
    
    throw lastError!;
  };
}