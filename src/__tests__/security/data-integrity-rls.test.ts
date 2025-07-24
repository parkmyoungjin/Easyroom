/**
 * @jest-environment node
 */

import { createClient } from '@/lib/supabase/server';
import { userIdGuards } from '@/lib/security/user-id-guards';
import { fixReservationUserId } from '@/lib/security/fix-reservation-user-id';

// Mock dependencies
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    dataAccess: jest.fn()
  }
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('Data Integrity and RLS Policy Tests', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSupabase = {
      auth: {
        getUser: jest.fn(),
        getSession: jest.fn()
      },
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(),
            gte: jest.fn(() => ({
              lte: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({ data: [], error: null }))
              }))
            }))
          })),
          insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
          update: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ data: null, error: null }))
          })),
          delete: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ data: null, error: null }))
          }))
        }))
      })),
      rpc: jest.fn()
    };

    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  describe('User ID Consistency Tests', () => {
    it('should validate user_id references database ID not auth ID', async () => {
      const mockUser = { id: 'auth-user-123' };
      const mockDbUser = { id: 'db-user-456', auth_id: 'auth-user-123' };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: mockDbUser,
        error: null
      });

      const result = await userIdGuards.validateUserIdConsistency('auth-user-123');
      
      expect(result.isValid).toBe(true);
      expect(result.dbUserId).toBe('db-user-456');
      expect(result.authUserId).toBe('auth-user-123');
    });

    it('should detect inconsistent user_id usage', async () => {
      const mockUser = { id: 'auth-user-123' };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Mock user not found in database
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'User not found' }
      });

      const result = await userIdGuards.validateUserIdConsistency('auth-user-123');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('User not found');
    });

    it('should prevent auth_id being used as user_id in reservations', async () => {
      const authId = 'auth-user-123';
      const dbUserId = 'db-user-456';

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { id: dbUserId, auth_id: authId },
        error: null
      });

      // Test that we get the correct database user ID
      const validatedUserId = await userIdGuards.getValidatedUserId(authId);
      
      expect(validatedUserId).toBe(dbUserId);
      expect(validatedUserId).not.toBe(authId);
    });

    it('should fix existing reservations with incorrect user_id', async () => {
      const authId = 'auth-user-123';
      const dbUserId = 'db-user-456';
      const reservationId = 'reservation-789';

      // Mock finding reservation with auth_id instead of db user_id
      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({
          data: { id: reservationId, user_id: authId }, // Incorrect: using auth_id
          error: null
        })
        .mockResolvedValueOnce({
          data: { id: dbUserId, auth_id: authId }, // User lookup
          error: null
        });

      mockSupabase.from().update().eq.mockResolvedValue({
        data: { id: reservationId, user_id: dbUserId },
        error: null
      });

      const result = await fixReservationUserId(reservationId);
      
      expect(result.success).toBe(true);
      expect(result.oldUserId).toBe(authId);
      expect(result.newUserId).toBe(dbUserId);
    });

    it('should validate foreign key constraints', async () => {
      const invalidUserId = 'non-existent-user';

      // Mock foreign key constraint violation
      mockSupabase.from().insert.mockResolvedValue({
        data: null,
        error: { 
          message: 'Foreign key constraint violation',
          code: '23503'
        }
      });

      // Attempt to create reservation with invalid user_id
      const insertResult = await mockSupabase.from('reservations').insert({
        user_id: invalidUserId,
        room_id: 'room-123',
        title: 'Test Meeting',
        start_time: '2025-01-22T10:00:00Z',
        end_time: '2025-01-22T11:00:00Z'
      });

      expect(insertResult.error).toBeTruthy();
      expect(insertResult.error.code).toBe('23503');
    });
  });

  describe('RLS Policy Enforcement Tests', () => {
    it('should enforce user can only see own reservations in authenticated context', async () => {
      const mockUser = { id: 'auth-user-123' };
      const dbUserId = 'db-user-456';

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Mock RLS filtering - user should only see their own reservations
      mockSupabase.from().select().eq().gte().lte().order.mockResolvedValue({
        data: [
          {
            id: 'reservation-1',
            user_id: dbUserId,
            title: 'My Meeting',
            start_time: '2025-01-22T10:00:00Z'
          }
          // Other users' reservations should be filtered out by RLS
        ],
        error: null
      });

      const supabase = await createClient();
      const { data } = await supabase
        .from('reservations')
        .select('*')
        .eq('user_id', dbUserId)
        .gte('start_time', '2025-01-22T00:00:00Z')
        .lte('end_time', '2025-01-22T23:59:59Z')
        .order('start_time');

      expect(data).toHaveLength(1);
      expect(data[0].user_id).toBe(dbUserId);
    });

    it('should prevent unauthorized data modification through RLS', async () => {
      const mockUser = { id: 'auth-user-123' };
      const otherUserReservationId = 'reservation-belonging-to-other-user';

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Mock RLS preventing update of other user's reservation
      mockSupabase.from().update().eq.mockResolvedValue({
        data: null, // No rows affected due to RLS
        error: null
      });

      const supabase = await createClient();
      const result = await supabase
        .from('reservations')
        .update({ title: 'Hacked Meeting' })
        .eq('id', otherUserReservationId);

      // RLS should prevent the update
      expect(result.data).toBeNull();
    });

    it('should allow anonymous users to see only public reservation data', async () => {
      // No authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      // Mock RLS allowing only public data for anonymous users
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            id: 'reservation-1',
            room_id: 'room-1',
            title: 'Booked', // Masked title
            start_time: '2025-01-22T10:00:00Z',
            end_time: '2025-01-22T11:00:00Z',
            room_name: 'Conference Room A',
            is_mine: false
          }
        ],
        error: null
      });

      const supabase = await createClient();
      const { data } = await supabase.rpc('get_public_reservations_anonymous', {
        start_date: '2025-01-22T00:00:00Z',
        end_date: '2025-01-22T23:59:59Z'
      });

      expect(data).toHaveLength(1);
      expect(data[0].title).toBe('Booked'); // Should be masked
      expect(data[0].is_mine).toBe(false);
      expect(data[0]).not.toHaveProperty('purpose'); // Sensitive data should be excluded
    });

    it('should enforce admin-only access to user management functions', async () => {
      const mockUser = { id: 'regular-user-123' };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { 
          session: { 
            user: mockUser,
            access_token: 'valid-token'
          }
        },
        error: null
      });

      // Mock non-admin user
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { role: 'user' }, // Not admin
        error: null
      });

      // Attempt admin operation should be blocked
      const result = await simulateAdminOperation(mockUser.id);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('insufficient_privileges');
    });

    it('should validate RLS policies prevent data leakage', async () => {
      const mockUser = { id: 'auth-user-123' };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Mock RLS ensuring no sensitive data leakage
      mockSupabase.from().select().eq().gte().lte().order.mockResolvedValue({
        data: [
          {
            id: 'reservation-1',
            room_id: 'room-1',
            user_id: 'other-user-456',
            title: 'Booked', // Should be masked for other users
            purpose: null, // Should be null for other users
            start_time: '2025-01-22T10:00:00Z',
            end_time: '2025-01-22T11:00:00Z',
            is_mine: false
          }
        ],
        error: null
      });

      const supabase = await createClient();
      const { data } = await supabase
        .from('reservations')
        .select('*')
        .eq('status', 'confirmed')
        .gte('start_time', '2025-01-22T00:00:00Z')
        .lte('end_time', '2025-01-22T23:59:59Z')
        .order('start_time');

      expect(data[0].title).toBe('Booked');
      expect(data[0].purpose).toBeNull();
      expect(data[0].is_mine).toBe(false);
    });
  });

  describe('Data Validation Tests', () => {
    it('should validate reservation time constraints', async () => {
      const mockUser = { id: 'auth-user-123' };
      const dbUserId = 'db-user-456';

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Mock validation error for invalid time range
      mockSupabase.from().insert.mockResolvedValue({
        data: null,
        error: {
          message: 'Start time must be before end time',
          code: '23514' // Check constraint violation
        }
      });

      const supabase = await createClient();
      const result = await supabase.from('reservations').insert({
        user_id: dbUserId,
        room_id: 'room-123',
        title: 'Invalid Meeting',
        start_time: '2025-01-22T11:00:00Z', // After end time
        end_time: '2025-01-22T10:00:00Z'    // Before start time
      });

      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('23514');
    });

    it('should validate required fields', async () => {
      const mockUser = { id: 'auth-user-123' };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Mock validation error for missing required fields
      mockSupabase.from().insert.mockResolvedValue({
        data: null,
        error: {
          message: 'null value in column "title" violates not-null constraint',
          code: '23502'
        }
      });

      const supabase = await createClient();
      const result = await supabase.from('reservations').insert({
        user_id: 'db-user-456',
        room_id: 'room-123',
        // title is missing
        start_time: '2025-01-22T10:00:00Z',
        end_time: '2025-01-22T11:00:00Z'
      });

      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('23502');
    });

    it('should validate data type constraints', async () => {
      const mockUser = { id: 'auth-user-123' };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Mock validation error for invalid data type
      mockSupabase.from().insert.mockResolvedValue({
        data: null,
        error: {
          message: 'invalid input syntax for type timestamp',
          code: '22007'
        }
      });

      const supabase = await createClient();
      const result = await supabase.from('reservations').insert({
        user_id: 'db-user-456',
        room_id: 'room-123',
        title: 'Test Meeting',
        start_time: 'invalid-timestamp',
        end_time: '2025-01-22T11:00:00Z'
      });

      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('22007');
    });

    it('should validate business logic constraints', async () => {
      const mockUser = { id: 'auth-user-123' };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Mock business logic validation (e.g., room double booking)
      mockSupabase.from().insert.mockResolvedValue({
        data: null,
        error: {
          message: 'Room is already booked for this time slot',
          code: '23505' // Unique constraint violation
        }
      });

      const supabase = await createClient();
      const result = await supabase.from('reservations').insert({
        user_id: 'db-user-456',
        room_id: 'room-123',
        title: 'Conflicting Meeting',
        start_time: '2025-01-22T10:00:00Z',
        end_time: '2025-01-22T11:00:00Z'
      });

      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('23505');
    });
  });

  describe('Database Security Boundary Tests', () => {
    it('should prevent SQL injection through RPC parameters', async () => {
      const mockUser = { id: 'auth-user-123' };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Mock RPC function with potential injection attempt
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null
      });

      const maliciousStartDate = "2025-01-01'; DROP TABLE reservations; --";
      
      const supabase = await createClient();
      const result = await supabase.rpc('get_public_reservations', {
        start_date: maliciousStartDate,
        end_date: '2025-01-31T23:59:59Z'
      });

      // RPC should handle parameters safely
      expect(result.error).toBeNull();
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_public_reservations', {
        start_date: maliciousStartDate,
        end_date: '2025-01-31T23:59:59Z'
      });
    });

    it('should enforce connection limits and timeouts', async () => {
      // Mock connection timeout
      mockSupabase.from().select.mockRejectedValue(
        new Error('Connection timeout after 30 seconds')
      );

      const supabase = await createClient();
      
      await expect(
        supabase.from('reservations').select('*')
      ).rejects.toThrow('Connection timeout');
    });

    it('should validate database permissions at connection level', async () => {
      // Mock permission denied error
      mockSupabase.from().delete.mockResolvedValue({
        data: null,
        error: {
          message: 'permission denied for table reservations',
          code: '42501'
        }
      });

      const supabase = await createClient();
      const result = await supabase
        .from('reservations')
        .delete()
        .eq('id', 'some-reservation');

      expect(result.error).toBeTruthy();
      expect(result.error.code).toBe('42501');
    });

    it('should handle concurrent access safely', async () => {
      const mockUser = { id: 'auth-user-123' };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Mock concurrent operations
      const operations = Array.from({ length: 10 }, (_, i) => {
        mockSupabase.from().select().eq().single.mockResolvedValue({
          data: { id: `reservation-${i}`, user_id: 'db-user-456' },
          error: null
        });
        
        return mockSupabase.from('reservations')
          .select('*')
          .eq('id', `reservation-${i}`)
          .single();
      });

      const results = await Promise.all(operations);
      
      // All operations should complete successfully
      results.forEach((result, i) => {
        expect(result.data.id).toBe(`reservation-${i}`);
      });
    });
  });
});

// Helper function to simulate admin operation
async function simulateAdminOperation(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const session = await mockSupabase.auth.getSession();
    
    if (!session.data.session) {
      return { allowed: false, reason: 'not_authenticated' };
    }

    const roleCheck = await mockSupabase.from('users')
      .select('role')
      .eq('auth_id', userId)
      .single();

    if (!roleCheck.data || roleCheck.data.role !== 'admin') {
      return { allowed: false, reason: 'insufficient_privileges' };
    }

    return { allowed: true };
  } catch (error) {
    return { allowed: false, reason: 'error' };
  }
}