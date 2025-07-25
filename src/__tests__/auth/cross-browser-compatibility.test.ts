/**
 * Cross-Browser Compatibility Tests for PWA Auth Optimization
 * Tests authentication system across different browser environments and PWA scenarios
 */

import { UniversalAuthStateManager } from '@/lib/auth/universal-auth-state-manager';
import { AuthState } from '@/types/auth-optimization';

// Mock different browser environments
const createBrowserEnvironmentMock = (browserType: 'chrome' | 'firefox' | 'safari' | 'edge' | 'mobile') => {
  const baseLocalStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  };

  switch (browserType) {
    case 'chrome':
      return {
        ...baseLocalStorage,
        // Chrome has good localStorage support
        quotaExceeded: false,
        available: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      };
    
    case 'firefox':
      return {
        ...baseLocalStorage,
        // Firefox has good localStorage support
        quotaExceeded: false,
        available: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
      };
    
    case 'safari':
      return {
        ...baseLocalStorage,
        // Safari has localStorage but with some quirks
        quotaExceeded: false,
        available: true,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
        // Safari sometimes has issues with localStorage in private mode
        privateMode: false
      };
    
    case 'edge':
      return {
        ...baseLocalStorage,
        // Edge has good localStorage support
        quotaExceeded: false,
        available: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59'
      };
    
    case 'mobile':
      return {
        ...baseLocalStorage,
        // Mobile browsers may have limited localStorage
        quotaExceeded: true, // Simulate quota issues
        available: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
      };
    
    default:
      return baseLocalStorage;
  }
};

// Mock PWA environment
const createPWAEnvironmentMock = (scenario: 'standalone' | 'browser' | 'minimal-ui' | 'fullscreen') => {
  const mockWindow = {
    navigator: {
      standalone: scenario === 'standalone', // iOS PWA
      serviceWorker: {
        ready: Promise.resolve({
          active: { state: 'activated' }
        })
      }
    },
    matchMedia: jest.fn((query: string) => ({
      matches: query === '(display-mode: standalone)' && scenario === 'standalone',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn()
    })),
    location: {
      protocol: 'https:',
      host: 'app.example.com'
    }
  };

  return mockWindow;
};

