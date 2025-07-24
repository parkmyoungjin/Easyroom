/**
 * 창 닫기 유틸리티
 * 다양한 브라우저 환경에서 안정적인 창 닫기를 지원합니다.
 */

export interface WindowCloseOptions {
  /** 창 닫기 시도 전 지연 시간 (ms) */
  delay?: number;
  /** 창 닫기 실패 시 표시할 메시지 */
  fallbackMessage?: string;
  /** 대체 UI 표시 여부 */
  showFallbackUI?: boolean;
  /** 최대 재시도 횟수 */
  maxRetries?: number;
  /** 재시도 간격 (ms) */
  retryInterval?: number;
}

export interface WindowCloseResult {
  /** 창 닫기 성공 여부 */
  success: boolean;
  /** 사용된 방법 */
  method: 'auto' | 'manual' | 'failed';
  /** 에러 메시지 (실패 시) */
  error?: string;
  /** 창이 실제로 닫혔는지 여부 */
  windowClosed?: boolean;
}

export type WindowCloseCallback = (result: WindowCloseResult) => void;

/**
 * 브라우저 환경을 감지합니다.
 */
function detectBrowserEnvironment() {
  if (typeof window === 'undefined') {
    return { canClose: false, reason: 'SSR environment' };
  }

  // 창이 스크립트로 열렸는지 확인
  const openedByScript = window.opener !== null || window.history.length <= 1;
  
  // 모바일 환경 감지
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  // 브라우저 타입 감지 (더 정확한 패턴)
  const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent);
  const isFirefox = /Firefox/.test(navigator.userAgent);
  const isSafari = /Safari/.test(navigator.userAgent) && !isChrome && !/Edg/.test(navigator.userAgent);
  const isEdge = /Edg/.test(navigator.userAgent); // 새로운 Edge는 Edg로 표시
  const isOpera = /OPR/.test(navigator.userAgent);
  const isIE = /Trident/.test(navigator.userAgent);

  return {
    canClose: openedByScript,
    reason: openedByScript ? 'Can close' : 'Not opened by script',
    isMobile,
    browser: {
      chrome: isChrome,
      firefox: isFirefox,
      safari: isSafari,
      edge: isEdge,
      opera: isOpera,
      ie: isIE
    },
    openedByScript
  };
}

/**
 * 창이 실제로 닫혔는지 확인합니다.
 */
function checkWindowClosed(): Promise<boolean> {
  return new Promise((resolve) => {
    // 창이 닫혔는지 확인하는 여러 방법 시도
    const checkMethods = [
      // 방법 1: window.closed 속성 확인
      () => window.closed,
      
      // 방법 2: 포커스 이벤트로 확인
      () => {
        try {
          window.focus();
          return document.hasFocus() === false;
        } catch {
          return true; // 에러 발생 시 닫힌 것으로 간주
        }
      },
      
      // 방법 3: 부모 창과의 통신 확인
      () => {
        try {
          if (window.opener) {
            window.opener.postMessage('ping', '*');
            return false;
          }
          return true;
        } catch {
          return true;
        }
      }
    ];

    // 100ms 후 확인
    setTimeout(() => {
      const results = checkMethods.map(method => {
        try {
          return method();
        } catch {
          return true; // 에러 시 닫힌 것으로 간주
        }
      });
      
      // 하나라도 닫혔다고 판단하면 닫힌 것으로 간주
      resolve(results.some(result => result));
    }, 100);
  });
}

/**
 * 다양한 방법으로 창 닫기를 시도합니다.
 */
