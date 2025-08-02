/**
 * Environment-Specific Error Handler Service
 * Provides context-aware error messages and troubleshooting guidance
 * Requirements: 1.2, 3.3, 4.1, 4.4
 */

import { logger } from '@/lib/utils/logger';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface ErrorContext {
  operation: 'startup' | 'email_check' | 'client_init' | 'runtime_access' | 'validation';
  environment: string;
  userAgent?: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  previousErrors?: Error[];
  endpoint?: string;
  caller?: string;
  retryAttempt?: number;
}

export interface UserFriendlyError {
  title: string;
  message: string;
  actions: ErrorAction[];
  technicalDetails?: string;
  canRetry: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  errorCode: string;
  category?: 'environment' | 'network' | 'configuration' | 'database' | 'auth';
  retryDelay?: number;
}

export interface ErrorAction {
  label: string;
  action: 'retry' | 'redirect' | 'contact_support' | 'check_config' | 'reload_page';
  target?: string;
  description?: string;
}

export interface TroubleshootingStep {
  step: number;
  title: string;
  description: string;
  command?: string;
  expectedResult?: string;
  troubleshootingLevel: 'basic' | 'intermediate' | 'advanced';
}

// ============================================================================
// ENVIRONMENT ERROR HANDLER CLASS
// ============================================================================

export class EnvironmentErrorHandler {
  private static instance: EnvironmentErrorHandler;

  private constructor() {}

  static getInstance(): EnvironmentErrorHandler {
    if (!EnvironmentErrorHandler.instance) {
      EnvironmentErrorHandler.instance = new EnvironmentErrorHandler();
    }
    return EnvironmentErrorHandler.instance;
  }

  /**
   * Handle environment error with context-aware messaging
   */
  handleEnvironmentError(error: Error, context: ErrorContext): UserFriendlyError {
    const errorType = this.categorizeError(error);
    const environment = context.environment || 'development';
    
    // Log the error with context
    this.logErrorWithContext(error, context, errorType);

    switch (errorType) {
      case 'missing_environment_variable':
        return this.handleMissingEnvironmentVariable(error, context);
      
      case 'invalid_environment_variable':
        return this.handleInvalidEnvironmentVariable(error, context);
      
      case 'client_initialization_failure':
        return this.handleClientInitializationFailure(error, context);
      
      case 'network_error':
        return this.handleNetworkError(error, context);
      
      case 'validation_error':
        return this.handleValidationError(error, context);
      
      case 'permission_error':
        return this.handlePermissionError(error, context);
      
      default:
        return this.handleGenericError(error, context);
    }
  }

  /**
   * Generate troubleshooting steps based on error and environment
   */
  generateTroubleshootingSteps(error: Error, environment: string): TroubleshootingStep[] {
    const errorType = this.categorizeError(error);
    const steps: TroubleshootingStep[] = [];

    switch (errorType) {
      case 'missing_environment_variable':
        steps.push(...this.getMissingVariableTroubleshootingSteps(error, environment));
        break;
      
      case 'invalid_environment_variable':
        steps.push(...this.getInvalidVariableTroubleshootingSteps(error, environment));
        break;
      
      case 'client_initialization_failure':
        steps.push(...this.getClientInitTroubleshootingSteps(error, environment));
        break;
      
      case 'network_error':
        steps.push(...this.getNetworkTroubleshootingSteps(error, environment));
        break;
      
      default:
        steps.push(...this.getGenericTroubleshootingSteps(error, environment));
    }

    return steps;
  }

  /**
   * Check if detailed error should be shown based on environment
   */
  shouldShowDetailedError(environment: string): boolean {
    return environment === 'development' || environment === 'test';
  }

  /**
   * Get environment-specific error message
   */
  getEnvironmentSpecificMessage(error: Error, environment: string): string {
    const baseMessage = error.message;
    
    switch (environment) {
      case 'development':
        return `개발 환경 오류: ${baseMessage}`;
      
      case 'test':
        return `테스트 환경 오류: ${baseMessage}`;
      
      case 'production':
        return '서비스 연결에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
      
      default:
        return baseMessage;
    }
  }

  // ============================================================================
  // PRIVATE ERROR HANDLING METHODS
  // ============================================================================

