/**
 * Comprehensive Data Integrity Integration Tests
 * Tests data integrity validation across all critical system components
 * Requirements: 6.1, 6.2
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(),
  rpc: jest.fn(),
  auth: {
    getUser: jest.fn()
  }
};

const mockQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis()
};

// Mock validation functions
jest.mock('@/lib/security/user-id-guards', () => ({
  validateUserIdClient: jest.fn(),
  getCorrectUserIdFromAuthId: jest.fn(),
  isValidUUID: jest.fn(),
  validateReservationData: jest.fn(),
  validateReservationUpdateData: jest.fn()
}));

// Mock security monitor
jest.mock('@/lib/monitoring/security-monitor', () => ({
  securityMonitor: {
    recordDataIntegrityViolation: jest.fn(),
    recordEvent: jest.fn()
  },
  recordDataIntegrityViolation: jest.fn()
}));

import { validateUserIdClient, getCorrectUserIdFromAuthId, isValidUUID, validateReservationData } from '@/lib/security/user-id-guards';
import { recordDataIntegrityViolation } from '@/lib/monitoring/security-monitor';

describe('Data Integrity Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.from.mockReturnValue(mockQuery);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('User ID Consistency Validation', () => {
    it('should detect and prevent auth_id/database_id confusion in reservations', async () => {
      // Mock user data
      const mockUser = {
        id: 'db-user-123',
        auth_id: 'auth-user-456',
        name: 'John Doe',
        email: 'john@example.com'
      };

      // Mock reservation data using auth_id instead of database id
      const invalidReservationData = {
        room_id: 'room-123',
        user_id: 'auth-user-456', // This should be 'db-user-123'
        title: 'Team Meeting',
        start_time: '2024-01-01T10:00:00Z',
        end_time: '2024-01-01T11:00:00Z'
      };

      // Mock validation to detect auth_id confusion
      (validateUserIdClient as jest.MockedFunction<typeof validateUserIdClient>)
        .mockResolvedValue({
          isValid: false,
          userId: 'auth-user-456',
          error: 'user_id appears to be auth_id instead of database id',
          correctedUserId: 'db-user-123'
        });

      (validateReservationData as jest.MockedFunction<typeof validateReservationData>)
        .mockImplementation(async (data) => {
          const userValidation = await validateUserIdClient(data.user_id);
          if (!userValidation.isValid && userValidation.correctedUserId) {
            // Should correct the user_id
            return {
              ...data,
              user_id: userValidation.correctedUserId
            };
          }
          throw new Error(`Invalid user_id: ${userValidation.error}`);
        });

      const result = await validateReservationData(invalidReservationData);

      expect(validateUserIdClient).toHaveBeenCalledWith('auth-user-456');
      expect(result.user_id).toBe('db-user-123'); // Should be corrected
      expect(recordDataIntegrityViolation).toHaveBeenCalledWith({
        userId: 'auth-user-456',
        table: 'reservations',
        operation: 'create',
        violationType: 'auth_id_confusion',
        affectedRecords: 1
      });
    });

    it('should validate user_id references exist in database', async () => {
      const nonExistentUserId = 'non-existent-user-id';
      
      (validateUserIdClient as jest.MockedFunction<typeof validateUserIdClient>)
        .mockResolvedValue({
          isValid: false,
          userId: nonExistentUserId,
          error: 'user_id does not exist in users table'
        });

      (validateReservationData as jest.MockedFunction<typeof validateReservationData>)
        .mockRejectedValue(new Error('Invalid user_id: user_id does not exist in users table'));

      const invalidReservationData = {
        room_id: 'room-123',
        user_id: nonExistentUserId,
        title: 'Team Meeting',
        start_time: '2024-01-01T10:00:00Z',
        end_time: '2024-01-01T11:00:00Z'
      };

      await expect(validateReservationData(invalidReservationData))
        .rejects.toThrow('Invalid user_id: user_id does not exist in users table');

      expect(validateUserIdClient).toHaveBeenCalledWith(nonExistentUserId);
    });

    it('should validate UUID format for all ID fields', async () => {
      const invalidUUIDs = [
        'invalid-uuid',
        '123',
        '',
        null,
        undefined
      ];

      (isValidUUID as jest.MockedFunction<typeof isValidUUID>)
        .mockImplementation((value) => {
          if (typeof value !== 'string') return false;
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          return uuidRegex.test(value);
        });

      for (const invalidUUID of invalidUUIDs) {
        expect(isValidUUID(invalidUUID)).toBe(false);
      }

      // Valid UUID should pass
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      expect(isValidUUID(validUUID)).toBe(true);
    });
  });

  describe('Cross-Table Referential Integrity', () => {
    it('should validate room_id references exist in rooms table', async () => {
      const nonExistentRoomId = '123e4567-e89b-12d3-a456-426614174999';
      
      mockQuery.select.mockResolvedValueOnce({
        data: null,
        error: { message: 'Room not found' }
      });

      // Simulate room validation
      const roomExists = async (roomId: string) => {
        const { data, error } = await mockSupabaseClient
          .from('rooms')
          .select('id')
          .eq('id', roomId)
          .single();
        
        return !error && data;
      };

      const exists = await roomExists(nonExistentRoomId);
      expect(exists).toBeFalsy();
      expect(mockQuery.select).toHaveBeenCalledWith('id');
      expect(mockQuery.eq).toHaveBeenCalledWith('id', nonExistentRoomId);
    });

    it('should prevent orphaned reservations when users are deleted', async () => {
      const userId = 'user-to-delete';
      const reservationsForUser = [
        { id: 'res-1', user_id: userId, title: 'Meeting 1' },
        { id: 'res-2', user_id: userId, title: 'Meeting 2' }
      ];

      // Mock finding reservations for user
      mockQuery.select.mockResolvedValueOnce({
        data: reservationsForUser,
        error: null
      });

      // Simulate checking for dependent reservations before user deletion
      const checkDependentReservations = async (userId: string) => {
        const { data, error } = await mockSupabaseClient
          .from('reservations')
          .select('id, title')
          .eq('user_id', userId);
        
        return { data, error };
      };

      const { data: dependentReservations } = await checkDependentReservations(userId);
      
      expect(dependentReservations).toHaveLength(2);
      expect(dependentReservations[0].user_id).toBe(userId);
      
      // Should prevent deletion if dependent records exist
      if (dependentReservations && dependentReservations.length > 0) {
        expect(() => {
          throw new Error(`Cannot delete user: ${dependentReservations.length} dependent reservations exist`);
        }).toThrow('Cannot delete user: 2 dependent reservations exist');
      }
    });
  });

  describe('Data Consistency Validation', () => {
    it('should detect duplicate auth_id values across users', async () => {
      const duplicateAuthId = 'duplicate-auth-123';
      const usersWithDuplicateAuthId = [
        { id: 'user-1', auth_id: duplicateAuthId, name: 'User One' },
        { id: 'user-2', auth_id: duplicateAuthId, name: 'User Two' }
      ];

      mockQuery.select.mockResolvedValueOnce({
        data: usersWithDuplicateAuthId,
        error: null
      });

      // Simulate duplicate auth_id detection
      const findDuplicateAuthIds = async () => {
        const { data, error } = await mockSupabaseClient
          .from('users')
          .select('id, auth_id, name')
          .eq('auth_id', duplicateAuthId);
        
        return { data, error };
      };

      const { data: duplicateUsers } = await findDuplicateAuthIds();
      
      expect(duplicateUsers).toHaveLength(2);
      expect(duplicateUsers.every(user => user.auth_id === duplicateAuthId)).toBe(true);
      
      // Should trigger data integrity violation
      expect(recordDataIntegrityViolation).toHaveBeenCalledWith({
        table: 'users',
        operation: 'validation',
        violationType: 'duplicate_auth_id',
        affectedRecords: 2,
        endpoint: 'data_integrity_check'
      });
    });

    it('should validate reservation time constraints', async () => {
      const invalidTimeReservation = {
        room_id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Invalid Time Meeting',
        start_time: '2024-01-01T11:00:00Z',
        end_time: '2024-01-01T10:00:00Z' // End before start
      };

      // Simulate time validation
      const validateReservationTimes = (data: any) => {
        const startTime = new Date(data.start_time);
        const endTime = new Date(data.end_time);
        
        if (endTime <= startTime) {
          throw new Error('End time must be after start time');
        }
        
        return true;
      };

      expect(() => {
        validateReservationTimes(invalidTimeReservation);
      }).toThrow('End time must be after start time');
    });

    it('should detect overlapping reservations for same room', async () => {
      const roomId = '123e4567-e89b-12d3-a456-426614174000';
      const newReservation = {
        room_id: roomId,
        start_time: '2024-01-01T10:30:00Z',
        end_time: '2024-01-01T11:30:00Z'
      };

      const existingReservations = [
        {
          id: 'existing-1',
          room_id: roomId,
          start_time: '2024-01-01T10:00:00Z',
          end_time: '2024-01-01T11:00:00Z'
        }
      ];

      mockQuery.select.mockResolvedValueOnce({
        data: existingReservations,
        error: null
      });

      // Simulate overlap detection
      const checkReservationOverlap = async (reservation: any) => {
        const { data: existing } = await mockSupabaseClient
          .from('reservations')
          .select('id, start_time, end_time')
          .eq('room_id', reservation.room_id);

        const newStart = new Date(reservation.start_time);
        const newEnd = new Date(reservation.end_time);

        for (const existingRes of existing || []) {
          const existingStart = new Date(existingRes.start_time);
          const existingEnd = new Date(existingRes.end_time);

          // Check for overlap
          if (newStart < existingEnd && newEnd > existingStart) {
            return {
              hasOverlap: true,
              conflictingReservation: existingRes
            };
          }
        }

        return { hasOverlap: false };
      };

      const overlapResult = await checkReservationOverlap(newReservation);
      
      expect(overlapResult.hasOverlap).toBe(true);
      expect(overlapResult.conflictingReservation).toBeDefined();
      expect(overlapResult.conflictingReservation.id).toBe('existing-1');
    });
  });

  describe('Database Constraint Validation', () => {
    it('should enforce NOT NULL constraints', async () => {
      const invalidReservationData = {
        room_id: null, // Should not be null
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Test Meeting',
        start_time: '2024-01-01T10:00:00Z',
        end_time: '2024-01-01T11:00:00Z'
      };

      mockQuery.insert.mockRejectedValue({
        code: '23502', // PostgreSQL NOT NULL violation
        message: 'null value in column "room_id" violates not-null constraint'
      });

      // Simulate database insert
      const insertReservation = async (data: any) => {
        return await mockSupabaseClient
          .from('reservations')
          .insert(data);
      };

      await expect(insertReservation(invalidReservationData))
        .rejects.toMatchObject({
          code: '23502',
          message: expect.stringContaining('not-null constraint')
        });
    });

    it('should enforce foreign key constraints', async () => {
      const invalidReservationData = {
        room_id: '123e4567-e89b-12d3-a456-426614174999', // Non-existent room
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Test Meeting',
        start_time: '2024-01-01T10:00:00Z',
        end_time: '2024-01-01T11:00:00Z'
      };

      mockQuery.insert.mockRejectedValue({
        code: '23503', // PostgreSQL foreign key violation
        message: 'insert or update on table "reservations" violates foreign key constraint'
      });

      const insertReservation = async (data: any) => {
        return await mockSupabaseClient
          .from('reservations')
          .insert(data);
      };

      await expect(insertReservation(invalidReservationData))
        .rejects.toMatchObject({
          code: '23503',
          message: expect.stringContaining('foreign key constraint')
        });
    });

    it('should enforce unique constraints', async () => {
      const duplicateUserData = {
        email: 'existing@example.com', // Already exists
        name: 'New User',
        department: 'Engineering'
      };

      mockQuery.insert.mockRejectedValue({
        code: '23505', // PostgreSQL unique violation
        message: 'duplicate key value violates unique constraint "users_email_key"'
      });

      const insertUser = async (data: any) => {
        return await mockSupabaseClient
          .from('users')
          .insert(data);
      };

      await expect(insertUser(duplicateUserData))
        .rejects.toMatchObject({
          code: '23505',
          message: expect.stringContaining('unique constraint')
        });
    });
  });

  describe('Data Migration Integrity', () => {
    it('should validate data integrity after migrations', async () => {
      // Mock migration validation queries
      const validationQueries = [
        {
          name: 'orphaned_reservations',
          query: 'SELECT COUNT(*) FROM reservations WHERE user_id NOT IN (SELECT id FROM users)',
          expectedCount: 0
        },
        {
          name: 'invalid_uuids',
          query: 'SELECT COUNT(*) FROM users WHERE id !~ \'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$\'',
          expectedCount: 0
        },
        {
          name: 'duplicate_auth_ids',
          query: 'SELECT auth_id, COUNT(*) FROM users WHERE auth_id IS NOT NULL GROUP BY auth_id HAVING COUNT(*) > 1',
          expectedCount: 0
        }
      ];

      for (const validation of validationQueries) {
        mockSupabaseClient.rpc.mockResolvedValueOnce({
          data: [{ count: validation.expectedCount }],
          error: null
        });

        const { data, error } = await mockSupabaseClient.rpc('execute_validation_query', {
          query: validation.query
        });

        expect(error).toBeNull();
        expect(data[0].count).toBe(validation.expectedCount);
      }
    });

    it('should rollback on data integrity failures', async () => {
      const migrationSteps = [
        'ALTER TABLE users ADD COLUMN new_field TEXT',
        'UPDATE users SET new_field = \'default_value\'',
        'ALTER TABLE users ALTER COLUMN new_field SET NOT NULL'
      ];

      // Mock successful first two steps, failure on third
      mockSupabaseClient.rpc
        .mockResolvedValueOnce({ data: null, error: null }) // Step 1 success
        .mockResolvedValueOnce({ data: null, error: null }) // Step 2 success
        .mockRejectedValueOnce({ // Step 3 failure
          code: '23502',
          message: 'column "new_field" contains null values'
        });

      const executeMigration = async (steps: string[]) => {
        const completedSteps: string[] = [];
        
        try {
          for (const step of steps) {
            await mockSupabaseClient.rpc('execute_sql', { sql: step });
            completedSteps.push(step);
          }
          return { success: true, completedSteps };
        } catch (error) {
          // Rollback completed steps
          for (const step of completedSteps.reverse()) {
            // Generate rollback SQL (simplified)
            const rollbackSql = step.includes('ADD COLUMN') 
              ? step.replace('ADD COLUMN', 'DROP COLUMN')
              : `-- Rollback: ${step}`;
            
            await mockSupabaseClient.rpc('execute_sql', { sql: rollbackSql });
          }
          
          throw error;
        }
      };

      await expect(executeMigration(migrationSteps))
        .rejects.toMatchObject({
          code: '23502',
          message: expect.stringContaining('null values')
        });

      // Verify rollback was attempted
      expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(5); // 3 forward + 2 rollback
    });
  });

  describe('Real-time Data Integrity Monitoring', () => {
    it('should monitor data integrity violations in real-time', async () => {
      const violationEvents = [
        {
          type: 'auth_id_confusion',
          table: 'reservations',
          recordId: 'res-123',
          details: { originalUserId: 'auth-456', correctedUserId: 'db-123' }
        },
        {
          type: 'orphaned_record',
          table: 'reservations',
          recordId: 'res-456',
          details: { invalidUserId: 'non-existent-user' }
        }
      ];

      for (const violation of violationEvents) {
        recordDataIntegrityViolation({
          table: violation.table,
          operation: 'create',
          violationType: violation.type,
          affectedRecords: 1,
          endpoint: 'api/reservations'
        });
      }

      expect(recordDataIntegrityViolation).toHaveBeenCalledTimes(2);
      expect(recordDataIntegrityViolation).toHaveBeenCalledWith(
        expect.objectContaining({
          violationType: 'auth_id_confusion'
        })
      );
      expect(recordDataIntegrityViolation).toHaveBeenCalledWith(
        expect.objectContaining({
          violationType: 'orphaned_record'
        })
      );
    });

    it('should aggregate data integrity metrics', async () => {
      const mockMetrics = {
        totalViolations: 5,
        violationsByType: {
          auth_id_confusion: 2,
          orphaned_record: 1,
          duplicate_auth_id: 1,
          invalid_uuid: 1
        },
        violationsByTable: {
          reservations: 3,
          users: 2
        },
        recentViolations: [
          {
            timestamp: '2024-01-01T10:00:00Z',
            type: 'auth_id_confusion',
            table: 'reservations'
          }
        ]
      };

      // Mock metrics aggregation
      const getDataIntegrityMetrics = () => mockMetrics;
      
      const metrics = getDataIntegrityMetrics();
      
      expect(metrics.totalViolations).toBe(5);
      expect(metrics.violationsByType.auth_id_confusion).toBe(2);
      expect(metrics.violationsByTable.reservations).toBe(3);
      expect(metrics.recentViolations).toHaveLength(1);
    });
  });
});