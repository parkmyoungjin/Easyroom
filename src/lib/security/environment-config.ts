/**
 * 환경별 보안 설정 관리
 * 각 환경(개발, 테스트, 프로덕션)에 맞는 보안 정책을 정의합니다.
 */

export interface EnvironmentSecurityConfig {
  requiredVariables: string[];
  optionalVariables: string[];
  securityChecks: {
    requireHttps: boolean;
    requireServiceRoleKey: boolean;
    validateKeyFormats: boolean;
    checkDefaultValues: boolean;
  };
  logging: {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    auditServiceRoleAccess: boolean;
    redactSensitiveData: boolean;
  };
  errorHandling: {
    exitOnValidationFailure: boolean;
    throwOnMissingRequired: boolean;
  };
}

/**
 * 개발 환경 보안 설정
 */
export const developmentConfig: EnvironmentSecurityConfig = {
  requiredVariables: [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ],
  optionalVariables: [
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET'
  ],
  securityChecks: {
    requireHttps: false, // 로컬 개발에서는 HTTP 허용
    requireServiceRoleKey: false, // 개발 환경에서는 선택사항
    validateKeyFormats: true,
    checkDefaultValues: true
  },
  logging: {
    logLevel: 'debug',
    auditServiceRoleAccess: true,
    redactSensitiveData: true
  },
  errorHandling: {
    exitOnValidationFailure: false, // 개발 환경에서는 경고만
    throwOnMissingRequired: false
  }
};

/**
 * 테스트 환경 보안 설정
 */
export const testConfig: EnvironmentSecurityConfig = {
  requiredVariables: [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ],
  optionalVariables: [
    'SUPABASE_SERVICE_ROLE_KEY'
  ],
  securityChecks: {
    requireHttps: false, // 테스트 환경에서는 HTTP 허용
    requireServiceRoleKey: false,
    validateKeyFormats: false, // 테스트에서는 모의 키 사용 가능
    checkDefaultValues: false
  },
  logging: {
    logLevel: 'warn',
    auditServiceRoleAccess: false, // 테스트에서는 감사 로깅 비활성화
    redactSensitiveData: true
  },
  errorHandling: {
    exitOnValidationFailure: false,
    throwOnMissingRequired: true // 테스트에서는 누락된 변수에 대해 예외 발생
  }
};

/**
 * 프로덕션 환경 보안 설정
 */
export const productionConfig: EnvironmentSecurityConfig = {
  requiredVariables: [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY' // 프로덕션에서는 필수
  ],
  optionalVariables: [
    'NEXTAUTH_SECRET',
    'AUTH_SECRET'
  ],
  securityChecks: {
    requireHttps: true, // 프로덕션에서는 HTTPS 필수
    requireServiceRoleKey: true,
    validateKeyFormats: true,
    checkDefaultValues: true // 개발용 기본값 사용 금지
  },
  logging: {
    logLevel: 'info',
    auditServiceRoleAccess: true,
    redactSensitiveData: true
  },
  errorHandling: {
    exitOnValidationFailure: true, // 프로덕션에서는 검증 실패 시 종료
    throwOnMissingRequired: true
  }
};

/**
 * 현재 환경에 맞는 보안 설정 반환
 */
export function getEnvironmentConfig(): EnvironmentSecurityConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  switch (nodeEnv) {
    case 'production':
      return productionConfig;
    case 'test':
      return testConfig;
    case 'development':
    default:
      return developmentConfig;
  }
}

/**
 * 환경 설정 유효성 검증
 */
export function validateEnvironmentConfig(config: EnvironmentSecurityConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 필수 변수 설정 확인
  if (!config.requiredVariables || config.requiredVariables.length === 0) {
    errors.push('필수 환경 변수 목록이 비어있습니다');
  }

  // 로그 레벨 유효성 확인
  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLogLevels.includes(config.logging.logLevel)) {
    errors.push(`유효하지 않은 로그 레벨: ${config.logging.logLevel}`);
  }

  // 프로덕션 환경 특별 검증
  if (process.env.NODE_ENV === 'production') {
    if (!config.securityChecks.requireHttps) {
      errors.push('프로덕션 환경에서는 HTTPS가 필수입니다');
    }
    
    if (!config.securityChecks.requireServiceRoleKey) {
      errors.push('프로덕션 환경에서는 서비스 역할 키가 필수입니다');
    }
    
    if (!config.errorHandling.exitOnValidationFailure) {
      errors.push('프로덕션 환경에서는 검증 실패 시 프로세스 종료가 필요합니다');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 환경 설정 정보 출력 (디버깅용)
 */
export function logEnvironmentConfig(): void {
  const config = getEnvironmentConfig();
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  console.log(`\n=== 환경 보안 설정 (${nodeEnv.toUpperCase()}) ===`);
  console.log('필수 환경 변수:', config.requiredVariables);
  console.log('선택적 환경 변수:', config.optionalVariables);
  console.log('보안 검사:', config.securityChecks);
  console.log('로깅 설정:', config.logging);
  console.log('오류 처리:', config.errorHandling);
  console.log('=====================================\n');
}