  /**
   * Categorize error type based on error message and context
   */
  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('not set') || message.includes('missing')) {
      return 'missing_environment_variable';
    }
    
    if (message.includes('invalid format') || message.includes('validation failed')) {
      return 'invalid_environment_variable';
    }
    
    if (message.includes('client initialization') || message.includes('supabase')) {
      return 'client_initialization_failure';
    }
    
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return 'network_error';
    }
    
    if (message.includes('validation') || message.includes('validate')) {
      return 'validation_error';
    }
    
    if (message.includes('permission') || message.includes('unauthorized') || message.includes('forbidden')) {
      return 'permission_error';
    }
    
    return 'generic_error';
  }

  /**
   * Handle missing environment variable error
   */
  private handleMissingEnvironmentVariable(error: Error, context: ErrorContext): UserFriendlyError {
    const environment = context.environment || 'development';
    const variableName = this.extractVariableName(error.message);
    
    const actions: ErrorAction[] = [];
    
    if (environment === 'development') {
      actions.push({
        label: '환경 설정 확인',
        action: 'check_config',
        description: '.env.local 파일을 확인하고 개발 서버를 재시작하세요'
      });
      
      actions.push({
        label: '개발 서버 재시작',
        action: 'reload_page',
        description: 'npm run dev 명령으로 개발 서버를 재시작하세요'
      });
    }
    
    actions.push({
      label: '페이지 새로고침',
      action: 'reload_page',
      description: '환경 변수 설정 후 페이지를 새로고침하세요'
    });
    
    if (context.retryAttempt && context.retryAttempt < 3) {
      actions.push({
        label: '다시 시도',
        action: 'retry',
        description: '잠시 후 다시 시도해보세요'
      });
    }

    // Enhanced message for development environment
    let enhancedMessage = this.getEnvironmentSpecificMessage(error, environment);
    if (environment === 'development' && variableName) {
      enhancedMessage += `\n\n해결 방법:\n1. .env.local 파일에 ${variableName} 변수가 설정되어 있는지 확인\n2. 개발 서버를 재시작 (npm run dev)\n3. 브라우저 새로고침`;
    }

    return {
      title: environment === 'production' ? '서비스 연결 오류' : '환경 설정 오류',
      message: enhancedMessage,
      actions,
      technicalDetails: this.shouldShowDetailedError(environment) ? error.message : undefined,
      canRetry: false,
      severity: 'critical',
      errorCode: `ENV_MISSING_${variableName || 'VARIABLE'}`,
      category: 'environment'
    };
  }

  /**
   * Handle invalid environment variable error
   */
  private handleInvalidEnvironmentVariable(error: Error, context: ErrorContext): UserFriendlyError {
    const environment = context.environment || 'development';
    const variableName = this.extractVariableName(error.message);
    
    const actions: ErrorAction[] = [
      {
        label: '설정 확인',
        action: 'check_config',
        description: '환경 변수 형식을 확인하세요'
      }
    ];

    return {
      title: '환경 설정 형식 오류',
      message: environment === 'production' 
        ? '서비스 설정에 문제가 있습니다. 관리자에게 문의하세요.'
        : `환경 변수 ${variableName}의 형식이 올바르지 않습니다.`,
      actions,
      technicalDetails: this.shouldShowDetailedError(environment) ? error.message : undefined,
      canRetry: false,
      severity: 'medium',
      errorCode: `ENV_INVALID_${variableName || 'VARIABLE'}`
    };
  }

  /**
   * Handle client initialization failure
   */
  private handleClientInitializationFailure(error: Error, context: ErrorContext): UserFriendlyError {
    const environment = context.environment || 'development';
    
    const actions: ErrorAction[] = [
      {
        label: '다시 시도',
        action: 'retry',
        description: '잠시 후 다시 시도해보세요'
      }
    ];
    
    if (environment === 'development') {
      actions.push({
        label: '환경 설정 확인',
        action: 'check_config',
        description: 'Supabase 설정을 확인하세요'
      });
    }

    return {
      title: '서비스 연결 실패',
      message: environment === 'production'
        ? '서비스 연결에 실패했습니다. 잠시 후 다시 시도해주세요.'
        : '데이터베이스 클라이언트 초기화에 실패했습니다.',
      actions,
      technicalDetails: this.shouldShowDetailedError(environment) ? error.message : undefined,
      canRetry: true,
      severity: 'high',
      errorCode: 'CLIENT_INIT_FAILED'
    };
  }

  /**
   * Handle network error
   */
  private handleNetworkError(error: Error, context: ErrorContext): UserFriendlyError {
    const environment = context.environment || 'development';
    
    const actions: ErrorAction[] = [
      {
        label: '다시 시도',
        action: 'retry',
        description: '네트워크 연결을 확인하고 다시 시도하세요'
      }
    ];

    return {
      title: '네트워크 연결 오류',
      message: '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인하고 다시 시도해주세요.',
      actions,
      technicalDetails: this.shouldShowDetailedError(environment) ? error.message : undefined,
      canRetry: true,
      severity: 'medium',
      errorCode: 'NETWORK_ERROR'
    };
  }

  /**
   * Handle validation error
   */
  private handleValidationError(error: Error, context: ErrorContext): UserFriendlyError {
    const environment = context.environment || 'development';
    
    return {
      title: '입력 값 검증 오류',
      message: '입력하신 정보에 문제가 있습니다. 다시 확인해주세요.',
      actions: [],
      technicalDetails: this.shouldShowDetailedError(environment) ? error.message : undefined,
      canRetry: false,
      severity: 'low',
      errorCode: 'VALIDATION_ERROR'
    };
  }

  /**
   * Handle permission error
   */
  private handlePermissionError(error: Error, context: ErrorContext): UserFriendlyError {
    const environment = context.environment || 'development';
    
    return {
      title: '권한 오류',
      message: '이 작업을 수행할 권한이 없습니다.',
      actions: [
        {
          label: '로그인 확인',
          action: 'redirect',
          target: '/login',
          description: '로그인 상태를 확인하세요'
        }
      ],
      technicalDetails: this.shouldShowDetailedError(environment) ? error.message : undefined,
      canRetry: false,
      severity: 'medium',
      errorCode: 'PERMISSION_ERROR'
    };
  }

  /**
   * Handle generic error
   */
  private handleGenericError(error: Error, context: ErrorContext): UserFriendlyError {
    const environment = context.environment || 'development';
    
    return {
      title: '알 수 없는 오류',
      message: environment === 'production'
        ? '예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        : '알 수 없는 오류가 발생했습니다.',
      actions: [
        {
          label: '다시 시도',
          action: 'retry',
          description: '잠시 후 다시 시도해보세요'
        },
        {
          label: '지원팀 문의',
          action: 'contact_support',
          description: '문제가 지속되면 지원팀에 문의하세요'
        }
      ],
      technicalDetails: this.shouldShowDetailedError(environment) ? error.message : undefined,
      canRetry: true,
      severity: 'medium',
      errorCode: 'GENERIC_ERROR'
    };
  }

  // ============================================================================
  // TROUBLESHOOTING METHODS
  // ============================================================================

  /**
   * Get troubleshooting steps for missing environment variable
   */
  private getMissingVariableTroubleshootingSteps(error: Error, environment: string): TroubleshootingStep[] {
    const variableName = this.extractVariableName(error.message);
    const steps: TroubleshootingStep[] = [];

    if (environment === 'development') {
      steps.push({
        step: 1,
        title: '.env.local 파일 확인',
        description: '프로젝트 루트에 .env.local 파일이 있는지 확인하세요.',
        command: 'dir .env.local',
        expectedResult: '.env.local 파일이 존재해야 합니다.',
        troubleshootingLevel: 'basic'
      });

      if (variableName) {
        steps.push({
          step: 2,
          title: `${variableName} 변수 설정 확인`,
          description: `.env.local 파일에 ${variableName} 변수가 올바르게 설정되어 있는지 확인하세요.`,
          command: `findstr ${variableName} .env.local`,
          expectedResult: `${variableName}=your_value_here 형태로 설정되어 있어야 합니다.`,
          troubleshootingLevel: 'basic'
        });
      }

      steps.push({
        step: 3,
        title: '개발 서버 완전 재시작',
        description: '환경 변수 변경 후 개발 서버를 완전히 종료하고 재시작하세요.',
        command: 'npm run dev',
        expectedResult: '서버가 정상적으로 시작되어야 합니다.',
        troubleshootingLevel: 'basic'
      });

      steps.push({
        step: 4,
        title: '환경 변수 로딩 확인',
        description: 'Node.js가 환경 변수를 올바르게 로드하는지 확인하세요.',
        command: 'npm run check-env',
        expectedResult: '모든 필수 환경 변수가 "설정됨"으로 표시되어야 합니다.',
        troubleshootingLevel: 'intermediate'
      });

      steps.push({
        step: 5,
        title: '브라우저 캐시 및 하드 새로고침',
        description: '브라우저에서 Ctrl+Shift+R (또는 Cmd+Shift+R)로 하드 새로고침을 수행하세요.',
        expectedResult: '캐시된 환경 설정이 초기화되어야 합니다.',
        troubleshootingLevel: 'basic'
      });
    }

    if (environment === 'production') {
      steps.push({
        step: 1,
        title: '배포 환경 변수 확인',
        description: '배포 플랫폼에서 환경 변수가 올바르게 설정되어 있는지 확인하세요.',
        troubleshootingLevel: 'intermediate'
      });
    }

    return steps;
  }

  /**
   * Get troubleshooting steps for invalid environment variable
   */
  private getInvalidVariableTroubleshootingSteps(error: Error, environment: string): TroubleshootingStep[] {
    const variableName = this.extractVariableName(error.message);
    
    return [
      {
        step: 1,
        title: '변수 형식 확인',
        description: `${variableName} 변수의 형식이 올바른지 확인하세요.`,
        troubleshootingLevel: 'basic'
      },
      {
        step: 2,
        title: '예제 값 참조',
        description: '.env.example 파일의 예제 값을 참조하여 올바른 형식으로 설정하세요.',
        command: 'cat .env.example',
        troubleshootingLevel: 'basic'
      }
    ];
  }

  /**
   * Get troubleshooting steps for client initialization failure
   */
  private getClientInitTroubleshootingSteps(error: Error, environment: string): TroubleshootingStep[] {
    return [
      {
        step: 1,
        title: 'Supabase 프로젝트 상태 확인',
        description: 'Supabase 대시보드에서 프로젝트가 활성 상태인지 확인하세요.',
        troubleshootingLevel: 'basic'
      },
      {
        step: 2,
        title: 'API 키 유효성 확인',
        description: 'Supabase 프로젝트 설정에서 API 키가 올바른지 확인하세요.',
        troubleshootingLevel: 'intermediate'
      },
      {
        step: 3,
        title: '네트워크 연결 확인',
        description: 'Supabase 서버에 연결할 수 있는지 확인하세요.',
        command: 'curl -I https://your-project.supabase.co',
        troubleshootingLevel: 'intermediate'
      }
    ];
  }

  /**
   * Get troubleshooting steps for network error
   */
  private getNetworkTroubleshootingSteps(error: Error, environment: string): TroubleshootingStep[] {
    return [
      {
        step: 1,
        title: '인터넷 연결 확인',
        description: '인터넷 연결이 정상적으로 작동하는지 확인하세요.',
        troubleshootingLevel: 'basic'
      },
      {
        step: 2,
        title: '방화벽 설정 확인',
        description: '방화벽이나 프록시 설정이 연결을 차단하고 있지 않은지 확인하세요.',
        troubleshootingLevel: 'intermediate'
      }
    ];
  }

  /**
   * Get generic troubleshooting steps
   */
  private getGenericTroubleshootingSteps(error: Error, environment: string): TroubleshootingStep[] {
    return [
      {
        step: 1,
        title: '브라우저 새로고침',
        description: '페이지를 새로고침하여 일시적인 문제를 해결해보세요.',
        troubleshootingLevel: 'basic'
      },
      {
        step: 2,
        title: '브라우저 캐시 삭제',
        description: '브라우저 캐시를 삭제하고 다시 시도해보세요.',
        troubleshootingLevel: 'basic'
      },
      {
        step: 3,
        title: '개발자 도구 확인',
        description: '브라우저 개발자 도구의 콘솔에서 추가 오류 정보를 확인하세요.',
        troubleshootingLevel: 'intermediate'
      }
    ];
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Extract variable name from error message
   */
  private extractVariableName(message: string): string | null {
    const matches = message.match(/(?:variable\s+|Variable\s+)([A-Z_][A-Z0-9_]*)/i);
    return matches ? matches[1] : null;
  }

  /**
   * Log error with context
   */
  private logErrorWithContext(error: Error, context: ErrorContext, errorType: string): void {
    const logData = {
      errorType,
      operation: context.operation,
      environment: context.environment,
      caller: context.caller,
      endpoint: context.endpoint,
      userId: context.userId,
      sessionId: context.sessionId,
      retryAttempt: context.retryAttempt,
      userAgent: context.userAgent,
      previousErrors: context.previousErrors?.map(e => e.message)
    };

    logger.error(`Environment error handled: ${error.message}`, logData);
  }
}

// ============================================================================
// SINGLETON INSTANCE AND EXPORTS
// ============================================================================

export const environmentErrorHandler = EnvironmentErrorHandler.getInstance();

// Convenience functions
export const handleEnvironmentError = environmentErrorHandler.handleEnvironmentError.bind(environmentErrorHandler);
export const generateTroubleshootingSteps = environmentErrorHandler.generateTroubleshootingSteps.bind(environmentErrorHandler);
export const shouldShowDetailedError = environmentErrorHandler.shouldShowDetailedError.bind(environmentErrorHandler);
export const getEnvironmentSpecificMessage = environmentErrorHandler.getEnvironmentSpecificMessage.bind(environmentErrorHandler);