import { logger } from '@/lib/utils/logger';
import { getEnvironmentConfig, validateEnvironmentConfig } from '@/lib/security/environment-config';

/**
 * 환경 변수 보안 관리자
 * 서비스 역할 키와 같은 민감한 환경 변수에 대한 접근을 제어하고 감사합니다.
 */

interface EnvironmentAccessContext {
  caller: string;
  endpoint?: string;
  userId?: string;
  timestamp: Date;
}

class EnvironmentSecurityManager {
  private static instance: EnvironmentSecurityManager;
  private serviceRoleAccessLog: EnvironmentAccessContext[] = [];

  private constructor() {}

  static getInstance(): EnvironmentSecurityManager {
    if (!EnvironmentSecurityManager.instance) {
      EnvironmentSecurityManager.instance = new EnvironmentSecurityManager();
    }
    return EnvironmentSecurityManager.instance;
  }

  /**
   * 공개 환경 변수 안전하게 가져오기
   */
  getPublicKey(key: string): string {
    const publicKeys = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'NODE_ENV'
    ];

    if (!publicKeys.includes(key)) {
      logger.warn('비공개 환경 변수 접근 시도', { key, caller: this.getCaller() });
      throw new Error(`${key}는 공개 환경 변수가 아닙니다`);
    }

    const value = process.env[key];
    if (!value) {
      throw new Error(`환경 변수 ${key}가 설정되지 않았습니다`);
    }

