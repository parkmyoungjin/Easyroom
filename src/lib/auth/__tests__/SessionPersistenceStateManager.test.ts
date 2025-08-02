/**
 * Unit tests for SessionPersistenceStateManager
 */

import { SessionPersistenceStateManager } from '../SessionPersistenceStateManager';
import {
  SessionPersistenceErrorType,
  SessionSyncError,
  MiddlewareTestResult
} from '../SessionPersistenceState';

// Mock localStorage
const mockLocalStorage = {
  store: {} as Record<string, string>,
  getItem: jest.fn((key: string) => mockLocalStorage.store[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    mockLocalStorage.store[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete mockLocalStorage.store[key];
  }),
  clear: jest.fn(() => {
    mockLocalStorage.store = {};
  })
};

// Mock window and localStorage
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

describe('SessionPersistenceStateManager', () => {
  let stateManager: SessionPersistenceStateManager;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    mockLocalStorage.clear();
    jest.clearAllMocks();
    // Suppress console.warn for all tests
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    stateManager = new SessionPersistenceStateManager();
  });

  afterEach(() => {
    // Restore console.warn
    consoleWarnSpy.mockRestore();
  });

  describe('Initialization', () => {
    it('should create initial state when no stored state exists', () => {
      const state = stateManager.getState();
      
      expect(state.sessionId).toBeNull();
      expect(state.persistenceStatus).toBe('invalid');
      expect(state.cookieStatus).toBe('missing');
      expect(state.middlewareCompatible).toBe(false);
      expect(state.syncErrors).toEqual([]);
      expect(state.recoveryAttempts).toBe(0);
    });

    it('should load state from localStorage when available', () => {
      const storedState = {
        sessionId: 'test-session-id',
        persistenceStatus: 'active',
        lastSyncTime: new Date().toISOString(),
        cookieStatus: 'valid',
        cookieGenerationAttempts: 2,
        lastCookieValidation: new Date().toISOString(),
        middlewareCompatible: true,
        lastMiddlewareTest: new Date().toISOString(),
        middlewareTestResults: [],
        syncErrors: [],
        recoveryAttempts: 1,
        lastRecoveryTime: new Date().toISOString(),
        performanceMetrics: {
          cookieGenerationTime: [],
          cookieValidationTime: [],
          middlewareTestTime: [],
          cookieGenerationSuccessRate: 0,
          middlewareCompatibilityRate: 0,
          sessionSyncSuccessRate: 0,
          totalSyncAttempts: 0,
          successfulSyncs: 0,
          failedSyncs: 0,
          averageResponseTime: 0,
          maxResponseTime: 0,
          minResponseTime: 0,
          lastUpdated: new Date().toISOString()
        }
      };

      mockLocalStorage.store['session_persistence_state'] = JSON.stringify(storedState);
      
      const newStateManager = new SessionPersistenceStateManager();
      const state = newStateManager.getState();
      
      expect(state.sessionId).toBe('test-session-id');
      expect(state.persistenceStatus).toBe('active');
      expect(state.cookieStatus).toBe('valid');
      expect(state.middlewareCompatible).toBe(true);
      expect(state.recoveryAttempts).toBe(1);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      mockLocalStorage.store['session_persistence_state'] = 'invalid-json';
      
      const newStateManager = new SessionPersistenceStateManager();
      const state = newStateManager.getState();
      
      // Should fall back to initial state
      expect(state.sessionId).toBeNull();
      expect(state.persistenceStatus).toBe('invalid');
    });
  });

  describe('Session Management', () => {
    it('should update session information correctly', () => {
      stateManager.updateSession('new-session-id', 'active');
      
      const state = stateManager.getState();
      expect(state.sessionId).toBe('new-session-id');
      expect(state.persistenceStatus).toBe('active');
      expect(state.lastSyncTime).toBeInstanceOf(Date);
    });

    it('should persist state to localStorage when session is updated', () => {
      stateManager.updateSession('test-session', 'syncing');
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'session_persistence_state',
        expect.stringContaining('test-session')
      );
    });
  });

  describe('Cookie Status Management', () => {
    it('should update cookie status without incrementing attempts', () => {
      stateManager.updateCookieStatus('valid', false);
      
      const state = stateManager.getState();
      expect(state.cookieStatus).toBe('valid');
      expect(state.cookieGenerationAttempts).toBe(0);
      expect(state.lastCookieValidation).toBeInstanceOf(Date);
    });

    it('should increment cookie generation attempts when specified', () => {
      stateManager.updateCookieStatus('invalid', true);
      stateManager.updateCookieStatus('corrupted', true);
      
      const state = stateManager.getState();
      expect(state.cookieGenerationAttempts).toBe(2);
    });
  });

  describe('Middleware Compatibility Management', () => {
    it('should update middleware compatibility status', () => {
      stateManager.updateMiddlewareCompatibility(true);
      
      const state = stateManager.getState();
      expect(state.middlewareCompatible).toBe(true);
      expect(state.lastMiddlewareTest).toBeInstanceOf(Date);
    });

    it('should add middleware test results', () => {
      const testResult: MiddlewareTestResult = {
        timestamp: new Date(),
        success: true,
        responseTime: 150,
        cookieFormat: 'valid-jwt'
      };

      stateManager.addMiddlewareTestResult(testResult);
      
      const state = stateManager.getState();
      expect(state.middlewareTestResults).toHaveLength(1);
      expect(state.middlewareTestResults[0]).toEqual(testResult);
    });

    it('should limit middleware test results to 10 entries', () => {
      // Add 15 test results
      for (let i = 0; i < 15; i++) {
        const testResult: MiddlewareTestResult = {
          timestamp: new Date(),
          success: i % 2 === 0,
          responseTime: 100 + i,
          cookieFormat: `format-${i}`
        };
        stateManager.addMiddlewareTestResult(testResult);
      }
      
      const state = stateManager.getState();
      expect(state.middlewareTestResults).toHaveLength(10);
      // Should keep the last 10 results
      expect(state.middlewareTestResults[0].cookieFormat).toBe('format-5');
      expect(state.middlewareTestResults[9].cookieFormat).toBe('format-14');
    });
  });

  describe('Error Tracking', () => {
    it('should add sync errors with timestamps', () => {
      const syncError: SessionSyncError = {
        type: 'cookie_generation',
        message: 'Failed to generate cookie',
        recoverable: true,
        timestamp: new Date()
      };

      stateManager.addSyncError(syncError);
      
      const state = stateManager.getState();
      expect(state.syncErrors).toHaveLength(1);
      expect(state.syncErrors[0].type).toBe('cookie_generation');
      expect(state.syncErrors[0].timestamp).toBeInstanceOf(Date);
    });

    it('should limit sync errors to 5 entries', () => {
      // Add 8 sync errors
      for (let i = 0; i < 8; i++) {
        const syncError: SessionSyncError = {
          type: 'session_validation',
          message: `Error ${i}`,
          recoverable: true,
          timestamp: new Date()
        };
        stateManager.addSyncError(syncError);
      }
      
      const state = stateManager.getState();
      expect(state.syncErrors).toHaveLength(5);
      // Should keep the last 5 errors
      expect(state.syncErrors[0].message).toBe('Error 3');
      expect(state.syncErrors[4].message).toBe('Error 7');
    });
  });

  describe('Recovery Management', () => {
    it('should record recovery attempts', () => {
      stateManager.recordRecoveryAttempt();
      stateManager.recordRecoveryAttempt();
      
      const state = stateManager.getState();
      expect(state.recoveryAttempts).toBe(2);
      expect(state.lastRecoveryTime).toBeInstanceOf(Date);
    });

    it('should provide retry recommendation for low recovery attempts', () => {
      const recommendation = stateManager.getRecoveryRecommendation();
      
      expect(recommendation.action).toBe('retry');
      expect(recommendation.priority).toBe('low');
    });

    it('should recommend reauth when max recovery attempts exceeded', () => {
      // Simulate max recovery attempts
      for (let i = 0; i < 5; i++) {
        stateManager.recordRecoveryAttempt();
      }
      
      const recommendation = stateManager.getRecoveryRecommendation();
      
      expect(recommendation.action).toBe('reauth');
      expect(recommendation.priority).toBe('critical');
    });

    it('should recommend clear for persistent middleware failures', () => {
      stateManager.updateMiddlewareCompatibility(false);
      
      // Add multiple sync errors
      stateManager.addSyncError({
        type: 'middleware_compatibility',
        message: 'Middleware test failed',
        recoverable: false,
        timestamp: new Date()
      });
      stateManager.addSyncError({
        type: 'middleware_compatibility',
        message: 'Another middleware failure',
        recoverable: false,
        timestamp: new Date()
      });
      
      const recommendation = stateManager.getRecoveryRecommendation();
      
      expect(recommendation.action).toBe('clear');
      expect(recommendation.priority).toBe('high');
    });

    it('should recommend regenerate for cookie corruption', () => {
      stateManager.updateCookieStatus('corrupted');
      
      const recommendation = stateManager.getRecoveryRecommendation();
      
      expect(recommendation.action).toBe('regenerate');
      expect(recommendation.priority).toBe('medium');
    });
  });

  describe('Performance Tracking', () => {
    it('should record cookie operation performance', () => {
      stateManager.recordCookieOperation('generation', 250, true);
      stateManager.recordCookieOperation('validation', 100, true);
      
      const state = stateManager.getState();
      expect(state.performanceMetrics.cookieGenerationTime).toContain(250);
      expect(state.performanceMetrics.cookieValidationTime).toContain(100);
    });

    it('should record session sync performance', () => {
      stateManager.recordSessionSync(300, true);
      stateManager.recordSessionSync(400, false);
      
      const state = stateManager.getState();
      expect(state.performanceMetrics.totalSyncAttempts).toBe(2);
      expect(state.performanceMetrics.successfulSyncs).toBe(1);
      expect(state.performanceMetrics.failedSyncs).toBe(1);
      expect(state.performanceMetrics.sessionSyncSuccessRate).toBe(0.5);
    });

    it('should provide performance summary', () => {
      stateManager.recordSessionSync(200, true);
      stateManager.recordSessionSync(300, true);
      stateManager.recordSessionSync(400, false);
      
      const summary = stateManager.getPerformanceSummary();
      
      expect(summary.totalOperations).toBe(3);
      expect(summary.successRate).toBeCloseTo(0.67, 2);
      expect(summary.recentErrors).toEqual([]);
    });
  });

  describe('Error Creation', () => {
    it('should create enhanced session persistence error', () => {
      stateManager.updateCookieStatus('invalid');
      stateManager.updateMiddlewareCompatibility(false);
      
      const error = stateManager.createSessionPersistenceError(
        SessionPersistenceErrorType.COOKIE_GENERATION_FAILED,
        'Test error message'
      );
      
      expect(error.name).toBe('SessionPersistenceError');
      expect(error.message).toBe('Test error message');
      expect(error.persistenceType).toBe(SessionPersistenceErrorType.COOKIE_GENERATION_FAILED);
      expect(error.cookieStatus).toBe('invalid');
      expect(error.middlewareCompatible).toBe(false);
      expect(error.debugInfo.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('State Management', () => {
    it('should reset state completely', () => {
      // Set up some state
      stateManager.updateSession('test-session', 'active');
      stateManager.recordRecoveryAttempt();
      stateManager.addSyncError({
        type: 'cookie_generation',
        message: 'Test error',
        recoverable: true,
        timestamp: new Date()
      });
      
      stateManager.resetState();
      
      const state = stateManager.getState();
      expect(state.sessionId).toBeNull();
      expect(state.persistenceStatus).toBe('invalid');
      expect(state.recoveryAttempts).toBe(0);
      expect(state.syncErrors).toEqual([]);
    });

    it('should cleanup expired data', () => {
      // Add old middleware test result (2 hours ago - should be cleaned up)
      const oldTestResult: MiddlewareTestResult = {
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        success: true,
        responseTime: 100,
        cookieFormat: 'old-format'
      };
      
      // Add recent middleware test result (should be kept)
      const recentTestResult: MiddlewareTestResult = {
        timestamp: new Date(),
        success: true,
        responseTime: 150,
        cookieFormat: 'recent-format'
      };
      
      stateManager.addMiddlewareTestResult(oldTestResult);
      stateManager.addMiddlewareTestResult(recentTestResult);
      
      // Add old sync error (2 hours ago - should be cleaned up)
      const oldError: SessionSyncError = {
        type: 'session_validation',
        message: 'Old error',
        recoverable: true,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      };
      
      // Add recent sync error (should be kept)
      const recentError: SessionSyncError = {
        type: 'cookie_generation',
        message: 'Recent error',
        recoverable: true,
        timestamp: new Date()
      };
      
      stateManager.addSyncError(oldError);
      stateManager.addSyncError(recentError);
      
      stateManager.cleanup();
      
      const state = stateManager.getState();
      expect(state.middlewareTestResults).toHaveLength(1);
      expect(state.middlewareTestResults[0].cookieFormat).toBe('recent-format');
      expect(state.syncErrors).toHaveLength(1);
      expect(state.syncErrors[0].message).toBe('Recent error');
    });
  });

  describe('Storage Persistence', () => {
    it('should persist state changes to localStorage', () => {
      stateManager.updateSession('persistent-session', 'active');
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'session_persistence_state',
        expect.stringContaining('persistent-session')
      );
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage.setItem to throw an error
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('Storage quota exceeded');
      });
      
      // Should not throw an error
      expect(() => {
        stateManager.updateSession('test-session', 'active');
      }).not.toThrow();
    });
  });
});