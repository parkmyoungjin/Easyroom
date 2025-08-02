// src/lib/auth/__tests__/SessionErrorHandler.test.ts

import { SessionErrorHandler, SESSION_ERROR_STRATEGIES } from '../SessionErrorHandler';

describe('SessionErrorHandler', () => {
  let errorHandler: SessionErrorHandler;

  beforeEach(() => {
    errorHandler = new SessionErrorHandler();
  });

  describe('constructor', () => {
    it('should initialize with empty metrics', () => {
      const metrics = errorHandler.getMetrics();
      
      expect(metrics.totalChecks).toBe(0);
      expect(metrics.successfulChecks).toBe(0);
      expect(metrics.failedChecks).toBe(0);
      expect(metrics.averageResponseTime).toBe(0);
      expect(metrics.lastSuccessTime).toBeNull();
      expect(metrics.lastFailureTime).toBeNull();
      expect(metrics.consecutiveFailures).toBe(0);
    });
  });

  describe('categorizeError', () => {
    it('should categorize AuthSessionMissingError correctly', () => {
      const error = new Error('Session missing');
      error.name = 'AuthSessionMissingError';
      
      const result = errorHandler.categorizeError(error);
      
      expect(result.type).toBe('session');
      expect(result.retryable).toBe(true);
      expect(result.strategy).toBe(SESSION_ERROR_STRATEGIES['AuthSessionMissingError']);
    });

    it('should categorize NetworkError correctly', () => {
      const error = new Error('Network failed');
      error.name = 'NetworkError';
      
      const result = errorHandler.categorizeError(error);
      
      expect(result.type).toBe('network');
      expect(result.retryable).toBe(true);
      expect(result.strategy).toBe(SESSION_ERROR_STRATEGIES['NetworkError']);
    });

    it('should categorize AuthInvalidTokenError correctly', () => {
      const error = new Error('Invalid token');
      error.name = 'AuthInvalidTokenError';
      
      const result = errorHandler.categorizeError(error);
      
      expect(result.type).toBe('session');
      expect(result.retryable).toBe(false);
      expect(result.strategy).toBe(SESSION_ERROR_STRATEGIES['AuthInvalidTokenError']);
    });

    it('should fallback to pattern matching for unknown error names', () => {
      const networkError = new Error('fetch timeout occurred');
      const result1 = errorHandler.categorizeError(networkError);
      expect(result1.type).toBe('network');
      expect(result1.retryable).toBe(true);

      const sessionError = new Error('session expired');
      const result2 = errorHandler.categorizeError(sessionError);
      expect(result2.type).toBe('session');
      expect(result2.retryable).toBe(true);

      const permissionError = new Error('unauthorized access');
      const result3 = errorHandler.categorizeError(permissionError);
      expect(result3.type).toBe('permission');
      expect(result3.retryable).toBe(false);
    });

    it('should handle unknown errors', () => {
      const unknownError = new Error('Something weird happened');
      const result = errorHandler.categorizeError(unknownError);
      
      expect(result.type).toBe('unknown');
      expect(result.retryable).toBe(true);
      expect(result.code).toBe('UNKNOWN_ERROR');
    });

    it('should handle non-Error objects', () => {
      const stringError = 'String error message';
      const result1 = errorHandler.categorizeError(stringError);
      expect(result1.type).toBe('unknown');

      const objectError = { message: 'Object error' };
      const result2 = errorHandler.categorizeError(objectError);
      expect(result2.type).toBe('unknown');
    });
  });

  describe('recordSessionCheck', () => {
    it('should record successful session check', () => {
      const startTime = new Date(Date.now() - 100); // 100ms ago
      
      errorHandler.recordSessionCheck(startTime, true);
      
      const metrics = errorHandler.getMetrics();
      expect(metrics.totalChecks).toBe(1);
      expect(metrics.successfulChecks).toBe(1);
      expect(metrics.failedChecks).toBe(0);
      expect(metrics.consecutiveFailures).toBe(0);
      expect(metrics.lastSuccessTime).toBeInstanceOf(Date);
      expect(metrics.averageResponseTime).toBeGreaterThan(90); // Should be around 100ms
      expect(metrics.averageResponseTime).toBeLessThan(110);
    });

    it('should record failed session check', () => {
      const startTime = new Date(Date.now() - 200); // 200ms ago
      const error = new Error('Test error');
      
      jest.spyOn(console, 'warn').mockImplementation();
      
      errorHandler.recordSessionCheck(startTime, false, error);
      
      const metrics = errorHandler.getMetrics();
      expect(metrics.totalChecks).toBe(1);
      expect(metrics.successfulChecks).toBe(0);
      expect(metrics.failedChecks).toBe(1);
      expect(metrics.consecutiveFailures).toBe(1);
      expect(metrics.lastFailureTime).toBeInstanceOf(Date);
      expect(metrics.averageResponseTime).toBeGreaterThan(190); // Should be around 200ms
      expect(metrics.averageResponseTime).toBeLessThan(210);
      
      jest.restoreAllMocks();
    });

    it('should calculate average response time correctly', () => {
      jest.spyOn(console, 'warn').mockImplementation();
      
      // First check: ~100ms
      const start1 = new Date(Date.now() - 100);
      errorHandler.recordSessionCheck(start1, true);
      
      // Second check: ~200ms
      const start2 = new Date(Date.now() - 200);
      errorHandler.recordSessionCheck(start2, false);
      
      const metrics = errorHandler.getMetrics();
      expect(metrics.averageResponseTime).toBeGreaterThan(140); // Should be around 150ms
      expect(metrics.averageResponseTime).toBeLessThan(160);
      
      jest.restoreAllMocks();
    });

    it('should reset consecutive failures on success', () => {
      jest.spyOn(console, 'warn').mockImplementation();
      
      // Record some failures
      errorHandler.recordSessionCheck(new Date(), false);
      errorHandler.recordSessionCheck(new Date(), false);
      expect(errorHandler.getMetrics().consecutiveFailures).toBe(2);
      
      // Record success
      errorHandler.recordSessionCheck(new Date(), true);
      expect(errorHandler.getMetrics().consecutiveFailures).toBe(0);
      
      jest.restoreAllMocks();
    });

    it('should execute fallback action for known error strategies', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(console, 'warn').mockImplementation();
      
      const error = new Error('Session missing');
      error.name = 'AuthSessionMissingError';
      
      errorHandler.recordSessionCheck(new Date(), false, error);
      
      expect(consoleSpy).toHaveBeenCalledWith('[SessionErrorHandler] Session missing, stopping polling');
      
      jest.restoreAllMocks();
    });
  });

  describe('shouldStopPolling', () => {
    it('should return false for low consecutive failures', () => {
      // Record 4 consecutive failures
      for (let i = 0; i < 4; i++) {
        errorHandler.recordSessionCheck(new Date(), false);
      }
      
      expect(errorHandler.shouldStopPolling()).toBe(false);
    });

    it('should return true for high consecutive failures', () => {
      jest.spyOn(console, 'warn').mockImplementation();
      
      // Record 5 consecutive failures
      for (let i = 0; i < 5; i++) {
        errorHandler.recordSessionCheck(new Date(), false);
      }
      
      expect(errorHandler.shouldStopPolling()).toBe(true);
      
      jest.restoreAllMocks();
    });

    it('should reset after successful check', () => {
      jest.spyOn(console, 'warn').mockImplementation();
      
      // Record failures
      for (let i = 0; i < 5; i++) {
        errorHandler.recordSessionCheck(new Date(), false);
      }
      expect(errorHandler.shouldStopPolling()).toBe(true);
      
      // Record success
      errorHandler.recordSessionCheck(new Date(), true);
      expect(errorHandler.shouldStopPolling()).toBe(false);
      
      jest.restoreAllMocks();
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics to initial state', () => {
      jest.spyOn(console, 'warn').mockImplementation();
      
      // Record some activity
      errorHandler.recordSessionCheck(new Date(), true);
      errorHandler.recordSessionCheck(new Date(), false);
      
      expect(errorHandler.getMetrics().totalChecks).toBe(2);
      
      // Reset
      errorHandler.resetMetrics();
      
      const metrics = errorHandler.getMetrics();
      expect(metrics.totalChecks).toBe(0);
      expect(metrics.successfulChecks).toBe(0);
      expect(metrics.failedChecks).toBe(0);
      expect(metrics.averageResponseTime).toBe(0);
      expect(metrics.lastSuccessTime).toBeNull();
      expect(metrics.lastFailureTime).toBeNull();
      expect(metrics.consecutiveFailures).toBe(0);
      
      jest.restoreAllMocks();
    });
  });

  describe('getMetrics', () => {
    it('should return readonly copy of metrics', () => {
      const metrics = errorHandler.getMetrics();
      
      // Should not be able to modify the returned metrics
      expect(() => {
        (metrics as any).totalChecks = 999;
      }).not.toThrow(); // TypeScript prevents this, but runtime doesn't
      
      // Original metrics should remain unchanged
      expect(errorHandler.getMetrics().totalChecks).toBe(0);
    });
  });

  describe('SESSION_ERROR_STRATEGIES', () => {
    it('should have correct strategy for AuthSessionMissingError', () => {
      const strategy = SESSION_ERROR_STRATEGIES['AuthSessionMissingError'];
      
      expect(strategy.type).toBe('session');
      expect(strategy.shouldRetry).toBe(true);
      expect(strategy.retryDelay).toBe(2000);
      expect(strategy.maxRetries).toBe(2);
      expect(typeof strategy.fallbackAction).toBe('function');
    });

    it('should have correct strategy for NetworkError', () => {
      const strategy = SESSION_ERROR_STRATEGIES['NetworkError'];
      
      expect(strategy.type).toBe('network');
      expect(strategy.shouldRetry).toBe(true);
      expect(strategy.retryDelay).toBe(5000);
      expect(strategy.maxRetries).toBe(3);
      expect(typeof strategy.fallbackAction).toBe('function');
    });

    it('should have correct strategy for AuthInvalidTokenError', () => {
      const strategy = SESSION_ERROR_STRATEGIES['AuthInvalidTokenError'];
      
      expect(strategy.type).toBe('session');
      expect(strategy.shouldRetry).toBe(false);
      expect(strategy.retryDelay).toBe(0);
      expect(strategy.maxRetries).toBe(0);
      expect(typeof strategy.fallbackAction).toBe('function');
    });
  });
});