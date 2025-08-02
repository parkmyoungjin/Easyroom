/**
 * Test Infrastructure Setup
 * Configures testing environment for automated testing infrastructure
 * Requirements: 6.1, 6.2, 6.4, 6.5
 */

import { jest } from '@jest/globals';

// Global test configuration
declare global {
  namespace NodeJS {
    interface Global {
      testConfig: {
        performanceThresholds: Record<string, { warning: number; critical: number }>;
        securityTestConfig: {
          maxAuthFailures: number;
          suspiciousActivityThreshold: number;
          rateLimitThreshold: number;
        };
        dataIntegrityConfig: {
          maxOrphanedRecords: number;
          maxDuplicateAuthIds: number;
          validationTimeout: number;
        };
      };
    }
  }
}

// Performance thresholds for all test suites
export const PERFORMANCE_THRESHOLDS = {
  authentication: { warning: 1000, critical: 3000 },
  authorization: { warning: 500, critical: 1500 },
  database_query: { warning: 2000, critical: 5000 },
  rpc_function: { warning: 1500, critical: 4000 },
  data_validation: { warning: 800, critical: 2000 },
  environment_check: { warning: 200, critical: 500 },
  api_validation: { warning: 300, critical: 1000 }
};

// Security testing configuration
export const SECURITY_TEST_CONFIG = {
  maxAuthFailures: 5,
  suspiciousActivityThreshold: 3,
  rateLimitThreshold: 10,
  privilegeEscalationTolerance: 0,
  dataIntegrityViolationTolerance: 0
};

// Data integrity testing configuration
export const DATA_INTEGRITY_CONFIG = {
  maxOrphanedRecords: 0,
  maxDuplicateAuthIds: 0,
  validationTimeout: 5000,
  maxConstraintViolations: 0,
  maxReferentialIntegrityErrors: 0
};

// Mock factories for consistent test data
export const createMockUser = (overrides: Partial<any> = {}) => ({
  id: '123e4567-e89b-12d3-a456-426614174000',
  auth_id: '123e4567-e89b-12d3-a456-426614174001',
  name: 'Test User',
  email: 'test@example.com',
  department: 'Engineering',
  role: 'employee',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides
});

export const createMockReservation = (overrides: Partial<any> = {}) => ({
  id: '123e4567-e89b-12d3-a456-426614174002',
  room_id: '123e4567-e89b-12d3-a456-426614174003',
  user_id: '123e4567-e89b-12d3-a456-426614174000',
  title: 'Test Meeting',
  purpose: 'Team discussion',
  start_time: '2024-01-01T10:00:00Z',
  end_time: '2024-01-01T11:00:00Z',
  status: 'confirmed',
  created_at: '2024-01-01T09:00:00Z',
  updated_at: '2024-01-01T09:00:00Z',
  ...overrides
});

export const createMockRoom = (overrides: Partial<any> = {}) => ({
  id: '123e4567-e89b-12d3-a456-426614174003',
  name: 'Conference Room A',
  description: 'Large conference room',
  capacity: 10,
  location: 'Building 1, Floor 2',
  amenities: { projector: true, whiteboard: false },
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides
});

// Performance measurement utilities
export const measureExecutionTime = async <T>(
  operation: () => Promise<T>
): Promise<{ result: T; duration: number }> => {
  const startTime = performance.now();
  const result = await operation();
  const duration = performance.now() - startTime;
  return { result, duration };
};

export const assertPerformanceThreshold = (
  operation: string,
  duration: number,
  level: 'warning' | 'critical' = 'warning'
) => {
  const threshold = PERFORMANCE_THRESHOLDS[operation as keyof typeof PERFORMANCE_THRESHOLDS];
  if (!threshold) {
    throw new Error(`No performance threshold defined for operation: ${operation}`);
  }
  
  const limit = threshold[level];
  if (duration > limit) {
    throw new Error(
      `Performance threshold exceeded for ${operation}: ${duration}ms > ${limit}ms (${level})`
    );
  }
};

// Security test utilities
export const createSecurityEvent = (type: string, overrides: Partial<any> = {}) => ({
  type,
  severity: 'medium',
  timestamp: new Date(),
  userId: 'test-user-123',
  ipAddress: '192.168.1.1',
  endpoint: '/api/test',
  details: {},
  ...overrides
});

export const createPerformanceMetric = (operation: string, overrides: Partial<any> = {}) => ({
  operation,
  duration: 500,
  timestamp: new Date().toISOString(),
  success: true,
  metadata: {},
  ...overrides
});

// Data integrity test utilities
export const createDataIntegrityViolation = (type: string, overrides: Partial<any> = {}) => ({
  type,
  table: 'test_table',
  operation: 'create',
  affectedRecords: 1,
  timestamp: new Date().toISOString(),
  details: {},
  ...overrides
});

// Mock Supabase client factory
export const createMockSupabaseClient = () => {
  const mockQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis()
  };

  return {
    from: jest.fn(() => mockQuery),
    rpc: jest.fn(),
    auth: {
      getUser: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn()
    },
    query: mockQuery
  };
};

