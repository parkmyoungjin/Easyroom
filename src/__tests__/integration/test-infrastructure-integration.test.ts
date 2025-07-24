/**
 * Test Infrastructure Integration Test
 * Validates that all automated testing infrastructure components work together
 * Requirements: 6.1, 6.2, 6.4, 6.5
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import testInfrastructure from '../setup/test-infrastructure.setup';

const {
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
} = testInfrastructure;

describe('Test Infrastructure Integration', () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    cleanup = setupTestEnvironment();
  });

  afterEach(() => {
    if (cleanup) {
      cleanup();
    }
  });

  describe('Test Data Generation', () => {
    it('should generate consistent mock data', () => {
      const user = createMockUser();
      const reservation = createMockReservation();
      const room = createMockRoom();

      // Validate structure
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('auth_id');
      expect(user).toHaveProperty('email');
      expect(validateUUID(user.id)).toBe(true);
      expect(validateEmail(user.email)).toBe(true);

      expect(reservation).toHaveProperty('id');
      expect(reservation).toHaveProperty('room_id');
      expect(reservation).toHaveProperty('user_id');
      expect(validateUUID(reservation.id)).toBe(true);
      expect(validateDatetime(reservation.start_time)).toBe(true);

      expect(room).toHaveProperty('id');
      expect(room).toHaveProperty('name');
      expect(room).toHaveProperty('capacity');
      expect(validateUUID(room.id)).toBe(true);
      expect(typeof room.capacity).toBe('number');
    });

    it('should generate bulk test data efficiently', () => {
      const userCount = 100;
      const reservationCount = 50;
      const roomCount = 20;

      const startTime = performance.now();
      
      const users = generateTestUsers(userCount);
      const reservations = generateTestReservations(reservationCount);
      const rooms = generateTestRooms(roomCount);
      
      const duration = performance.now() - startTime;

      expect(users).toHaveLength(userCount);
      expect(reservations).toHaveLength(reservationCount);
      expect(rooms).toHaveLength(roomCount);

      // Should generate data quickly
      expect(duration).toBeLessThan(1000); // Less than 1 second

      // Validate uniqueness
      const userIds = users.map(u => u.id);
      const uniqueUserIds = new Set(userIds);
      expect(uniqueUserIds.size).toBe(userCount);
    });

    it('should support data customization', () => {
      const customUser = createMockUser({
        name: 'Custom User',
        email: 'custom@example.com',
        role: 'admin'
      });

      expect(customUser.name).toBe('Custom User');
      expect(customUser.email).toBe('custom@example.com');
      expect(customUser.role).toBe('admin');
      
      // Other fields should use defaults
      expect(validateUUID(customUser.id)).toBe(true);
      expect(customUser.department).toBe('Engineering');
    });
  });

  describe('Performance Measurement Integration', () => {
    it('should measure execution time accurately', async () => {
      const mockOperation = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 500))
      );

      const { result, duration } = await measureExecutionTime(mockOperation);

      expect(mockOperation).toHaveBeenCalled();
      expect(duration).toBeGreaterThan(450); // Allow some variance
      expect(duration).toBeLessThan(600);
    });

    it('should validate performance thresholds', () => {
      // Should pass for acceptable performance
      expect(() => {
        assertPerformanceThreshold('authentication', 800, 'warning');
      }).not.toThrow();

      // Should fail for poor performance
      expect(() => {
        assertPerformanceThreshold('authentication', 3500, 'critical');
      }).toThrow('Performance threshold exceeded');
    });

    it('should handle unknown operations gracefully', () => {
      expect(() => {
        assertPerformanceThreshold('unknown_operation', 1000);
      }).toThrow('No performance threshold defined');
    });
  });

  describe('Mock System Integration', () => {
    it('should create functional Supabase client mock', () => {
      const mockClient = createMockSupabaseClient();

      expect(mockClient.from).toBeDefined();
      expect(mockClient.rpc).toBeDefined();
      expect(mockClient.auth.getUser).toBeDefined();

      // Test chaining
      const query = mockClient.from('users');
      expect(query.select).toBeDefined();
      expect(query.eq).toBeDefined();
    });

    it('should create comprehensive monitoring system mocks', () => {
      const { securityMonitor, performanceMonitor } = createMockMonitoringSystems();

      // Security monitor methods
      expect(securityMonitor.recordEvent).toBeDefined();
      expect(securityMonitor.recordAuthFailure).toBeDefined();
      expect(securityMonitor.getSecurityStats).toBeDefined();

      // Performance monitor methods
      expect(performanceMonitor.recordMetric).toBeDefined();
      expect(performanceMonitor.measureAuthentication).toBeDefined();
      expect(performanceMonitor.getPerformanceStats).toBeDefined();

      // Test mock functionality
      securityMonitor.recordEvent({ type: 'test', severity: 'low' });
      expect(securityMonitor.recordEvent).toHaveBeenCalledWith({
        type: 'test',
        severity: 'low'
      });
    });
  });

  describe('Event Creation Integration', () => {
    it('should create consistent security events', () => {
      const event = createSecurityEvent('auth_failure', {
        userId: 'test-user',
        severity: 'high'
      });

      expect(event.type).toBe('auth_failure');
      expect(event.userId).toBe('test-user');
      expect(event.severity).toBe('high');
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.ipAddress).toBe('192.168.1.1'); // Default value
    });

    it('should create performance metrics with proper structure', () => {
      const metric = createPerformanceMetric('database_query', {
        duration: 1200,
        success: false,
        metadata: { table: 'users' }
      });

      expect(metric.operation).toBe('database_query');
      expect(metric.duration).toBe(1200);
      expect(metric.success).toBe(false);
      expect(metric.metadata.table).toBe('users');
      expect(typeof metric.timestamp).toBe('string');
    });

    it('should create data integrity violations', () => {
      const violation = createDataIntegrityViolation('auth_id_confusion', {
        table: 'reservations',
        affectedRecords: 3
      });

      expect(violation.type).toBe('auth_id_confusion');
      expect(violation.table).toBe('reservations');
      expect(violation.affectedRecords).toBe(3);
      expect(violation.operation).toBe('create'); // Default value
    });
  });

  describe('Validation Utilities Integration', () => {
    it('should validate UUIDs correctly', () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
      ];

      const invalidUUIDs = [
        'invalid-uuid',
        '123',
        '',
        '123e4567-e89b-12d3-a456-42661417400', // Too short
        '123e4567-e89b-12d3-a456-4266141740000' // Too long
      ];

      validUUIDs.forEach(uuid => {
        expect(validateUUID(uuid)).toBe(true);
      });

      invalidUUIDs.forEach(uuid => {
        expect(validateUUID(uuid)).toBe(false);
      });
    });

    it('should validate email addresses correctly', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org'
      ];

      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user@.com',
        ''
      ];

      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });

    it('should validate datetime strings correctly', () => {
      const validDatetimes = [
        '2024-01-01T10:00:00Z',
        '2024-12-31T23:59:59.999Z',
        '2024-06-15T14:30:00.000Z'
      ];

      const invalidDatetimes = [
        '2024-01-01',
        '10:00:00',
        'invalid-date',
        '2024-01-01T25:00:00Z', // Invalid hour
        ''
      ];

      validDatetimes.forEach(datetime => {
        expect(validateDatetime(datetime)).toBe(true);
      });

      invalidDatetimes.forEach(datetime => {
        expect(validateDatetime(datetime)).toBe(false);
      });
    });
  });

  describe('Test Result Aggregation', () => {
    it('should aggregate test results correctly', () => {
      const testResults = [
        { name: 'Test 1', passed: true, duration: 500 },
        { name: 'Test 2', passed: true, duration: 300 },
        { name: 'Test 3', passed: false, duration: 800, errors: ['Assertion failed'] },
        { name: 'Test 4', passed: true, duration: 200 }
      ];

      const aggregated = aggregateTestResults(testResults);

      expect(aggregated.summary.total).toBe(4);
      expect(aggregated.summary.passed).toBe(3);
      expect(aggregated.summary.failed).toBe(1);
      expect(aggregated.summary.successRate).toBe(75);
      expect(aggregated.summary.totalDuration).toBe(1800);
      expect(aggregated.summary.averageDuration).toBe(450);

      expect(aggregated.failedTests).toHaveLength(1);
      expect(aggregated.failedTests[0].name).toBe('Test 3');
      expect(aggregated.failedTests[0].errors).toEqual(['Assertion failed']);

      expect(aggregated.performanceStats.fastest).toBe(200);
      expect(aggregated.performanceStats.slowest).toBe(800);
      expect(aggregated.performanceStats.median).toBe(500); // Median of [200, 300, 500, 800] is 500 (index 2)
    });

    it('should handle empty test results', () => {
      const aggregated = aggregateTestResults([]);

      expect(aggregated.summary.total).toBe(0);
      expect(aggregated.summary.passed).toBe(0);
      expect(aggregated.summary.failed).toBe(0);
      expect(aggregated.summary.successRate).toBe(NaN);
      expect(aggregated.failedTests).toHaveLength(0);
    });
  });

  describe('Configuration Integration', () => {
    it('should provide consistent performance thresholds', () => {
      expect(PERFORMANCE_THRESHOLDS.authentication.warning).toBe(1000);
      expect(PERFORMANCE_THRESHOLDS.authentication.critical).toBe(3000);
      expect(PERFORMANCE_THRESHOLDS.database_query.warning).toBe(2000);
      expect(PERFORMANCE_THRESHOLDS.rpc_function.critical).toBe(4000);
    });

    it('should provide security test configuration', () => {
      expect(SECURITY_TEST_CONFIG.maxAuthFailures).toBe(5);
      expect(SECURITY_TEST_CONFIG.suspiciousActivityThreshold).toBe(3);
      expect(SECURITY_TEST_CONFIG.rateLimitThreshold).toBe(10);
    });

    it('should provide data integrity configuration', () => {
      expect(DATA_INTEGRITY_CONFIG.maxOrphanedRecords).toBe(0);
      expect(DATA_INTEGRITY_CONFIG.maxDuplicateAuthIds).toBe(0);
      expect(DATA_INTEGRITY_CONFIG.validationTimeout).toBe(5000);
    });
  });

  describe('End-to-End Integration Scenario', () => {
    it('should support complete testing workflow', async () => {
      // 1. Generate test data
      const users = generateTestUsers(5);
      const reservations = generateTestReservations(3);

      // 2. Create mock systems
      const mockClient = createMockSupabaseClient();
      const { securityMonitor, performanceMonitor } = createMockMonitoringSystems();

      // 3. Simulate operations with performance measurement
      const mockDatabaseOperation = jest.fn().mockResolvedValue({
        data: reservations,
        error: null
      });

      const { result, duration } = await measureExecutionTime(mockDatabaseOperation);

      // 4. Record metrics and events
      const performanceMetric = createPerformanceMetric('database_query', {
        duration,
        success: !result.error,
        metadata: { recordCount: result.data.length }
      });

      performanceMonitor.recordMetric(performanceMetric);

      // 5. Validate results
      expect(result.data).toHaveLength(3);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.database_query.warning);
      expect(performanceMonitor.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'database_query',
          success: true
        })
      );

      // 6. Aggregate and validate
      const testResults = [
        { name: 'Database Operation Test', passed: true, duration }
      ];

      const aggregated = aggregateTestResults(testResults);
      expect(aggregated.summary.successRate).toBe(100);
    });

    it('should handle failure scenarios gracefully', async () => {
      // Simulate failed operation
      const mockFailedOperation = jest.fn().mockRejectedValue(
        new Error('Database connection failed')
      );

      const { securityMonitor } = createMockMonitoringSystems();

      try {
        await measureExecutionTime(mockFailedOperation);
      } catch (error) {
        // Record security event for failure
        const securityEvent = createSecurityEvent('database_error', {
          severity: 'high',
          details: { error: (error as Error).message }
        });

        securityMonitor.recordEvent(securityEvent);
      }

      expect(mockFailedOperation).toHaveBeenCalled();
      expect(securityMonitor.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'database_error',
          severity: 'high'
        })
      );
    });
  });

  describe('Global Configuration Access', () => {
    it('should provide global test configuration', () => {
      expect((global as any).testConfig).toBeDefined();
      expect((global as any).testConfig.performanceThresholds).toBeDefined();
      expect((global as any).testConfig.securityTestConfig).toBeDefined();
      expect((global as any).testConfig.dataIntegrityConfig).toBeDefined();
    });
  });
});