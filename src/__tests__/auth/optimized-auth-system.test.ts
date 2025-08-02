/**
 * @jest-environment jsdom
 */

import { OptimizedAuthSystem, getOptimizedAuthSystem, resetOptimizedAuthSystem } from '@/lib/auth/optimized-auth-system';
import { AuthState, AuthResult } from '@/types/auth-optimization';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock window.location
const mockLocation = {
  origin: 'https://example.com',
  href: '',
  assign: jest.fn(),
  replace: jest.fn()
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
});

describe('OptimizedAuthSystem', () => {
  let authSystem: OptimizedAuthSystem;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
    mockLocation.href = '';
    resetOptimizedAuthSystem();
    
    // Suppress console logs and errors for all tests
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    authSystem = new OptimizedAuthSystem(
      { interval: 100, maxAge: 1000 },
      { baseUrl: 'https://example.com' }
    );
  });

  afterEach(() => {
    authSystem.destroy();
    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('State Management Integration', () => {
    it('should set and get auth state', () => {
      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'user123',
        sessionToken: 'token123',
        source: 'internal'
      };

      authSystem.setAuthState(authState);
      const retrievedState = authSystem.getAuthState();

      expect(retrievedState).toEqual(authState);
    });

    it('should clear auth state', () => {
      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'user123',
        source: 'internal'
      };

      authSystem.setAuthState(authState);
      authSystem.clearAuthState();
      
      const state = authSystem.getAuthState();
      expect(state).toBeNull();
    });

    it('should handle state change callbacks', () => {
      const callback = jest.fn();
      const unsubscribe = authSystem.onStateChange(callback);

      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'user123',
        source: 'internal'
      };

      authSystem.setAuthState(authState);
      expect(callback).toHaveBeenCalledWith(authState);

      unsubscribe();
    });
  });

  describe('Authentication Flow Methods', () => {
    it('should check if user is authenticated', () => {
      expect(authSystem.isAuthenticated()).toBe(false);

      authSystem.completeAuth('user123', 'token123');
      expect(authSystem.isAuthenticated()).toBe(true);
    });

    it('should check if authentication is pending', () => {
      expect(authSystem.isPending()).toBe(false);

      authSystem.setPendingAuth('user123');
      expect(authSystem.isPending()).toBe(true);
    });

    it('should get current user ID', () => {
      expect(authSystem.getCurrentUserId()).toBeNull();

      authSystem.completeAuth('user123', 'token123');
      expect(authSystem.getCurrentUserId()).toBe('user123');
    });

    it('should get current session token', () => {
      expect(authSystem.getCurrentSessionToken()).toBeNull();

      authSystem.completeAuth('user123', 'token123');
      expect(authSystem.getCurrentSessionToken()).toBe('token123');
    });

    it('should set pending authentication', () => {
      authSystem.setPendingAuth('user123');
      
      const state = authSystem.getAuthState();
      expect(state?.status).toBe('pending');
      expect(state?.userId).toBe('user123');
      expect(state?.source).toBe('internal');
    });

    it('should complete authentication', () => {
      authSystem.completeAuth('user123', 'token123', 'external_app');
      
      const state = authSystem.getAuthState();
      expect(state?.status).toBe('authenticated');
      expect(state?.userId).toBe('user123');
      expect(state?.sessionToken).toBe('token123');
      expect(state?.source).toBe('external_app');
    });

    it('should logout user', () => {
      authSystem.completeAuth('user123', 'token123');
      expect(authSystem.isAuthenticated()).toBe(true);

      authSystem.logout();
      expect(authSystem.isAuthenticated()).toBe(false);
      
      const state = authSystem.getAuthState();
      expect(state?.status).toBe('unauthenticated');
    });
  });

  describe('Redirection Integration', () => {
    it('should redirect to auth provider', () => {
      authSystem.redirectToAuth('google', 'https://example.com/return');
      
      expect(mockLocation.href).toContain('/auth/google');
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'easyroom_auth_return_url',
        'https://example.com/return'
      );
    });

    it('should build return URL', () => {
      const returnUrl = authSystem.buildReturnUrl('https://example.com');
      
      expect(returnUrl).toContain('/auth/callback/verified');
      expect(returnUrl).toContain('source=external_app');
    });

    it('should parse return URL', () => {
      const url = 'https://example.com/auth/callback/verified?success=true&user_id=123';
      const result = authSystem.parseReturnUrl(url);
      
      expect(result.success).toBe(true);
      expect(result.userId).toBe('123');
    });

    it('should handle auth return and update state', () => {
      const authResult: AuthResult = {
        success: true,
        userId: 'user123',
        sessionToken: 'token123',
        timestamp: Date.now()
      };

      authSystem.handleAuthReturn(authResult);

      // Should update state
      const state = authSystem.getAuthState();
      expect(state?.status).toBe('authenticated');
      expect(state?.userId).toBe('user123');
      expect(state?.sessionToken).toBe('token123');
      expect(state?.source).toBe('external_app');

      // Should redirect to verified page
      expect(mockLocation.href).toContain('/auth/callback/verified');
    });

    it('should handle failed auth return', () => {
      const authResult: AuthResult = {
        success: false,
        error: 'Authentication failed',
        timestamp: Date.now()
      };

      authSystem.handleAuthReturn(authResult);

      const state = authSystem.getAuthState();
      expect(state?.status).toBe('unauthenticated');
    });
  });

  describe('Storage Management', () => {
    it('should manage stored auth result', () => {
      const authResult: AuthResult = {
        success: true,
        userId: 'user123',
        timestamp: Date.now()
      };

      authSystem.handleAuthReturn(authResult);
      
      const storedResult = authSystem.getStoredAuthResult();
      expect(storedResult).toEqual(authResult);

      authSystem.clearStoredAuthResult();
      expect(authSystem.getStoredAuthResult()).toBeNull();
    });

    it('should manage stored return URL', () => {
      const returnUrl = 'https://example.com/return';
      
      authSystem.redirectToAuth('google', returnUrl);
      expect(authSystem.getStoredReturnUrl()).toBe(returnUrl);

      authSystem.clearStoredReturnUrl();
      expect(authSystem.getStoredReturnUrl()).toBeNull();
    });
  });

  describe('Configuration Management', () => {
    it('should get state manager configuration', () => {
      const config = authSystem.getStateManagerConfig();
      
      expect(config.interval).toBe(100);
      expect(config.maxAge).toBe(1000);
    });

    it('should get redirection configuration', () => {
      const config = authSystem.getRedirectionConfig();
      
      expect(config.baseUrl).toBe('https://example.com');
    });

    it('should update state manager configuration', () => {
      authSystem.updateStateManagerConfig({ interval: 200 });
      
      const config = authSystem.getStateManagerConfig();
      expect(config.interval).toBe(200);
    });

    it('should update redirection configuration', () => {
      authSystem.updateRedirectionConfig({ autoRedirectDelay: 3000 });
      
      const config = authSystem.getRedirectionConfig();
      expect(config.autoRedirectDelay).toBe(3000);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance from getOptimizedAuthSystem', () => {
      const instance1 = getOptimizedAuthSystem();
      const instance2 = getOptimizedAuthSystem();
      
      expect(instance1).toBe(instance2);
    });

    it('should reset singleton instance', () => {
      const instance1 = getOptimizedAuthSystem();
      resetOptimizedAuthSystem();
      const instance2 = getOptimizedAuthSystem();
      
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle localStorage errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('localStorage error');
      });

      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'user123',
        source: 'internal'
      };

      expect(() => authSystem.setAuthState(authState)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle redirection errors gracefully', () => {
      Object.defineProperty(window, 'location', {
        value: {
          ...mockLocation,
          set href(value) {
            throw new Error('Navigation error');
          }
        },
        writable: true
      });

      expect(() => {
        authSystem.redirectToAuth('google');
      }).toThrow('Failed to redirect to google authentication');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources on destroy', () => {
      const callback = jest.fn();
      authSystem.onStateChange(callback);
      
      authSystem.destroy();
      
      // Should not call callback after destroy
      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'user123',
        source: 'internal'
      };

      authSystem.setAuthState(authState);
      expect(callback).toHaveBeenCalledTimes(1); // Only the initial call
    });
  });
});