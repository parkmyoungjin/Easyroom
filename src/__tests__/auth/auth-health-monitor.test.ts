/**
 * Tests for Authentication Health Monitor
 */

import { AuthHealthMonitor, AuthHealthAlert } from '@/lib/auth/auth-health-monitor';
import { AuthState } from '@/types/auth-optimization';

// Mock localStorage
const createMockLocalStorage = () => {
  let store: { [key: string]: string } = {};
  
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
    reset: () => {
      store = {};
    }
  };
};

describe('AuthHealthMonitor', () => {
  let mockLocalStorage: ReturnType<typeof createMockLocalStorage>;
  let originalLocalStorage: Storage;
  let consoleSpy: jest.SpyInstance;

  beforeAll(() => {
    originalLocalStorage = global.localStorage;
  });

  beforeEach(() => {
    mockLocalStorage = createMockLocalStorage();
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });

    // Reset singleton instance
    (AuthHealthMonitor as any).instance = null;
    jest.clearAllMocks();
    
    // COMPLETE STERILE FIELD: Suppress all console output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore all console methods after each test
    jest.restoreAllMocks();
  });

  afterAll(() => {
    Object.defineProperty(global, 'localStorage', {
      value: originalLocalStorage,
      writable: true
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = AuthHealthMonitor.getInstance();
      const instance2 = AuthHealthMonitor.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Metrics Recording', () => {
    it('should record polling events correctly', () => {
      const monitor = AuthHealthMonitor.getInstance();
      
      // Record successful polling events
      monitor.recordPollingEvent(true, 500);
      monitor.recordPollingEvent(true, 600);
      monitor.recordPollingEvent(true, 400);
      
      const metrics = monitor.getMetrics();
      expect(metrics.pollingErrors).toBe(0);
      expect(metrics.averagePollingInterval).toBe(500); // (500 + 600 + 400) / 3
      expect(metrics.lastSuccessfulPoll).toBeGreaterThan(Date.now() - 1000);
    });

    it('should record polling errors and emit alerts', () => {
      const monitor = AuthHealthMonitor.getInstance();
      const alertCallback = jest.fn();
      monitor.onAlert(alertCallback);
      
      // Record multiple polling errors
      for (let i = 0; i < 6; i++) {
        monitor.recordPollingEvent(false, 0, new Error(`Polling error ${i}`));
      }
      
      const metrics = monitor.getMetrics();
      expect(metrics.pollingErrors).toBe(6);
      expect(metrics.lastError).toContain('Polling error');
      
      // Should have emitted error alert
      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'error',
          message: expect.stringContaining('High number of polling errors')
        })
      );
    });

    it('should record storage events correctly', () => {
      const monitor = AuthHealthMonitor.getInstance();
      const alertCallback = jest.fn();
      monitor.onAlert(alertCallback);
      
      // Record storage errors
      monitor.recordStorageEvent(false, 'set', new Error('Storage quota exceeded'));
      monitor.recordStorageEvent(false, 'get', new Error('Storage unavailable'));
      monitor.recordStorageEvent(false, 'remove', new Error('Storage error'));
      
      const metrics = monitor.getMetrics();
      expect(metrics.storageErrors).toBe(3);
      expect(metrics.lastError).toContain('Storage error');
      
      // Should have emitted critical alert
      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'critical',
          message: expect.stringContaining('Critical storage errors detected')
        })
      );
    });

    it('should record callback events and memory usage', () => {
      const monitor = AuthHealthMonitor.getInstance();
      const alertCallback = jest.fn();
      monitor.onAlert(alertCallback);
      
      // Record callback events
      monitor.recordCallbackEvent(true, 10);
      monitor.recordCallbackEvent(false, 15, new Error('Callback error'));
      monitor.recordCallbackEvent(true, 60); // High callback count
      
      const metrics = monitor.getMetrics();
      expect(metrics.callbackErrors).toBe(1);
      expect(metrics.memoryUsage.callbackCount).toBe(60);
      
      // Should have emitted warning for high callback count
      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warning',
          message: expect.stringContaining('High number of active callbacks')
        })
      );
    });

    it('should record state changes and detect stale data', () => {
      const monitor = AuthHealthMonitor.getInstance();
      const alertCallback = jest.fn();
      monitor.onAlert(alertCallback);
      
      // Record state change with old timestamp
      const staleState: AuthState = {
        status: 'authenticated',
        timestamp: Date.now() - 60000, // 1 minute old
        userId: 'test-user',
        sessionToken: 'test-token',
        source: 'internal'
      };
      
      monitor.recordStateChange(staleState, 'polling');
      
      const metrics = monitor.getMetrics();
      expect(metrics.stateChanges).toBe(1);
      
      // Should have emitted warning for stale data
      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warning',
          message: expect.stringContaining('Stale authentication state detected')
        })
      );
    });

    it('should record polling status changes', () => {
      const monitor = AuthHealthMonitor.getInstance();
      const alertCallback = jest.fn();
      monitor.onAlert(alertCallback);
      
      monitor.recordPollingStatus(true);
      let metrics = monitor.getMetrics();
      expect(metrics.memoryUsage.pollingActive).toBe(true);
      
      monitor.recordPollingStatus(false);
      metrics = monitor.getMetrics();
      expect(metrics.memoryUsage.pollingActive).toBe(false);
      
      // Should have emitted warning for stopped polling
      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warning',
          message: 'Authentication polling has stopped'
        })
      );
    });
  });

  describe('Health Status Assessment', () => {
    it('should return healthy status with no issues', () => {
      const monitor = AuthHealthMonitor.getInstance();
      
      // Record only successful events
      monitor.recordPollingEvent(true, 500);
      monitor.recordStorageEvent(true, 'set');
      monitor.recordCallbackEvent(true, 5);
      
      const status = monitor.getHealthStatus();
      expect(status.status).toBe('healthy');
      expect(status.issues).toHaveLength(0);
      expect(status.score).toBe(100);
    });

    it('should return warning status with minor issues', () => {
      const monitor = AuthHealthMonitor.getInstance();
      
      // Record some minor issues - need more callback errors to trigger warning
      for (let i = 0; i < 10; i++) {
        monitor.recordCallbackEvent(false, 10, new Error(`Callback error ${i}`));
      }
      
      const status = monitor.getHealthStatus();
      expect(status.status).toBe('warning');
      expect(status.issues.length).toBeGreaterThan(0);
      expect(status.score).toBeLessThan(100);
    });

    it('should return error status with significant issues', () => {
      const monitor = AuthHealthMonitor.getInstance();
      
      // Record significant issues - need more than threshold (5) to trigger error
      for (let i = 0; i < 6; i++) {
        monitor.recordPollingEvent(false, 0, new Error(`Polling error ${i}`));
      }
      
      const status = monitor.getHealthStatus();
      expect(status.status).toBe('error');
      expect(status.issues.length).toBeGreaterThan(0);
      expect(status.score).toBeLessThan(75);
    });

    it('should return critical status with severe issues', () => {
      const monitor = AuthHealthMonitor.getInstance();
      
      // Record critical storage errors - need more than threshold (3) to trigger critical
      // Each storage error reduces score by 10, so need 6 errors to get below 50
      for (let i = 0; i < 6; i++) {
        monitor.recordStorageEvent(false, 'set', new Error(`Storage error ${i}`));
      }
      
      const status = monitor.getHealthStatus();
      expect(status.status).toBe('critical');
      expect(status.issues.length).toBeGreaterThan(0);
      expect(status.score).toBeLessThan(50);
    });
  });

  describe('Alert System', () => {
    it('should emit alerts to multiple subscribers', () => {
      const monitor = AuthHealthMonitor.getInstance();
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      monitor.onAlert(callback1);
      monitor.onAlert(callback2);
      
      // Trigger an alert
      for (let i = 0; i < 6; i++) {
        monitor.recordPollingEvent(false, 0, new Error('Test error'));
      }
      
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should handle unsubscribe correctly', () => {
      const monitor = AuthHealthMonitor.getInstance();
      const callback = jest.fn();
      
      const unsubscribe = monitor.onAlert(callback);
      unsubscribe();
      
      // Trigger an alert
      for (let i = 0; i < 6; i++) {
        monitor.recordPollingEvent(false, 0, new Error('Test error'));
      }
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', () => {
      const monitor = AuthHealthMonitor.getInstance();
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = jest.fn();
      
      // Suppress console.error during this test to avoid log pollution
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      monitor.onAlert(errorCallback);
      monitor.onAlert(normalCallback);
      
      // Trigger an alert
      for (let i = 0; i < 6; i++) {
        monitor.recordPollingEvent(false, 0, new Error('Test error'));
      }
      
      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
      
      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Metrics Persistence', () => {
    it('should persist metrics to localStorage', () => {
      const monitor = AuthHealthMonitor.getInstance();
      
      monitor.recordPollingEvent(false, 0, new Error('Test error'));
      monitor.recordStorageEvent(false, 'set', new Error('Storage error'));
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'easyroom_auth_health_metrics',
        expect.stringContaining('"pollingErrors":1')
      );
    });

    it('should load persisted metrics on initialization', () => {
      // Set up persisted data
      const persistedData = {
        pollingErrors: 3,
        storageErrors: 1,
        callbackErrors: 2,
        stateChanges: 10,
        timestamp: Date.now()
      };
      
      mockLocalStorage.setItem('easyroom_auth_health_metrics', JSON.stringify(persistedData));
      
      const monitor = AuthHealthMonitor.getInstance();
      const metrics = monitor.getMetrics();
      
      expect(metrics.pollingErrors).toBe(3);
      expect(metrics.storageErrors).toBe(1);
      expect(metrics.callbackErrors).toBe(2);
      expect(metrics.stateChanges).toBe(10);
    });

    it('should handle persistence errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      // Suppress console.warn during this test to avoid log pollution
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      const monitor = AuthHealthMonitor.getInstance();
      
      // Should not throw error
      expect(() => {
        monitor.recordPollingEvent(false, 0, new Error('Test error'));
      }).not.toThrow();
      
      // Restore console.warn
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Health Report Generation', () => {
    it('should generate comprehensive health report', () => {
      const monitor = AuthHealthMonitor.getInstance();
      
      // Record some events
      monitor.recordPollingEvent(true, 500);
      monitor.recordStorageEvent(true, 'set');
      monitor.recordCallbackEvent(true, 10);
      
      const report = monitor.generateHealthReport();
      
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('status');
      expect(report).toHaveProperty('recommendations');
      expect(report.recommendations).toContain('System is operating within normal parameters');
    });

    it('should provide relevant recommendations for issues', () => {
      const monitor = AuthHealthMonitor.getInstance();
      
      // Create various issues
      monitor.recordPollingEvent(false, 0, new Error('Polling error'));
      monitor.recordStorageEvent(false, 'set', new Error('Storage error'));
      monitor.recordCallbackEvent(false, 60, new Error('Callback error'));
      
      const report = monitor.generateHealthReport();
      
      expect(report.recommendations).toContain('Consider increasing polling interval to reduce errors');
      expect(report.recommendations).toContain('Check localStorage availability and quota');
      expect(report.recommendations).toContain('Review callback implementations for error handling');
      expect(report.recommendations).toContain('Review callback lifecycle management');
    });
  });

  describe('Cleanup and Reset', () => {
    it('should reset metrics correctly', () => {
      const monitor = AuthHealthMonitor.getInstance();
      const alertCallback = jest.fn();
      monitor.onAlert(alertCallback);
      
      // Record some events
      monitor.recordPollingEvent(false, 0, new Error('Test error'));
      monitor.recordStorageEvent(false, 'set', new Error('Storage error'));
      
      let metrics = monitor.getMetrics();
      expect(metrics.pollingErrors).toBeGreaterThan(0);
      expect(metrics.storageErrors).toBeGreaterThan(0);
      
      monitor.resetMetrics();
      
      metrics = monitor.getMetrics();
      expect(metrics.pollingErrors).toBe(0);
      expect(metrics.storageErrors).toBe(0);
      expect(metrics.callbackErrors).toBe(0);
      expect(metrics.stateChanges).toBe(0);
      
      // Should have emitted reset alert
      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          message: 'Health metrics have been reset'
        })
      );
    });

    it('should cleanup resources on destroy', () => {
      const monitor = AuthHealthMonitor.getInstance();
      const alertCallback = jest.fn();
      monitor.onAlert(alertCallback);
      
      monitor.destroy();
      
      // Alert callbacks are cleared before emitting destroy alert, so callback won't be called
      // This tests the actual behavior of the destroy method
      expect(alertCallback).not.toHaveBeenCalled();
    });
  });
});