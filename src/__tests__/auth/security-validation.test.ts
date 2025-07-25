/**
 * Security Validation Tests for PWA Auth Optimization
 * Tests localStorage state tampering protection and security measures
 */

import { UniversalAuthStateManager } from '@/lib/auth/universal-auth-state-manager';
import { AuthState, StoredAuthState } from '@/types/auth-optimization';

// Mock localStorage for controlled security testing
const createSecurityMockLocalStorage = () => {
  let store: { [key: string]: string } = {};
  let tamperDetected = false;

  return {
    getItem: jest.fn((key: string) => {
      return store[key] || null;
    }),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    // Security testing helpers
    tamperWithData: (key: string, tamperFn: (data: any) => any) => {
      const existing = store[key];
      if (existing) {
        try {
          const parsed = JSON.parse(existing);
          const tampered = tamperFn(parsed);
          store[key] = JSON.stringify(tampered);
          tamperDetected = true;
        } catch (e) {
          // Invalid JSON, replace with invalid data
          store[key] = 'invalid-json';
          tamperDetected = true;
        }
      }
    },
    injectMaliciousData: (key: string, maliciousData: any) => {
      store[key] = JSON.stringify(maliciousData);
      tamperDetected = true;
    },
    corruptData: (key: string) => {
      store[key] = 'corrupted-data-not-json';
      tamperDetected = true;
    },
    get tamperDetected() { return tamperDetected; },
    reset: () => {
      store = {};
      tamperDetected = false;
    }
  };
};

