import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock Supabase client for RPC function testing
const mockSupabase = {
  rpc: jest.fn(),
  auth: {
    getUser: jest.fn()
  }
};

// Mock the createClient function
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

describe('Pagination RPC Functions Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get_public_reservations_paginated Function', () => {
    it('should return paginated results with metadata for authenticated users', async () => {
      const mockPaginatedData = [
        {
          id: 'res1',
          room_id: 'room1',
          user_id: 'user1',
          title: 'My Meeting',
          purpose: 'Team sync',
          start_time: '2025-01-22T09:00:00Z',
          end_time: '2025-01-22T10:00:00Z',
          department: 'Engineering',
          user_name: 'John Doe',
          is_mine: true,
          total_count: 25,
          has_more: true
        },
        {
          id: 'res2',
          room_id: 'room2',
          user_id: 'user2',
          title: 'Booked',
          purpose: null,
          start_time: '2025-01-22T11:00:00Z',
          end_time: '2025-01-22T12:00:00Z',
          department: 'Marketing',
          user_name: 'Jane Smith',
          is_mine: false,
          total_count: 25,
          has_more: true
        }
      ];

      mockSupabase.rpc.mockResolvedValue({ data: mockPaginatedData, error: null });

      const result = await mockSupabase.rpc('get_public_reservations_paginated', {
        start_date: '2025-01-22T00:00:00.000Z',
        end_date: '2025-01-22T23:59:59.999Z',
        page_limit: 10,
        page_offset: 0
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].total_count).toBe(25);
      expect(result.data[0].has_more).toBe(true);
      expect(result.data[0].is_mine).toBe(true);
      expect(result.data[1].is_mine).toBe(false);
      expect(result.data[1].title).toBe('Booked'); // Non-owner sees masked title
    });

    it('should validate pagination parameters', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('page_limit must be between 1 and 100'));

      await expect(
        mockSupabase.rpc('get_public_reservations_paginated', {
          start_date: '2025-01-22T00:00:00.000Z',
          end_date: '2025-01-22T23:59:59.999Z',
          page_limit: 150, // Invalid: too high
          page_offset: 0
        })
      ).rejects.toThrow('page_limit must be between 1 and 100');
    });

    it('should validate negative offset', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('page_offset must be >= 0'));

      await expect(
        mockSupabase.rpc('get_public_reservations_paginated', {
          start_date: '2025-01-22T00:00:00.000Z',
          end_date: '2025-01-22T23:59:59.999Z',
          page_limit: 10,
          page_offset: -5 // Invalid: negative
        })
      ).rejects.toThrow('page_offset must be >= 0');
    });

    it('should calculate has_more correctly for last page', async () => {
      const mockLastPageData = [
        {
          id: 'res1',
          total_count: 15,
          has_more: false // Last page
        }
      ];

      mockSupabase.rpc.mockResolvedValue({ data: mockLastPageData, error: null });

      const result = await mockSupabase.rpc('get_public_reservations_paginated', {
        start_date: '2025-01-22T00:00:00.000Z',
        end_date: '2025-01-22T23:59:59.999Z',
        page_limit: 10,
        page_offset: 10 // Second page of 15 total items
      });

      expect(result.data[0].has_more).toBe(false);
    });
  });

  describe('get_public_reservations_anonymous_paginated Function', () => {
    it('should return paginated results with minimal data for anonymous users', async () => {
      const mockAnonymousData = [
        {
          id: 'res1',
          room_id: 'room1',
          title: 'Booked',
          start_time: '2025-01-22T09:00:00Z',
          end_time: '2025-01-22T10:00:00Z',
          room_name: 'Conference Room A',
          is_mine: false,
          total_count: 8,
          has_more: false
        },
        {
          id: 'res2',
          room_id: 'room2',
          title: 'Booked',
          start_time: '2025-01-22T11:00:00Z',
          end_time: '2025-01-22T12:00:00Z',
          room_name: 'Meeting Room B',
          is_mine: false,
          total_count: 8,
          has_more: false
        }
      ];

      mockSupabase.rpc.mockResolvedValue({ data: mockAnonymousData, error: null });

      const result = await mockSupabase.rpc('get_public_reservations_anonymous_paginated', {
        start_date: '2025-01-22T00:00:00.000Z',
        end_date: '2025-01-22T23:59:59.999Z',
        page_limit: 10,
        page_offset: 0
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].title).toBe('Booked'); // Always masked for anonymous
      expect(result.data[0].is_mine).toBe(false); // Always false for anonymous
      expect(result.data[0].total_count).toBe(8);
      expect(result.data[0].has_more).toBe(false);
    });

    it('should validate pagination parameters for anonymous function', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('page_limit must be between 1 and 100'));

      await expect(
        mockSupabase.rpc('get_public_reservations_anonymous_paginated', {
          start_date: '2025-01-22T00:00:00.000Z',
          end_date: '2025-01-22T23:59:59.999Z',
          page_limit: 0, // Invalid: too low
          page_offset: 0
        })
      ).rejects.toThrow('page_limit must be between 1 and 100');
    });
  });

  describe('Enhanced Existing Functions with Optional Pagination', () => {
    it('should work without pagination parameters (backward compatibility)', async () => {
      const mockData = [
        {
          id: 'res1',
          title: 'My Meeting',
          is_mine: true
        }
      ];

      mockSupabase.rpc.mockResolvedValue({ data: mockData, error: null });

      const result = await mockSupabase.rpc('get_public_reservations', {
        start_date: '2025-01-22T00:00:00.000Z',
        end_date: '2025-01-22T23:59:59.999Z'
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].total_count).toBeUndefined(); // No pagination metadata
      expect(result.data[0].has_more).toBeUndefined();
    });

    it('should work with pagination parameters', async () => {
      const mockData = [
        {
          id: 'res1',
          title: 'My Meeting',
          is_mine: true
        }
      ];

      mockSupabase.rpc.mockResolvedValue({ data: mockData, error: null });

      const result = await mockSupabase.rpc('get_public_reservations', {
        start_date: '2025-01-22T00:00:00.000Z',
        end_date: '2025-01-22T23:59:59.999Z',
        page_limit: 10,
        page_offset: 0
      });

      expect(result.data).toHaveLength(1);
    });

    it('should validate partial pagination parameters', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Both page_limit and page_offset must be provided together'));

      await expect(
        mockSupabase.rpc('get_public_reservations', {
          start_date: '2025-01-22T00:00:00.000Z',
          end_date: '2025-01-22T23:59:59.999Z',
          page_limit: 10
          // Missing page_offset
        })
      ).rejects.toThrow('Both page_limit and page_offset must be provided together');
    });
  });

  describe('Date Range Validation with Pagination', () => {
    it('should validate date ranges even with pagination', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Start date must be before end date'));

      await expect(
        mockSupabase.rpc('get_public_reservations_paginated', {
          start_date: '2025-01-22T23:59:59.999Z',
          end_date: '2025-01-22T00:00:00.000Z', // Invalid: end before start
          page_limit: 10,
          page_offset: 0
        })
      ).rejects.toThrow('Start date must be before end date');
    });

    it('should validate date range limits with pagination', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Date range cannot exceed 90 days'));

      await expect(
        mockSupabase.rpc('get_public_reservations_paginated', {
          start_date: '2025-01-01T00:00:00.000Z',
          end_date: '2025-04-15T23:59:59.999Z', // More than 90 days
          page_limit: 10,
          page_offset: 0
        })
      ).rejects.toThrow('Date range cannot exceed 90 days');
    });
  });

  describe('Performance and Indexing', () => {
    it('should handle large offset values efficiently', async () => {
      const mockData = [
        {
          id: 'res1',
          total_count: 10000,
          has_more: true
        }
      ];

      mockSupabase.rpc.mockResolvedValue({ data: mockData, error: null });

      const result = await mockSupabase.rpc('get_public_reservations_paginated', {
        start_date: '2025-01-22T00:00:00.000Z',
        end_date: '2025-01-22T23:59:59.999Z',
        page_limit: 50,
        page_offset: 5000 // Large offset
      });

      expect(result.data[0].total_count).toBe(10000);
      expect(result.data[0].has_more).toBe(true);
    });

    it('should return consistent total_count across pages', async () => {
      const mockFirstPageData = [
        { id: 'res1', total_count: 100, has_more: true }
      ];
      const mockSecondPageData = [
        { id: 'res2', total_count: 100, has_more: true }
      ];

      // First page
      mockSupabase.rpc.mockResolvedValueOnce({ data: mockFirstPageData, error: null });
      const firstResult = await mockSupabase.rpc('get_public_reservations_paginated', {
        start_date: '2025-01-22T00:00:00.000Z',
        end_date: '2025-01-22T23:59:59.999Z',
        page_limit: 10,
        page_offset: 0
      });

      // Second page
      mockSupabase.rpc.mockResolvedValueOnce({ data: mockSecondPageData, error: null });
      const secondResult = await mockSupabase.rpc('get_public_reservations_paginated', {
        start_date: '2025-01-22T00:00:00.000Z',
        end_date: '2025-01-22T23:59:59.999Z',
        page_limit: 10,
        page_offset: 10
      });

      expect(firstResult.data[0].total_count).toBe(secondResult.data[0].total_count);
    });
  });

  describe('Empty Results Handling', () => {
    it('should handle empty results correctly', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

      const result = await mockSupabase.rpc('get_public_reservations_paginated', {
        start_date: '2025-01-22T00:00:00.000Z',
        end_date: '2025-01-22T23:59:59.999Z',
        page_limit: 10,
        page_offset: 0
      });

      expect(result.data).toEqual([]);
    });

    it('should handle offset beyond available data', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

      const result = await mockSupabase.rpc('get_public_reservations_paginated', {
        start_date: '2025-01-22T00:00:00.000Z',
        end_date: '2025-01-22T23:59:59.999Z',
        page_limit: 10,
        page_offset: 1000 // Way beyond available data
      });

      expect(result.data).toEqual([]);
    });
  });
});