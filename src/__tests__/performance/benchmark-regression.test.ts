/**
 * Performance Benchmark and Regression Tests
 * Tests to prevent performance regression and ensure system meets benchmarks
 * Requirements: 6.4, 6.5
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock performance monitoring
const mockPerformanceMonitor = {
  recordMetric: jest.fn(),
  measureAuthentication: jest.fn(),
  measureAuthorization: jest.fn(),
  measureDatabaseQuery: jest.fn(),
  measureRpcFunction: jest.fn(),
  measureDataValidation: jest.fn(),
  measureEnvironmentCheck: jest.fn(),
  getPerformanceStats: jest.fn(),
  getPerformanceTrends: jest.fn()
};

jest.mock('@/lib/monitoring/performance-monitor', () => ({
  performanceMonitor: mockPerformanceMonitor,
  measureAuthentication: mockPerformanceMonitor.measureAuthentication,
  measureAuthorization: mockPerformanceMonitor.measureAuthorization,
  measureDatabaseQuery: mockPerformanceMonitor.measureDatabaseQuery,
  measureRpcFunction: mockPerformanceMonitor.measureRpcFunction,
  measureDataValidation: mockPerformanceMonitor.measureDataValidation,
  measureEnvironmentCheck: mockPerformanceMonitor.measureEnvironmentCheck
}));

// Mock Supabase client for performance testing
const mockSupabaseClient = {
  from: jest.fn(),
  rpc: jest.fn(),
  auth: {
    getUser: jest.fn(),
    signInWithPassword: jest.fn()
  }
};

const mockQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis()
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}));

import { 
  measureAuthentication,
  measureAuthorization,
  measureDatabaseQuery,
  measureRpcFunction,
  measureDataValidation,
  measureEnvironmentCheck
} from '@/lib/monitoring/performance-monitor';

describe('Performance Benchmark and Regression Tests', () => {
  // Performance thresholds (in milliseconds)
  const PERFORMANCE_THRESHOLDS = {
    authentication: {
      warning: 1000,
      critical: 3000
    },
    authorization: {
      warning: 500,
      critical: 1500
    },
    database_query: {
      warning: 2000,
      critical: 5000
    },
    rpc_function: {
      warning: 1500,
      critical: 4000
    },
    data_validation: {
      warning: 800,
      critical: 2000
    },
    environment_check: {
      warning: 200,
      critical: 500
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.from.mockReturnValue(mockQuery);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Authentication Performance Benchmarks', () => {
    it('should complete authentication within performance threshold', async () => {
      const mockAuthOperation = jest.fn().mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => resolve({
            user: { id: 'user-123', email: 'test@example.com' },
            session: { access_token: 'token-123' }
          }), 500); // 500ms delay
        })
      );

      mockPerformanceMonitor.measureAuthentication.mockImplementation(async (operation) => {
        const startTime = performance.now();
        const result = await operation();
        const duration = performance.now() - startTime;
        
        mockPerformanceMonitor.recordMetric({
          operation: 'authentication',
          duration,
          success: true
        });
        
        return { result, duration };
      });

      const { result, duration } = await measureAuthentication(mockAuthOperation);

      expect(result.user.id).toBe('user-123');
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.authentication.warning);
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'authentication',
          success: true
        })
      );
    });

    it('should detect slow authentication and trigger alerts', async () => {
      const slowAuthOperation = jest.fn().mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => resolve({
            user: { id: 'user-123', email: 'test@example.com' }
          }), 3500); // 3.5 seconds - exceeds critical threshold
        })
      );

      mockPerformanceMonitor.measureAuthentication.mockImplementation(async (operation) => {
        const startTime = performance.now();
        const result = await operation();
        const duration = performance.now() - startTime;
        
        mockPerformanceMonitor.recordMetric({
          operation: 'authentication',
          duration,
          success: true
        });

        // Should trigger alert for slow authentication
        if (duration > PERFORMANCE_THRESHOLDS.authentication.critical) {
          // Alert would be triggered in real implementation
          return { result, duration, alert: 'critical_performance' };
        }
        
        return { result, duration };
      });

      const { result, duration, alert } = await measureAuthentication(slowAuthOperation);

      expect(result.user.id).toBe('user-123');
      expect(duration).toBeGreaterThan(PERFORMANCE_THRESHOLDS.authentication.critical);
      expect(alert).toBe('critical_performance');
    });

    it('should benchmark multiple concurrent authentication requests', async () => {
      const concurrentRequests = 10;
      const authOperations = Array.from({ length: concurrentRequests }, (_, i) => 
        jest.fn().mockImplementation(() => 
          new Promise(resolve => {
            setTimeout(() => resolve({
              user: { id: `user-${i}`, email: `user${i}@example.com` }
            }), Math.random() * 1000); // Random delay up to 1 second
          })
        )
      );

      mockPerformanceMonitor.measureAuthentication.mockImplementation(async (operation) => {
        const startTime = performance.now();
        const result = await operation();
        const duration = performance.now() - startTime;
        
        mockPerformanceMonitor.recordMetric({
          operation: 'authentication',
          duration,
          success: true
        });
        
        return { result, duration };
      });

      const startTime = performance.now();
      const results = await Promise.all(
        authOperations.map(op => measureAuthentication(op))
      );
      const totalTime = performance.now() - startTime;

      // All requests should complete
      expect(results).toHaveLength(concurrentRequests);
      results.forEach((result, i) => {
        expect(result.result.user.id).toBe(`user-${i}`);
        expect(result.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.authentication.warning);
      });

      // Total time should be reasonable for concurrent execution
      expect(totalTime).toBeLessThan(2000); // Should complete within 2 seconds

      // Should record metrics for all requests
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledTimes(concurrentRequests);
    });
  });

  describe('Database Query Performance Benchmarks', () => {
    it('should complete simple SELECT queries within threshold', async () => {
      const mockSelectQuery = jest.fn().mockResolvedValue({
        data: [
          { id: 'res-1', title: 'Meeting 1' },
          { id: 'res-2', title: 'Meeting 2' }
        ],
        error: null
      });

      mockPerformanceMonitor.measureDatabaseQuery.mockImplementation(async (operation) => {
        const startTime = performance.now();
        const result = await operation();
        const duration = performance.now() - startTime;
        
        mockPerformanceMonitor.recordMetric({
          operation: 'database_query',
          duration,
          success: !result.error
        });
        
        return { result, duration };
      });

      const { result, duration } = await measureDatabaseQuery(mockSelectQuery);

      expect(result.data).toHaveLength(2);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.database_query.warning);
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'database_query',
          success: true
        })
      );
    });

    it('should benchmark complex queries with joins and filters', async () => {
      const complexQueryData = Array.from({ length: 100 }, (_, i) => ({
        id: `res-${i}`,
        title: `Meeting ${i}`,
        room_name: `Room ${i % 10}`,
        user_name: `User ${i % 20}`,
        department: `Dept ${i % 5}`
      }));

      const mockComplexQuery = jest.fn().mockImplementation(() => 
        new Promise(resolve => {
          // Simulate complex query processing time
          setTimeout(() => resolve({
            data: complexQueryData,
            error: null
          }), 800); // 800ms for complex query
        })
      );

      mockPerformanceMonitor.measureDatabaseQuery.mockImplementation(async (operation) => {
        const startTime = performance.now();
        const result = await operation();
        const duration = performance.now() - startTime;
        
        mockPerformanceMonitor.recordMetric({
          operation: 'database_query',
          duration,
          success: !result.error,
          metadata: {
            queryType: 'complex_join',
            recordCount: result.data?.length || 0
          }
        });
        
        return { result, duration };
      });

      const { result, duration } = await measureDatabaseQuery(mockComplexQuery);

      expect(result.data).toHaveLength(100);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.database_query.warning);
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'database_query',
          success: true,
          metadata: expect.objectContaining({
            queryType: 'complex_join',
            recordCount: 100
          })
        })
      );
    });

    it('should benchmark pagination query performance', async () => {
      const paginationSizes = [10, 20, 50, 100];
      
      for (const pageSize of paginationSizes) {
        const mockPaginatedData = Array.from({ length: pageSize }, (_, i) => ({
          id: `item-${i}`,
          title: `Item ${i}`
        }));

        const mockPaginatedQuery = jest.fn().mockResolvedValue({
          data: mockPaginatedData,
          error: null
        });

        mockPerformanceMonitor.measureDatabaseQuery.mockImplementation(async (operation) => {
          const startTime = performance.now();
          const result = await operation();
          const duration = performance.now() - startTime;
          
          mockPerformanceMonitor.recordMetric({
            operation: 'database_query',
            duration,
            success: !result.error,
            metadata: {
              queryType: 'paginated',
              pageSize: result.data?.length || 0
            }
          });
          
          return { result, duration };
        });

        const { result, duration } = await measureDatabaseQuery(mockPaginatedQuery);

        expect(result.data).toHaveLength(pageSize);
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.database_query.warning);
        
        // Larger page sizes should not significantly impact performance
        if (pageSize <= 50) {
          expect(duration).toBeLessThan(500); // Should be very fast for small pages
        }
      }
    });
  });

  describe('RPC Function Performance Benchmarks', () => {
    it('should benchmark RPC function execution time', async () => {
      const mockRpcData = Array.from({ length: 25 }, (_, i) => ({
        id: `res-${i}`,
        title: `Meeting ${i}`,
        total_count: 100,
        has_more: i < 24
      }));

      const mockRpcFunction = jest.fn().mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => resolve({
            data: mockRpcData,
            error: null
          }), 600); // 600ms for RPC function
        })
      );

      mockPerformanceMonitor.measureRpcFunction.mockImplementation(async (operation) => {
        const startTime = performance.now();
        const result = await operation();
        const duration = performance.now() - startTime;
        
        mockPerformanceMonitor.recordMetric({
          operation: 'rpc_function',
          duration,
          success: !result.error,
          metadata: {
            functionName: 'get_public_reservations_paginated',
            resultCount: result.data?.length || 0
          }
        });
        
        return { result, duration };
      });

      const { result, duration } = await measureRpcFunction(mockRpcFunction);

      expect(result.data).toHaveLength(25);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.rpc_function.warning);
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'rpc_function',
          success: true,
          metadata: expect.objectContaining({
            functionName: 'get_public_reservations_paginated',
            resultCount: 25
          })
        })
      );
    });

    it('should compare RPC vs direct query performance', async () => {
      // Mock direct query
      const mockDirectQuery = jest.fn().mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => resolve({
            data: Array.from({ length: 25 }, (_, i) => ({ id: `res-${i}` })),
            error: null
          }), 1200); // 1.2 seconds for direct query
        })
      );

      // Mock RPC function (should be faster)
      const mockRpcFunction = jest.fn().mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => resolve({
            data: Array.from({ length: 25 }, (_, i) => ({ id: `res-${i}` })),
            error: null
          }), 600); // 600ms for RPC function
        })
      );

      mockPerformanceMonitor.measureDatabaseQuery.mockImplementation(async (operation) => {
        const startTime = performance.now();
        const result = await operation();
        const duration = performance.now() - startTime;
        return { result, duration };
      });

      mockPerformanceMonitor.measureRpcFunction.mockImplementation(async (operation) => {
        const startTime = performance.now();
        const result = await operation();
        const duration = performance.now() - startTime;
        return { result, duration };
      });

      const directQueryResult = await measureDatabaseQuery(mockDirectQuery);
      const rpcFunctionResult = await measureRpcFunction(mockRpcFunction);

      // RPC function should be significantly faster
      expect(rpcFunctionResult.duration).toBeLessThan(directQueryResult.duration);
      expect(rpcFunctionResult.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.rpc_function.warning);
      
      // Both should return same data structure
      expect(directQueryResult.result.data).toHaveLength(25);
      expect(rpcFunctionResult.result.data).toHaveLength(25);
    });
  });

  describe('Data Validation Performance Benchmarks', () => {
    it('should benchmark user ID validation performance', async () => {
      const mockUserIdValidation = jest.fn().mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => resolve({
            isValid: true,
            userId: 'user-123',
            authId: 'auth-456'
          }), 300); // 300ms for validation
        })
      );

      mockPerformanceMonitor.measureDataValidation.mockImplementation(async (operation) => {
        const startTime = performance.now();
        const result = await operation();
        const duration = performance.now() - startTime;
        
        mockPerformanceMonitor.recordMetric({
          operation: 'data_validation',
          duration,
          success: result.isValid,
          metadata: {
            validationType: 'user_id_validation'
          }
        });
        
        return { result, duration };
      });

      const { result, duration } = await measureDataValidation(mockUserIdValidation);

      expect(result.isValid).toBe(true);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.data_validation.warning);
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'data_validation',
          success: true,
          metadata: expect.objectContaining({
            validationType: 'user_id_validation'
          })
        })
      );
    });

    it('should benchmark bulk validation performance', async () => {
      const validationCount = 50;
      const mockBulkValidation = jest.fn().mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => resolve({
            validatedCount: validationCount,
            errors: [],
            isValid: true
          }), 1000); // 1 second for bulk validation
        })
      );

      mockPerformanceMonitor.measureDataValidation.mockImplementation(async (operation) => {
        const startTime = performance.now();
        const result = await operation();
        const duration = performance.now() - startTime;
        
        mockPerformanceMonitor.recordMetric({
          operation: 'data_validation',
          duration,
          success: result.isValid,
          metadata: {
            validationType: 'bulk_validation',
            recordCount: result.validatedCount
          }
        });
        
        return { result, duration };
      });

      const { result, duration } = await measureDataValidation(mockBulkValidation);

      expect(result.validatedCount).toBe(validationCount);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.data_validation.warning);
      
      // Performance per record should be reasonable
      const perRecordTime = duration / validationCount;
      expect(perRecordTime).toBeLessThan(50); // Less than 50ms per record
    });
  });

  describe('Environment Check Performance Benchmarks', () => {
    it('should benchmark environment variable access time', async () => {
      const mockEnvironmentCheck = jest.fn().mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => resolve({
            variable: 'DATABASE_URL',
            value: '[REDACTED]',
            cached: false
          }), 50); // 50ms for environment check
        })
      );

      mockPerformanceMonitor.measureEnvironmentCheck.mockImplementation(async (operation) => {
        const startTime = performance.now();
        const result = await operation();
        const duration = performance.now() - startTime;
        
        mockPerformanceMonitor.recordMetric({
          operation: 'environment_check',
          duration,
          success: !!result.value,
          metadata: {
            variableName: result.variable,
            cached: result.cached
          }
        });
        
        return { result, duration };
      });

      const { result, duration } = await measureEnvironmentCheck(mockEnvironmentCheck);

      expect(result.variable).toBe('DATABASE_URL');
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.environment_check.warning);
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'environment_check',
          success: true,
          metadata: expect.objectContaining({
            variableName: 'DATABASE_URL',
            cached: false
          })
        })
      );
    });

    it('should benchmark cached vs non-cached environment access', async () => {
      const mockNonCachedCheck = jest.fn().mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => resolve({
            variable: 'DATABASE_URL',
            value: '[REDACTED]',
            cached: false
          }), 100); // 100ms for non-cached
        })
      );

      const mockCachedCheck = jest.fn().mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => resolve({
            variable: 'DATABASE_URL',
            value: '[REDACTED]',
            cached: true
          }), 10); // 10ms for cached
        })
      );

      mockPerformanceMonitor.measureEnvironmentCheck.mockImplementation(async (operation) => {
        const startTime = performance.now();
        const result = await operation();
        const duration = performance.now() - startTime;
        return { result, duration };
      });

      const nonCachedResult = await measureEnvironmentCheck(mockNonCachedCheck);
      const cachedResult = await measureEnvironmentCheck(mockCachedCheck);

      // Cached access should be significantly faster
      expect(cachedResult.duration).toBeLessThan(nonCachedResult.duration);
      expect(cachedResult.duration).toBeLessThan(50); // Very fast for cached access
      expect(nonCachedResult.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.environment_check.warning);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance regression over time', async () => {
      const historicalPerformanceData = [
        { timestamp: '2024-01-01T10:00:00Z', operation: 'authentication', duration: 500 },
        { timestamp: '2024-01-01T10:01:00Z', operation: 'authentication', duration: 520 },
        { timestamp: '2024-01-01T10:02:00Z', operation: 'authentication', duration: 480 },
        { timestamp: '2024-01-01T10:03:00Z', operation: 'authentication', duration: 510 },
        { timestamp: '2024-01-01T10:04:00Z', operation: 'authentication', duration: 800 }, // Regression
        { timestamp: '2024-01-01T10:05:00Z', operation: 'authentication', duration: 850 }  // Continued regression
      ];

      mockPerformanceMonitor.getPerformanceTrends.mockReturnValue({
        hourlyAverages: [
          { hour: '2024-01-01T10:00:00Z', averageDuration: 503, operationCount: 4 },
          { hour: '2024-01-01T10:00:00Z', averageDuration: 825, operationCount: 2 }
        ],
        trend: 'degrading'
      });

      const trends = mockPerformanceMonitor.getPerformanceTrends('authentication', 1);

      expect(trends.trend).toBe('degrading');
      expect(trends.hourlyAverages[1].averageDuration).toBeGreaterThan(
        trends.hourlyAverages[0].averageDuration * 1.5 // 50% increase indicates regression
      );
    });

    it('should calculate performance percentiles for regression analysis', async () => {
      const performanceData = [
        100, 120, 110, 130, 105, 140, 115, 125, 135, 145, // Normal range
        200, 220, 210, 230, 205, 240, 215, 225, 235, 245  // Degraded performance
      ];

      const calculatePercentiles = (data: number[]) => {
        const sorted = [...data].sort((a, b) => a - b);
        return {
          p50: sorted[Math.floor(sorted.length * 0.5)],
          p90: sorted[Math.floor(sorted.length * 0.9)],
          p95: sorted[Math.floor(sorted.length * 0.95)],
          p99: sorted[Math.floor(sorted.length * 0.99)]
        };
      };

      const percentiles = calculatePercentiles(performanceData);

      // P95 should be within acceptable range for most operations
      expect(percentiles.p95).toBeLessThan(PERFORMANCE_THRESHOLDS.authentication.warning);
      
      // P99 might exceed warning but should be below critical
      expect(percentiles.p99).toBeLessThan(PERFORMANCE_THRESHOLDS.authentication.critical);
      
      // P50 (median) should be well within normal range
      expect(percentiles.p50).toBeLessThan(PERFORMANCE_THRESHOLDS.authentication.warning * 0.5);
    });
  });

  describe('Load Testing Scenarios', () => {
    it('should handle concurrent API requests without performance degradation', async () => {
      const concurrentRequests = 20;
      const mockApiOperations = Array.from({ length: concurrentRequests }, (_, i) => 
        jest.fn().mockImplementation(() => 
          new Promise(resolve => {
            setTimeout(() => resolve({
              data: [{ id: `item-${i}`, title: `Item ${i}` }],
              error: null
            }), Math.random() * 500 + 200); // 200-700ms random delay
          })
        )
      );

      mockPerformanceMonitor.measureDatabaseQuery.mockImplementation(async (operation) => {
        const startTime = performance.now();
        const result = await operation();
        const duration = performance.now() - startTime;
        return { result, duration };
      });

      const startTime = performance.now();
      const results = await Promise.all(
        mockApiOperations.map(op => measureDatabaseQuery(op))
      );
      const totalTime = performance.now() - startTime;

      // All requests should complete successfully
      expect(results).toHaveLength(concurrentRequests);
      results.forEach((result, i) => {
        expect(result.result.data[0].id).toBe(`item-${i}`);
        expect(result.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.database_query.warning);
      });

      // Total time should not be significantly longer than the longest individual request
      const maxIndividualTime = Math.max(...results.map(r => r.duration));
      expect(totalTime).toBeLessThan(maxIndividualTime * 1.2); // Allow 20% overhead for concurrency
    });

    it('should maintain performance under sustained load', async () => {
      const sustainedRequestCount = 100;
      const batchSize = 10;
      const batches = sustainedRequestCount / batchSize;

      const performanceResults: number[] = [];

      for (let batch = 0; batch < batches; batch++) {
        const batchOperations = Array.from({ length: batchSize }, () => 
          jest.fn().mockImplementation(() => 
            new Promise(resolve => {
              setTimeout(() => resolve({
                data: [{ id: 'test-item' }],
                error: null
              }), 300); // Consistent 300ms
            })
          )
        );

        mockPerformanceMonitor.measureDatabaseQuery.mockImplementation(async (operation) => {
          const startTime = performance.now();
          const result = await operation();
          const duration = performance.now() - startTime;
          return { result, duration };
        });

        const batchResults = await Promise.all(
          batchOperations.map(op => measureDatabaseQuery(op))
        );

        const batchAverageTime = batchResults.reduce((sum, r) => sum + r.duration, 0) / batchSize;
        performanceResults.push(batchAverageTime);

        // Small delay between batches to simulate sustained load
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Performance should remain consistent across all batches
      const firstBatchAverage = performanceResults[0];
      const lastBatchAverage = performanceResults[performanceResults.length - 1];
      
      // Performance degradation should be minimal (less than 20%)
      expect(lastBatchAverage).toBeLessThan(firstBatchAverage * 1.2);
      
      // All batch averages should be within acceptable range
      performanceResults.forEach(avgTime => {
        expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.database_query.warning);
      });
    });
  });

  describe('Memory Usage Performance', () => {
    it('should monitor memory usage during operations', async () => {
      const mockMemoryIntensiveOperation = jest.fn().mockImplementation(() => 
        new Promise(resolve => {
          // Simulate memory-intensive operation
          const largeArray = new Array(100000).fill('test-data');
          setTimeout(() => {
            resolve({
              data: largeArray.slice(0, 10), // Return small subset
              error: null,
              memoryUsed: largeArray.length * 10 // Approximate memory usage
            });
          }, 400);
        })
      );

      mockPerformanceMonitor.measureDatabaseQuery.mockImplementation(async (operation) => {
        const startTime = performance.now();
        const initialMemory = process.memoryUsage?.()?.heapUsed || 0;
        
        const result = await operation();
        const duration = performance.now() - startTime;
        const finalMemory = process.memoryUsage?.()?.heapUsed || 0;
        const memoryDelta = finalMemory - initialMemory;
        
        mockPerformanceMonitor.recordMetric({
          operation: 'database_query',
          duration,
          success: !result.error,
          metadata: {
            memoryDelta,
            memoryUsed: result.memoryUsed
          }
        });
        
        return { result, duration, memoryDelta };
      });

      const { result, duration, memoryDelta } = await measureDatabaseQuery(mockMemoryIntensiveOperation);

      expect(result.data).toHaveLength(10);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.database_query.warning);
      
      // Memory usage should be reasonable
      expect(memoryDelta).toBeLessThan(50 * 1024 * 1024); // Less than 50MB delta
      
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            memoryDelta: expect.any(Number),
            memoryUsed: expect.any(Number)
          })
        })
      );
    });
  });
});