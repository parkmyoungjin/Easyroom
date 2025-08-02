/**
 * PWA Signup Utilities
 * Handles PWA-specific functionality for signup process including offline detection
 */

import { getNetworkStatus, isNetworkError } from './auth-timeout';

export interface PWASignupState {
  isOnline: boolean;
  isPWA: boolean;
  canSignup: boolean;
  offlineMessage?: string;
}

export interface SignupCompatibilityCheck {
  canProceed: boolean;
  reason?: string;
  suggestedAction?: string;
}

/**
 * Detects if the app is running as a PWA
 */
export function isPWAEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for PWA display modes
  const displayMode = window.matchMedia('(display-mode: standalone)').matches ||
                     window.matchMedia('(display-mode: minimal-ui)').matches ||
                     window.matchMedia('(display-mode: fullscreen)').matches;
  
  // Check for iOS standalone mode
  const isIOSStandalone = (window.navigator as any).standalone === true;
  
  // Check for installed PWA indicators
  const isInstalled = window.matchMedia('(display-mode: standalone)').matches;
  
  return displayMode || isIOSStandalone || isInstalled;
}

/**
 * Gets current PWA signup state
 */
export function getPWASignupState(): PWASignupState {
  const networkStatus = getNetworkStatus();
  const isPWA = isPWAEnvironment();
  
  const state: PWASignupState = {
    isOnline: networkStatus.isOnline,
    isPWA,
    canSignup: networkStatus.isOnline, // Signup requires internet connection
  };
  
  if (!networkStatus.isOnline) {
    state.offlineMessage = isPWA 
      ? 'PWA 앱에서 회원가입을 하려면 인터넷 연결이 필요합니다. 연결을 확인하고 다시 시도해주세요.'
      : '회원가입을 하려면 인터넷 연결이 필요합니다. 연결을 확인하고 다시 시도해주세요.';
  }
  
  return state;
}

/**
 * Checks signup compatibility with current environment
 */
export function checkSignupCompatibility(): SignupCompatibilityCheck {
  const pwState = getPWASignupState();
  
  if (!pwState.isOnline) {
    return {
      canProceed: false,
      reason: 'offline',
      suggestedAction: '인터넷 연결을 확인하고 다시 시도해주세요.'
    };
  }
  
  return {
    canProceed: true
  };
}

/**
 * Validates signup to OTP transition
 */
export function validateSignupToOtpTransition(email: string): SignupCompatibilityCheck {
  // Check basic email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      canProceed: false,
      reason: 'invalid_email',
      suggestedAction: '올바른 이메일 주소를 입력해주세요.'
    };
  }
  
  // Check network connectivity for OTP
  const networkStatus = getNetworkStatus();
  if (!networkStatus.isOnline) {
    return {
      canProceed: false,
      reason: 'offline_otp',
      suggestedAction: 'OTP 로그인을 위해서는 인터넷 연결이 필요합니다.'
    };
  }
  
  return {
    canProceed: true
  };
}

/**
 * Handles signup errors with PWA context
 */
export function handleSignupError(error: any): {
  message: string;
  canRetry: boolean;
  isPWASpecific: boolean;
} {
  const isPWA = isPWAEnvironment();
  const isNetworkErr = isNetworkError(error);
  
  if (isNetworkErr) {
    return {
      message: isPWA 
        ? 'PWA 환경에서 네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인하고 다시 시도해주세요.'
        : '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인하고 다시 시도해주세요.',
      canRetry: true,
      isPWASpecific: isPWA
    };
  }
  
  // Handle other common signup errors
  const errorMessage = error?.message?.toLowerCase() || '';
  
  if (errorMessage.includes('already registered') || errorMessage.includes('already exists')) {
    return {
      message: '이미 가입된 이메일입니다. 로그인 페이지에서 OTP 로그인을 시도해주세요.',
      canRetry: false,
      isPWASpecific: false
    };
  }
  
  if (errorMessage.includes('invalid email')) {
    return {
      message: '올바른 이메일 주소를 입력해주세요.',
      canRetry: true,
      isPWASpecific: false
    };
  }
  
  // Generic error handling
  return {
    message: isPWA 
      ? 'PWA 환경에서 회원가입 중 오류가 발생했습니다. 다시 시도해주세요.'
      : '회원가입 중 오류가 발생했습니다. 다시 시도해주세요.',
    canRetry: true,
    isPWASpecific: isPWA
  };
}

/**
 * Provides user guidance for signup to OTP transition
 */
export function getSignupToOtpGuidance(email: string): {
  title: string;
  message: string;
  nextSteps: string[];
} {
  const isPWA = isPWAEnvironment();
  
  return {
    title: '회원가입 완료!',
    message: `${email}로 회원가입이 완료되었습니다. 이제 OTP 코드로 로그인할 수 있습니다.`,
    nextSteps: [
      '로그인 페이지에서 가입한 이메일을 입력하세요',
      '이메일로 전송된 6자리 OTP 코드를 입력하세요',
      isPWA ? 'PWA 환경에서도 동일하게 OTP 로그인이 가능합니다' : 'OTP 코드는 5분간 유효합니다',
      '로그인 후 모든 기능을 이용할 수 있습니다'
    ]
  };
}

/**
 * Monitors network status changes for PWA signup
 */
export function createSignupNetworkMonitor(
  onOnline: () => void,
  onOffline: () => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {}; // No-op for SSR
  }
  
  const handleOnline = () => {
    const pwState = getPWASignupState();
    if (pwState.canSignup) {
      onOnline();
    }
  };
  
  const handleOffline = () => {
    onOffline();
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}