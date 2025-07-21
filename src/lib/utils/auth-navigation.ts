/**
 * 인증 관련 네비게이션 유틸리티
 * 페이지별 리디렉션 정책을 관리합니다.
 */

export interface AuthNavigationPolicy {
  /** 자동 리디렉션 허용 여부 */
  allowAutoRedirect: boolean;
  /** 인증 상태 변경 감지 여부 */
  detectAuthStateChange: boolean;
  /** 페이지 설명 */
  description: string;
}

/**
 * 페이지별 인증 네비게이션 정책
 */
export const AUTH_NAVIGATION_POLICIES: Record<string, AuthNavigationPolicy> = {
  // 인증 콜백 페이지 - 자동 리디렉션 완전 비활성화
  '/auth/callback': {
    allowAutoRedirect: false,
    detectAuthStateChange: false,
    description: 'Email verification callback page - should close automatically'
  },
  
  // 로그인/회원가입 페이지 - 인증된 사용자는 메인으로 리디렉션
  '/login': {
    allowAutoRedirect: true,
    detectAuthStateChange: true,
    description: 'Login page - redirect authenticated users to main'
  },
  
  '/signup': {
    allowAutoRedirect: true,
    detectAuthStateChange: true,
    description: 'Signup page - redirect authenticated users to main'
  },
  
  // 보호된 페이지들 - 미인증 사용자는 로그인으로 리디렉션
  '/admin': {
    allowAutoRedirect: true,
    detectAuthStateChange: true,
    description: 'Admin page - requires authentication and admin role'
  },
  
  '/reservations/new': {
    allowAutoRedirect: true,
    detectAuthStateChange: true,
    description: 'New reservation page - requires authentication'
  },
  
  '/reservations/my': {
    allowAutoRedirect: true,
    detectAuthStateChange: true,
    description: 'My reservations page - requires authentication'
  },
  
  // 공개 페이지들 - 리디렉션 없음
  '/': {
    allowAutoRedirect: false,
    detectAuthStateChange: true,
    description: 'Main page - accessible to all users'
  },
  
  '/dashboard': {
    allowAutoRedirect: false,
    detectAuthStateChange: true,
    description: 'Dashboard page - accessible to all users with different content'
  }
};

/**
 * 현재 페이지의 인증 네비게이션 정책을 가져옵니다.
 */
export function getCurrentAuthPolicy(pathname?: string): AuthNavigationPolicy {
  if (typeof window === 'undefined' && !pathname) {
    // SSR 환경에서 pathname이 제공되지 않은 경우 기본값
    return {
      allowAutoRedirect: false,
      detectAuthStateChange: false,
      description: 'SSR environment - no auto redirect'
    };
  }
  
  const currentPath = pathname || window.location.pathname;
  
  // 정확한 경로 매칭 시도
  if (AUTH_NAVIGATION_POLICIES[currentPath]) {
    return AUTH_NAVIGATION_POLICIES[currentPath];
  }
  
  // 패턴 매칭 시도
  for (const [pattern, policy] of Object.entries(AUTH_NAVIGATION_POLICIES)) {
    if (currentPath.startsWith(pattern)) {
      return policy;
    }
  }
  
  // 기본 정책 (공개 페이지)
  return {
    allowAutoRedirect: false,
    detectAuthStateChange: true,
    description: 'Default policy - public page'
  };
}

/**
 * 현재 페이지에서 자동 리디렉션이 허용되는지 확인합니다.
 */
export function shouldAllowAutoRedirect(pathname?: string): boolean {
  return getCurrentAuthPolicy(pathname).allowAutoRedirect;
}

/**
 * 현재 페이지에서 인증 상태 변경을 감지해야 하는지 확인합니다.
 */
export function shouldDetectAuthStateChange(pathname?: string): boolean {
  return getCurrentAuthPolicy(pathname).detectAuthStateChange;
}

/**
 * 인증 콜백 페이지인지 확인합니다.
 */
export function isAuthCallbackPage(pathname?: string): boolean {
  const currentPath = pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
  return currentPath === '/auth/callback';
}

/**
 * 보호된 페이지인지 확인합니다.
 */
export function isProtectedPage(pathname?: string): boolean {
  const currentPath = pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
  const protectedPaths = ['/admin', '/reservations/new', '/reservations/my'];
  return protectedPaths.some(path => currentPath.startsWith(path));
}

/**
 * 인증 관련 페이지인지 확인합니다.
 */
export function isAuthPage(pathname?: string): boolean {
  const currentPath = pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
  const authPaths = ['/login', '/signup'];
  return authPaths.some(path => currentPath.startsWith(path));
}

/**
 * 페이지별 리디렉션 로직을 처리합니다.
 */
export interface RedirectOptions {
  isAuthenticated: boolean;
  isAdmin?: boolean;
  currentPath?: string;
  fallbackPath?: string;
}

export function getRedirectPath(options: RedirectOptions): string | null {
  const {
    isAuthenticated,
    isAdmin = false,
    currentPath = typeof window !== 'undefined' ? window.location.pathname : '',
    fallbackPath = '/'
  } = options;

  const policy = getCurrentAuthPolicy(currentPath);
  
  // 자동 리디렉션이 허용되지 않는 페이지
  if (!policy.allowAutoRedirect) {
    return null;
  }

  // 인증된 사용자가 인증 페이지에 접근하는 경우
  if (isAuthenticated && isAuthPage(currentPath)) {
    return fallbackPath;
  }

  // 미인증 사용자가 보호된 페이지에 접근하는 경우
  if (!isAuthenticated && isProtectedPage(currentPath)) {
    const loginUrl = new URL('/login', window.location.origin);
    loginUrl.searchParams.set('redirect', currentPath);
    return loginUrl.toString();
  }

  // 관리자 권한이 필요한 페이지
  if (currentPath.startsWith('/admin') && !isAdmin) {
    return fallbackPath;
  }

  return null;
}

/**
 * 디버깅을 위한 현재 인증 네비게이션 상태를 로깅합니다.
 */
export function logAuthNavigationState(pathname?: string): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const currentPath = pathname || (typeof window !== 'undefined' ? window.location.pathname : 'SSR');
  const policy = getCurrentAuthPolicy(pathname);
  
  console.group(`🔐 Auth Navigation State: ${currentPath}`);
  console.log('Policy:', policy);
  console.log('Allow Auto Redirect:', policy.allowAutoRedirect);
  console.log('Detect Auth State Change:', policy.detectAuthStateChange);
  console.log('Is Auth Callback Page:', isAuthCallbackPage(pathname));
  console.log('Is Protected Page:', isProtectedPage(pathname));
  console.log('Is Auth Page:', isAuthPage(pathname));
  console.groupEnd();
}