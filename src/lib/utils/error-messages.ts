/**
 * 이메일 인증 관련 에러 메시지 유틸리티
 */

export interface ErrorInfo {
  title: string;
  message: string;
  action?: string;
  severity: 'error' | 'warning' | 'info';
}

export type AuthErrorType = 
  | 'NETWORK_ERROR'
  | 'TOKEN_EXPIRED' 
  | 'TOKEN_INVALID'
  | 'EMAIL_NOT_CONFIRMED'
  | 'USER_NOT_FOUND'
  | 'SESSION_ERROR'
  | 'PROFILE_CREATION_FAILED'
  | 'UNKNOWN_ERROR'
  | 'WINDOW_CLOSE_FAILED'
  | 'LOGIN_TIMEOUT'
  | 'REDIRECT_TIMEOUT'
  | 'AUTH_TIMEOUT'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'PASSWORD_WEAK'
  | 'EMAIL_INVALID'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SERVER_ERROR'
  | 'DATABASE_ERROR';

/**
 * 에러 타입별 사용자 친화적 메시지 매핑
 */
export const ERROR_MESSAGES: Record<AuthErrorType, ErrorInfo> = {
  NETWORK_ERROR: {
    title: '네트워크 연결 오류',
    message: '인터넷 연결을 확인하고 다시 시도해주세요.',
    action: '새로고침하여 다시 시도',
    severity: 'error'
  },
  
  TOKEN_EXPIRED: {
    title: '인증 링크 만료',
    message: '이메일 인증 링크가 만료되었습니다. 새로운 인증 이메일을 요청해주세요.',
    action: '새 인증 이메일 요청',
    severity: 'warning'
  },
  
  TOKEN_INVALID: {
    title: '잘못된 인증 링크',
    message: '유효하지 않은 인증 링크입니다. 이메일에서 올바른 링크를 클릭했는지 확인해주세요.',
    action: '이메일 다시 확인',
    severity: 'error'
  },
  
  EMAIL_NOT_CONFIRMED: {
    title: '이메일 인증 미완료',
    message: '이메일 인증이 아직 완료되지 않았습니다. 이메일을 확인하고 인증 링크를 클릭해주세요.',
    action: '이메일 확인',
    severity: 'warning'
  },
  
  USER_NOT_FOUND: {
    title: '사용자 정보 없음',
    message: '인증 세션에서 사용자 정보를 찾을 수 없습니다. 다시 회원가입을 진행해주세요.',
    action: '회원가입 다시 시도',
    severity: 'error'
  },
  
  SESSION_ERROR: {
    title: '세션 오류',
    message: '인증 세션 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    action: '잠시 후 다시 시도',
    severity: 'error'
  },
  
  PROFILE_CREATION_FAILED: {
    title: '프로필 생성 실패',
    message: '사용자 프로필 생성에 실패했지만 인증은 완료되었습니다. 로그인 후 프로필을 확인해주세요.',
    action: '로그인하여 확인',
    severity: 'warning'
  },
  
  UNKNOWN_ERROR: {
    title: '알 수 없는 오류',
    message: '예상치 못한 오류가 발생했습니다. 문제가 지속되면 관리자에게 문의해주세요.',
    action: '다시 시도 또는 관리자 문의',
    severity: 'error'
  },
  
  WINDOW_CLOSE_FAILED: {
    title: '창 닫기 실패',
    message: '자동으로 창을 닫을 수 없습니다. 브라우저 보안 설정으로 인한 제한일 수 있습니다.',
    action: '수동으로 창 닫기',
    severity: 'info'
  },

  LOGIN_TIMEOUT: {
    title: '로그인 시간 초과',
    message: '로그인 처리 시간이 초과되었습니다. 네트워크 연결을 확인하고 다시 시도해주세요.',
    action: '다시 로그인 시도',
    severity: 'warning'
  },

  REDIRECT_TIMEOUT: {
    title: '페이지 이동 시간 초과',
    message: '페이지 이동 처리 시간이 초과되었습니다. 새로고침하거나 다시 시도해주세요.',
    action: '새로고침 후 다시 시도',
    severity: 'warning'
  },

  AUTH_TIMEOUT: {
    title: '인증 확인 시간 초과',
    message: '인증 상태 확인 시간이 초과되었습니다. 다시 로그인해주세요.',
    action: '다시 로그인',
    severity: 'warning'
  },

  INVALID_CREDENTIALS: {
    title: '로그인 정보 오류',
    message: '이메일 또는 비밀번호가 올바르지 않습니다. 다시 확인해주세요.',
    action: '로그인 정보 재입력',
    severity: 'error'
  },

  ACCOUNT_LOCKED: {
    title: '계정 잠금',
    message: '보안상의 이유로 계정이 일시적으로 잠겼습니다. 잠시 후 다시 시도하거나 관리자에게 문의하세요.',
    action: '관리자 문의',
    severity: 'error'
  },

  PASSWORD_WEAK: {
    title: '비밀번호 보안 강도 부족',
    message: '비밀번호가 보안 요구사항을 충족하지 않습니다. 더 강력한 비밀번호를 설정해주세요.',
    action: '비밀번호 재설정',
    severity: 'warning'
  },

  EMAIL_INVALID: {
    title: '유효하지 않은 이메일',
    message: '입력하신 이메일 주소가 유효하지 않습니다. 올바른 이메일 형식으로 입력해주세요.',
    action: '이메일 주소 확인',
    severity: 'error'
  },

  RATE_LIMIT_EXCEEDED: {
    title: '요청 한도 초과',
    message: '너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.',
    action: '잠시 후 다시 시도',
    severity: 'warning'
  },

  SERVER_ERROR: {
    title: '서버 오류',
    message: '서버에서 오류가 발생했습니다. 잠시 후 다시 시도하거나 관리자에게 문의하세요.',
    action: '잠시 후 다시 시도',
    severity: 'error'
  },

  DATABASE_ERROR: {
    title: '데이터베이스 오류',
    message: '데이터베이스 연결에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
    action: '잠시 후 다시 시도',
    severity: 'error'
  }
};

