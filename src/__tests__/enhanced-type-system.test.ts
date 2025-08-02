/**
 * Enhanced Type System Tests
 * Comprehensive tests for branded types and enhanced validation
 * Requirements: 1.1, 1.5
 */

import {
  createAuthId,
  createDatabaseUserId,
  isAuthId,
  isDatabaseUserId,
  toAuthId,
  toDatabaseUserId,
  type AuthId,
  type DatabaseUserId,
  type UserIdValidationContext,
  type EnhancedUserIdValidationResult
} from '@/types/enhanced-types';

import {
  EnhancedUserIdGuards,
  validateUserIdWithContext
} from '@/lib/security/enhanced-user-id-guards';

import {
  userFromDatabase,
  reservationFromDatabase,
  validateDatabaseUserId,
  validateAuthId
} from '@/lib/utils/type-converters';

import type { User, Reservation } from '@/types/database';

// Mock dependencies
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    })),
    auth: {
      getUser: jest.fn(),
      admin: {
        getUserById: jest.fn()
      }
    }
  }
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('@/lib/monitoring/security-monitor', () => ({
  securityMonitor: {
    recordEvent: jest.fn()
  }
}));

jest.mock('@/lib/monitoring/performance-monitor', () => ({
  performanceMonitor: {
    measureDatabaseQuery: jest.fn((fn) => fn())
  }
}));

