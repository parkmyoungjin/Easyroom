/**
 * Server-side isolation utilities
 * Prevents browser-specific code from running on server
 */

/**
 * Safe wrapper for browser-only operations
 * Returns undefined on server, executes function on client
 */
export function clientOnly<T>(fn: () => T): T | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return fn();
}

/**
 * Safe wrapper for server-only operations
 * Returns undefined on client, executes function on server
 */
export function serverOnly<T>(fn: () => T): T | undefined {
  if (typeof window !== 'undefined') {
    return undefined;
  }
  return fn();
}

/**
 * Environment detection utilities
 */
export const environment = {
  isServer: typeof window === 'undefined',
  isClient: typeof window !== 'undefined',
  isBrowser: typeof window !== 'undefined' && typeof document !== 'undefined',
  isNode: typeof process !== 'undefined' && process.versions?.node,
};

/**
 * Safe access to browser APIs with fallbacks
 */
export const safeBrowserAPIs = {
  localStorage: clientOnly(() => window.localStorage),
  sessionStorage: clientOnly(() => window.sessionStorage),
  navigator: clientOnly(() => window.navigator),
  location: clientOnly(() => window.location),
  history: clientOnly(() => window.history),
  document: clientOnly(() => window.document),
  
  // Safe methods
  getItem: (key: string) => clientOnly(() => localStorage.getItem(key)),
  setItem: (key: string, value: string) => clientOnly(() => localStorage.setItem(key, value)),
  removeItem: (key: string) => clientOnly(() => localStorage.removeItem(key)),
  
  // Navigation helpers
  getCurrentUrl: () => clientOnly(() => window.location.href),
  redirect: (url: string) => clientOnly(() => window.location.href = url),
  reload: () => clientOnly(() => window.location.reload()),
};

/**
 * Dependency isolation for third-party libraries
 */
export class DependencyIsolator {
  private static instance: DependencyIsolator;
  private isolatedDeps = new Map<string, any>();

  static getInstance(): DependencyIsolator {
    if (!DependencyIsolator.instance) {
      DependencyIsolator.instance = new DependencyIsolator();
    }
    return DependencyIsolator.instance;
  }

  /**
   * Register a dependency that should only be available on client
   */
  registerClientDependency<T>(name: string, factory: () => T): void {
    if (environment.isClient) {
      try {
        this.isolatedDeps.set(name, factory());
      } catch (error) {
        console.warn(`Failed to initialize client dependency ${name}:`, error);
      }
    }
  }

  /**
   * Get a client-only dependency safely
   */
  getClientDependency<T>(name: string): T | undefined {
    return this.isolatedDeps.get(name);
  }

  /**
   * Check if a dependency is available
   */
  hasDependency(name: string): boolean {
    return this.isolatedDeps.has(name);
  }
}

/**
 * Wrapper for third-party libraries that might cause server issues
 */
export function wrapThirdPartyLibrary<T>(
  name: string,
  factory: () => T,
  fallback?: T
): T | undefined {
  if (environment.isServer) {
    return fallback;
  }

  try {
    return factory();
  } catch (error) {
    console.warn(`Third-party library ${name} failed to load:`, error);
    return fallback;
  }
}

/**
 * Safe dynamic import for client-only modules
 */
export async function safeClientImport<T>(
  importFn: () => Promise<T>
): Promise<T | undefined> {
  if (environment.isServer) {
    return undefined;
  }

  try {
    return await importFn();
  } catch (error) {
    console.warn('Failed to import client module:', error);
    return undefined;
  }
}