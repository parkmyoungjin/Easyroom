/**
 * Authentication Timeout and Error Recovery Utilities
 * Implements timeout detection and recovery mechanisms for login and redirect processes
 */

export interface TimeoutConfig {
  loginTimeout: number;      // 10 seconds for login process
  redirectTimeout: number;   // 5 seconds for redirect process
  authTimeout: number;       // 15 seconds for auth state verification
}

export interface AuthTimeoutError extends Error {
  type: 'login_timeout' | 'redirect_timeout' | 'auth_timeout';
  duration: number;
  recoverable: boolean;
  retryAction?: () => void;
}

export interface RecoveryOption {
  label: string;
  action: () => void;
  primary?: boolean;
}

export interface TimeoutHandler {
  startTimeout: (type: keyof TimeoutConfig, callback: () => void) => void;
  clearTimeout: (type: keyof TimeoutConfig) => void;
  clearAllTimeouts: () => void;
  isTimedOut: (type: keyof TimeoutConfig) => boolean;
}

// Default timeout configuration
export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  loginTimeout: 10000,    // 10 seconds
  redirectTimeout: 5000,  // 5 seconds
  authTimeout: 15000,     // 15 seconds
};

/**
 * Creates an authentication timeout error
 */
export function createAuthTimeoutError(
  type: AuthTimeoutError['type'],
  duration: number,
  retryAction?: () => void
): AuthTimeoutError {
  const error = new Error(getTimeoutMessage(type, duration)) as AuthTimeoutError;
  error.type = type;
  error.duration = duration;
  error.recoverable = true;
  error.retryAction = retryAction;
  error.name = 'AuthTimeoutError';
  
  return error;
}

/**
 * Gets user-friendly timeout message
 */
function getTimeoutMessage(type: AuthTimeoutError['type'], duration: number): string {
  const seconds = Math.floor(duration / 1000);
  
  switch (type) {
    case 'login_timeout':
      return `로그인 처리가 ${seconds}초 내에 완료되지 않았습니다.`;
    case 'redirect_timeout':
      return `페이지 이동이 ${seconds}초 내에 완료되지 않았습니다.`;
    case 'auth_timeout':
      return `인증 상태 확인이 ${seconds}초 내에 완료되지 않았습니다.`;
    default:
      return `처리 시간이 ${seconds}초를 초과했습니다.`;
  }
}

/**
 * Gets recovery options for timeout errors
 */
export function getRecoveryOptions(error: AuthTimeoutError): RecoveryOption[] {
  const options: RecoveryOption[] = [];

  switch (error.type) {
    case 'login_timeout':
      options.push({
        label: '다시 로그인',
        action: error.retryAction || (() => window.location.reload()),
        primary: true
      });
      options.push({
        label: '페이지 새로고침',
        action: () => window.location.reload()
      });
      break;

    case 'redirect_timeout':
      options.push({
        label: '메인 페이지로 이동',
        action: () => window.location.href = '/',
        primary: true
      });
      options.push({
        label: '다시 시도',
        action: error.retryAction || (() => window.location.reload())
      });
      break;

    case 'auth_timeout':
      options.push({
        label: '로그인 페이지로 이동',
        action: () => window.location.href = '/login',
        primary: true
      });
      options.push({
        label: '새로고침',
        action: () => window.location.reload()
      });
      break;
  }

  return options;
}

/**
 * Creates a timeout handler for managing multiple timeouts
 */
export function createTimeoutHandler(config: TimeoutConfig = DEFAULT_TIMEOUT_CONFIG): TimeoutHandler {
  const timeouts = new Map<keyof TimeoutConfig, NodeJS.Timeout>();
  const timedOut = new Set<keyof TimeoutConfig>();

  return {
    startTimeout(type: keyof TimeoutConfig, callback: () => void) {
      // Clear existing timeout for this type
      this.clearTimeout(type);
      
      const timeout = setTimeout(() => {
        timedOut.add(type);
        callback();
      }, config[type]);
      
      timeouts.set(type, timeout);
    },

    clearTimeout(type: keyof TimeoutConfig) {
      const timeout = timeouts.get(type);
      if (timeout) {
        clearTimeout(timeout);
        timeouts.delete(type);
      }
      timedOut.delete(type);
    },

    clearAllTimeouts() {
      timeouts.forEach((timeout) => clearTimeout(timeout));
      timeouts.clear();
      timedOut.clear();
    },

    isTimedOut(type: keyof TimeoutConfig) {
      return timedOut.has(type);
    }
  };
}

/**
 * Wraps a promise with timeout functionality
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutType: AuthTimeoutError['type'],
  retryAction?: () => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(createAuthTimeoutError(timeoutType, timeoutMs, retryAction));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

/**
 * Network connection status checker
 */
export interface NetworkStatus {
  isOnline: boolean;
  connectionType?: string;
  effectiveType?: string;
}

export function getNetworkStatus(): NetworkStatus {
  if (typeof window === 'undefined') {
    return { isOnline: true };
  }

  const navigator = window.navigator as any;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  return {
    isOnline: navigator.onLine,
    connectionType: connection?.type,
    effectiveType: connection?.effectiveType
  };
}

/**
 * Checks if error is network-related
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false;
  
  const message = error.message?.toLowerCase() || '';
  const networkKeywords = [
    'network', 'fetch', 'connection', 'timeout',
    'offline', 'unreachable', 'dns', 'cors'
  ];
  
  return networkKeywords.some(keyword => message.includes(keyword)) || 
         !getNetworkStatus().isOnline;
}

/**
 * Creates a retry mechanism with exponential backoff
 */
export function createRetryMechanism<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        resolve(result);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry on non-network errors
        if (!isNetworkError(error) && attempt < maxRetries) {
          reject(lastError);
          return;
        }
        
        if (attempt === maxRetries) {
          reject(lastError);
          return;
        }
        
        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  });
}