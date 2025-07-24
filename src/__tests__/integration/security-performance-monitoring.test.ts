/**
 * Security and Performance Monitoring Integration Tests
 * Tests integration between security monitoring and performance tracking systems
 * Requirements: 6.1, 6.2, 6.4
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock security monitor
const mockSecurityMonitor = {
  recordEvent: jest.fn(),
  recordAuthFailure: jest.fn(),
  recordSuspiciousAccess: jest.fn(),
  recordDataIntegrityViolation: jest.fn(),
  recordRateLimitExceeded: jest.fn(),
  recordPrivilegeEscalationAttempt: jest.fn(),
  getRecentEvents: jest.fn(),
  getActiveAlerts: jest.fn(),
  getSecurityStats: jest.fn(),
  getSystemHealth: jest.fn(),
  resolveAlert: jest.fn()
};

// Mock performance monitor
const mockPerformanceMonitor = {
  recordMetric: jest.fn(),
  measureAuthentication: jest.fn(),
  measureAuthorization: jest.fn(),
  measureDatabaseQuery: jest.fn(),
  measureRpcFunction: jest.fn(),
  measureDataValidation: jest.fn(),
  measureEnvironmentCheck: jest.fn(),
  getPerformanceStats: jest.fn(),
  getPerformanceAlerts: jest.fn(),
  getPerformanceTrends: jest.fn(),
  getResourceUsage: jest.fn(),
  cleanup: jest.fn()
};

// Mock modules
jest.mock('@/lib/monitoring/security-monitor', () => ({
  securityMonitor: mockSecurityMonitor,
  recordAuthFailure: mockSecurityMonitor.recordAuthFailure,
  recordSuspiciousAccess: mockSecurityMonitor.recordSuspiciousAccess,
  recordDataIntegrityViolation: mockSecurityMonitor.recordDataIntegrityViolation,
  recordRateLimitExceeded: mockSecurityMonitor.recordRateLimitExceeded,
  recordPrivilegeEscalationAttempt: mockSecurityMonitor.recordPrivilegeEscalationAttempt
}));

jest.mock('@/lib/monitoring/performance-monitor', () => ({
  performanceMonitor: mockPerformanceMonitor,
  measureAuthentication: mockPerformanceMonitor.measureAuthentication,
  measureAuthorization: mockPerformanceMonitor.measureAuthorization,
  measureDatabaseQuery: mockPerformanceMonitor.measureDatabaseQuery,
  measureRpcFunction: mockPerformanceMonitor.measureRpcFunction,
  measureDataValidation: mockPerformanceMonitor.measureDataValidation,
  measureEnvironmentCheck: mockPerformanceMonitor.measureEnvironmentCheck
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

import { 
  securityMonitor, 
  recordAuthFailure, 
  recordSuspiciousAccess,
  recordDataIntegrityViolation,
  recordRateLimitExceeded,
  recordPrivilegeEscalationAttempt
} from '@/lib/monitoring/security-monitor';

import { 
  performanceMonitor,
  measureAuthentication,
  measureAuthorization,
  measureDatabaseQuery,
  measureRpcFunction,
  measureDataValidation,
  measureEnvironmentCheck
} from '@/lib/monitoring/performance-monitor';

describe('Security and Performance Monitoring Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Authentication Flow Monitoring', () => {
    it('should monitor authentication performance and security events', async () => {
      const mockAuthOperation = jest.fn().mockResolvedValue({ 
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'token-123' }
      });

      // Mock performance measurement
      mockPerformanceMonitor.measureAuthentication.mockImplementation(async (operation) => {
        const startTime = performance.now();
        const result = await operation();
        const duration = performance.now() - startTime;
        
        mockPerformanceMonitor.recordMetric({
          operation: 'authentication',
          duration,
          success: true,
          metadata: { userId: result.user.id }
        });
        
        return result;
      });

      // Execute authentication with monitoring
      const result = await measureAuthentication(mockAuthOperation, {
        endpoint: '/api/auth/login',
        method: 'POST'
      });

      expect(mockPerformanceMonitor.measureAuthentication).toHaveBeenCalledWith(
        mockAuthOperation,
        expect.objectContaining({
          endpoint: '/api/auth/login',
          method: 'POST'
        })
      );

      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'authentication',
          success: true,
          metadata: expect.objectContaining({
            userId: 'user-123'
          })
        })
      );

      expect(result.user.id).toBe('user-123');
    });

    it('should record authentication failures with performance context', async () => {
      const mockFailedAuthOperation = jest.fn().mockRejectedValue(
        new Error('Invalid credentials')
      );

      mockPerformanceMonitor.measureAuthentication.mockImplementation(async (operation) => {
        const startTime = performance.now();
        let success = false;
        let error: Error | null = null;
        
        try {
          const result = await operation();
          success = true;
          return result;
        } catch (err) {
          success = false;
          error = err as Error;
          throw err;
        } finally {
          const duration = performance.now() - startTime;
          
          mockPerformanceMonitor.recordMetric({
            operation: 'authentication',
            duration,
            success,
            metadata: { error: error?.message }
          });

          if (!success) {
            recordAuthFailure({
              endpoint: '/api/auth/login',
              reason: error?.message || 'Unknown error',
              ipAddress: '192.168.1.1',
              userAgent: 'Mozilla/5.0...'
            });
          }
        }
      });

      await expect(
        measureAuthentication(mockFailedAuthOperation, {
          endpoint: '/api/auth/login',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0...'
        })
      ).rejects.toThrow('Invalid credentials');

      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'authentication',
          success: false,
          metadata: expect.objectContaining({
            error: 'Invalid credentials'
          })
        })
      );

      expect(recordAuthFailure).toHaveBeenCalledWith({
        endpoint: '/api/auth/login',
        reason: 'Invalid credentials',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...'
      });
    });

    it('should detect suspicious authentication patterns', async () => {
      const rapidAuthAttempts = Array.from({ length: 10 }, (_, i) => ({
        userId: 'user-123',
        timestamp: new Date(Date.now() + i * 100), // 100ms apart
        success: false,
        ipAddress: '192.168.1.1'
      }));

      // Simulate rapid authentication attempts
      for (const attempt of rapidAuthAttempts) {
        recordAuthFailure({
          userId: attempt.userId,
          endpoint: '/api/auth/login',
          reason: 'Invalid credentials',
          ipAddress: attempt.ipAddress
        });
      }

      // Mock suspicious access detection
      mockSecurityMonitor.getRecentEvents.mockReturnValue(
        rapidAuthAttempts.map(attempt => ({
          type: 'auth_failure',
          severity: 'medium',
          userId: attempt.userId,
          ipAddress: attempt.ipAddress,
          timestamp: attempt.timestamp,
          details: { reason: 'Invalid credentials' }
        }))
      );

      const recentEvents = securityMonitor.getRecentEvents(50);
      const authFailures = recentEvents.filter(e => e.type === 'auth_failure');
      
      // Should detect rapid succession pattern
      if (authFailures.length >= 5) {
        recordSuspiciousAccess({
          userId: 'user-123',
          ipAddress: '192.168.1.1',
          endpoint: '/api/auth/login',
          pattern: 'rapid_auth_failures',
          riskScore: 85
        });
      }

      expect(recordAuthFailure).toHaveBeenCalledTimes(10);
      expect(recordSuspiciousAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          pattern: 'rapid_auth_failures',
          riskScore: 85
        })
      );
    });
  });

  describe('Database Query Performance Monitoring', () => {
    it('should monitor database query performance with security context', async () => {
      const mockDatabaseQuery = jest.fn().mockResolvedValue({
        data: [{ id: 'res-1', title: 'Meeting 1' }],
        error: null
      });

      mockPerformanceMonitor.measureDatabaseQuery.mockImplementation(async (operation, metadata) => {
        const startTime = performance.now();
        const result = await operation();
        const duration = performance.now() - startTime;
        
        // Record performance metric
        mockPerformanceMonitor.recordMetric({
          operation: 'database_query',
          duration,
          success: !result.error,
          metadata: {
            ...metadata,
            queryType: 'SELECT',
            recordCount: result.data?.length || 0
          }
        });

        // Check for slow queries (security concern)
        if (duration > 2000) {
          recordSuspiciousAccess({
            endpoint: metadata?.endpoint || '/api/unknown',
            pattern: 'slow_database_query',
            riskScore: 60
          });
        }

        return result;
      });

      const result = await measureDatabaseQuery(mockDatabaseQuery, {
        endpoint: '/api/reservations',
        table: 'reservations',
        operation: 'SELECT'
      });

      expect(mockPerformanceMonitor.measureDatabaseQuery).toHaveBeenCalledWith(
        mockDatabaseQuery,
        expect.objectContaining({
          endpoint: '/api/reservations',
          table: 'reservations',
          operation: 'SELECT'
        })
      );

      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'database_query',
          success: true,
          metadata: expect.objectContaining({
            queryType: 'SELECT',
            recordCount: 1
          })
        })
      );

      expect(result.data).toHaveLength(1);
    });

    it('should detect and report slow database queries', async () => {
      const slowQuery = jest.fn().mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ data: [], error: null }), 2500)
        )
      );

      mockPerformanceMonitor.measureDatabaseQuery.mockImplementation(async (operation, metadata) => {
        const startTime = performance.now();
        const result = await operation();
        const duration = performance.now() - startTime;
        
        mockPerformanceMonitor.recordMetric({
          operation: 'database_query',
          duration,
          success: true,
          metadata
        });

        // Detect slow query
        if (duration > 2000) {
          recordSuspiciousAccess({
            endpoint: metadata?.endpoint || '/api/unknown',
            pattern: 'slow_database_query',
            riskScore: Math.min(60 + (duration - 2000) / 100, 100)
          });
        }

        return result;
      });

      await measureDatabaseQuery(slowQuery, {
        endpoint: '/api/reservations',
        table: 'reservations'
      });

      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'database_query',
          success: true
        })
      );

      expect(recordSuspiciousAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          pattern: 'slow_database_query',
          riskScore: expect.any(Number)
        })
      );
    });

    it('should monitor RPC function performance', async () => {
      const mockRpcFunction = jest.fn().mockResolvedValue({
        data: [{ id: 'res-1', total_count: 25, has_more: true }],
        error: null
      });

      mockPerformanceMonitor.measureRpcFunction.mockImplementation(async (operation, metadata) => {
        const startTime = performance.now();
        const result = await operation();
        const duration = performance.now() - startTime;
        
        mockPerformanceMonitor.recordMetric({
          operation: 'rpc_function',
          duration,
          success: !result.error,
          metadata: {
            ...metadata,
            functionName: metadata?.functionName,
            resultCount: result.data?.length || 0
          }
        });

        return result;
      });

      const result = await measureRpcFunction(mockRpcFunction, {
        functionName: 'get_public_reservations_paginated',
        endpoint: '/api/reservations/public-authenticated',
        parameters: { page_limit: 10, page_offset: 0 }
      });

      expect(mockPerformanceMonitor.measureRpcFunction).toHaveBeenCalledWith(
        mockRpcFunction,
        expect.objectContaining({
          functionName: 'get_public_reservations_paginated',
          endpoint: '/api/reservations/public-authenticated'
        })
      );

      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'rpc_function',
          success: true,
          metadata: expect.objectContaining({
            functionName: 'get_public_reservations_paginated',
            resultCount: 1
          })
        })
      );

      expect(result.data[0].total_count).toBe(25);
    });
  });

  describe('Data Validation Performance Monitoring', () => {
    it('should monitor data validation performance', async () => {
      const mockValidationOperation = jest.fn().mockResolvedValue({
        isValid: true,
        userId: 'user-123',
        validatedData: { title: 'Meeting', room_id: 'room-123' }
      });

      mockPerformanceMonitor.measureDataValidation.mockImplementation(async (operation, metadata) => {
        const startTime = performance.now();
        const result = await operation();
        const duration = performance.now() - startTime;
        
        mockPerformanceMonitor.recordMetric({
          operation: 'data_validation',
          duration,
          success: result.isValid,
          metadata: {
            ...metadata,
            validationType: metadata?.validationType,
            recordsValidated: 1
          }
        });

        return result;
      });

      const result = await measureDataValidation(mockValidationOperation, {
        validationType: 'reservation_data',
        endpoint: '/api/reservations',
        table: 'reservations'
      });

      expect(mockPerformanceMonitor.measureDataValidation).toHaveBeenCalledWith(
        mockValidationOperation,
        expect.objectContaining({
          validationType: 'reservation_data',
          endpoint: '/api/reservations'
        })
      );

      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'data_validation',
          success: true,
          metadata: expect.objectContaining({
            validationType: 'reservation_data',
            recordsValidated: 1
          })
        })
      );

      expect(result.isValid).toBe(true);
    });

    it('should record data integrity violations during validation', async () => {
      const mockFailedValidation = jest.fn().mockResolvedValue({
        isValid: false,
        error: 'user_id appears to be auth_id instead of database id',
        correctedUserId: 'db-user-123'
      });

      mockPerformanceMonitor.measureDataValidation.mockImplementation(async (operation, metadata) => {
        const startTime = performance.now();
        const result = await operation();
        const duration = performance.now() - startTime;
        
        mockPerformanceMonitor.recordMetric({
          operation: 'data_validation',
          duration,
          success: result.isValid,
          metadata
        });

        // Record data integrity violation
        if (!result.isValid && result.error?.includes('auth_id')) {
          recordDataIntegrityViolation({
            table: 'reservations',
            operation: 'create',
            violationType: 'auth_id_confusion',
            affectedRecords: 1,
            endpoint: metadata?.endpoint
          });
        }

        return result;
      });

      const result = await measureDataValidation(mockFailedValidation, {
        validationType: 'user_id_validation',
        endpoint: '/api/reservations',
        table: 'reservations'
      });

      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'data_validation',
          success: false
        })
      );

      expect(recordDataIntegrityViolation).toHaveBeenCalledWith({
        table: 'reservations',
        operation: 'create',
        violationType: 'auth_id_confusion',
        affectedRecords: 1,
        endpoint: '/api/reservations'
      });

      expect(result.isValid).toBe(false);
    });
  });

  describe('Environment Security Monitoring', () => {
    it('should monitor environment variable access performance', async () => {
      const mockEnvironmentCheck = jest.fn().mockResolvedValue({
        variable: 'DATABASE_URL',
        value: '[REDACTED]',
        source: 'process.env'
      });

      mockPerformanceMonitor.measureEnvironmentCheck.mockImplementation(async (operation, metadata) => {
        const startTime = performance.now();
        const result = await operation();
        const duration = performance.now() - startTime;
        
        mockPerformanceMonitor.recordMetric({
          operation: 'environment_check',
          duration,
          success: !!result.value,
          metadata: {
            ...metadata,
            variableName: result.variable,
            accessContext: metadata?.accessContext
          }
        });

        return result;
      });

      const result = await measureEnvironmentCheck(mockEnvironmentCheck, {
        variableName: 'DATABASE_URL',
        accessContext: 'database_connection',
        endpoint: '/api/reservations'
      });

      expect(mockPerformanceMonitor.measureEnvironmentCheck).toHaveBeenCalledWith(
        mockEnvironmentCheck,
        expect.objectContaining({
          variableName: 'DATABASE_URL',
          accessContext: 'database_connection'
        })
      );

      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'environment_check',
          success: true,
          metadata: expect.objectContaining({
            variableName: 'DATABASE_URL',
            accessContext: 'database_connection'
          })
        })
      );

      expect(result.variable).toBe('DATABASE_URL');
    });
  });

  describe('Authorization Performance Monitoring', () => {
    it('should monitor authorization checks with performance tracking', async () => {
      const mockAuthorizationCheck = jest.fn().mockResolvedValue({
        authorized: true,
        userId: 'user-123',
        role: 'employee',
        permissions: ['read_reservations', 'create_reservations']
      });

      mockPerformanceMonitor.measureAuthorization.mockImplementation(async (operation, metadata) => {
        const startTime = performance.now();
        const result = await operation();
        const duration = performance.now() - startTime;
        
        mockPerformanceMonitor.recordMetric({
          operation: 'authorization',
          duration,
          success: result.authorized,
          metadata: {
            ...metadata,
            userId: result.userId,
            role: result.role,
            permissionsChecked: result.permissions?.length || 0
          }
        });

        return result;
      });

      const result = await measureAuthorization(mockAuthorizationCheck, {
        endpoint: '/api/reservations',
        action: 'create_reservation',
        resource: 'reservations'
      });

      expect(mockPerformanceMonitor.measureAuthorization).toHaveBeenCalledWith(
        mockAuthorizationCheck,
        expect.objectContaining({
          endpoint: '/api/reservations',
          action: 'create_reservation',
          resource: 'reservations'
        })
      );

      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'authorization',
          success: true,
          metadata: expect.objectContaining({
            userId: 'user-123',
            role: 'employee',
            permissionsChecked: 2
          })
        })
      );

      expect(result.authorized).toBe(true);
    });

    it('should record privilege escalation attempts', async () => {
      const mockUnauthorizedAccess = jest.fn().mockResolvedValue({
        authorized: false,
        userId: 'user-123',
        role: 'employee',
        requiredRole: 'admin',
        attemptedAction: 'delete_user'
      });

      mockPerformanceMonitor.measureAuthorization.mockImplementation(async (operation, metadata) => {
        const startTime = performance.now();
        const result = await operation();
        const duration = performance.now() - startTime;
        
        mockPerformanceMonitor.recordMetric({
          operation: 'authorization',
          duration,
          success: result.authorized,
          metadata
        });

        // Record privilege escalation attempt
        if (!result.authorized && result.requiredRole && result.role !== result.requiredRole) {
          recordPrivilegeEscalationAttempt({
            userId: result.userId,
            endpoint: metadata?.endpoint || '/api/unknown',
            attemptedAction: result.attemptedAction,
            currentRole: result.role,
            requiredRole: result.requiredRole
          });
        }

        return result;
      });

      const result = await measureAuthorization(mockUnauthorizedAccess, {
        endpoint: '/api/admin/users/delete',
        action: 'delete_user',
        resource: 'users'
      });

      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'authorization',
          success: false
        })
      );

      expect(recordPrivilegeEscalationAttempt).toHaveBeenCalledWith({
        userId: 'user-123',
        endpoint: '/api/admin/users/delete',
        attemptedAction: 'delete_user',
        currentRole: 'employee',
        requiredRole: 'admin'
      });

      expect(result.authorized).toBe(false);
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should monitor rate limiting with performance context', async () => {
      const rateLimitEvents = Array.from({ length: 15 }, (_, i) => ({
        userId: 'user-123',
        endpoint: '/api/reservations',
        timestamp: new Date(Date.now() + i * 100),
        ipAddress: '192.168.1.1'
      }));

      // Simulate rate limit exceeded
      for (const event of rateLimitEvents) {
        if (rateLimitEvents.indexOf(event) >= 10) { // After 10 requests
          recordRateLimitExceeded({
            userId: event.userId,
            ipAddress: event.ipAddress,
            endpoint: event.endpoint,
            requestCount: rateLimitEvents.indexOf(event) + 1,
            timeWindow: 60, // 1 minute
            limit: 10
          });
        }
      }

      expect(recordRateLimitExceeded).toHaveBeenCalledTimes(5); // Calls 11-15
      expect(recordRateLimitExceeded).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          endpoint: '/api/reservations',
          requestCount: expect.any(Number),
          limit: 10
        })
      );
    });
  });

  describe('System Health Integration', () => {
    it('should provide integrated system health status', async () => {
      const mockSecurityHealth = {
        status: 'healthy',
        eventsCount: 150,
        alertsCount: 2,
        memoryUsage: 0.3,
        lastEventTime: '2024-01-01T10:00:00Z'
      };

      const mockPerformanceHealth = {
        memoryUsage: 0.25,
        metricsCount: 5000,
        alertsCount: 1,
        oldestMetricAge: 120 // minutes
      };

      mockSecurityMonitor.getSystemHealth.mockReturnValue(mockSecurityHealth);
      mockPerformanceMonitor.getResourceUsage.mockReturnValue(mockPerformanceHealth);

      const securityHealth = securityMonitor.getSystemHealth();
      const performanceHealth = performanceMonitor.getResourceUsage();

      // Integrated health assessment
      const integratedHealth = {
        overall: securityHealth.status === 'healthy' && performanceHealth.memoryUsage < 0.8 ? 'healthy' : 'degraded',
        security: securityHealth,
        performance: performanceHealth,
        recommendations: []
      };

      if (performanceHealth.memoryUsage > 0.7) {
        integratedHealth.recommendations.push('Consider cleaning up old performance metrics');
      }

      if (securityHealth.alertsCount > 5) {
        integratedHealth.recommendations.push('Review and resolve active security alerts');
      }

      expect(integratedHealth.overall).toBe('healthy');
      expect(integratedHealth.security.status).toBe('healthy');
      expect(integratedHealth.performance.memoryUsage).toBe(0.25);
      expect(integratedHealth.recommendations).toHaveLength(0);
    });

    it('should detect degraded system performance', async () => {
      const mockDegradedSecurityHealth = {
        status: 'degraded',
        eventsCount: 500,
        alertsCount: 8,
        memoryUsage: 0.85
      };

      const mockDegradedPerformanceHealth = {
        memoryUsage: 0.9,
        metricsCount: 45000,
        alertsCount: 5,
        oldestMetricAge: 1440 // 24 hours
      };

      mockSecurityMonitor.getSystemHealth.mockReturnValue(mockDegradedSecurityHealth);
      mockPerformanceMonitor.getResourceUsage.mockReturnValue(mockDegradedPerformanceHealth);

      const securityHealth = securityMonitor.getSystemHealth();
      const performanceHealth = performanceMonitor.getResourceUsage();

      const integratedHealth = {
        overall: 'critical',
        security: securityHealth,
        performance: performanceHealth,
        recommendations: [
          'Immediate cleanup of performance metrics required',
          'Review and resolve security alerts',
          'Consider increasing system resources'
        ]
      };

      expect(integratedHealth.overall).toBe('critical');
      expect(integratedHealth.security.status).toBe('degraded');
      expect(integratedHealth.performance.memoryUsage).toBe(0.9);
      expect(integratedHealth.recommendations).toHaveLength(3);
    });
  });
});