/**
 * Supabase 에러를 분석하여 적절한 에러 타입을 반환합니다.
 */
export function analyzeSupabaseError(error: any): AuthErrorType {
  if (!error) return 'UNKNOWN_ERROR';
  
  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code || error.status;
  
  // 타임아웃 관련 에러 (우선 처리)
  if (errorMessage.includes('timeout') || errorCode === 'TIMEOUT') {
    if (errorMessage.includes('login')) return 'LOGIN_TIMEOUT';
    if (errorMessage.includes('redirect')) return 'REDIRECT_TIMEOUT';
    if (errorMessage.includes('auth')) return 'AUTH_TIMEOUT';
    return 'AUTH_TIMEOUT'; // 기본 타임아웃
  }
  
  // 네트워크 관련 에러
  if (errorMessage.includes('network') || 
      errorMessage.includes('fetch') || 
      errorMessage.includes('connection') ||
      errorMessage.includes('offline') ||
      errorCode === 'NETWORK_ERROR' ||
      errorCode === 'ECONNREFUSED' ||
      errorCode === 'ENOTFOUND') {
    return 'NETWORK_ERROR';
  }
  
  // 인증 자격 증명 관련 에러
  if (errorMessage.includes('invalid login credentials') ||
      errorMessage.includes('wrong password') ||
      errorMessage.includes('incorrect password') ||
      errorMessage.includes('authentication failed') ||
      errorCode === 'INVALID_CREDENTIALS') {
    return 'INVALID_CREDENTIALS';
  }
  
  // 계정 잠금 관련 에러
  if (errorMessage.includes('account locked') ||
      errorMessage.includes('too many attempts') ||
      errorMessage.includes('temporarily disabled') ||
      errorCode === 'ACCOUNT_LOCKED') {
    return 'ACCOUNT_LOCKED';
  }
  
  // 요청 한도 초과 에러
  if (errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests') ||
      errorCode === 'RATE_LIMIT_EXCEEDED' ||
      errorCode === 429) {
    return 'RATE_LIMIT_EXCEEDED';
  }
  
  // 토큰 관련 에러
  if (errorMessage.includes('token') && errorMessage.includes('expired')) {
    return 'TOKEN_EXPIRED';
  }
  
  if (errorMessage.includes('invalid') && 
      (errorMessage.includes('token') || errorMessage.includes('jwt'))) {
    return 'TOKEN_INVALID';
  }
  
  // 이메일 관련 에러
  if (errorMessage.includes('email not confirmed') || 
      errorMessage.includes('email_confirmed_at')) {
    return 'EMAIL_NOT_CONFIRMED';
  }
  
  if (errorMessage.includes('invalid email') ||
      errorMessage.includes('email format') ||
      errorMessage.includes('malformed email')) {
    return 'EMAIL_INVALID';
  }
  
  // 비밀번호 관련 에러
  if (errorMessage.includes('password') && 
      (errorMessage.includes('weak') || errorMessage.includes('strength'))) {
    return 'PASSWORD_WEAK';
  }
  
  // 사용자 관련 에러
  if (errorMessage.includes('user not found') || 
      errorCode === 'USER_NOT_FOUND') {
    return 'USER_NOT_FOUND';
  }
  
  // 서버 관련 에러
  if (errorCode >= 500 && errorCode < 600) {
    return 'SERVER_ERROR';
  }
  
  // 세션 관련 에러 (특정 PGRST 코드는 먼저 체크)
  if (errorMessage.includes('session') || 
      errorMessage.includes('auth') ||
      errorCode === 'PGRST301') {
    return 'SESSION_ERROR';
  }
  
  // 데이터베이스 관련 에러
  if (errorMessage.includes('database') ||
      errorMessage.includes('connection pool') ||
      errorMessage.includes('postgres') ||
      errorCode === 'DATABASE_ERROR' ||
      errorCode?.toString().startsWith('PGRST')) {
    return 'DATABASE_ERROR';
  }
  
  return 'UNKNOWN_ERROR';
}

