/**
 * Third-party library wrapper utilities
 * Provides safe wrappers for libraries that might cause server-side issues
 */

import { wrapThirdPartyLibrary, environment } from '@/lib/polyfills/server-isolation';
import { getClientDependency } from '@/lib/polyfills/client-polyfills';

/**
 * Safe wrapper for react-use hooks that might access browser APIs
 */
export function safeUseLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T) => void] {
  if (!environment.isBrowser) {
    return [initialValue, () => {}];
  }

  const localStorage = getClientDependency<Storage>('localStorage');
  if (!localStorage) {
    return [initialValue, () => {}];
  }

  try {
    const item = localStorage.getItem(key);
    const value = item ? JSON.parse(item) : initialValue;
    
    const setValue = (newValue: T) => {
      try {
        localStorage.setItem(key, JSON.stringify(newValue));
      } catch (error) {
        console.warn(`Failed to save to localStorage:`, error);
      }
    };

    return [value, setValue];
  } catch (error) {
    console.warn(`Failed to read from localStorage:`, error);
    return [initialValue, () => {}];
  }
}

/**
 * Safe wrapper for framer-motion that handles server-side rendering
 */
export function safeFramerMotion() {
  return wrapThirdPartyLibrary(
    'framer-motion',
    () => require('framer-motion'),
    {
      motion: {
        div: 'div',
        span: 'span',
        button: 'button',
        // Add other common motion components as needed
      },
      AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    }
  );
}

/**
 * Safe wrapper for date-fns-tz that might have timezone issues
 */
export function safeDateFnsTz() {
  return wrapThirdPartyLibrary(
    'date-fns-tz',
    () => require('date-fns-tz'),
    {
      format: (date: Date, formatStr: string) => date.toISOString(),
      zonedTimeToUtc: (date: Date) => date,
      utcToZonedTime: (date: Date) => date,
    }
  );
}

/**
 * Safe wrapper for axios with proper error handling
 */
export function safeAxios() {
  return wrapThirdPartyLibrary(
    'axios',
    () => {
      const axios = require('axios');
      
      // Add request interceptor for better error handling
      axios.interceptors.request.use(
        (config: any) => {
          // Ensure we don't send browser-specific headers on server
          if (environment.isServer) {
            delete config.headers['User-Agent'];
            delete config.headers['Referer'];
          }
          return config;
        },
        (error: any) => Promise.reject(error)
      );

      // Add response interceptor for consistent error handling
      axios.interceptors.response.use(
        (response: any) => response,
        (error: any) => {
          if (error.code === 'ECONNABORTED') {
            console.warn('Request timeout:', error.config?.url);
          }
          return Promise.reject(error);
        }
      );

      return axios;
    }
  );
}

/**
 * Safe wrapper for zustand that handles SSR properly
 */
export function createSafeZustandStore<T>(
  createStore: () => T,
  serverFallback?: Partial<T>
): T | Partial<T> {
  if (environment.isServer && serverFallback) {
    return serverFallback;
  }

  return wrapThirdPartyLibrary(
    'zustand-store',
    createStore,
    serverFallback || ({} as T)
  ) || ({} as T);
}

/**
 * Safe wrapper for react-query that handles server-side properly
 */
export function safeReactQuery() {
  return wrapThirdPartyLibrary(
    'react-query',
    () => require('@tanstack/react-query'),
    {
      QueryClient: class MockQueryClient {
        getQueryData() { return undefined; }
        setQueryData() {}
        invalidateQueries() {}
      },
      useQuery: () => ({ data: undefined, isLoading: false, error: null }),
      useMutation: () => ({ mutate: () => {}, isLoading: false }),
    }
  );
}

/**
 * Safe wrapper for browser-specific utilities
 */
export const safeBrowserUtils = {
  /**
   * Safe clipboard access
   */
  copyToClipboard: async (text: string): Promise<boolean> => {
    if (!environment.isBrowser) {
      return false;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const result = document.execCommand('copy');
        textArea.remove();
        return result;
      }
    } catch (error) {
      console.warn('Failed to copy to clipboard:', error);
      return false;
    }
  },

  /**
   * Safe file download
   */
  downloadFile: (data: string, filename: string, type: string = 'text/plain') => {
    if (!environment.isBrowser) {
      return;
    }

    try {
      const blob = new Blob([data], { type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn('Failed to download file:', error);
    }
  },

  /**
   * Safe notification API
   */
  showNotification: async (title: string, options?: NotificationOptions): Promise<boolean> => {
    if (!environment.isBrowser || !('Notification' in window)) {
      return false;
    }

    try {
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
    } catch (error) {
      console.warn('Failed to show notification:', error);
      return false;
    }
  },
};

/**
 * Safe wrapper for dynamic imports that might fail
 */
export async function safeDynamicImport<T>(
  importFn: () => Promise<{ default: T } | T>,
  fallback?: T
): Promise<T | undefined> {
  if (environment.isServer && fallback) {
    return fallback;
  }

  try {
    const module = await importFn();
    return (module && typeof module === 'object' && 'default' in module) ? module.default : module;
  } catch (error) {
    console.warn('Failed to dynamically import module:', error);
    return fallback;
  }
}