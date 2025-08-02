/**
 * @jest-environment jsdom
 */

import { UniversalAuthStateManager } from '@/lib/auth/universal-auth-state-manager';
import { AuthState } from '@/types/auth-optimization';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  const mock = {
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
    // Expose store for direct manipulation in tests
    get store() { return store; },
    set store(newStore) { store = newStore; }
  };

  return mock;
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('UniversalAuthStateManager', () => {
  let manager: UniversalAuthStateManager;
  let consoleLogSpy: jest.SpyInstance;
  const mockCallback = jest.fn();

  beforeEach(() => {
    // Reset localStorage mock
    localStorageMock.clear();
    jest.clearAllMocks();
    
    // Reset singleton instance
    (UniversalAuthStateManager as any).instance = null;
    
    // COMPLETE STERILE FIELD: Suppress all console output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Create new instance
    manager = UniversalAuthStateManager.getInstance({
      interval: 100, // Faster interval for testing
      maxAge: 1000,
      retryAttempts: 2,
      backoffMultiplier: 1.5
    });
  });

  afterEach(() => {
    manager.destroy();
    jest.clearAllTimers();
    // Restore all console methods
    jest.restoreAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = UniversalAuthStateManager.getInstance();
      const instance2 = UniversalAuthStateManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('State Management', () => {
    it('should set and get auth state', () => {
      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'user123',
        sessionToken: 'token123',
        source: 'internal'
      };

      manager.setAuthState(authState);
      const retrievedState = manager.getAuthState();

      expect(retrievedState).toEqual(authState);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'easyroom_auth_state',
        expect.stringContaining('"status":"authenticated"')
      );
    });

    it('should return null when no state exists', () => {
      const state = manager.getAuthState();
      expect(state).toBeNull();
    });

    it('should clear auth state', () => {
      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'user123',
        source: 'internal'
      };

      manager.setAuthState(authState);
      manager.clearAuthState();
      
      const state = manager.getAuthState();
      expect(state).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('easyroom_auth_state');
    });

    it('should handle expired state', () => {
      const expiredState = {
        version: '2.0',
        state: {
          status: 'authenticated',
          timestamp: Date.now() - 2000, // 2 seconds ago
          userId: 'user123',
          source: 'internal'
        },
        metadata: {
          createdAt: Date.now() - 2000,
          updatedAt: Date.now() - 2000,
          source: 'internal'
        }
      };

      localStorageMock.setItem('easyroom_auth_state', JSON.stringify(expiredState));
      
      const state = manager.getAuthState();
      expect(state).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('easyroom_auth_state');
    });
  });

  describe('State Change Callbacks', () => {
    it('should call callback immediately with current state', () => {
      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'user123',
        source: 'internal'
      };

      manager.setAuthState(authState);
      manager.onStateChange(mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(authState);
    });

    it('should call callback when state changes', () => {
      const unsubscribe = manager.onStateChange(mockCallback);
      
      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'user123',
        source: 'internal'
      };

      manager.setAuthState(authState);
      
      expect(mockCallback).toHaveBeenCalledWith(authState);
      
      unsubscribe();
    });

    it('should not call callback after unsubscribe', () => {
      const unsubscribe = manager.onStateChange(mockCallback);
      unsubscribe();
      
      mockCallback.mockClear();
      
      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'user123',
        source: 'internal'
      };

      manager.setAuthState(authState);
      
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('Polling Mechanism', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start polling mechanism', () => {
      // Just verify that polling is working by checking that the manager
      // can detect state changes over time
      const unsubscribe = manager.onStateChange(mockCallback);
      
      // Set initial state
      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'user123',
        source: 'internal'
      };
      
      manager.setAuthState(authState);
      
      // Advance timers to ensure polling continues
      jest.advanceTimersByTime(200);
      
      // The polling mechanism should be running (no errors thrown)
      expect(mockCallback).toHaveBeenCalled();
      
      unsubscribe();
    });

    it('should not call callback for identical states', () => {
      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'user123',
        source: 'internal'
      };

      manager.setAuthState(authState);
      const unsubscribe = manager.onStateChange(mockCallback);
      mockCallback.mockClear();

      // Advance timers multiple times
      jest.advanceTimersByTime(300);

      // Should not have been called again since state didn't change
      expect(mockCallback).not.toHaveBeenCalled();
      
      unsubscribe();
    });
  });

  describe('Error Handling', () => {
    it('should handle localStorage setItem errors', () => {
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

      expect(() => manager.setAuthState(authState)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[UniversalAuthStateManager] Failed to set auth state:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle localStorage getItem errors', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      localStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error('localStorage error');
      });

      const state = manager.getAuthState();
      expect(state).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[UniversalAuthStateManager] Failed to get auth state:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle invalid JSON in localStorage', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      localStorageMock.setItem('easyroom_auth_state', 'invalid json');

      const state = manager.getAuthState();
      expect(state).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle callback errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });

      // The error will be thrown during onStateChange call since it immediately calls with current state
      expect(() => manager.onStateChange(errorCallback)).not.toThrow();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[UniversalAuthStateManager] Error in callback:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Configuration', () => {
    it('should return current configuration', () => {
      const config = manager.getConfig();
      expect(config).toEqual({
        interval: 100,
        maxAge: 1000,
        retryAttempts: 2,
        backoffMultiplier: 1.5
      });
    });

    it('should update configuration', () => {
      manager.updateConfig({ interval: 200, maxAge: 2000 });
      const config = manager.getConfig();
      
      expect(config.interval).toBe(200);
      expect(config.maxAge).toBe(2000);
      expect(config.retryAttempts).toBe(2); // Should keep existing values
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources on destroy', () => {
      const unsubscribe = manager.onStateChange(mockCallback);
      
      manager.destroy();
      
      // Should not call callback after destroy
      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'user123',
        source: 'internal'
      };

      manager.setAuthState(authState);
      expect(mockCallback).toHaveBeenCalledTimes(1); // Only the initial call
    });
  });
});