/**
 * 에러 정보를 가져옵니다.
 */
export function getErrorInfo(errorType: AuthErrorType): ErrorInfo {
  return ERROR_MESSAGES[errorType];
}

/**
 * Supabase 에러를 사용자 친화적 메시지로 변환합니다.
 */
export function getErrorMessage(error: any): ErrorInfo {
  const errorType = analyzeSupabaseError(error);
  return getErrorInfo(errorType);
}

/**
 * 진행률과 함께 표시할 로딩 메시지들
 */
export const LOADING_MESSAGES = [
  '이메일 인증을 확인하고 있습니다...',
  '사용자 정보를 처리하고 있습니다...',
  '프로필을 생성하고 있습니다...',
  '인증을 완료하고 있습니다...'
];

/**
 * 성공 메시지 변형들
 */
export const SUCCESS_MESSAGES = [
  '이메일 인증이 완료되었습니다!',
  '계정이 성공적으로 활성화되었습니다!',
  '인증이 완료되었습니다!'
];

/**
 * 창 닫기 관련 메시지들
 */
export const WINDOW_CLOSE_MESSAGES = {
  ATTEMPTING: '이 창을 자동으로 닫는 중입니다...',
  SUCCESS: '창이 자동으로 닫힙니다...',
  FAILED: '자동으로 창을 닫을 수 없습니다.',
  MANUAL_INSTRUCTION: '아래 버튼을 클릭하거나 브라우저의 탭 닫기 버튼을 사용해주세요.',
  KEYBOARD_SHORTCUT: 'Ctrl+W (Windows) 또는 Cmd+W (Mac)를 눌러 창을 닫을 수도 있습니다.'
};

/**
 * 브라우저별 창 닫기 안내 메시지
 */
export function getBrowserSpecificCloseMessage(): string {
  if (typeof window === 'undefined') return '';
  
  const userAgent = navigator.userAgent.toLowerCase();
  
  // 모바일 환경을 먼저 체크
  if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
    return 'iOS: 탭 관리 버튼을 눌러 이 탭을 닫아주세요.';
  }
  
  if (userAgent.includes('android')) {
    return 'Android: 탭 버튼을 눌러 이 탭을 닫거나 뒤로가기 버튼을 눌러주세요.';
  }
  
  // 데스크톱 브라우저 체크 (Edge를 먼저 체크)
  if (userAgent.includes('edg')) {
    return 'Edge: 탭 우측의 X 버튼을 클릭하거나 Ctrl+W를 눌러주세요.';
  }
  
  if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
    return 'Chrome: 탭 우측의 X 버튼을 클릭하거나 Ctrl+W를 눌러주세요.';
  }
  
  if (userAgent.includes('firefox')) {
    return 'Firefox: 탭 우측의 X 버튼을 클릭하거나 Ctrl+W를 눌러주세요.';
  }
  
  if (userAgent.includes('safari') && !userAgent.includes('chrome') && !userAgent.includes('edg')) {
    return 'Safari: 탭 좌측의 X 버튼을 클릭하거나 Cmd+W를 눌러주세요.';
  }
  
  return '브라우저의 탭 닫기 버튼을 클릭하거나 키보드 단축키를 사용해주세요.';
}