describe('Enhanced Type System', () => {
  // Test data - Using proper UUID v4 format
  const validUuid = '123e4567-e89b-42d3-a456-426614174000'; // Fixed: 42d3 (starts with 4)
  const invalidUuid = 'invalid-uuid';
  const anotherValidUuid = '987fcdeb-51a2-43d1-8f12-123456789abc'; // Fixed: 43d1 -> 43d1, 8f12 (starts with 8)

  describe('Branded Types', () => {
    describe('AuthId', () => {
      it('should create AuthId from valid UUID', () => {
        const authId = createAuthId(validUuid);
        expect(authId).toBe(validUuid);
        expect(isAuthId(authId)).toBe(true);
      });

      it('should throw error for invalid UUID when creating AuthId', () => {
        expect(() => createAuthId(invalidUuid)).toThrow('Invalid AuthId format');
      });

      it('should validate AuthId type guard', () => {
        const authId = createAuthId(validUuid);
        expect(isAuthId(authId)).toBe(true);
        expect(isAuthId(invalidUuid)).toBe(false);
        expect(isAuthId(null)).toBe(false);
        expect(isAuthId(undefined)).toBe(false);
        expect(isAuthId(123)).toBe(false);
      });

      it('should convert unknown to AuthId safely', () => {
        const authId = toAuthId(validUuid);
        expect(authId).toBe(validUuid);
        expect(isAuthId(authId)).toBe(true);

        expect(() => toAuthId(invalidUuid)).toThrow('Invalid AuthId format');
        expect(() => toAuthId(null)).toThrow('Cannot convert object to AuthId');
        expect(() => toAuthId(123)).toThrow('Cannot convert number to AuthId');
      });
    });

    describe('DatabaseUserId', () => {
      it('should create DatabaseUserId from valid UUID', () => {
        const userId = createDatabaseUserId(validUuid);
        expect(userId).toBe(validUuid);
        expect(isDatabaseUserId(userId)).toBe(true);
      });

      it('should throw error for invalid UUID when creating DatabaseUserId', () => {
        expect(() => createDatabaseUserId(invalidUuid)).toThrow('Invalid DatabaseUserId format');
      });

      it('should validate DatabaseUserId type guard', () => {
        const userId = createDatabaseUserId(validUuid);
        expect(isDatabaseUserId(userId)).toBe(true);
        expect(isDatabaseUserId(invalidUuid)).toBe(false);
        expect(isDatabaseUserId(null)).toBe(false);
        expect(isDatabaseUserId(undefined)).toBe(false);
        expect(isDatabaseUserId(123)).toBe(false);
      });

      it('should convert unknown to DatabaseUserId safely', () => {
        const userId = toDatabaseUserId(validUuid);
        expect(userId).toBe(validUuid);
        expect(isDatabaseUserId(userId)).toBe(true);

        expect(() => toDatabaseUserId(invalidUuid)).toThrow('Invalid DatabaseUserId format');
        expect(() => toDatabaseUserId(null)).toThrow('Cannot convert object to DatabaseUserId');
        expect(() => toDatabaseUserId(123)).toThrow('Cannot convert number to DatabaseUserId');
      });
    });

    describe('Type Safety', () => {
      it('should prevent AuthId and DatabaseUserId confusion at compile time', () => {
        const authId = createAuthId(validUuid);
        const userId = createDatabaseUserId(anotherValidUuid);

        // These should be different types even if they have the same string value
        expect(authId).not.toBe(userId);

        // Note: At runtime, branded types are just strings, so type guards check UUID format
        // The real type safety happens at compile time
        expect(isAuthId(authId)).toBe(true);
        expect(isDatabaseUserId(authId)).toBe(true); // Both are valid UUIDs at runtime
        expect(isAuthId(userId)).toBe(true); // Both are valid UUIDs at runtime
        expect(isDatabaseUserId(userId)).toBe(true);
        
        // The key is that TypeScript will prevent mixing them at compile time
        // This test verifies the creation and basic functionality works
        expect(typeof authId).toBe('string');
        expect(typeof userId).toBe('string');
      });
    });
  });

  describe('Enhanced User ID Guards', () => {
    describe('Type Guards and Assertions', () => {
      it('should assert valid reservation user ID', () => {
        const validUserId = createDatabaseUserId(validUuid);
        
        expect(() => {
          EnhancedUserIdGuards.assertValidReservationUserId(validUserId);
        }).not.toThrow();

        expect(() => {
          EnhancedUserIdGuards.assertValidReservationUserId(invalidUuid);
        }).toThrow('Invalid reservation user_id');

        expect(() => {
          EnhancedUserIdGuards.assertValidReservationUserId(null);
        }).toThrow('Invalid reservation user_id');
      });

      it('should assert valid auth ID', () => {
        const validAuthId = createAuthId(validUuid);
        
        expect(() => {
          EnhancedUserIdGuards.assertValidAuthId(validAuthId);
        }).not.toThrow();

        expect(() => {
          EnhancedUserIdGuards.assertValidAuthId(invalidUuid);
        }).toThrow('Invalid auth_id');

        expect(() => {
          EnhancedUserIdGuards.assertValidAuthId(null);
        }).toThrow('Invalid auth_id');
      });
    });

    describe('Validation Context', () => {
      it('should create proper validation context', () => {
        const context: UserIdValidationContext = {
          operation: 'create',
          table: 'reservations',
          userId: validUuid,
          timestamp: new Date(),
          source: 'client',
          metadata: { test: true }
        };

        expect(context.operation).toBe('create');
        expect(context.table).toBe('reservations');
        expect(context.userId).toBe(validUuid);
        expect(context.source).toBe('client');
        expect(context.metadata).toEqual({ test: true });
        expect(context.timestamp).toBeInstanceOf(Date);
      });

      it('should handle different operation types', () => {
        const operations: UserIdValidationContext['operation'][] = [
          'create', 'update', 'delete', 'query', 'auth_check'
        ];

        operations.forEach(operation => {
          const context: UserIdValidationContext = {
            operation,
            table: 'test_table',
            userId: validUuid,
            timestamp: new Date(),
            source: 'server'
          };

          expect(context.operation).toBe(operation);
        });
      });

      it('should handle different source types', () => {
        const sources: UserIdValidationContext['source'][] = [
          'client', 'server', 'middleware', 'api'
        ];

        sources.forEach(source => {
          const context: UserIdValidationContext = {
            operation: 'query',
            table: 'test_table',
            userId: validUuid,
            timestamp: new Date(),
            source
          };

          expect(context.source).toBe(source);
        });
      });
    });
  });

  describe('Type Converters', () => {
    describe('Database Type Conversion', () => {
      it('should convert database User to EnhancedUser', () => {
        const dbUser: User = {
          id: validUuid,
          auth_id: anotherValidUuid,
          employee_id: 'EMP001',
          name: 'Test User',
          email: 'test@example.com',
          department: 'IT',
          role: 'employee',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-02T00:00:00Z'
        };

        const enhancedUser = userFromDatabase(dbUser);

        expect(isDatabaseUserId(enhancedUser.id)).toBe(true);
        expect(isAuthId(enhancedUser.auth_id)).toBe(true);
        expect(enhancedUser.name).toBe('Test User');
        expect(enhancedUser.email).toBe('test@example.com');
        expect(enhancedUser.department).toBe('IT');
        expect(enhancedUser.role).toBe('employee');
        expect(enhancedUser.created_at).toBeInstanceOf(Date);
        expect(enhancedUser.updated_at).toBeInstanceOf(Date);
      });

      it('should convert database Reservation to EnhancedReservation', () => {
        const dbReservation: Reservation = {
          id: validUuid,
          room_id: anotherValidUuid,
          user_id: validUuid,
          title: 'Test Meeting',
          purpose: 'Team sync',
          start_time: '2023-01-01T10:00:00Z',
          end_time: '2023-01-01T11:00:00Z',
          status: 'confirmed',
          cancellation_reason: null,
          created_at: '2023-01-01T09:00:00Z',
          updated_at: '2023-01-01T09:00:00Z'
        };

        const enhancedReservation = reservationFromDatabase(dbReservation);

        expect(enhancedReservation.id).toBe(validUuid);
        expect(enhancedReservation.room_id).toBe(anotherValidUuid);
        expect(isDatabaseUserId(enhancedReservation.user_id)).toBe(true);
        expect(enhancedReservation.title).toBe('Test Meeting');
        expect(enhancedReservation.purpose).toBe('Team sync');
        expect(enhancedReservation.status).toBe('confirmed');
        expect(enhancedReservation.start_time).toBeInstanceOf(Date);
        expect(enhancedReservation.end_time).toBeInstanceOf(Date);
        expect(enhancedReservation.created_at).toBeInstanceOf(Date);
        expect(enhancedReservation.updated_at).toBeInstanceOf(Date);
      });
    });

    describe('Validation Utilities', () => {
      it('should validate DatabaseUserId conversion', () => {
        const validResult = validateDatabaseUserId(validUuid);
        expect(validResult.isValid).toBe(true);
        if (validResult.isValid) {
          expect(isDatabaseUserId(validResult.userId)).toBe(true);
        }

        const invalidResult = validateDatabaseUserId(invalidUuid);
        expect(invalidResult.isValid).toBe(false);
        if (!invalidResult.isValid) {
          expect(invalidResult.error).toContain('Invalid DatabaseUserId format');
        }
      });

      it('should validate AuthId conversion', () => {
        const validResult = validateAuthId(validUuid);
        expect(validResult.isValid).toBe(true);
        if (validResult.isValid) {
          expect(isAuthId(validResult.authId)).toBe(true);
        }

        const invalidResult = validateAuthId(invalidUuid);
        expect(invalidResult.isValid).toBe(false);
        if (!invalidResult.isValid) {
          expect(invalidResult.error).toContain('Invalid AuthId format');
        }
      });
    });
  });

  describe('Integration Tests', () => {
    it('should maintain type safety throughout the validation pipeline', () => {
      // Create branded types
      const authId = createAuthId(validUuid);
      const userId = createDatabaseUserId(anotherValidUuid);

      // Verify type safety - at runtime, both are valid UUIDs
      expect(isAuthId(authId)).toBe(true);
      expect(isDatabaseUserId(userId)).toBe(true);
      expect(isAuthId(userId)).toBe(true); // Both are valid UUIDs at runtime
      expect(isDatabaseUserId(authId)).toBe(true); // Both are valid UUIDs at runtime

      // Test assertions - these work because they check UUID format
      expect(() => {
        EnhancedUserIdGuards.assertValidAuthId(authId);
      }).not.toThrow();

      expect(() => {
        EnhancedUserIdGuards.assertValidReservationUserId(userId);
      }).not.toThrow();

      // At runtime, both pass UUID validation, but TypeScript prevents mixing at compile time
      expect(() => {
        EnhancedUserIdGuards.assertValidAuthId(userId);
      }).not.toThrow(); // Valid UUID format

      expect(() => {
        EnhancedUserIdGuards.assertValidReservationUserId(authId);
      }).not.toThrow(); // Valid UUID format
      
      // The real benefit is compile-time type safety, not runtime differentiation
      expect(typeof authId).toBe('string');
      expect(typeof userId).toBe('string');
    });

    it('should handle validation context properly', () => {
      const context: UserIdValidationContext = {
        operation: 'create',
        table: 'reservations',
        userId: validUuid,
        timestamp: new Date(),
        source: 'api',
        requestId: 'test-request-123',
        metadata: {
          endpoint: '/api/reservations',
          userAgent: 'test-agent'
        }
      };

      // Verify all context fields are properly typed
      expect(context.operation).toBe('create');
      expect(context.table).toBe('reservations');
      expect(context.userId).toBe(validUuid);
      expect(context.source).toBe('api');
      expect(context.requestId).toBe('test-request-123');
      expect(context.metadata).toEqual({
        endpoint: '/api/reservations',
        userAgent: 'test-agent'
      });
      expect(context.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling', () => {
    it('should provide meaningful error messages for invalid UUIDs', () => {
      expect(() => createAuthId('not-a-uuid')).toThrow('Invalid AuthId format: not-a-uuid');
      expect(() => createDatabaseUserId('also-not-a-uuid')).toThrow('Invalid DatabaseUserId format: also-not-a-uuid');
    });

    it('should handle null and undefined values gracefully', () => {
      expect(isAuthId(null)).toBe(false);
      expect(isAuthId(undefined)).toBe(false);
      expect(isDatabaseUserId(null)).toBe(false);
      expect(isDatabaseUserId(undefined)).toBe(false);

      expect(() => toAuthId(null)).toThrow('Cannot convert object to AuthId');
      expect(() => toAuthId(undefined)).toThrow('Cannot convert undefined to AuthId');
      expect(() => toDatabaseUserId(null)).toThrow('Cannot convert object to DatabaseUserId');
      expect(() => toDatabaseUserId(undefined)).toThrow('Cannot convert undefined to DatabaseUserId');
    });

    it('should handle non-string values appropriately', () => {
      expect(isAuthId(123)).toBe(false);
      expect(isAuthId({})).toBe(false);
      expect(isAuthId([])).toBe(false);
      expect(isDatabaseUserId(123)).toBe(false);
      expect(isDatabaseUserId({})).toBe(false);
      expect(isDatabaseUserId([])).toBe(false);

      expect(() => toAuthId(123)).toThrow('Cannot convert number to AuthId');
      expect(() => toDatabaseUserId({})).toThrow('Cannot convert object to DatabaseUserId');
    });
  });
});

describe('Performance and Security Context Interfaces', () => {
  // Test data for this describe block - Using proper UUID v4 format
  const validUuid = '123e4567-e89b-42d3-a456-426614174000'; // Fixed: 42d3 (starts with 4)
  const anotherValidUuid = '987fcdeb-51a2-43d1-8f12-123456789abc'; // Fixed: 43d1 -> 43d1, 8f12 (starts with 8)

  it('should properly type security event contexts', () => {
    const securityEvent = {
      eventType: 'user_id_mismatch' as const,
      severity: 'high' as const,
      userId: createDatabaseUserId(validUuid),
      authId: createAuthId(anotherValidUuid),
      operation: 'create',
      table: 'reservations',
      timestamp: new Date(),
      source: 'enhanced_user_id_guards',
      metadata: {
        originalUserId: validUuid,
        correctedUserId: anotherValidUuid
      }
    };

    expect(securityEvent.eventType).toBe('user_id_mismatch');
    expect(securityEvent.severity).toBe('high');
    expect(isDatabaseUserId(securityEvent.userId)).toBe(true);
    expect(isAuthId(securityEvent.authId)).toBe(true);
    expect(securityEvent.timestamp).toBeInstanceOf(Date);
  });

  it('should properly type performance metric contexts', () => {
    const performanceMetric = {
      operation: 'user_id_validation' as const,
      duration: 150.5,
      success: true,
      userId: createDatabaseUserId(validUuid),
      endpoint: '/api/reservations',
      timestamp: new Date(),
      correlationId: 'test-correlation-123',
      metadata: {
        validationSteps: 3,
        cacheHit: false
      }
    };

    expect(performanceMetric.operation).toBe('user_id_validation');
    expect(performanceMetric.duration).toBe(150.5);
    expect(performanceMetric.success).toBe(true);
    expect(isDatabaseUserId(performanceMetric.userId)).toBe(true);
    expect(performanceMetric.timestamp).toBeInstanceOf(Date);
  });
});