describe('Auth System Security Validation', () => {
  let mockLocalStorage: ReturnType<typeof createSecurityMockLocalStorage>;
  let originalLocalStorage: Storage;
  let consoleSpy: jest.SpyInstance;

  beforeAll(() => {
    originalLocalStorage = global.localStorage;
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  beforeEach(() => {
    mockLocalStorage = createSecurityMockLocalStorage();
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });

    // Reset singleton instance
    (UniversalAuthStateManager as any).instance = null;
    jest.clearAllMocks();
    consoleSpy.mockClear();
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
    consoleSpy.mockRestore();
  });

  describe('localStorage State Tampering Protection', () => {
    it('should handle corrupted JSON data gracefully', () => {
      const manager = UniversalAuthStateManager.getInstance();
      
      // Set valid state first
      const validState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'test-user',
        sessionToken: 'test-token',
        source: 'internal'
      };
      
      manager.setAuthState(validState);
      expect(manager.getAuthState()).toEqual(validState);
      
      // Corrupt the data
      mockLocalStorage.corruptData('easyroom_auth_state');
      
      // Should return null and log error
      const corruptedState = manager.getAuthState();
      expect(corruptedState).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[UniversalAuthStateManager] Failed to get auth state:'),
        expect.any(Error)
      );

      manager.destroy();
    });

    it('should detect and handle malicious state injection', () => {
      const manager = UniversalAuthStateManager.getInstance();
      
      // Inject malicious data with script injection attempt
      const maliciousData = {
        version: '2.0',
        state: {
          status: 'authenticated',
          timestamp: Date.now(),
          userId: '<script>alert("xss")</script>',
          sessionToken: 'javascript:alert("xss")',
          source: 'internal'
        },
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          source: 'internal'
        }
      };
      
      mockLocalStorage.injectMaliciousData('easyroom_auth_state', maliciousData);
      
      // Should still return the data (system doesn't sanitize, that's app responsibility)
      // but should not cause any execution issues
      const retrievedState = manager.getAuthState();
      expect(retrievedState).toBeTruthy();
      expect(retrievedState?.userId).toBe('<script>alert("xss")</script>');
      
      // The system should handle this data safely without executing scripts
      expect(() => {
        const callback = jest.fn();
        manager.onStateChange(callback);
        expect(callback).toHaveBeenCalledWith(retrievedState);
      }).not.toThrow();

      manager.destroy();
    });

    it('should handle timestamp manipulation attempts', () => {
      const manager = UniversalAuthStateManager.getInstance({
        maxAge: 1000 // 1 second for testing
      });
      
      // Set valid state
      const validState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'test-user',
        sessionToken: 'test-token',
        source: 'internal'
      };
      
      manager.setAuthState(validState);
      
      // Tamper with timestamp to make it appear newer
      mockLocalStorage.tamperWithData('easyroom_auth_state', (data: StoredAuthState) => {
        data.metadata.updatedAt = Date.now() + 10000; // Future timestamp
        return data;
      });
      
      // Should still work with future timestamp
      const tamperedState = manager.getAuthState();
      expect(tamperedState).toBeTruthy();
      
      // Tamper with timestamp to make it very old
      mockLocalStorage.tamperWithData('easyroom_auth_state', (data: StoredAuthState) => {
        data.metadata.updatedAt = Date.now() - 10000; // Very old timestamp
        return data;
      });
      
      // Should be expired and return null
      const expiredState = manager.getAuthState();
      expect(expiredState).toBeNull();

      manager.destroy();
    });

    it('should handle version manipulation attempts', () => {
      const manager = UniversalAuthStateManager.getInstance();
      
      // Set valid state
      const validState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'test-user',
        sessionToken: 'test-token',
        source: 'internal'
      };
      
      manager.setAuthState(validState);
      
      // Tamper with version
      mockLocalStorage.tamperWithData('easyroom_auth_state', (data: StoredAuthState) => {
        data.version = '999.0'; // Invalid version
        return data;
      });
      
      // Should still return the state (version is informational)
      const tamperedState = manager.getAuthState();
      expect(tamperedState).toBeTruthy();
      expect(tamperedState?.userId).toBe('test-user');

      manager.destroy();
    });

    it('should handle missing required fields', () => {
      const manager = UniversalAuthStateManager.getInstance();
      
      // Inject data missing required fields
      const incompleteData = {
        version: '2.0',
        state: {
          status: 'authenticated',
          // Missing timestamp, userId, sessionToken, source
        },
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          source: 'internal'
        }
      };
      
      mockLocalStorage.injectMaliciousData('easyroom_auth_state', incompleteData);
      
      // Should return the incomplete state (validation is app responsibility)
      const incompleteState = manager.getAuthState();
      expect(incompleteState).toBeTruthy();
      expect(incompleteState?.status).toBe('authenticated');
      expect(incompleteState?.timestamp).toBeUndefined();

      manager.destroy();
    });

    it('should handle state source manipulation', () => {
      const manager = UniversalAuthStateManager.getInstance();
      
      // Set valid state
      const validState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'test-user',
        sessionToken: 'test-token',
        source: 'internal'
      };
      
      manager.setAuthState(validState);
      
      // Tamper with source
      mockLocalStorage.tamperWithData('easyroom_auth_state', (data: StoredAuthState) => {
        data.state.source = 'malicious_source' as any;
        data.metadata.source = 'malicious_source' as any;
        return data;
      });
      
      // Should return the tampered state
      const tamperedState = manager.getAuthState();
      expect(tamperedState).toBeTruthy();
      expect(tamperedState?.source).toBe('malicious_source');

      manager.destroy();
    });
  });

  describe('Cross-Origin Security', () => {
    it('should isolate auth state per origin', () => {
      const manager = UniversalAuthStateManager.getInstance();
      
      // Set state
      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'test-user',
        sessionToken: 'test-token',
        source: 'internal'
      };
      
      manager.setAuthState(authState);
      
      // Simulate different origin by using different storage key
      mockLocalStorage.setItem('different_origin_auth_state', JSON.stringify({
        version: '2.0',
        state: {
          status: 'authenticated',
          timestamp: Date.now(),
          userId: 'malicious-user',
          sessionToken: 'malicious-token',
          source: 'external_app'
        },
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          source: 'external_app'
        }
      }));
      
      // Should only return our origin's state
      const retrievedState = manager.getAuthState();
      expect(retrievedState?.userId).toBe('test-user');
      expect(retrievedState?.sessionToken).toBe('test-token');

      manager.destroy();
    });
  });

  describe('Token Security', () => {
    it('should handle token extraction attempts', () => {
      const manager = UniversalAuthStateManager.getInstance();
      
      // Set state with sensitive token
      const sensitiveState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'test-user',
        sessionToken: 'super-secret-jwt-token-12345',
        source: 'internal'
      };
      
      manager.setAuthState(sensitiveState);
      
      // Verify token is stored (this is expected behavior)
      const retrievedState = manager.getAuthState();
      expect(retrievedState?.sessionToken).toBe('super-secret-jwt-token-12345');
      
      // Verify token is cleared when auth state is cleared
      manager.clearAuthState();
      const clearedState = manager.getAuthState();
      expect(clearedState).toBeNull();
      
      // Verify token is not accessible after clearing
      const rawStorage = mockLocalStorage.getItem('easyroom_auth_state');
      expect(rawStorage).toBeNull();

      manager.destroy();
    });

    it('should handle token tampering attempts', () => {
      const manager = UniversalAuthStateManager.getInstance();
      
      // Set valid state
      const validState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'test-user',
        sessionToken: 'valid-token-12345',
        source: 'internal'
      };
      
      manager.setAuthState(validState);
      
      // Tamper with token
      mockLocalStorage.tamperWithData('easyroom_auth_state', (data: StoredAuthState) => {
        data.state.sessionToken = 'tampered-token-67890';
        return data;
      });
      
      // Should return tampered token (validation is app responsibility)
      const tamperedState = manager.getAuthState();
      expect(tamperedState?.sessionToken).toBe('tampered-token-67890');
      
      // App should validate token elsewhere, not in state manager
      expect(tamperedState?.userId).toBe('test-user');

      manager.destroy();
    });
  });

  describe('Callback Security', () => {
    it('should handle malicious callbacks safely', () => {
      const manager = UniversalAuthStateManager.getInstance();
      
      // Register malicious callback that throws
      const maliciousCallback = jest.fn(() => {
        throw new Error('Malicious callback error');
      });
      
      const normalCallback = jest.fn();
      
      manager.onStateChange(maliciousCallback);
      manager.onStateChange(normalCallback);
      
      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'test-user',
        sessionToken: 'test-token',
        source: 'internal'
      };
      
      // Should not throw despite malicious callback
      expect(() => manager.setAuthState(authState)).not.toThrow();
      
      // Normal callback should still be called
      expect(normalCallback).toHaveBeenCalledWith(authState);
      expect(maliciousCallback).toHaveBeenCalledWith(authState);
      
      // Error should be logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[UniversalAuthStateManager] Error in callback:'),
        expect.any(Error)
      );

      manager.destroy();
    });

    it('should prevent callback injection through state changes', () => {
      const manager = UniversalAuthStateManager.getInstance();
      
      let callbackExecuted = false;
      const normalCallback = jest.fn(() => {
        callbackExecuted = true;
      });
      
      manager.onStateChange(normalCallback);
      
      // Try to inject callback through state data
      const maliciousState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'test-user',
        sessionToken: 'test-token',
        source: 'internal',
        maliciousCallback: () => {
          // This should never execute
          throw new Error('Callback injection successful');
        }
      } as any;
      
      // Should not execute injected callback
      expect(() => manager.setAuthState(maliciousState)).not.toThrow();
      expect(callbackExecuted).toBe(true); // Normal callback should execute
      
      // Malicious callback should not be stored or executed
      const retrievedState = manager.getAuthState();
      expect(retrievedState).not.toHaveProperty('maliciousCallback');

      manager.destroy();
    });
  });

  describe('Memory Security', () => {
    it('should clear sensitive data from memory on destroy', () => {
      const manager = UniversalAuthStateManager.getInstance();
      
      const sensitiveState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'sensitive-user',
        sessionToken: 'sensitive-token-12345',
        source: 'internal'
      };
      
      manager.setAuthState(sensitiveState);
      
      // Verify state is accessible
      expect(manager.getAuthState()).toEqual(sensitiveState);
      
      // Destroy manager
      manager.destroy();
      
      // Verify internal state is cleared (check private properties)
      const managerInternal = manager as any;
      expect(managerInternal.lastKnownState).toBeNull();
      expect(managerInternal.callbacks.size).toBe(0);
      expect(managerInternal.pollingInterval).toBeNull();

      // Note: localStorage is not cleared by destroy() - that's intentional
      // Apps should call clearAuthState() before destroy() if needed
    });

    it('should handle memory pressure gracefully', () => {
      const manager = UniversalAuthStateManager.getInstance();
      
      // Simulate memory pressure by creating many callbacks
      const callbacks: jest.Mock[] = [];
      const unsubscribeFunctions: (() => void)[] = [];
      
      // Create 1000 callbacks to simulate memory pressure
      for (let i = 0; i < 1000; i++) {
        const callback = jest.fn();
        callbacks.push(callback);
        const unsubscribe = manager.onStateChange(callback);
        unsubscribeFunctions.push(unsubscribe);
      }
      
      const authState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'test-user',
        sessionToken: 'test-token',
        source: 'internal'
      };
      
      // Should handle many callbacks without issues
      expect(() => manager.setAuthState(authState)).not.toThrow();
      
      // All callbacks should be called
      callbacks.forEach(callback => {
        expect(callback).toHaveBeenCalledWith(authState);
      });
      
      // Should handle mass unsubscribe
      expect(() => {
        unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
      }).not.toThrow();

      manager.destroy();
    });
  });
});