async function attemptWindowClose(): Promise<WindowCloseResult> {
  const env = detectBrowserEnvironment();
  
  if (!env.canClose) {
    return {
      success: false,
      method: 'failed',
      error: `Cannot close window: ${env.reason}`,
      windowClosed: false
    };
  }

  // 방법 1: 표준 window.close()
  try {
    window.close();
    const closed = await checkWindowClosed();
    
    if (closed) {
      return {
        success: true,
        method: 'auto',
        windowClosed: true
      };
    }
  } catch (error) {
    console.warn('Standard window.close() failed:', error);
  }

  // 방법 2: 브라우저별 특수 방법
  if (env.browser && (env.browser.chrome || env.browser.edge)) {
    try {
      // Chrome/Edge: 새 탭으로 이동 후 닫기
      if (typeof window.location.href !== 'undefined') {
        window.location.href = 'about:blank';
        setTimeout(() => window.close(), 100);
        
        const closed = await checkWindowClosed();
        if (closed) {
          return {
            success: true,
            method: 'auto',
            windowClosed: true
          };
        }
      }
    } catch (error) {
      console.warn('Chrome/Edge specific close failed:', error);
    }
  }

  if (env.browser && env.browser.firefox) {
    try {
      // Firefox: self.close() 시도 (서버 안전한 방식)
      if (typeof self !== 'undefined') {
        (self as any).close();
      } else if (typeof window !== 'undefined') {
        window.close();
      }
      
      const closed = await checkWindowClosed();
      if (closed) {
        return {
          success: true,
          method: 'auto',
          windowClosed: true
        };
      }
    } catch (error) {
      console.warn('Firefox specific close failed:', error);
    }
  }

  if (env.browser && env.browser.safari) {
    try {
      // Safari: 특별한 처리 없이 표준 방법 재시도
      // Safari는 보안이 엄격하므로 표준 방법이 최선
      window.close();
      
      const closed = await checkWindowClosed();
      if (closed) {
        return {
          success: true,
          method: 'auto',
          windowClosed: true
        };
      }
    } catch (error) {
      console.warn('Safari specific close failed:', error);
    }
  }

  if (env.browser && env.browser.opera) {
    try {
      // Opera: Chrome 기반이므로 유사한 방법 시도
      if (typeof window.location.href !== 'undefined') {
        window.location.href = 'about:blank';
        setTimeout(() => window.close(), 100);
        
        const closed = await checkWindowClosed();
        if (closed) {
          return {
            success: true,
            method: 'auto',
            windowClosed: true
          };
        }
      }
    } catch (error) {
      console.warn('Opera specific close failed:', error);
    }
  }

  if (env.browser && env.browser.ie) {
    try {
      // Internet Explorer: 레거시 방법 시도
      (window as any).external?.close?.();
      
      const closed = await checkWindowClosed();
      if (closed) {
        return {
          success: true,
          method: 'auto',
          windowClosed: true
        };
      }
    } catch (error) {
      console.warn('IE specific close failed:', error);
    }
  }

  // 방법 3: 모바일 환경 대응
  if (env.isMobile) {
    try {
      // 모바일에서는 여러 방법 시도
      
      // 방법 3-1: 히스토리 조작으로 뒤로가기 유도
      if (window.history.length > 1) {
        window.history.back();
        
        const closed = await checkWindowClosed();
        if (closed) {
          return {
            success: true,
            method: 'auto',
            windowClosed: true
          };
        }
      }
      
      // 방법 3-2: 모바일 브라우저별 특수 처리
      const userAgent = navigator.userAgent.toLowerCase();
      
      if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
        // iOS Safari: 특별한 처리
        try {
          if (typeof window.location.href !== 'undefined') {
            window.location.href = 'about:blank';
            setTimeout(() => window.close(), 200);
            
            const closed = await checkWindowClosed();
            if (closed) {
              return {
                success: true,
                method: 'auto',
                windowClosed: true
              };
            }
          }
        } catch (iosError) {
          console.warn('iOS specific close failed:', iosError);
        }
      }
      
      if (userAgent.includes('android')) {
        // Android Chrome: 특별한 처리
        try {
          // Android에서는 빈 페이지로 이동 후 닫기 시도
          if (typeof window.location.replace !== 'undefined') {
            window.location.replace('about:blank');
            setTimeout(() => window.close(), 300);
            
            const closed = await checkWindowClosed();
            if (closed) {
              return {
                success: true,
                method: 'auto',
                windowClosed: true
              };
            }
          }
        } catch (androidError) {
          console.warn('Android specific close failed:', androidError);
        }
      }
      
    } catch (error) {
      console.warn('Mobile close attempt failed:', error);
    }
  }

  // 모든 방법 실패
  return {
    success: false,
    method: 'failed',
    error: 'All close methods failed',
    windowClosed: false
  };
}

/**
 * 창 닫기를 시도하고 결과를 반환합니다.
 * 
 * @param options 창 닫기 옵션
 * @param callback 결과 콜백 함수
 * @returns Promise<WindowCloseResult>
 */
export async function closeWindow(
  options: WindowCloseOptions = {},
  callback?: WindowCloseCallback
): Promise<WindowCloseResult> {
  const {
    delay = 0,
    fallbackMessage = '이 창을 수동으로 닫아주세요.',
    showFallbackUI = true,
    maxRetries = 3,
    retryInterval = 500
  } = options;

  // 지연 시간이 있으면 대기
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  let lastResult: WindowCloseResult;
  
  // 재시도 로직
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`Window close attempt ${attempt}/${maxRetries}`);
    
    lastResult = await attemptWindowClose();
    
    if (lastResult.success) {
      console.log('Window closed successfully:', lastResult);
      callback?.(lastResult);
      return lastResult;
    }
    
    // 마지막 시도가 아니면 재시도 간격만큼 대기
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }

  // 모든 시도 실패
  console.warn('All window close attempts failed:', lastResult!);
  
  const finalResult: WindowCloseResult = {
    success: false,
    method: 'manual',
    error: lastResult!.error,
    windowClosed: false
  };

  callback?.(finalResult);
  return finalResult;
}

/**
 * 창 닫기 상태를 모니터링합니다.
 */
export function monitorWindowClose(
  onClose: () => void,
  interval: number = 1000
): () => void {
  const checkInterval = setInterval(async () => {
    const closed = await checkWindowClosed();
    if (closed) {
      clearInterval(checkInterval);
      onClose();
    }
  }, interval);

  // 정리 함수 반환
  return () => clearInterval(checkInterval);
}

/**
 * 부모 창에 메시지를 전송합니다.
 */
export function notifyParentWindow(message: any, origin: string = '*'): boolean {
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(message, origin);
      return true;
    }
    
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(message, origin);
      return true;
    }
    
    return false;
  } catch (error) {
    console.warn('Failed to notify parent window:', error);
    return false;
  }
}

/**
 * 창 닫기 전 정리 작업을 수행합니다.
 */
export function cleanupBeforeClose(): void {
  try {
    // 이벤트 리스너 정리
    window.removeEventListener('beforeunload', cleanupBeforeClose);
    window.removeEventListener('unload', cleanupBeforeClose);
    
    // 타이머 정리 (브라우저 환경에서만 실행)
    if (typeof window !== 'undefined') {
      // 브라우저 환경에서는 타이머 ID가 숫자로 관리됨
      const tempTimeoutId = window.setTimeout(() => {}, 0);
      window.clearTimeout(tempTimeoutId);
      
      // 일반적으로 사용되는 범위의 타이머 ID들을 정리
      for (let i = 1; i <= (tempTimeoutId as any); i++) {
        try {
          window.clearTimeout(i);
          window.clearInterval(i);
        } catch {
          // 에러 무시 (이미 정리된 타이머)
        }
      }
    }
    
    // 부모 창에 닫기 알림
    notifyParentWindow({ type: 'WINDOW_CLOSING' });
    
  } catch (error) {
    console.warn('Cleanup before close failed:', error);
  }
}