// Mock monitoring systems factory
export const createMockMonitoringSystems = () => ({
  securityMonitor: {
    recordEvent: jest.fn(),
    recordAuthFailure: jest.fn(),
    recordSuspiciousAccess: jest.fn(),
    recordDataIntegrityViolation: jest.fn(),
    recordRateLimitExceeded: jest.fn(),
    recordPrivilegeEscalationAttempt: jest.fn(),
    getRecentEvents: jest.fn(() => []),
    getActiveAlerts: jest.fn(() => []),
    getSecurityStats: jest.fn(() => ({
      totalEvents: 0,
      eventsByType: {},
      eventsBySeverity: {},
      activeAlerts: 0
    })),
    getSystemHealth: jest.fn(() => ({
      status: 'healthy',
      eventsCount: 0,
      alertsCount: 0,
      memoryUsage: 0.1
    })),
    resolveAlert: jest.fn(() => true)
  },
  performanceMonitor: {
    recordMetric: jest.fn(),
    measureAuthentication: jest.fn(),
    measureAuthorization: jest.fn(),
    measureDatabaseQuery: jest.fn(),
    measureRpcFunction: jest.fn(),
    measureDataValidation: jest.fn(),
    measureEnvironmentCheck: jest.fn(),
    getPerformanceStats: jest.fn(() => ({
      totalOperations: 0,
      averageDuration: 0,
      successRate: 100,
      operationStats: {},
      slowestOperations: []
    })),
    getPerformanceAlerts: jest.fn(() => []),
    getPerformanceTrends: jest.fn(() => ({
      hourlyAverages: [],
      trend: 'stable'
    })),
    getResourceUsage: jest.fn(() => ({
      memoryUsage: 0.1,
      metricsCount: 0,
      alertsCount: 0,
      oldestMetricAge: 0
    })),
    cleanup: jest.fn(() => 0)
  }
});

// Test data generators
export const generateTestUsers = (count: number) => 
  Array.from({ length: count }, (_, i) => createMockUser({
    id: `user-${i}`,
    auth_id: `auth-${i}`,
    name: `User ${i}`,
    email: `user${i}@example.com`
  }));

export const generateTestReservations = (count: number) => 
  Array.from({ length: count }, (_, i) => createMockReservation({
    id: `reservation-${i}`,
    title: `Meeting ${i}`,
    start_time: new Date(Date.now() + i * 3600000).toISOString(), // Each hour apart
    end_time: new Date(Date.now() + i * 3600000 + 3600000).toISOString() // 1 hour duration
  }));

export const generateTestRooms = (count: number) => 
  Array.from({ length: count }, (_, i) => createMockRoom({
    id: `room-${i}`,
    name: `Room ${i}`,
    capacity: 5 + (i % 10) // Capacity between 5-14
  }));

// Validation utilities
export const validateUUID = (value: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateDatetime = (datetime: string): boolean => {
  const date = new Date(datetime);
  return !isNaN(date.getTime()) && datetime.includes('T') && datetime.includes('Z');
};

// Test environment setup
export const setupTestEnvironment = () => {
  // Set global test configuration
  (global as any).testConfig = {
    performanceThresholds: PERFORMANCE_THRESHOLDS,
    securityTestConfig: SECURITY_TEST_CONFIG,
    dataIntegrityConfig: DATA_INTEGRITY_CONFIG
  };

  // Mock console methods to reduce test noise
  const originalConsole = { ...console };
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();

  // Return cleanup function
  return () => {
    Object.assign(console, originalConsole);
  };
};

// Test result aggregation utilities
export const aggregateTestResults = (results: Array<{ name: string; passed: boolean; duration: number; errors?: string[] }>) => {
  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const averageDuration = totalDuration / totalTests;

  const failedTestDetails = results
    .filter(r => !r.passed)
    .map(r => ({
      name: r.name,
      errors: r.errors || ['Unknown error']
    }));

  return {
    summary: {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      successRate: (passedTests / totalTests) * 100,
      totalDuration,
      averageDuration
    },
    failedTests: failedTestDetails,
    performanceStats: {
      fastest: Math.min(...results.map(r => r.duration)),
      slowest: Math.max(...results.map(r => r.duration)),
      median: [...results].sort((a, b) => a.duration - b.duration)[Math.floor(results.length / 2)]?.duration || 0
    }
  };
};

// Export all utilities for use in test files
export default {
  PERFORMANCE_THRESHOLDS,
  SECURITY_TEST_CONFIG,
  DATA_INTEGRITY_CONFIG,
  createMockUser,
  createMockReservation,
  createMockRoom,
  measureExecutionTime,
  assertPerformanceThreshold,
  createSecurityEvent,
  createPerformanceMetric,
  createDataIntegrityViolation,
  createMockSupabaseClient,
  createMockMonitoringSystems,
  generateTestUsers,
  generateTestReservations,
  generateTestRooms,
  validateUUID,
  validateEmail,
  validateDatetime,
  setupTestEnvironment,
  aggregateTestResults
};

// Add a simple test to satisfy Jest requirements
describe('Test Infrastructure Setup', () => {
  it('should export performance thresholds', () => {
    expect(PERFORMANCE_THRESHOLDS).toBeDefined();
    expect(PERFORMANCE_THRESHOLDS.authentication).toBeDefined();
  });

  it('should create mock user', () => {
    const user = createMockUser();
    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');
  });
});