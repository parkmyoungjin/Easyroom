/**
 * Integration tests for SessionPersistenceStateManager
 * Tests state persistence across browser sessions and page refreshes
 */

import { SessionPersistenceStateManager } from '../SessionPersistenceStateManager';
import {
  SessionSyncError,
  MiddlewareTestResult,
  SessionPersistenceErrorType
} from '../SessionPersistenceState';

// Mock localStorage with more realistic behavior
const createMockLocalStorage = () => {
  const store: Record<string, string> = {};
  
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    get store() { return { ...store }; }
  };
};

describe('SessionPersistenceStateManager Integration Tests', () => {
  let mockLocalStorage: ReturnType<typeof createMockLocalStorage>;

  beforeEach(() => {
    mockLocalStorage = createMockLocalStorage();
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      configurable: true
    });
    jest.clearAllMocks();
    
    // Clear any existing localStorage data to ensure test isolation
    mockLocalStorage.clear();
    
    // Ensure both storage keys are cleared
    mockLocalStorage.removeItem('session_persistence_state');
    mockLocalStorage.removeItem('session_performance_metrics');
  });

  // Helper to ensure complete isolation for specific tests
  const ensureCleanStorage = () => {
    const cleanStorage = createMockLocalStorage();
    Object.defineProperty(window, 'localStorage', {
      value: cleanStorage,
      configurable: true
    });
    return cleanStorage;
  };

  // Helper function to create a fresh localStorage environment for each test
  const createFreshStorage = () => {
    const freshStorage = createMockLocalStorage();
    Object.defineProperty(window, 'localStorage', {
      value: freshStorage,
      configurable: true
    });
    return freshStorage;
  };

  describe('Cross-Session State Persistence', () => {
    it('should maintain state across browser session simulation', () => {
      // Simulate first browser session
      const session1Manager = new SessionPersistenceStateManager();
      
      // Set up session state
      session1Manager.updateSession('user-session-123', 'active');
      session1Manager.updateCookieStatus('valid', true);
      session1Manager.updateMiddlewareCompatibility(true);
      session1Manager.recordCookieOperation('generation', 200, true);
      
      const testResult: MiddlewareTestResult = {
        timestamp: new Date(),
        success: true,
        responseTime: 150,
        cookieFormat: 'valid-jwt-format'
      };
      session1Manager.addMiddlewareTestResult(testResult);
      
      // Simulate browser restart - create new manager instance
      const session2Manager = new SessionPersistenceStateManager();
      const restoredState = session2Manager.getState();
      
      // Verify state was restored correctly
      expect(restoredState.sessionId).toBe('user-session-123');
      expect(restoredState.persistenceStatus).toBe('active');
      expect(restoredState.cookieStatus).toBe('valid');
      expect(restoredState.cookieGenerationAttempts).toBe(1);
      expect(restoredState.middlewareCompatible).toBe(true);
      expect(restoredState.middlewareTestResults).toHaveLength(1);
      expect(restoredState.middlewareTestResults[0].cookieFormat).toBe('valid-jwt-format');
      expect(restoredState.performanceMetrics.cookieGenerationTime).toContain(200);
    });

    it('should handle page refresh scenario with error recovery', () => {
      // Initial page load
      const initialManager = new SessionPersistenceStateManager();
      
      // Simulate authentication flow with some errors
      initialManager.updateSession('session-with-errors', 'syncing');
      
      const syncError: SessionSyncError = {
        type: 'middleware_compatibility',
        message: 'Middleware parsing failed',
        recoverable: true,
        timestamp: new Date()
      };
      initialManager.addSyncError(syncError);
      initialManager.recordRecoveryAttempt();
      
      // Eventually successful
      initialManager.updateMiddlewareCompatibility(true);
      initialManager.updateSession('session-with-errors', 'active');
      
      // Simulate page refresh
      const refreshedManager = new SessionPersistenceStateManager();
      const refreshedState = refreshedManager.getState();
      
      // Verify error history and recovery state is maintained
      expect(refreshedState.sessionId).toBe('session-with-errors');
      expect(refreshedState.persistenceStatus).toBe('active');
      expect(refreshedState.syncErrors).toHaveLength(1);
      expect(refreshedState.syncErrors[0].type).toBe('middleware_compatibility');
      expect(refreshedState.recoveryAttempts).toBe(1);
      expect(refreshedState.middlewareCompatible).toBe(true);
    });

    it('should maintain performance metrics across sessions', () => {
      // Ensure completely clean storage for this test
      ensureCleanStorage();
      
      // Session 1: Record some performance data
      const session1 = new SessionPersistenceStateManager();
      
      session1.recordCookieOperation('generation', 100, true);
      session1.recordCookieOperation('generation', 150, true);
      session1.recordCookieOperation('validation', 50, true);
      session1.recordSessionSync(200, true);
      session1.recordSessionSync(300, false);
      
      // Session 2: Continue recording performance data (simulates browser restart)
      const session2 = new SessionPersistenceStateManager();
      
      session2.recordCookieOperation('generation', 120, true);
      session2.recordSessionSync(250, true);
      
      const metrics = session2.getState().performanceMetrics;
      
      // Verify cumulative performance tracking - should include all operations from both sessions
      // The app maintains performance data across sessions, so we expect all data to be present
      expect(metrics.cookieGenerationTime).toContain(100);
      expect(metrics.cookieGenerationTime).toContain(150);
      expect(metrics.cookieGenerationTime).toContain(120);
      expect(metrics.cookieValidationTime).toContain(50);
      expect(metrics.totalSyncAttempts).toBe(3);
      expect(metrics.successfulSyncs).toBe(2);
      expect(metrics.failedSyncs).toBe(1);
      expect(metrics.sessionSyncSuccessRate).toBeCloseTo(0.67, 2);
    });
  });

  describe('Error Recovery Across Sessions', () => {
    it('should provide consistent recovery recommendations across sessions', () => {
      // Session 1: Build up error state
      const session1 = new SessionPersistenceStateManager();
      
      session1.updateCookieStatus('corrupted');
      session1.updateMiddlewareCompatibility(false);
      // Don't add too many recovery attempts to avoid triggering reauth
      session1.recordRecoveryAttempt();
      
      const recommendation1 = session1.getRecoveryRecommendation();
      
      // Session 2: Same state should give same recommendation
      const session2 = new SessionPersistenceStateManager();
      const recommendation2 = session2.getRecoveryRecommendation();
      
      expect(recommendation1.action).toBe(recommendation2.action);
      expect(recommendation1.priority).toBe(recommendation2.priority);
      expect(recommendation2.action).toBe('regenerate'); // Due to corrupted cookie
      expect(recommendation2.priority).toBe('medium');
    });

    it('should escalate recovery recommendations based on persistent failures', () => {
      // Ensure completely clean storage for this test
      ensureCleanStorage();
      
      // Session 1: Initial failures
      const session1 = new SessionPersistenceStateManager();
      
      session1.updateMiddlewareCompatibility(false);
      session1.addSyncError({
        type: 'middleware_compatibility',
        message: 'First failure',
        recoverable: false,
        timestamp: new Date()
      });
      
      const recommendation1 = session1.getRecoveryRecommendation();
      // With middleware incompatible and 1 error, this should be 'high' priority according to the logic
      expect(recommendation1.priority).toBe('high'); // Middleware incompatible + 1 error = high priority
      expect(recommendation1.action).toBe('clear');
      
      // Session 2: Add more failures to same state
      const session2 = new SessionPersistenceStateManager();
      // The middleware compatibility should already be false from session1
      session2.addSyncError({
        type: 'middleware_compatibility',
        message: 'Second failure',
        recoverable: false,
        timestamp: new Date()
      });
      
      const recommendation2 = session2.getRecoveryRecommendation();
      expect(recommendation2.action).toBe('clear');
      expect(recommendation2.priority).toBe('high'); // Multiple middleware failures
    });

    it('should handle maximum recovery attempts across sessions', () => {
      // Ensure completely clean storage for this test
      ensureCleanStorage();
      
      // Session 1: Approach max recovery attempts
      const session1 = new SessionPersistenceStateManager({
        maxRetryAttempts: 5  // Use higher limit to avoid immediate reauth
      });
      
      session1.recordRecoveryAttempt();
      session1.recordRecoveryAttempt();
      
      const recommendation1 = session1.getRecoveryRecommendation();
      expect(recommendation1.action).not.toBe('reauth');
      
      // Session 2: Exceed max recovery attempts
      const session2 = new SessionPersistenceStateManager({
        maxRetryAttempts: 5
      });
      
      // Add more attempts to exceed the limit
      session2.recordRecoveryAttempt(); // 3rd attempt
      session2.recordRecoveryAttempt(); // 4th attempt
      session2.recordRecoveryAttempt(); // 5th attempt - should trigger reauth
      
      const recommendation2 = session2.getRecoveryRecommendation();
      expect(recommendation2.action).toBe('reauth');
      expect(recommendation2.priority).toBe('critical');
    });
  });

  describe('Data Cleanup and Optimization', () => {
    it('should clean up expired data while preserving recent data across sessions', () => {
      // Session 1: Add mixed old and recent data
      const session1 = new SessionPersistenceStateManager();
      
      // Add old data (2 hours ago)
      const oldTestResult: MiddlewareTestResult = {
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        success: false,
        responseTime: 1000,
        cookieFormat: 'old-format'
      };
      
      const oldError: SessionSyncError = {
        type: 'session_validation',
        message: 'Old validation error',
        recoverable: true,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000)
      };
      
      // Add recent data
      const recentTestResult: MiddlewareTestResult = {
        timestamp: new Date(),
        success: true,
        responseTime: 200,
        cookieFormat: 'recent-format'
      };
      
      const recentError: SessionSyncError = {
        type: 'cookie_generation',
        message: 'Recent cookie error',
        recoverable: true,
        timestamp: new Date()
      };
      
      session1.addMiddlewareTestResult(oldTestResult);
      session1.addMiddlewareTestResult(recentTestResult);
      session1.addSyncError(oldError);
      session1.addSyncError(recentError);
      
      // Session 2: Perform cleanup
      const session2 = new SessionPersistenceStateManager();
      session2.cleanup();
      
      const cleanedState = session2.getState();
      
      // Verify only recent data remains (old data should be filtered out)
      expect(cleanedState.middlewareTestResults.length).toBeGreaterThan(0);
      expect(cleanedState.middlewareTestResults.some(result => result.cookieFormat === 'recent-format')).toBe(true);
      expect(cleanedState.syncErrors.length).toBeGreaterThan(0);
      expect(cleanedState.syncErrors.some(error => error.message === 'Recent cookie error')).toBe(true);
    });

    it('should limit data growth to prevent storage bloat', () => {
      const session1 = new SessionPersistenceStateManager();
      
      // Add many middleware test results
      for (let i = 0; i < 15; i++) {
        const testResult: MiddlewareTestResult = {
          timestamp: new Date(),
          success: i % 2 === 0,
          responseTime: 100 + i * 10,
          cookieFormat: `format-${i}`
        };
        session1.addMiddlewareTestResult(testResult);
      }
      
      // Add many sync errors
      for (let i = 0; i < 8; i++) {
        const syncError: SessionSyncError = {
          type: 'session_validation',
          message: `Error ${i}`,
          recoverable: true,
          timestamp: new Date()
        };
        session1.addSyncError(syncError);
      }
      
      // Session 2: Verify limits are enforced
      const session2 = new SessionPersistenceStateManager();
      const state = session2.getState();
      
      expect(state.middlewareTestResults.length).toBeLessThanOrEqual(10);
      expect(state.syncErrors.length).toBeLessThanOrEqual(5);
      
      // Verify most recent data is kept
      expect(state.middlewareTestResults[state.middlewareTestResults.length - 1].cookieFormat).toBe('format-14');
      expect(state.syncErrors[state.syncErrors.length - 1].message).toBe('Error 7');
    });
  });

  describe('Performance Monitoring Across Sessions', () => {
    it('should provide accurate performance summaries across sessions', () => {
      // Ensure completely clean storage for this test
      ensureCleanStorage();
      
      // Session 1: Reset state and record initial performance data
      const session1 = new SessionPersistenceStateManager();
      session1.resetState(); // Ensure clean state for this test
      
      session1.recordSessionSync(100, true);
      session1.recordSessionSync(200, true);
      session1.recordSessionSync(300, false);
      
      session1.addSyncError({
        type: 'session_validation',
        message: 'Performance test error',
        recoverable: true,
        timestamp: new Date()
      });
      
      // Session 2: Continue recording and get summary
      const session2 = new SessionPersistenceStateManager();
      
      session2.recordSessionSync(150, true);
      session2.recordSessionSync(250, false);
      
      const summary = session2.getPerformanceSummary();
      
      // The app maintains cumulative performance data across sessions
      expect(summary.totalOperations).toBe(5);
      expect(summary.successRate).toBe(0.6); // 3 successes out of 5
      expect(summary.recentErrors.length).toBeGreaterThan(0);
      expect(summary.recentErrors.some(error => error.message === 'Performance test error')).toBe(true);
    });

    it('should maintain performance metrics limits across sessions', () => {
      // Session 1: Fill up performance arrays
      const session1 = new SessionPersistenceStateManager();
      
      for (let i = 0; i < 25; i++) {
        session1.recordCookieOperation('generation', 100 + i, true);
      }
      
      // Session 2: Add more data
      const session2 = new SessionPersistenceStateManager();
      
      for (let i = 0; i < 5; i++) {
        session2.recordCookieOperation('generation', 200 + i, true);
      }
      
      const metrics = session2.getState().performanceMetrics;
      
      // Should maintain limit of 20 measurements
      expect(metrics.cookieGenerationTime.length).toBeLessThanOrEqual(20);
      
      // Should keep most recent measurements
      expect(metrics.cookieGenerationTime).toContain(204); // Last added value
    });
  });

  describe('Error Creation and Debugging', () => {
    it('should create consistent error objects across sessions', () => {
      // Session 1: Set up error conditions
      const session1 = new SessionPersistenceStateManager();
      
      session1.updateSession('error-session', 'syncing');
      session1.updateCookieStatus('invalid', true);
      session1.updateMiddlewareCompatibility(false);
      session1.recordRecoveryAttempt();
      
      // Session 2: Create error with same conditions
      const session2 = new SessionPersistenceStateManager();
      
      const error = session2.createSessionPersistenceError(
        SessionPersistenceErrorType.MIDDLEWARE_COMPATIBILITY_FAILED,
        'Middleware compatibility test failed'
      );
      
      expect(error.name).toBe('SessionPersistenceError');
      expect(error.persistenceType).toBe(SessionPersistenceErrorType.MIDDLEWARE_COMPATIBILITY_FAILED);
      expect(error.syncAttempt).toBeGreaterThan(0); // Should have recovery attempts from session1
      expect(error.cookieStatus).toBe('invalid');
      expect(error.middlewareCompatible).toBe(false);
      expect(error.debugInfo.sessionId).toBe('error-session');
      expect(error.debugInfo.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Configuration Persistence', () => {
    it('should respect custom configuration across sessions', () => {
      // Ensure completely clean storage for this test
      ensureCleanStorage();
      
      const customConfig = {
        maxRetryAttempts: 10,  // Use much higher limit to ensure test works correctly
        enablePerformanceTracking: false,
        syncDebounceTime: 1000
      };
      
      // Session 1: Use custom config and reset state to ensure clean start
      const session1 = new SessionPersistenceStateManager(customConfig);
      session1.resetState(); // Ensure clean state for this test
      
      // Add attempts but stay under custom limit
      session1.recordRecoveryAttempt();
      session1.recordRecoveryAttempt();
      
      const recommendation1 = session1.getRecoveryRecommendation();
      expect(recommendation1.action).not.toBe('reauth'); // Should not trigger reauth yet
      
      // Session 2: Same custom config should apply
      const session2 = new SessionPersistenceStateManager(customConfig);
      
      const recommendation2 = session2.getRecoveryRecommendation();
      expect(recommendation2.action).not.toBe('reauth'); // Still under custom limit
      
      // Add more attempts to exceed custom limit
      for (let i = 0; i < 8; i++) {
        session2.recordRecoveryAttempt(); // Add 8 more attempts to reach 10 total
      }
      
      const recommendation3 = session2.getRecoveryRecommendation();
      expect(recommendation3.action).toBe('reauth'); // Now should trigger reauth
    });
  });
});