describe('Cross-Browser Compatibility Tests', () => {
  let originalLocalStorage: Storage;
  let originalWindow: any;
  let originalNavigator: any;

  beforeAll(() => {
    originalLocalStorage = global.localStorage;
    originalWindow = global.window;
    originalNavigator = global.navigator;
  });

  beforeEach(() => {
    // Reset singleton instance
    (UniversalAuthStateManager as any).instance = null;
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any running intervals
    const manager = (UniversalAuthStateManager as any).instance;
    if (manager) {
      manager.destroy();
    }
  });

  afterAll(() => {
    Object.defineProperty(global, 'localStorage', {
      value: originalLocalStorage,
      writable: true
    });
    Object.defineProperty(global, 'window', {
      value: originalWindow,
      writable: true
    });
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true
    });
  });

  describe('Browser-Specific localStorage Behavior', () => {
    it('should work correctly in Chrome environment', () => {
      const chromeMock = createBrowserEnvironmentMock('chrome');
      let store: { [key: string]: string } = {};
      
      chromeMock.getItem.mockImplementation((key: string) => store[key] || null);
      chromeMock.setItem.mockImplementation((key: string, value: string) => {
        store[key] = value;
      });
      chromeMock.removeItem.mockImplementation((key: string) => {
        delete store[key];
      });

      Object.defineProperty(global, 'localStorage', {
        value: chromeMock,
        writable: true
      });

      const manager = UniversalAuthStateManager.getInstance();
      
      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'chrome-user',
        sessionToken: 'chrome-token',
        source: 'internal'
      };

      manager.setAuthState(authState);
      expect(manager.getAuthState()).toEqual(authState);
      
      manager.clearAuthState();
      expect(manager.getAuthState()).toBeNull();

      manager.destroy();
    });

    it('should work correctly in Firefox environment', () => {
      const firefoxMock = createBrowserEnvironmentMock('firefox');
      let store: { [key: string]: string } = {};
      
      firefoxMock.getItem.mockImplementation((key: string) => store[key] || null);
      firefoxMock.setItem.mockImplementation((key: string, value: string) => {
        store[key] = value;
      });
      firefoxMock.removeItem.mockImplementation((key: string) => {
        delete store[key];
      });

      Object.defineProperty(global, 'localStorage', {
        value: firefoxMock,
        writable: true
      });

      const manager = UniversalAuthStateManager.getInstance();
      
      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'firefox-user',
        sessionToken: 'firefox-token',
        source: 'internal'
      };

      manager.setAuthState(authState);
      expect(manager.getAuthState()).toEqual(authState);

      manager.destroy();
    });

    it('should handle Safari private mode limitations', () => {
      const safariMock = createBrowserEnvironmentMock('safari');
      
      // Simulate Safari private mode where localStorage throws
      safariMock.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError: DOM Exception 22');
      });
      safariMock.getItem.mockImplementation(() => {
        throw new Error('SecurityError: DOM Exception 18');
      });

      Object.defineProperty(global, 'localStorage', {
        value: safariMock,
        writable: true
      });

      const manager = UniversalAuthStateManager.getInstance();
      
      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'safari-user',
        sessionToken: 'safari-token',
        source: 'internal'
      };

      // Should handle errors gracefully
      expect(() => manager.setAuthState(authState)).not.toThrow();
      expect(() => manager.getAuthState()).not.toThrow();
      
      // Should return null due to storage errors
      expect(manager.getAuthState()).toBeNull();

      manager.destroy();
    });

    it('should handle mobile browser quota limitations', () => {
      const mobileMock = createBrowserEnvironmentMock('mobile');
      let quotaReached = false;
      
      mobileMock.setItem.mockImplementation((key: string, value: string) => {
        if (quotaReached || value.length > 100) { // Simulate small quota
          throw new Error('QuotaExceededError');
        }
      });
      mobileMock.getItem.mockImplementation(() => null);

      Object.defineProperty(global, 'localStorage', {
        value: mobileMock,
        writable: true
      });

      const manager = UniversalAuthStateManager.getInstance();
      
      // Try to set large auth state
      const largeAuthState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'mobile-user-with-very-long-id-that-might-exceed-quota',
        sessionToken: 'mobile-token-that-is-extremely-long-and-might-cause-quota-issues-in-mobile-browsers',
        source: 'internal'
      };

      // Should handle quota exceeded gracefully
      expect(() => manager.setAuthState(largeAuthState)).not.toThrow();
      
      // Should return null due to quota issues
      expect(manager.getAuthState()).toBeNull();

      manager.destroy();
    });
  });

  describe('PWA Environment Compatibility', () => {
    it('should work in standalone PWA mode', () => {
      const pwaMock = createPWAEnvironmentMock('standalone');
      let store: { [key: string]: string } = {};
      
      const localStorageMock = {
        getItem: jest.fn((key: string) => store[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          store[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete store[key];
        }),
        clear: jest.fn(() => {
          store = {};
        })
      };

      Object.defineProperty(global, 'localStorage', {
        value: localStorageMock,
        writable: true
      });
      
      Object.defineProperty(global, 'window', {
        value: pwaMock,
        writable: true
      });

      const manager = UniversalAuthStateManager.getInstance();
      
      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'pwa-user',
        sessionToken: 'pwa-token',
        source: 'external_app'
      };

      manager.setAuthState(authState);
      expect(manager.getAuthState()).toEqual(authState);

      // Should work with callbacks in PWA mode
      const callback = jest.fn();
      const unsubscribe = manager.onStateChange(callback);
      
      expect(callback).toHaveBeenCalledWith(authState);
      
      unsubscribe();
      manager.destroy();
    });

    it('should work in browser tab mode', () => {
      const browserMock = createPWAEnvironmentMock('browser');
      let store: { [key: string]: string } = {};
      
      const localStorageMock = {
        getItem: jest.fn((key: string) => store[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          store[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete store[key];
        }),
        clear: jest.fn(() => {
          store = {};
        })
      };

      Object.defineProperty(global, 'localStorage', {
        value: localStorageMock,
        writable: true
      });
      
      Object.defineProperty(global, 'window', {
        value: browserMock,
        writable: true
      });

      const manager = UniversalAuthStateManager.getInstance();
      
      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'browser-user',
        sessionToken: 'browser-token',
        source: 'internal'
      };

      manager.setAuthState(authState);
      expect(manager.getAuthState()).toEqual(authState);

      manager.destroy();
    });

    it('should handle service worker interactions', async () => {
      const pwaMock = createPWAEnvironmentMock('standalone');
      let store: { [key: string]: string } = {};
      
      const localStorageMock = {
        getItem: jest.fn((key: string) => store[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          store[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete store[key];
        }),
        clear: jest.fn(() => {
          store = {};
        })
      };

      Object.defineProperty(global, 'localStorage', {
        value: localStorageMock,
        writable: true
      });
      
      Object.defineProperty(global, 'navigator', {
        value: pwaMock.navigator,
        writable: true
      });

      const manager = UniversalAuthStateManager.getInstance();
      
      // Simulate service worker updating auth state
      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'sw-user',
        sessionToken: 'sw-token',
        source: 'external_app'
      };

      manager.setAuthState(authState);
      
      // Simulate polling detecting the change
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(manager.getAuthState()).toEqual(authState);

      manager.destroy();
    });
  });

  describe('Cross-Tab Communication', () => {
    it('should synchronize state across multiple manager instances', async () => {
      let store: { [key: string]: string } = {};
      
      const localStorageMock = {
        getItem: jest.fn((key: string) => store[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          store[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete store[key];
        }),
        clear: jest.fn(() => {
          store = {};
        })
      };

      Object.defineProperty(global, 'localStorage', {
        value: localStorageMock,
        writable: true
      });

      // Create first manager instance (simulating first tab)
      const manager1 = UniversalAuthStateManager.getInstance({
        interval: 50 // Fast polling for testing
      });
      
      const callback1 = jest.fn();
      manager1.onStateChange(callback1);

      // Reset singleton to create second instance (simulating second tab)
      (UniversalAuthStateManager as any).instance = null;
      
      const manager2 = UniversalAuthStateManager.getInstance({
        interval: 50 // Fast polling for testing
      });
      
      const callback2 = jest.fn();
      manager2.onStateChange(callback2);

      // Set state in first manager
      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'cross-tab-user',
        sessionToken: 'cross-tab-token',
        source: 'internal'
      };

      manager1.setAuthState(authState);

      // Wait for polling to detect change in second manager
      await new Promise(resolve => setTimeout(resolve, 150));

      // Both managers should have the same state
      expect(manager1.getAuthState()).toEqual(authState);
      expect(manager2.getAuthState()).toEqual(authState);
      
      // Both callbacks should have been called
      expect(callback1).toHaveBeenCalledWith(authState);
      expect(callback2).toHaveBeenCalledWith(authState);

      manager1.destroy();
      manager2.destroy();
    });
  });

  describe('Network Connectivity Scenarios', () => {
    it('should handle offline scenarios gracefully', () => {
      let store: { [key: string]: string } = {};
      
      const localStorageMock = {
        getItem: jest.fn((key: string) => store[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          store[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete store[key];
        }),
        clear: jest.fn(() => {
          store = {};
        })
      };

      Object.defineProperty(global, 'localStorage', {
        value: localStorageMock,
        writable: true
      });

      // Mock offline navigator
      Object.defineProperty(global, 'navigator', {
        value: { onLine: false },
        writable: true
      });

      const manager = UniversalAuthStateManager.getInstance();
      
      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'offline-user',
        sessionToken: 'offline-token',
        source: 'internal'
      };

      // Should work offline (localStorage is local)
      manager.setAuthState(authState);
      expect(manager.getAuthState()).toEqual(authState);

      manager.destroy();
    });

    it('should handle slow network conditions', async () => {
      let store: { [key: string]: string } = {};
      
      // Simulate slow localStorage access
      const localStorageMock = {
        getItem: jest.fn((key: string) => {
          // Simulate network delay
          const start = Date.now();
          while (Date.now() - start < 10) {
            // Busy wait
          }
          return store[key] || null;
        }),
        setItem: jest.fn((key: string, value: string) => {
          // Simulate network delay
          const start = Date.now();
          while (Date.now() - start < 10) {
            // Busy wait
          }
          store[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete store[key];
        }),
        clear: jest.fn(() => {
          store = {};
        })
      };

      Object.defineProperty(global, 'localStorage', {
        value: localStorageMock,
        writable: true
      });

      const manager = UniversalAuthStateManager.getInstance({
        interval: 100
      });
      
      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'slow-network-user',
        sessionToken: 'slow-network-token',
        source: 'internal'
      };

      const startTime = Date.now();
      manager.setAuthState(authState);
      const endTime = Date.now();

      // Should complete despite slow access
      expect(endTime - startTime).toBeLessThan(100);
      expect(manager.getAuthState()).toEqual(authState);

      manager.destroy();
    });
  });

  describe('Device-Specific Scenarios', () => {
    it('should handle low-memory devices', () => {
      let store: { [key: string]: string } = {};
      
      const localStorageMock = {
        getItem: jest.fn((key: string) => store[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          // Simulate memory pressure by occasionally failing
          if (Math.random() < 0.1) {
            throw new Error('Out of memory');
          }
          store[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete store[key];
        }),
        clear: jest.fn(() => {
          store = {};
        })
      };

      Object.defineProperty(global, 'localStorage', {
        value: localStorageMock,
        writable: true
      });

      const manager = UniversalAuthStateManager.getInstance();
      
      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'low-memory-user',
        sessionToken: 'low-memory-token',
        source: 'internal'
      };

      // Should handle memory errors gracefully
      for (let i = 0; i < 10; i++) {
        expect(() => manager.setAuthState(authState)).not.toThrow();
      }

      manager.destroy();
    });

    it('should handle high-DPI displays', () => {
      // High-DPI displays don't affect localStorage, but test for completeness
      Object.defineProperty(global, 'devicePixelRatio', {
        value: 3,
        writable: true
      });

      let store: { [key: string]: string } = {};
      
      const localStorageMock = {
        getItem: jest.fn((key: string) => store[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          store[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete store[key];
        }),
        clear: jest.fn(() => {
          store = {};
        })
      };

      Object.defineProperty(global, 'localStorage', {
        value: localStorageMock,
        writable: true
      });

      const manager = UniversalAuthStateManager.getInstance();
      
      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'high-dpi-user',
        sessionToken: 'high-dpi-token',
        source: 'internal'
      };

      manager.setAuthState(authState);
      expect(manager.getAuthState()).toEqual(authState);

      manager.destroy();
    });
  });
});