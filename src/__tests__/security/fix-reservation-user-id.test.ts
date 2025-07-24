/**
 * Enhanced fixReservationUserId Function Tests
 * Tests for comprehensive data repair operations
 * Requirements: 4.2, 4.3
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock the dependencies
const mockSupabaseClient = {
  from: jest.fn(),
  auth: {
    getUser: jest.fn()
  }
};

const mockQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis()
};

const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

const mockUserIdGuards = {
  validateUserIdClient: jest.fn()
};

// Mock the imports
jest.mock('@/lib/supabase/client', () => ({
  supabase: mockSupabaseClient
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue(mockSupabaseClient)
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: mockLogger
}));

jest.mock('./user-id-guards', () => ({
  UserIdGuards: mockUserIdGuards
}));

// Import after mocking
import { 
  ReservationUserIdFixer, 
  fixReservationUserId, 
  fixMultipleReservationUserIds,
  findReservationsNeedingFix
} from '@/lib/security/fix-reservation-user-id';

describe('ReservationUserIdFixer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.from.mockReturnValue(mockQuery);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      const fixer = new ReservationUserIdFixer();
      expect(fixer).toBeInstanceOf(ReservationUserIdFixer);
    });

    it('should accept custom configuration', () => {
      const config = {
        dryRun: true,
        createBackup: false,
        batchSize: 5
      };
      const fixer = new ReservationUserIdFixer(config);
      expect(fixer).toBeInstanceOf(ReservationUserIdFixer);
    });
  });

  describe('Single Reservation Fix', () => {
    it('should successfully fix a reservation with auth_id confusion', async () => {
      const reservationId = 'reservation-123';
      const authId = 'auth-id-456';
      const dbId = 'db-id-789';

      // Mock reservation data
      mockQuery.single
        .mockResolvedValueOnce({
          data: {
            id: reservationId,
            user_id: authId,
            title: 'Test Meeting'
          },
          error: null
        })
        // Mock user data for backup
        .mockResolvedValueOnce({
          data: {
            id: reservationId,
            user_id: authId,
            title: 'Test Meeting',
            room_id: 'room-123',
            start_time: '2024-01-01T10:00:00Z',
            end_time: '2024-01-01T11:00:00Z'
          },
          error: null
        })
        // Mock user name lookup
        .mockResolvedValueOnce({
          data: { name: 'John Doe' },
          error: null
        });

      // Mock user ID validation
      mockUserIdGuards.validateUserIdClient.mockResolvedValueOnce({
        isValid: false,
        correctedUserId: dbId,
        error: 'auth_id instead of database id'
      });

      // Mock update operation
      mockQuery.update.mockResolvedValueOnce({
        error: null
      });

      const fixer = new ReservationUserIdFixer({ dryRun: false });
      const result = await fixer.fixSingleReservation(reservationId);

      expect(result.success).toBe(true);
      expect(result.reservationId).toBe(reservationId);
      expect(result.originalUserId).toBe(authId);
      expect(result.correctedUserId).toBe(dbId);
      expect(result.userName).toBe('John Doe');
    });

    it('should handle dry run mode', async () => {
      const reservationId = 'reservation-123';
      const authId = 'auth-id-456';
      const dbId = 'db-id-789';

      // Mock reservation data
      mockQuery.single
        .mockResolvedValueOnce({
          data: {
            id: reservationId,
            user_id: authId,
            title: 'Test Meeting'
          },
          error: null
        })
        // Mock backup data
        .mockResolvedValueOnce({
          data: {
            id: reservationId,
            user_id: authId,
            title: 'Test Meeting'
          },
          error: null
        })
        // Mock user name
        .mockResolvedValueOnce({
          data: { name: 'John Doe' },
          error: null
        });

      // Mock user ID validation
      mockUserIdGuards.validateUserIdClient.mockResolvedValueOnce({
        isValid: false,
        correctedUserId: dbId,
        error: 'auth_id instead of database id'
      });

      const fixer = new ReservationUserIdFixer({ dryRun: true });
      const result = await fixer.fixSingleReservation(reservationId);

      expect(result.success).toBe(true);
      expect(result.reservationId).toBe(reservationId);
      expect(result.correctedUserId).toBe(dbId);
      
      // Verify no actual update was called
      expect(mockQuery.update).not.toHaveBeenCalled();
    });

    it('should skip reservations that do not need fixing', async () => {
      const reservationId = 'reservation-123';
      const validUserId = 'valid-user-id';

      // Mock reservation data
      mockQuery.single.mockResolvedValueOnce({
        data: {
          id: reservationId,
          user_id: validUserId,
          title: 'Test Meeting'
        },
        error: null
      });

      // Mock user ID validation - already valid
      mockUserIdGuards.validateUserIdClient.mockResolvedValueOnce({
        isValid: true,
        userId: validUserId
      });

      const fixer = new ReservationUserIdFixer();
      const result = await fixer.fixSingleReservation(reservationId);

      expect(result.success).toBe(true);
      expect(result.error).toContain('No fix needed');
      expect(mockQuery.update).not.toHaveBeenCalled();
    });

    it('should handle reservation not found', async () => {
      const reservationId = 'non-existent-reservation';

      // Mock reservation not found
      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Reservation not found')
      });

      const fixer = new ReservationUserIdFixer();
      const result = await fixer.fixSingleReservation(reservationId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Reservation not found');
    });

    it('should handle uncorrectable user_id errors', async () => {
      const reservationId = 'reservation-123';
      const invalidUserId = 'invalid-user-id';

      // Mock reservation data
      mockQuery.single.mockResolvedValueOnce({
        data: {
          id: reservationId,
          user_id: invalidUserId,
          title: 'Test Meeting'
        },
        error: null
      });

      // Mock user ID validation - cannot be corrected
      mockUserIdGuards.validateUserIdClient.mockResolvedValueOnce({
        isValid: false,
        error: 'User does not exist',
        correctedUserId: undefined
      });

      const fixer = new ReservationUserIdFixer();
      const result = await fixer.fixSingleReservation(reservationId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot fix reservation');
    });

    it('should retry on update failures', async () => {
      const reservationId = 'reservation-123';
      const authId = 'auth-id-456';
      const dbId = 'db-id-789';

      // Mock reservation data
      mockQuery.single
        .mockResolvedValueOnce({
          data: {
            id: reservationId,
            user_id: authId,
            title: 'Test Meeting'
          },
          error: null
        })
        // Mock backup data
        .mockResolvedValueOnce({
          data: {
            id: reservationId,
            user_id: authId,
            title: 'Test Meeting'
          },
          error: null
        })
        // Mock user name
        .mockResolvedValueOnce({
          data: { name: 'John Doe' },
          error: null
        });

      // Mock user ID validation
      mockUserIdGuards.validateUserIdClient.mockResolvedValueOnce({
        isValid: false,
        correctedUserId: dbId,
        error: 'auth_id instead of database id'
      });

      // Mock update failures then success
      mockQuery.update
        .mockResolvedValueOnce({ error: new Error('Database busy') })
        .mockResolvedValueOnce({ error: new Error('Connection timeout') })
        .mockResolvedValueOnce({ error: null });

      const fixer = new ReservationUserIdFixer({ 
        dryRun: false, 
        maxRetries: 3,
        retryDelay: 10 // Short delay for testing
      });
      
      const result = await fixer.fixSingleReservation(reservationId);

      expect(result.success).toBe(true);
      expect(mockQuery.update).toHaveBeenCalledTimes(3);
    });
  });

  describe('Batch Operations', () => {
    it('should process multiple reservations in batches', async () => {
      const reservationIds = ['res-1', 'res-2', 'res-3'];
      
      // Mock successful fixes for all reservations
      reservationIds.forEach((id, index) => {
        mockQuery.single
          // Reservation data
          .mockResolvedValueOnce({
            data: {
              id,
              user_id: `auth-id-${index}`,
              title: `Meeting ${index + 1}`
            },
            error: null
          })
          // Backup data
          .mockResolvedValueOnce({
            data: {
              id,
              user_id: `auth-id-${index}`,
              title: `Meeting ${index + 1}`
            },
            error: null
          })
          // User name
          .mockResolvedValueOnce({
            data: { name: `User ${index + 1}` },
            error: null
          });
      });

      // Mock user ID validations
      mockUserIdGuards.validateUserIdClient
        .mockResolvedValueOnce({
          isValid: false,
          correctedUserId: 'db-id-1',
          error: 'auth_id confusion'
        })
        .mockResolvedValueOnce({
          isValid: false,
          correctedUserId: 'db-id-2',
          error: 'auth_id confusion'
        })
        .mockResolvedValueOnce({
          isValid: false,
          correctedUserId: 'db-id-3',
          error: 'auth_id confusion'
        });

      // Mock successful updates
      mockQuery.update
        .mockResolvedValue({ error: null });

      const fixer = new ReservationUserIdFixer({ 
        dryRun: false,
        batchSize: 2
      });
      
      const result = await fixer.fixMultipleReservations(reservationIds);

      expect(result.totalProcessed).toBe(3);
      expect(result.successfulFixes).toBe(3);
      expect(result.failures).toBe(0);
      expect(result.results).toHaveLength(3);
    });

    it('should handle mixed success and failure in batch', async () => {
      const reservationIds = ['res-success', 'res-fail'];
      
      // Mock first reservation (success)
      mockQuery.single
        .mockResolvedValueOnce({
          data: {
            id: 'res-success',
            user_id: 'auth-id-1',
            title: 'Success Meeting'
          },
          error: null
        })
        .mockResolvedValueOnce({
          data: {
            id: 'res-success',
            user_id: 'auth-id-1',
            title: 'Success Meeting'
          },
          error: null
        })
        .mockResolvedValueOnce({
          data: { name: 'Success User' },
          error: null
        })
        // Mock second reservation (failure)
        .mockResolvedValueOnce({
          data: null,
          error: new Error('Not found')
        });

      // Mock user ID validation for first reservation
      mockUserIdGuards.validateUserIdClient.mockResolvedValueOnce({
        isValid: false,
        correctedUserId: 'db-id-1',
        error: 'auth_id confusion'
      });

      // Mock successful update for first reservation
      mockQuery.update.mockResolvedValueOnce({ error: null });

      const fixer = new ReservationUserIdFixer({ dryRun: false });
      const result = await fixer.fixMultipleReservations(reservationIds);

      expect(result.totalProcessed).toBe(2);
      expect(result.successfulFixes).toBe(1);
      expect(result.failures).toBe(1);
    });
  });

  describe('Backup and Rollback', () => {
    it('should create backups when enabled', async () => {
      const reservationId = 'reservation-123';
      
      // Mock reservation data for backup
      mockQuery.single.mockResolvedValueOnce({
        data: {
          id: reservationId,
          user_id: 'auth-id-456',
          title: 'Test Meeting',
          room_id: 'room-123'
        },
        error: null
      });

      const fixer = new ReservationUserIdFixer({ 
        createBackup: true,
        dryRun: true // Use dry run to avoid complex mocking
      });

      // Access private method through any cast for testing
      const backupId = await (fixer as any).createReservationBackup(reservationId, 'test');
      
      expect(backupId).toBeTruthy();
      expect(typeof backupId).toBe('string');
      
      const backups = fixer.getAvailableBackups();
      expect(backups).toHaveLength(1);
      expect(backups[0].reservationId).toBe(reservationId);
    });

    it('should skip backup creation when disabled', async () => {
      const fixer = new ReservationUserIdFixer({ createBackup: false });
      
      // Access private method through any cast for testing
      const backupId = await (fixer as any).createReservationBackup('test-id', 'test');
      
      expect(backupId).toBeNull();
      expect(fixer.getAvailableBackups()).toHaveLength(0);
    });

    it('should clear all backups', () => {
      const fixer = new ReservationUserIdFixer();
      
      // Manually add a backup for testing
      (fixer as any).backups.set('test-backup', {
        id: 'test-backup',
        reservationId: 'test-reservation',
        originalData: {},
        timestamp: new Date().toISOString(),
        operation: 'test'
      });

      expect(fixer.getAvailableBackups()).toHaveLength(1);
      
      fixer.clearBackups();
      expect(fixer.getAvailableBackups()).toHaveLength(0);
    });
  });

  describe('Data Integrity Validation', () => {
    it('should validate data integrity after fixes', async () => {
      const reservationIds = ['res-1', 'res-2'];
      
      // Mock reservation data
      mockQuery.single
        .mockResolvedValueOnce({
          data: {
            id: 'res-1',
            user_id: 'valid-user-id',
            title: 'Valid Meeting'
          },
          error: null
        })
        .mockResolvedValueOnce({
          data: {
            id: 'res-2',
            user_id: 'invalid-user-id',
            title: 'Invalid Meeting'
          },
          error: null
        });

      // Mock user ID validations
      mockUserIdGuards.validateUserIdClient
        .mockResolvedValueOnce({ isValid: true })
        .mockResolvedValueOnce({ 
          isValid: false, 
          error: 'User does not exist' 
        });

      const fixer = new ReservationUserIdFixer();
      const validation = await fixer.validateDataIntegrity(reservationIds);

      expect(validation.valid).toBe(false);
      expect(validation.issues).toHaveLength(1);
      expect(validation.issues[0].reservationId).toBe('res-2');
      expect(validation.issues[0].issue).toContain('Invalid user_id');
    });
  });

  describe('Convenience Functions', () => {
    it('should provide convenience function for single fix', async () => {
      const reservationId = 'test-reservation';
      
      // Mock reservation data
      mockQuery.single.mockResolvedValueOnce({
        data: {
          id: reservationId,
          user_id: 'valid-user-id',
          title: 'Test Meeting'
        },
        error: null
      });

      // Mock validation - no fix needed
      mockUserIdGuards.validateUserIdClient.mockResolvedValueOnce({
        isValid: true,
        userId: 'valid-user-id'
      });

      const result = await fixReservationUserId(reservationId);
      
      expect(result.success).toBe(true);
      expect(result.reservationId).toBe(reservationId);
    });

    it('should provide convenience function for batch fix', async () => {
      const reservationIds = ['res-1'];
      
      // Mock reservation data
      mockQuery.single.mockResolvedValueOnce({
        data: {
          id: 'res-1',
          user_id: 'valid-user-id',
          title: 'Test Meeting'
        },
        error: null
      });

      // Mock validation - no fix needed
      mockUserIdGuards.validateUserIdClient.mockResolvedValueOnce({
        isValid: true,
        userId: 'valid-user-id'
      });

      const result = await fixMultipleReservationUserIds(reservationIds);
      
      expect(result.totalProcessed).toBe(1);
      expect(result.successfulFixes).toBe(1);
    });
  });

  describe('Find Reservations Needing Fix', () => {
    it('should find reservations with auth_id confusion', async () => {
      // Mock users data
      mockQuery.select.mockReturnValueOnce({
        ...mockQuery,
        data: [
          { id: 'db-id-1', auth_id: 'auth-id-1' },
          { id: 'db-id-2', auth_id: 'auth-id-2' }
        ],
        error: null
      });

      // Mock reservations data
      mockQuery.select.mockReturnValueOnce({
        ...mockQuery,
        data: [
          { id: 'res-1', user_id: 'db-id-1' },      // Valid
          { id: 'res-2', user_id: 'auth-id-2' },    // Needs fix
          { id: 'res-3', user_id: 'non-existent' }  // Orphaned
        ],
        error: null
      });

      const needingFix = await findReservationsNeedingFix();
      
      expect(needingFix).toEqual(['res-2']);
    });

    it('should handle errors when finding reservations', async () => {
      // Mock users fetch error
      mockQuery.select.mockReturnValueOnce({
        ...mockQuery,
        data: null,
        error: new Error('Database error')
      });

      const needingFix = await findReservationsNeedingFix();
      
      expect(needingFix).toEqual([]);
    });
  });
});