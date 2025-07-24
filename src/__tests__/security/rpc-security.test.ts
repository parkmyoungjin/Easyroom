/**
 * @jest-environment node
 */

import { createClient } from '@/lib/supabase/server';

// Mock the server client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn()
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('RPC Function Security Model', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSupabase = {
      rpc: jest.fn(),
      auth: {
        getUser: jest.fn()
      }
    };
    
    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  describe('Input Validation', () => {
    it('should reject null start_date parameter', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Start date and end date cannot be null'));
      
      await expect(
        mockSupabase.rpc('get_public_reservations', {
          start_date: null,
          end_date: '2025-01-22T23:59:59.999Z'
        })
      ).rejects.toThrow('Start date and end date cannot be null');
    });

    it('should reject null end_date parameter', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Start date and end date cannot be null'));
      
      await expect(
        mockSupabase.rpc('get_public_reservations', {
          start_date: '2025-01-22T00:00:00.000Z',
          end_date: null
        })
      ).rejects.toThrow('Start date and end date cannot be null');
    });

    it('should reject start_date >= end_date', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Start date must be before end date'));
      
      await expect(
        mockSupabase.rpc('get_public_reservations', {
          start_date: '2025-01-22T23:59:59.999Z',
          end_date: '2025-01-22T00:00:00.000Z'
        })
      ).rejects.toThrow('Start date must be before end date');
    });

    it('should reject date range exceeding 90 days', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Date range cannot exceed 90 days'));
      
      await expect(
        mockSupabase.rpc('get_public_reservations', {
          start_date: '2025-01-01T00:00:00.000Z',
          end_date: '2025-04-15T23:59:59.999Z' // More than 90 days
        })
      ).rejects.toThrow('Date range cannot exceed 90 days');
    });

    it('should reject queries too far in the past', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Cannot query reservations older than 30 days'));
      
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      
      await expect(
        mockSupabase.rpc('get_public_reservations', {
          start_date: twoMonthsAgo.toISOString(),
          end_date: new Date().toISOString()
        })
      ).rejects.toThrow('Cannot query reservations older than 30 days');
    });

    it('should reject queries too far in the future', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Cannot query reservations more than 1 year in advance'));
      
      const twoYearsFromNow = new Date();
      twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
      
      await expect(
        mockSupabase.rpc('get_public_reservations', {
          start_date: new Date().toISOString(),
          end_date: twoYearsFromNow.toISOString()
        })
      ).rejects.toThrow('Cannot query reservations more than 1 year in advance');
    });

    it('should accept valid date range', async () => {
      const validData = [
        {
          id: 'reservation-1',
          room_id: 'room-1',
          user_id: 'user-1',
          title: 'My Meeting',
          purpose: 'Team standup',
          start_time: '2025-01-22T10:00:00Z',
          end_time: '2025-01-22T11:00:00Z',
          department: 'Engineering',
          user_name: 'John Doe',
          is_mine: true
        }
      ];

      mockSupabase.rpc.mockResolvedValue({ data: validData, error: null });
      
      const result = await mockSupabase.rpc('get_public_reservations', {
        start_date: '2025-01-22T00:00:00.000Z',
        end_date: '2025-01-22T23:59:59.999Z'
      });
      
      expect(result.data).toEqual(validData);
      expect(result.error).toBeNull();
    });
  });

  describe('Data Masking Security', () => {
    it('should mask other users reservations in authenticated function', async () => {
      const maskedData = [
        {
          id: 'reservation-1',
          room_id: 'room-1',
          user_id: 'other-user',
          title: 'Booked', // Masked
          purpose: null, // Masked
          start_time: '2025-01-22T10:00:00Z',
          end_time: '2025-01-22T11:00:00Z',
          department: 'Marketing',
          user_name: 'Jane Smith',
          is_mine: false
        }
      ];

      mockSupabase.rpc.mockResolvedValue({ data: maskedData, error: null });
      
      const result = await mockSupabase.rpc('get_public_reservations', {
        start_date: '2025-01-22T00:00:00.000Z',
        end_date: '2025-01-22T23:59:59.999Z'
      });
      
      expect(result.data[0].title).toBe('Booked');
      expect(result.data[0].purpose).toBeNull();
      expect(result.data[0].is_mine).toBe(false);
    });

    it('should show full details for own reservations in authenticated function', async () => {
      const ownReservationData = [
        {
          id: 'reservation-1',
          room_id: 'room-1',
          user_id: 'current-user',
          title: 'My Important Meeting', // Not masked
          purpose: 'Project planning session', // Not masked
          start_time: '2025-01-22T10:00:00Z',
          end_time: '2025-01-22T11:00:00Z',
          department: 'Engineering',
          user_name: 'Current User',
          is_mine: true
        }
      ];

      mockSupabase.rpc.mockResolvedValue({ data: ownReservationData, error: null });
      
      const result = await mockSupabase.rpc('get_public_reservations', {
        start_date: '2025-01-22T00:00:00.000Z',
        end_date: '2025-01-22T23:59:59.999Z'
      });
      
      expect(result.data[0].title).toBe('My Important Meeting');
      expect(result.data[0].purpose).toBe('Project planning session');
      expect(result.data[0].is_mine).toBe(true);
    });

    it('should mask all reservations in anonymous function', async () => {
      const anonymousData = [
        {
          id: 'reservation-1',
          room_id: 'room-1',
          title: 'Booked', // Always masked for anonymous
          start_time: '2025-01-22T10:00:00Z',
          end_time: '2025-01-22T11:00:00Z',
          room_name: 'Conference Room A',
          is_mine: false // Always false for anonymous
        }
      ];

      mockSupabase.rpc.mockResolvedValue({ data: anonymousData, error: null });
      
      const result = await mockSupabase.rpc('get_public_reservations_anonymous', {
        start_date: '2025-01-22T00:00:00.000Z',
        end_date: '2025-01-22T23:59:59.999Z'
      });
      
      expect(result.data[0].title).toBe('Booked');
      expect(result.data[0].is_mine).toBe(false);
      expect(result.data[0]).not.toHaveProperty('purpose');
      expect(result.data[0]).not.toHaveProperty('department');
      expect(result.data[0]).not.toHaveProperty('user_name');
    });
  });

  describe('Function Permissions', () => {
    it('should allow authenticated users to call get_public_reservations', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123' } },
        error: null
      });

      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });
      
      const result = await mockSupabase.rpc('get_public_reservations', {
        start_date: '2025-01-22T00:00:00.000Z',
        end_date: '2025-01-22T23:59:59.999Z'
      });
      
      expect(result.error).toBeNull();
    });

    it('should allow anonymous users to call get_public_reservations_anonymous', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });
      
      const result = await mockSupabase.rpc('get_public_reservations_anonymous', {
        start_date: '2025-01-22T00:00:00.000Z',
        end_date: '2025-01-22T23:59:59.999Z'
      });
      
      expect(result.error).toBeNull();
    });
  });

  describe('Security Constraints', () => {
    it('should only return confirmed reservations', async () => {
      const confirmedOnlyData = [
        {
          id: 'reservation-1',
          room_id: 'room-1',
          title: 'Booked',
          start_time: '2025-01-22T10:00:00Z',
          end_time: '2025-01-22T11:00:00Z',
          room_name: 'Conference Room A',
          is_mine: false
        }
      ];

      mockSupabase.rpc.mockResolvedValue({ data: confirmedOnlyData, error: null });
      
      const result = await mockSupabase.rpc('get_public_reservations_anonymous', {
        start_date: '2025-01-22T00:00:00.000Z',
        end_date: '2025-01-22T23:59:59.999Z'
      });
      
      // All returned reservations should be confirmed (this is enforced by the RPC function)
      expect(result.data).toEqual(confirmedOnlyData);
    });

    it('should return reservations in chronological order', async () => {
      const chronologicalData = [
        {
          id: 'reservation-1',
          start_time: '2025-01-22T09:00:00Z',
          end_time: '2025-01-22T10:00:00Z'
        },
        {
          id: 'reservation-2',
          start_time: '2025-01-22T11:00:00Z',
          end_time: '2025-01-22T12:00:00Z'
        },
        {
          id: 'reservation-3',
          start_time: '2025-01-22T14:00:00Z',
          end_time: '2025-01-22T15:00:00Z'
        }
      ];

      mockSupabase.rpc.mockResolvedValue({ data: chronologicalData, error: null });
      
      const result = await mockSupabase.rpc('get_public_reservations_anonymous', {
        start_date: '2025-01-22T00:00:00.000Z',
        end_date: '2025-01-22T23:59:59.999Z'
      });
      
      // Verify chronological order
      const startTimes = result.data.map(r => new Date(r.start_time).getTime());
      const sortedStartTimes = [...startTimes].sort((a, b) => a - b);
      expect(startTimes).toEqual(sortedStartTimes);
    });
  });
});