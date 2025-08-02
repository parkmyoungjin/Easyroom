/**
 * PWA Utilities for OTP Authentication
 * Provides PWA-specific functionality and detection
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

export interface PWACapabilities {
  supportsOffline: boolean;
  supportsNotifications: boolean;
  supportsBackgroundSync: boolean;
}

export interface PWAEnvironmentInfo {
  isPWA: boolean;
  displayMode: string;
  isStandalone: boolean;
  isIOS: boolean;
  isAndroid: boolean;
}

/**
 * Detects if the application is running in a PWA environment
 */
export function isPWAEnvironment(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // Check for display-mode: standalone
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  
  // Check for iOS standalone mode
  const isIOSStandalone = (window.navigator as any)?.standalone === true;
  
  // Check for other PWA display modes
  const isMinimalUI = window.matchMedia('(display-mode: minimal-ui)').matches;
  const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;

  return isStandalone || isIOSStandalone || isMinimalUI || isFullscreen;
}

/**
 * Gets detailed PWA environment information
 */
export function getPWAEnvironmentInfo(): PWAEnvironmentInfo {
  if (typeof window === 'undefined') {
    return {
      isPWA: false,
      displayMode: 'browser',
      isStandalone: false,
      isIOS: false,
      isAndroid: false,
    };
  }

  const userAgent = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);

  let displayMode = 'browser';
  if (window.matchMedia('(display-mode: standalone)').matches) {
    displayMode = 'standalone';
  } else if (window.matchMedia('(display-mode: minimal-ui)').matches) {
    displayMode = 'minimal-ui';
  } else if (window.matchMedia('(display-mode: fullscreen)').matches) {
    displayMode = 'fullscreen';
  }

  const isStandalone = displayMode !== 'browser' || (window.navigator as any)?.standalone === true;

  return {
    isPWA: isStandalone,
    displayMode,
    isStandalone,
    isIOS,
    isAndroid,
  };
}

/**
 * Gets PWA capabilities for the current environment
 */
export function getPWACapabilities(): PWACapabilities {
  if (typeof window === 'undefined') {
    return {
      supportsOffline: false,
      supportsNotifications: false,
      supportsBackgroundSync: false,
    };
  }

  const supportsOffline = 'serviceWorker' in navigator && 'caches' in window;
  const supportsNotifications = 'Notification' in window;
  const supportsBackgroundSync = 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype;

  return {
    supportsOffline,
    supportsNotifications,
    supportsBackgroundSync,
  };
}

/**
 * Checks if the device is currently online
 */
export function isOnline(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  return navigator.onLine;
}

/**
 * Handles PWA offline scenarios
 */
export function handlePWAOffline(): {
  isOffline: boolean;
  message: string;
  canRetry: boolean;
} {
  const offline = !isOnline();
  
  if (offline) {
    return {
      isOffline: true,
      message: 'PWA 앱이 오프라인 상태입니다. OTP 요청을 위해서는 인터넷 연결이 필요합니다.',
      canRetry: true,
    };
  }

  return {
    isOffline: false,
    message: '',
    canRetry: false,
  };
}

/**
 * Optimizes PWA performance for OTP input
 */
export function optimizePWAPerformance(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Prevent zoom on iOS when focusing input fields
  const inputs = document.querySelectorAll('input[inputmode="numeric"]');
  inputs.forEach(input => {
    const element = input as HTMLInputElement;
    if (element.style.fontSize === '' || parseFloat(element.style.fontSize) < 16) {
      element.style.fontSize = '16px';
    }
  });

  // Optimize touch targets for mobile
  const otpInputs = document.querySelectorAll('[data-otp-input]');
  otpInputs.forEach(input => {
    const element = input as HTMLElement;
    element.style.minHeight = '44px';
    element.style.minWidth = '44px';
  });
}

/**
 * Handles PWA installation prompt
 */
export function handlePWAInstallPrompt(): {
  canInstall: boolean;
  showPrompt: () => Promise<boolean>;
} {
  let deferredPrompt: any = null;

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
    });
  }

  return {
    canInstall: deferredPrompt !== null,
    showPrompt: async () => {
      if (!deferredPrompt) {
        return false;
      }

      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      
      return outcome === 'accepted';
    },
  };
}

/**
 * Provides haptic feedback for PWA
 */
export function providePWAHapticFeedback(type: 'success' | 'error' | 'warning'): void {
  if (typeof window === 'undefined' || !navigator.vibrate) {
    return;
  }

  const patterns = {
    success: [100, 50, 100],
    error: [200],
    warning: [100, 100, 100],
  };

  navigator.vibrate(patterns[type]);
}

/**
 * Shows PWA notification
 */
export async function showPWANotification(
  title: string,
  options: NotificationOptions = {}
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    new Notification(title, options);
    return true;
  } else if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      new Notification(title, options);
      return true;
    }
  }

  return false;
}

/**
 * Handles PWA app backgrounding
 */
export function handlePWABackgrounding(
  onBackground: () => void,
  onForeground: () => void
): () => void {
  if (typeof document === 'undefined') {
    return () => {};
  }

  const handleVisibilityChange = () => {
    if (document.hidden) {
      onBackground();
    } else {
      onForeground();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}

/**
 * Gets PWA storage quota information
 */
export async function getPWAStorageInfo(): Promise<{
  quota: number;
  usage: number;
  available: number;
  percentage: number;
}> {
  if (typeof navigator === 'undefined' || !('storage' in navigator) || !navigator.storage.estimate) {
    return {
      quota: 0,
      usage: 0,
      available: 0,
      percentage: 0,
    };
  }

  try {
    const estimate = await navigator.storage.estimate();
    const quota = estimate.quota || 0;
    const usage = estimate.usage || 0;
    const available = quota - usage;
    const percentage = quota > 0 ? (usage / quota) * 100 : 0;

    return {
      quota,
      usage,
      available,
      percentage,
    };
  } catch (error) {
    return {
      quota: 0,
      usage: 0,
      available: 0,
      percentage: 0,
    };
  }
}