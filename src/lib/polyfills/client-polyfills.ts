/**
 * Client-side polyfill management
 * Ensures browser-specific globals are only available in client environment
 */

import { DependencyIsolator, environment } from './server-isolation';

// Type definitions for browser globals
declare global {
  interface Window {
    __POLYFILLS_INITIALIZED__?: boolean;
  }
}

/**
 * Initialize client-side polyfills
 * Only runs in browser environment
 */
export function initializeClientPolyfills(): void {
  // Only run in browser environment
  if (!environment.isBrowser) {
    return;
  }

  // Prevent multiple initializations
  if (window.__POLYFILLS_INITIALIZED__) {
    return;
  }

  try {
    // Ensure self is properly defined in browser
    if (typeof self === 'undefined') {
      (window as any).self = window;
    }

    // Ensure globalThis compatibility
    if (typeof globalThis === 'undefined') {
      (window as any).globalThis = window;
    }

    // Initialize third-party library dependencies safely
    initializeThirdPartyDependencies();

    // Mark as initialized
    window.__POLYFILLS_INITIALIZED__ = true;
    
    console.log('Client polyfills initialized successfully');
  } catch (error) {
    console.warn('Failed to initialize client polyfills:', error);
  }
}

/**
 * Initialize third-party dependencies that might cause server issues
 */
function initializeThirdPartyDependencies(): void {
  const isolator = DependencyIsolator.getInstance();

  // Register client-only dependencies
  isolator.registerClientDependency('localStorage', () => window.localStorage);
  isolator.registerClientDependency('sessionStorage', () => window.sessionStorage);
  isolator.registerClientDependency('indexedDB', () => window.indexedDB);
  isolator.registerClientDependency('crypto', () => window.crypto);
  isolator.registerClientDependency('fetch', () => window.fetch);
  
  // Register service worker if supported
  if ('serviceWorker' in navigator) {
    isolator.registerClientDependency('serviceWorker', () => navigator.serviceWorker);
  }

  // Register notification API if supported
  if ('Notification' in window) {
    isolator.registerClientDependency('Notification', () => window.Notification);
  }

  // Register geolocation if supported
  if (navigator.geolocation) {
    isolator.registerClientDependency('geolocation', () => navigator.geolocation);
  }
}

/**
 * Check if we're in a browser environment
 */
export function isBrowser(): boolean {
  return environment.isBrowser;
}

/**
 * Safe access to browser globals
 */
export const browserGlobals = {
  get self() {
    return isBrowser() ? self : undefined;
  },
  
  get window() {
    return isBrowser() ? window : undefined;
  },
  
  get document() {
    return isBrowser() ? document : undefined;
  },
  
  get navigator() {
    return isBrowser() ? navigator : undefined;
  },

  get localStorage() {
    return isBrowser() ? window.localStorage : undefined;
  },

  get sessionStorage() {
    return isBrowser() ? window.sessionStorage : undefined;
  },

  get location() {
    return isBrowser() ? window.location : undefined;
  },

  get history() {
    return isBrowser() ? window.history : undefined;
  }
};

/**
 * Execute function only in browser environment
 */
export function runInBrowser<T>(fn: () => T): T | undefined {
  if (isBrowser()) {
    try {
      return fn();
    } catch (error) {
      console.warn('Error executing browser function:', error);
      return undefined;
    }
  }
  return undefined;
}

/**
 * Safe wrapper for third-party library initialization
 */
export function initializeThirdPartyLibrary<T>(
  name: string,
  factory: () => T,
  fallback?: T
): T | undefined {
  if (!isBrowser()) {
    return fallback;
  }

  try {
    const result = factory();
    console.log(`Third-party library ${name} initialized successfully`);
    return result;
  } catch (error) {
    console.warn(`Failed to initialize third-party library ${name}:`, error);
    return fallback;
  }
}

/**
 * Get a safely initialized third-party dependency
 */
export function getClientDependency<T>(name: string): T | undefined {
  const isolator = DependencyIsolator.getInstance();
  return isolator.getClientDependency<T>(name);
}