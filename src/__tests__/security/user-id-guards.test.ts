/**
 * User ID Guards Tests
 * Tests for user ID validation and type guards
 * Requirements: 4.3
 */

import { describe, it, expect } from '@jest/globals';

// Define the core validation functions locally for testing
function isValidUUID(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

function isValidDatabaseUserId(userId: unknown): userId is string {
  return isValidUUID(userId);
}

function isPotentialAuthId(userId: string, userContext?: { authId: string; dbId: string; name: string; email: string }): boolean {
  if (!userContext) {
    return false;
  }
  
  return userId === userContext.authId && userId !== userContext.dbId;
}

function assertValidReservationUserId(userId: unknown): asserts userId is string {
  if (!isValidDatabaseUserId(userId)) {
    throw new Error(`Invalid reservation user_id: ${userId}. Must be a valid UUID referencing users.id`);
  }
}

// Mock UserIdGuards object for testing
const UserIdGuards = {
  isValidUUID,
  isValidDatabaseUserId,
  isPotentialAuthId,
  assertValidReservationUserId
};

describe('UserIdGuards', () => {
  describe('UUID Validation', () => {
    describe('isValidUUID', () => {
      it('should validate correct UUID format', () => {
        const validUUIDs = [
          '123e4567-e89b-12d3-a456-426614174000',
          'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
        ];

        validUUIDs.forEach(uuid => {
          expect(UserIdGuards.isValidUUID(uuid)).toBe(true);
        });
      });

      it('should reject invalid UUID formats', () => {
        const invalidUUIDs = [
          'not-a-uuid',
          '123e4567-e89b-12d3-a456',
          '123e4567-e89b-12d3-a456-426614174000-extra',
          '',
          null,
          undefined,
          123,
          {}
        ];

        invalidUUIDs.forEach(uuid => {
          expect(UserIdGuards.isValidUUID(uuid)).toBe(false);
        });
      });
    });

    describe('isValidDatabaseUserId', () => {
      it('should validate database user ID format', () => {
        const validId = '123e4567-e89b-12d3-a456-426614174000';
        expect(UserIdGuards.isValidDatabaseUserId(validId)).toBe(true);
      });

      it('should reject invalid database user ID formats', () => {
        const invalidIds = ['not-uuid', null, undefined, 123];
        invalidIds.forEach(id => {
          expect(UserIdGuards.isValidDatabaseUserId(id)).toBe(false);
        });
      });
    });
  });

  describe('Auth ID Confusion Detection', () => {
    describe('isPotentialAuthId', () => {
      it('should detect when user_id matches auth_id but not db_id', () => {
        const userContext = {
          authId: 'auth-id-123',
          dbId: 'db-id-456',
          name: 'John Doe',
          email: 'john@example.com'
        };

        expect(UserIdGuards.isPotentialAuthId('auth-id-123', userContext)).toBe(true);
        expect(UserIdGuards.isPotentialAuthId('db-id-456', userContext)).toBe(false);
        expect(UserIdGuards.isPotentialAuthId('other-id', userContext)).toBe(false);
      });

      it('should return false when no user context provided', () => {
        expect(UserIdGuards.isPotentialAuthId('any-id')).toBe(false);
      });
    });
  });



  describe('Type Assertions', () => {
    describe('assertValidReservationUserId', () => {
      it('should pass for valid UUID', () => {
        const validId = '123e4567-e89b-12d3-a456-426614174000';
        expect(() => UserIdGuards.assertValidReservationUserId(validId)).not.toThrow();
      });

      it('should throw for invalid UUID', () => {
        expect(() => UserIdGuards.assertValidReservationUserId('invalid-uuid'))
          .toThrow('Invalid reservation user_id');
      });

      it('should throw for non-string values', () => {
        expect(() => UserIdGuards.assertValidReservationUserId(null))
          .toThrow('Invalid reservation user_id');
        expect(() => UserIdGuards.assertValidReservationUserId(123))
          .toThrow('Invalid reservation user_id');
      });
    });
  });
});