    return value;
  }

  /**
   * 서버 전용 환경 변수 안전하게 가져오기
   */
  getServerKey(key: string): string {
    const serverKeys = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'NODE_ENV'
    ];

    if (!serverKeys.includes(key)) {
      logger.warn('허용되지 않은 서버 환경 변수 접근', { key, caller: this.getCaller() });
      throw new Error(`${key}는 허용된 서버 환경 변수가 아닙니다`);
    }

    const value = process.env[key];
    if (!value) {
      throw new Error(`환경 변수 ${key}가 설정되지 않았습니다`);
    }

    return value;
  }

  /**
   * 서비스 역할 키 접근 (제한된 접근)
   * 관리자 API에서만 사용 가능
   */
  getServiceRoleKey(context: EnvironmentAccessContext): string {
    // 호출자 검증
    if (!this.isAuthorizedCaller(context.caller)) {
      logger.error('서비스 역할 키 무단 접근 시도', {
        caller: context.caller,
        endpoint: context.endpoint,
        userId: context.userId,
        timestamp: context.timestamp
      });
      throw new Error('서비스 역할 키에 대한 접근 권한이 없습니다');
    }

    // 엔드포인트 검증
    if (context.endpoint && !this.isAdminEndpoint(context.endpoint)) {
      logger.error('비관리자 엔드포인트에서 서비스 역할 키 접근 시도', {
        caller: context.caller,
        endpoint: context.endpoint,
        userId: context.userId
      });
      throw new Error('관리자 엔드포인트에서만 서비스 역할 키를 사용할 수 있습니다');
    }

    // 접근 로깅
    this.logServiceRoleAccess(context);

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다');
    }

    return serviceRoleKey;
  }

  /**
   * 환경 변수 유효성 검증
   */
  validateEnvironment(): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // 환경별 설정 로드
    const config = getEnvironmentConfig();
    
    // 환경 설정 자체의 유효성 검증
    const configValidation = validateEnvironmentConfig(config);
    if (!configValidation.valid) {
      errors.push(...configValidation.errors);
    }

    // 필수 환경 변수 검증
    for (const varName of config.requiredVariables) {
      if (!process.env[varName]) {
        errors.push(`필수 환경 변수 ${varName}가 설정되지 않았습니다`);
      }
    }

    // 선택적 환경 변수 확인 (경고만)
    for (const varName of config.optionalVariables) {
      if (!process.env[varName]) {
        warnings.push(`선택적 환경 변수 ${varName}가 설정되지 않았습니다`);
      }
    }

    // URL 형식 검증
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      try {
        const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
        
        // HTTPS 검증 (프로덕션 환경)
        if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
          errors.push('프로덕션 환경에서는 HTTPS URL이 필요합니다');
        }
        
        // Supabase URL 패턴 검증
        if (!url.hostname.includes('supabase')) {
          warnings.push('SUPABASE_URL이 표준 Supabase 도메인 패턴과 다릅니다');
        }
      } catch {
        errors.push('NEXT_PUBLIC_SUPABASE_URL이 유효한 URL 형식이 아닙니다');
      }
    }

    // 키 형식 검증
    if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (anonKey.length < 100) {
        warnings.push('SUPABASE_ANON_KEY가 예상보다 짧습니다. 올바른 키인지 확인하세요');
      }
    }

    // 서비스 역할 키 검증
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceKey.length < 100) {
        warnings.push('SUPABASE_SERVICE_ROLE_KEY가 예상보다 짧습니다. 올바른 키인지 확인하세요');
      }
      
      // 프로덕션 환경에서 서비스 키 보안 검증
      if (process.env.NODE_ENV === 'production') {
        if (serviceKey === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          errors.push('서비스 역할 키와 익명 키가 동일합니다. 보안상 위험합니다');
        }
      }
    } else {
      warnings.push('SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다. 관리자 기능이 제한됩니다');
    }

    // 환경별 추가 검증
    this.validateEnvironmentSpecificSettings(errors, warnings);

    // 로깅
    if (errors.length > 0) {
      logger.error('환경 변수 검증 실패', { errors, warnings });
    } else if (warnings.length > 0) {
      logger.warn('환경 변수 검증 경고', { warnings });
    } else {
      logger.info('환경 변수 검증 완료');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 환경별 특정 설정 검증
   */
  private validateEnvironmentSpecificSettings(errors: string[], warnings: string[]): void {
    const nodeEnv = process.env.NODE_ENV;

    switch (nodeEnv) {
      case 'production':
        this.validateProductionEnvironment(errors, warnings);
        break;
      case 'development':
        this.validateDevelopmentEnvironment(warnings);
        break;
      case 'test':
        this.validateTestEnvironment(warnings);
        break;
      default:
        warnings.push(`알 수 없는 NODE_ENV 값: ${nodeEnv}`);
    }
  }

  /**
   * 프로덕션 환경 검증
   */
  private validateProductionEnvironment(errors: string[], warnings: string[]): void {
    // 프로덕션에서는 서비스 역할 키가 필수
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      errors.push('프로덕션 환경에서는 SUPABASE_SERVICE_ROLE_KEY가 필수입니다');
    }

    // 개발용 기본값 검증
    const devDefaults = [
      'your_supabase_url_here',
      'your_supabase_anon_key_here',
      'your_service_role_key_here'
    ];

    const checkForDefaults = [
      { key: 'NEXT_PUBLIC_SUPABASE_URL', value: process.env.NEXT_PUBLIC_SUPABASE_URL },
      { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
      { key: 'SUPABASE_SERVICE_ROLE_KEY', value: process.env.SUPABASE_SERVICE_ROLE_KEY }
    ];

    for (const { key, value } of checkForDefaults) {
      if (value && devDefaults.some(defaultVal => value.includes(defaultVal))) {
        errors.push(`${key}에 개발용 기본값이 설정되어 있습니다. 프로덕션 값으로 변경하세요`);
      }
    }

    // 보안 헤더 관련 환경 변수 권장사항
    if (!process.env.NEXTAUTH_SECRET && !process.env.AUTH_SECRET) {
      warnings.push('인증 시크릿 키 설정을 권장합니다 (NEXTAUTH_SECRET 또는 AUTH_SECRET)');
    }
  }

  /**
   * 개발 환경 검증
   */
  private validateDevelopmentEnvironment(warnings: string[]): void {
    // 개발 환경에서의 권장사항
    if (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('localhost')) {
      warnings.push('로컬 Supabase 인스턴스를 사용 중입니다. 네트워크 연결을 확인하세요');
    }

    // 개발 도구 관련 환경 변수
    if (!process.env.NEXT_PUBLIC_VERCEL_URL && !process.env.NEXTAUTH_URL) {
      warnings.push('개발 환경에서 NEXTAUTH_URL 설정을 권장합니다');
    }
  }

  /**
   * 테스트 환경 검증
   */
  private validateTestEnvironment(warnings: string[]): void {
    // 테스트 환경에서는 실제 키 대신 모의 값 사용 권장
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('test')) {
      warnings.push('테스트 환경에서는 테스트용 Supabase 프로젝트 사용을 권장합니다');
    }
  }

  /**
   * 서비스 역할 키 접근 로그 조회
   */
  getServiceRoleAccessLog(): EnvironmentAccessContext[] {
    return [...this.serviceRoleAccessLog];
  }

  private isAuthorizedCaller(caller: string): boolean {
    const authorizedCallers = [
      'createAdminClient',
      'admin-api',
      'user-management',
      'system-maintenance'
    ];
    return authorizedCallers.includes(caller);
  }

  private isAdminEndpoint(endpoint: string): boolean {
    return endpoint.startsWith('/api/admin/') || endpoint.includes('admin');
  }

  private logServiceRoleAccess(context: EnvironmentAccessContext): void {
    // 메모리에 최근 100개 접근 기록만 유지
    if (this.serviceRoleAccessLog.length >= 100) {
      this.serviceRoleAccessLog.shift();
    }

    this.serviceRoleAccessLog.push(context);

    logger.info('서비스 역할 키 접근', {
      caller: context.caller,
      endpoint: context.endpoint,
      userId: context.userId ? '[REDACTED]' : undefined,
      timestamp: context.timestamp
    });
  }

  private getCaller(): string {
    const stack = new Error().stack;
    if (stack) {
      const lines = stack.split('\n');
      // 호출자 정보 추출 (스택 트레이스에서)
      for (let i = 2; i < Math.min(lines.length, 5); i++) {
        const line = lines[i];
        if (line.includes('at ') && !line.includes('EnvironmentSecurityManager')) {
          return line.trim().replace('at ', '');
        }
      }
    }
    return 'unknown';
  }
}

export const environmentManager = EnvironmentSecurityManager.getInstance();

/**
 * 서비스 역할 키 안전 접근 헬퍼
 */
export function getServiceRoleKey(context: Omit<EnvironmentAccessContext, 'timestamp'>): string {
  return environmentManager.getServiceRoleKey({
    ...context,
    timestamp: new Date()
  });
}

/**
 * 환경 변수 검증 헬퍼
 */
export function validateEnvironmentVariables(): void {
  const result = environmentManager.validateEnvironment();
  if (!result.valid) {
    throw new Error(`환경 변수 검증 실패: ${result.errors.join(', ')}`);
  }
}