/**
 * Environment Monitoring Performance Tests
 * Tests to ensure monitoring system doesn't negatively impact application performance
 * Requirements: 4.1, 4.2, 4.4
 */

import { 
  environmentMonitor,
  recordEnvironmentError,
  recordMissingVariable,
  recordClientInitializationFailure,
  startClientInitializationTracking,
  completeClientInitializationTracking,
  startEnvironmentValidationTracking,
  completeEnvironmentValidationTracking,
  type EnvironmentErrorContext
} from '@/lib/monitoring/environment-monitor';

// Mock all console methods to prevent infinite logging during performance tests
const originalConsole = { ...console };
beforeAll(() => {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  Object.assign(console, originalConsole);
});

describe('Environment Monitoring Performance', () => {
  let mockContext: EnvironmentErrorContext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockContext = {
      operation: 'startup_validation',
      caller: 'performance-test',
      environment: 'test',
      userId: 'perf-user-123',
      sessionId: 'perf-session-456'
    };
  });

  describe('Error Recording Performance', () => {
    it('should record errors efficiently under high load', () => {
      const startTime = performance.now();
      const errorCount = 10000;

      for (let i = 0; i < errorCount; i++) {
        recordEnvironmentError({
          type: 'validation_failed',
          severity: 'low',
          message: `Performance test error ${i}`,
          context: mockContext,
          correlationId: `perf-test-${i}`,
          metadata: {
            iteration: i,
            batch: Math.floor(i / 100),
            timestamp: Date.now()
          }
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const errorsPerSecond = (errorCount / duration) * 1000;

      // Should process at least 400 errors per second (realistic expectation)
      expect(errorsPerSecond).toBeGreaterThan(400);
      
      // Total time should be reasonable
      expect(duration).toBeLessThan(25000); // 25 seconds max

      // Verify memory management worked
      const recentErrors = environmentMonitor.getRecentErrors(15000);
      expect(recentErrors.length).toBeLessThanOrEqual(5000);
    });

    it('should handle concurrent error recording efficiently', async () => {
      const concurrentOperations = 100;
      const errorsPerOperation = 50;
      const startTime = performance.now();

      const promises = Array.from({ length: concurrentOperations }, (_, i) =>
        new Promise<void>(resolve => {
          setTimeout(() => {
            for (let j = 0; j < errorsPerOperation; j++) {
              recordEnvironmentError({
                type: 'network_error',
                severity: 'medium',
                message: `Concurrent error ${i}-${j}`,
                context: {
                  ...mockContext,
                  caller: `concurrent-${i}`
                }
              });
            }
            resolve();
          }, Math.random() * 100);
        })
      );

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;
      const totalErrors = concurrentOperations * errorsPerOperation;
      const errorsPerSecond = (totalErrors / duration) * 1000;

      expect(errorsPerSecond).toBeGreaterThan(300);
      expect(duration).toBeLessThan(15000); // 15 seconds max
    });

    it('should maintain performance with different error types', () => {
      const errorTypes = [
        'missing_variable',
        'invalid_format', 
        'validation_failed',
        'client_init_failed',
        'network_error',
        'configuration_error'
      ] as const;

      const startTime = performance.now();
      const iterationsPerType = 1000;

      errorTypes.forEach(errorType => {
        for (let i = 0; i < iterationsPerType; i++) {
          recordEnvironmentError({
            type: errorType,
            severity: 'medium',
            message: `${errorType} performance test ${i}`,
            context: mockContext,
            variable: errorType.includes('variable') ? `TEST_VAR_${i}` : undefined,
            metadata: {
              errorType,
              iteration: i,
              testRun: 'performance'
            }
          });
        }
      });

      const endTime = performance.now();
      const duration = endTime - startTime;
      const totalErrors = errorTypes.length * iterationsPerType;
      const errorsPerSecond = (totalErrors / duration) * 1000;

      expect(errorsPerSecond).toBeGreaterThan(400);
      expect(duration).toBeLessThan(15000);
    });
  });

  describe('Metrics Tracking Performance', () => {
    it('should track client initialization metrics efficiently', async () => {
      const operationCount = 5000;
      const startTime = performance.now();

      const promises = Array.from({ length: operationCount }, async (_, i) => {
        const attemptId = startClientInitializationTracking(`perf-${i}`);
        
        // Simulate variable processing time
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        
        const success = Math.random() > 0.2; // 80% success rate
        completeClientInitializationTracking(
          attemptId, 
          success, 
          success ? 0 : Math.floor(Math.random() * 3),
          success ? undefined : 'environment_error',
          success ? undefined : 'Test error'
        );
      });

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;
      const operationsPerSecond = (operationCount / duration) * 1000;

      expect(operationsPerSecond).toBeGreaterThan(200);
      expect(duration).toBeLessThan(25000); // 25 seconds max

      // Verify metrics were recorded
      const metrics = environmentMonitor.getClientInitializationMetrics(6000);
      expect(metrics.length).toBeLessThanOrEqual(2000); // Memory limit enforced
    });

    it('should track environment validation metrics efficiently', async () => {
      const validationCount = 3000;
      const startTime = performance.now();

      const promises = Array.from({ length: validationCount }, async (_, i) => {
        const validationId = startEnvironmentValidationTracking(`validation-${i}`);
        
        // Simulate validation processing
        await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
        
        const totalVars = 10 + Math.floor(Math.random() * 10);
        const validVars = Math.floor(totalVars * (0.7 + Math.random() * 0.3));
        const invalidVars = Math.floor((totalVars - validVars) * 0.6);
        const missingVars = totalVars - validVars - invalidVars;
        
        completeEnvironmentValidationTracking(
          validationId,
          totalVars,
          validVars,
          invalidVars,
          missingVars
        );
      });

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;
      const validationsPerSecond = (validationCount / duration) * 1000;

      expect(validationsPerSecond).toBeGreaterThan(100);
      expect(duration).toBeLessThan(30000); // 30 seconds max

      // Verify metrics were recorded and memory managed
      const metrics = environmentMonitor.getEnvironmentValidationMetrics(4000);
      expect(metrics.length).toBeLessThanOrEqual(2000);
    });
  });

  describe('Statistics Calculation Performance', () => {
    beforeEach(() => {
      // Setup test data
      for (let i = 0; i < 1000; i++) {
        recordEnvironmentError({
          type: i % 2 === 0 ? 'missing_variable' : 'validation_failed',
          severity: ['low', 'medium', 'high', 'critical'][i % 4] as any,
          message: `Setup error ${i}`,
          context: mockContext
        });
      }

      // Add some metrics
      for (let i = 0; i < 500; i++) {
        const attemptId = startClientInitializationTracking();
        completeClientInitializationTracking(attemptId, i % 3 !== 0);
        
        const validationId = startEnvironmentValidationTracking();
        completeEnvironmentValidationTracking(validationId, 10, 8, 1, 1);
      }
    });

    it('should calculate monitoring statistics quickly', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const stats = environmentMonitor.getMonitoringStats(60);
        
        // Verify stats are calculated correctly
        expect(stats.totalErrors).toBeGreaterThan(0);
        expect(stats.errorsByType).toBeDefined();
        expect(stats.errorsBySeverity).toBeDefined();
        expect(stats.clientInitializationSuccessRate).toBeGreaterThanOrEqual(0);
        expect(stats.clientInitializationSuccessRate).toBeLessThanOrEqual(100);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const calculationsPerSecond = (iterations / duration) * 1000;

      expect(calculationsPerSecond).toBeGreaterThan(100);
      expect(duration).toBeLessThan(10000); // 10 seconds max
    });

    it('should handle different time windows efficiently', () => {
      const timeWindows = [1, 5, 15, 30, 60, 120, 240];
      const startTime = performance.now();

      timeWindows.forEach(window => {
        for (let i = 0; i < 100; i++) {
          const stats = environmentMonitor.getMonitoringStats(window);
          expect(stats.timeWindow).toBe(window);
        }
      });

      const endTime = performance.now();
      const duration = endTime - startTime;
      const totalCalculations = timeWindows.length * 100;
      const calculationsPerSecond = (totalCalculations / duration) * 1000;

      expect(calculationsPerSecond).toBeGreaterThan(50);
      expect(duration).toBeLessThan(15000);
    });
  });

  describe('Alert System Performance', () => {
    it('should handle alert checking efficiently under high error volume', () => {
      const startTime = performance.now();
      const errorBatches = 50;
      const errorsPerBatch = 100;

      // Generate errors that should trigger alerts
      for (let batch = 0; batch < errorBatches; batch++) {
        for (let i = 0; i < errorsPerBatch; i++) {
          recordEnvironmentError({
            type: 'missing_variable',
            severity: 'high',
            variable: `BATCH_VAR_${batch}`,
            message: `Batch ${batch} error ${i}`,
            context: {
              ...mockContext,
              caller: `batch-${batch}`
            }
          });
        }
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const totalErrors = errorBatches * errorsPerBatch;
      const errorsPerSecond = (totalErrors / duration) * 1000;

      expect(errorsPerSecond).toBeGreaterThan(200);
      expect(duration).toBeLessThan(25000);

      // Verify alerts were created
      const activeAlerts = environmentMonitor.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);
    });

    it('should resolve alerts quickly', () => {
      // Create some alerts first
      for (let i = 0; i < 10; i++) {
        recordMissingVariable(`ALERT_VAR_${i}`, mockContext, 'critical');
      }

      const activeAlerts = environmentMonitor.getActiveAlerts();
      const startTime = performance.now();

      // Resolve all alerts
      activeAlerts.forEach(alert => {
        environmentMonitor.resolveAlert(alert.id);
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100); // Should be very fast
      
      const remainingAlerts = environmentMonitor.getActiveAlerts();
      expect(remainingAlerts.length).toBe(0);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should maintain stable memory usage under continuous load', () => {
      const initialMemory = process.memoryUsage();
      
      // Run continuous operations for a period
      const duration = 5000; // 5 seconds
      const startTime = Date.now();
      let operationCount = 0;

      const interval = setInterval(() => {
        // Mix of different operations
        recordEnvironmentError({
          type: 'validation_failed',
          severity: 'medium',
          message: `Memory test error ${operationCount}`,
          context: mockContext
        });

        const attemptId = startClientInitializationTracking();
        completeClientInitializationTracking(attemptId, Math.random() > 0.3);

        const validationId = startEnvironmentValidationTracking();
        completeEnvironmentValidationTracking(validationId, 10, 8, 1, 1);

        operationCount++;
      }, 10);

      return new Promise<void>(resolve => {
        setTimeout(() => {
          clearInterval(interval);
          
          const finalMemory = process.memoryUsage();
          const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
          const memoryIncreasePerOperation = memoryIncrease / operationCount;

          // Memory increase per operation should be minimal
          expect(memoryIncreasePerOperation).toBeLessThan(1000); // 1KB per operation max
          
          // Total memory increase should be reasonable
          expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB max

          console.log(`Performed ${operationCount} operations`);
          console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
          console.log(`Per operation: ${memoryIncreasePerOperation.toFixed(2)} bytes`);

          resolve();
        }, duration);
      });
    });

    it('should handle memory cleanup efficiently', () => {
      const startTime = performance.now();

      // Fill up to memory limits
      for (let i = 0; i < 6000; i++) {
        recordEnvironmentError({
          type: 'configuration_error',
          severity: 'low',
          message: `Cleanup test error ${i}`,
          context: mockContext,
          metadata: {
            largeData: new Array(100).fill(`data-${i}`).join('-')
          }
        });
      }

      for (let i = 0; i < 2500; i++) {
        const attemptId = startClientInitializationTracking();
        completeClientInitializationTracking(attemptId, true);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(15000); // 15 seconds max

      // Verify memory limits were enforced
      const errors = environmentMonitor.getRecentErrors(7000);
      const metrics = environmentMonitor.getClientInitializationMetrics(3000);

      expect(errors.length).toBeLessThanOrEqual(5000);
      expect(metrics.length).toBeLessThanOrEqual(2000);
    });
  });

  describe('External Alert Performance', () => {
    beforeEach(() => {
      // Mock fetch for external alerts
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should not block error recording when sending external alerts', async () => {
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
      
      const startTime = performance.now();
      const errorCount = 100;

      // Record errors that will trigger alerts
      for (let i = 0; i < errorCount; i++) {
        recordMissingVariable(`PERF_VAR_${i}`, mockContext, 'critical');
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const errorsPerSecond = (errorCount / duration) * 1000;

      // Should still be fast even with external alerts
      expect(errorsPerSecond).toBeGreaterThan(200);
      expect(duration).toBeLessThan(5000);

      // Wait for async alert processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify external alerts were attempted
      expect(global.fetch).toHaveBeenCalled();

      delete process.env.SLACK_WEBHOOK_URL;
    });

    it('should handle external alert failures without impacting performance', async () => {
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
      
      // Make fetch fail
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const startTime = performance.now();
      
      // Record errors that will trigger alerts
      for (let i = 0; i < 50; i++) {
        recordMissingVariable(`FAIL_VAR_${i}`, mockContext, 'critical');
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should still be fast even with failing external alerts
      expect(duration).toBeLessThan(2000);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 500));

      delete process.env.SLACK_WEBHOOK_URL;
    });
  });
});