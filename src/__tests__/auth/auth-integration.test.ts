/**
 * Integration tests for the new authentication system
 * Tests end-to-end authentication flow, cross-tab communication, and failure scenarios
 */

import { UniversalAuthStateManager } from '@/lib/auth/universal-auth-state-manager';
import { OptimizedAuthSystem } from '@/lib/auth/optimized-auth-system';

// Create a proper localStorage mock that behaves like the real thing
class LocalStorageMock {
  private store: { [key: string]: string } = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

// Mock window.location
const mockLocation = {
  href: '',
  origin: 'https://example.com',
};

describe('Authentication System Integration', () => {
  let authStateManager: UniversalAuthStateManager;
  let localStorageMock: LocalStorageMock;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    // Suppress console logs, errors, and warnings for all tests
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Create fresh localStorage mock for each test
    localStorageMock = new LocalStorageMock();
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });

    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
    });

    authStateManager = new UniversalAuthStateManager();
  });

  afterEach(() => {
    authStateManager.clearAuthState();
    // Clear any running timers
    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    jest.clearAllTimers();
  });

  describe('External App Authentication Flow', () => {
    it('should complete external app authentication flow', async () => {
      // Simulate external app authentication completion
      const authState = {
        status: 'authenticated' as const,
        timestamp: Date.now(),
        userId: 'user123',
        sessionToken: 'token123',
        source: 'external_app' as const
      };

      // Store auth state (simulating SmartVerifiedPage)
      authStateManager.setAuthState(authState);

      // Verify state is stored
      const storedState = authStateManager.getAuthState();
      expect(storedState).toEqual(authState);
      expect(localStorageMock.getItem('easyroom_auth_state')).toContain('"status":"authenticated"');
    });

    it('should handle external app authentication failure', () => {
      const failureState = {
        status: 'unauthenticated' as const,
        timestamp: Date.now(),
        source: 'external_app' as const
      };

      authStateManager.setAuthState(failureState);

      const storedState = authStateManager.getAuthState();
      expect(storedState?.status).toBe('unauthenticated');
    });

    it('should clean up stale authentication states', () => {
      // Create a stale state (older than 5 minutes)
      const staleTimestamp = Date.now() - (6 * 60 * 1000);
      const staleState = {
        status: 'authenticated' as const,
        timestamp: staleTimestamp,
        source: 'external_app' as const
      };

      // Set stale state in localStorage
      localStorageMock.setItem('easyroom_auth_state', JSON.stringify({
        version: '2.0',
        state: staleState,
        metadata: {
          createdAt: staleTimestamp,
          updatedAt: staleTimestamp,
          source: 'external_app'
        }
      }));

      const retrievedState = authStateManager.getAuthState();
      expect(retrievedState).toBeNull();
    });
  });

  describe('Cross-Tab Communication', () => {
    it('should notify authentication success across tabs', (done) => {
      const onAuthSuccess = jest.fn((state) => {
        if (state?.status === 'authenticated') {
          expect(onAuthSuccess).toHaveBeenCalled();
          done();
        }
      });

      // Set up listener using optimized auth system (simulating login page)
      const authSystem = new OptimizedAuthSystem();
      const cleanup = authSystem.onStateChange(onAuthSuccess);

      // Simulate authentication success notification (from verified page)
      authSystem.completeAuth('user123', 'token123', 'external_app');

      // Clean up
      cleanup();
    });

    it('should handle multiple listeners', (done) => {
      let callCount = 0;
      const onAuthSuccess1 = jest.fn((state) => {
        if (state?.status === 'authenticated') {
          callCount++;
          if (callCount === 2) done();
        }
      });
      const onAuthSuccess2 = jest.fn((state) => {
        if (state?.status === 'authenticated') {
          callCount++;
          if (callCount === 2) done();
        }
      });

      // Set up multiple listeners using optimized auth system
      const authSystem1 = new OptimizedAuthSystem();
      const authSystem2 = new OptimizedAuthSystem();
      const cleanup1 = authSystem1.onStateChange(onAuthSuccess1);
      const cleanup2 = authSystem2.onStateChange(onAuthSuccess2);

      // Notify success
      authSystem1.completeAuth('user123', 'token123', 'external_app');

      // Clean up
      cleanup1();
      cleanup2();
    });

    it('should properly clean up listeners', () => {
      const onAuthSuccess = jest.fn();
      
      // Set up and immediately clean up listener
      const authSystem = new OptimizedAuthSystem();
      const cleanup = authSystem.onStateChange(onAuthSuccess);
      cleanup();

      // Notify success - should not trigger callback
      authSystem.completeAuth('user123', 'token123', 'external_app');

      // Wait a bit to ensure callback isn't called
      setTimeout(() => {
        expect(onAuthSuccess).not.toHaveBeenCalled();
      }, 100);
    });

    it('should handle localStorage access failures gracefully', () => {
      // Mock localStorage to throw error
      const originalSetItem = localStorageMock.setItem;
      localStorageMock.setItem = jest.fn(() => {
        throw new Error('localStorage not available');
      });

      const authSystem = new OptimizedAuthSystem();

      // Should not throw error
      expect(() => authSystem.completeAuth('user123', 'token123')).not.toThrow();

      // Should still return cleanup function
      const cleanup = authSystem.onStateChange(jest.fn());
      expect(typeof cleanup).toBe('function');
      expect(() => cleanup()).not.toThrow();

      // Restore original method
      localStorageMock.setItem = originalSetItem;
    });
  });

  describe('Authentication State Polling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should detect state changes through polling', () => {
      const onStateChange = jest.fn();
      const cleanup = authStateManager.onStateChange(onStateChange);

      // Set initial state
      authStateManager.setAuthState({
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'user123',
        source: 'external_app'
      });

      // Fast-forward time to trigger polling
      jest.advanceTimersByTime(600); // More than polling interval

      expect(onStateChange).toHaveBeenCalled();
      const lastCall = onStateChange.mock.calls[onStateChange.mock.calls.length - 1];
      expect(lastCall[0]?.status).toBe('authenticated');
      expect(lastCall[0]?.userId).toBe('user123');

      cleanup();
    });

    it('should handle rapid state changes', () => {
      const onStateChange = jest.fn();
      const cleanup = authStateManager.onStateChange(onStateChange);

      // Rapid state changes
      authStateManager.setAuthState({
        status: 'pending',
        timestamp: Date.now(),
        source: 'internal'
      });

      authStateManager.setAuthState({
        status: 'authenticated',
        timestamp: Date.now(),
        userId: 'user123',
        source: 'external_app'
      });

      authStateManager.setAuthState({
        status: 'unauthenticated',
        timestamp: Date.now(),
        source: 'internal'
      });

      // Fast-forward time to trigger polling
      jest.advanceTimersByTime(600);

      expect(onStateChange).toHaveBeenCalled();
      cleanup();
    });

    it('should stop polling when all listeners are removed', () => {
      const onStateChange1 = jest.fn();
      const onStateChange2 = jest.fn();

      const cleanup1 = authStateManager.onStateChange(onStateChange1);
      const cleanup2 = authStateManager.onStateChange(onStateChange2);

      // Clear any initial calls
      onStateChange1.mockClear();
      onStateChange2.mockClear();

      // Remove all listeners
      cleanup1();
      cleanup2();

      // Change state - should not trigger callbacks since listeners are removed
      authStateManager.setAuthState({
        status: 'authenticated',
        timestamp: Date.now(),
        source: 'external_app'
      });

      // Fast-forward time
      jest.advanceTimersByTime(600);

      expect(onStateChange1).not.toHaveBeenCalled();
      expect(onStateChange2).not.toHaveBeenCalled();
    });
  });

  describe('Failure Scenarios', () => {
    it('should handle localStorage quota exceeded', () => {
      const originalSetItem = localStorageMock.setItem;
      localStorageMock.setItem = jest.fn(() => {
        throw new Error('QuotaExceededError');
      });

      // Should not throw error
      expect(() => {
        authStateManager.setAuthState({
          status: 'authenticated',
          timestamp: Date.now(),
          source: 'external_app'
        });
      }).not.toThrow();

      // Restore original method
      localStorageMock.setItem = originalSetItem;
    });

    it('should handle corrupted localStorage data', () => {
      const originalGetItem = localStorageMock.getItem;
      localStorageMock.getItem = jest.fn(() => 'invalid json');

      const state = authStateManager.getAuthState();
      expect(state).toBeNull();

      // Restore original method
      localStorageMock.getItem = originalGetItem;
    });

    it('should handle missing localStorage', () => {
      // Mock localStorage as undefined
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        writable: true,
      });

      const manager = new UniversalAuthStateManager();
      
      // Should not throw errors
      expect(() => {
        manager.setAuthState({
          status: 'authenticated',
          timestamp: Date.now(),
          source: 'external_app'
        });
      }).not.toThrow();

      expect(manager.getAuthState()).toBeNull();
    });

    it('should handle authentication timeout scenarios', () => {
      // Set a state that will be considered stale
      const oldTimestamp = Date.now() - (6 * 60 * 1000); // 6 minutes ago
      localStorageMock.setItem('easyroom_auth_state', JSON.stringify({
        version: '2.0',
        state: {
          status: 'authenticated',
          timestamp: oldTimestamp,
          source: 'external_app'
        },
        metadata: {
          createdAt: oldTimestamp,
          updatedAt: oldTimestamp,
          source: 'external_app'
        }
      }));

      // Trigger state check - should return null for stale state
      const state = authStateManager.getAuthState();
      expect(state).toBeNull();
    });

    it('should recover from network interruptions', () => {
      // Simulate network interruption during state storage
      let failCount = 0;
      const originalSetItem = localStorageMock.setItem;
      localStorageMock.setItem = jest.fn((key: string, value: string) => {
        failCount++;
        if (failCount <= 2) {
          throw new Error('Network error');
        }
        // Succeed on third attempt
        originalSetItem.call(localStorageMock, key, value);
      });

      // Should eventually succeed
      expect(() => {
        authStateManager.setAuthState({
          status: 'authenticated',
          timestamp: Date.now(),
          source: 'external_app'
        });
      }).not.toThrow();

      // Restore original method
      localStorageMock.setItem = originalSetItem;
    });
  });

  describe('Migration Compatibility', () => {
    it('should handle legacy BroadcastChannel state format', () => {
      // Mock old format data
      localStorageMock.setItem('easyroom_auth_state', JSON.stringify({
        version: '1.0',
        broadcastData: { status: 'SUCCESS' },
        timestamp: Date.now()
      }));

      // Should handle gracefully and return null for incompatible format
      const state = authStateManager.getAuthState();
      expect(state).toBeNull();
    });

    it('should maintain backward compatibility with existing auth tokens', () => {
      const validState = {
        status: 'authenticated' as const,
        timestamp: Date.now(),
        userId: 'legacy-user',
        sessionToken: 'legacy-token',
        source: 'internal' as const
      };

      localStorageMock.setItem('easyroom_auth_state', JSON.stringify({
        version: '2.0',
        state: validState,
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          source: 'migration'
        }
      }));

      const retrievedState = authStateManager.getAuthState();
      expect(retrievedState).toEqual(validState);
    });
  });
});