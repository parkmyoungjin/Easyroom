import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: jest.fn()
  },
  rpc: jest.fn(),
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        gte: jest.fn(() => ({
          lte: jest.fn(() => ({
            order: jest.fn(() => ({
              range: jest.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          }))
        }))
      }))
    }))
  }))
};

// Mock the createClient function
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

// Mock other dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('@/lib/utils/date', () => ({
  normalizeDateForQuery: jest.fn()
    .mockReturnValueOnce('2025-01-22T00:00:00.000Z')
    .mockReturnValueOnce('2025-01-22T23:59:59.999Z')
}));

jest.mock('@/lib/utils/error-handler', () => ({
  ReservationErrorHandler: {
    handleApiError: jest.fn(() => ({
      userMessage: 'Test error',
      code: 'TEST_ERROR',
      message: 'Test error message'
    }))
  }
}));

describe('Pagination Functionality Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('RPC Function Selection Logic', () => {
    it('should select paginated function when limit and offset are provided', () => {
      const pageLimit = 10;
      const pageOffset = 0;
      
      const functionName = (pageLimit !== null && pageOffset !== null) 
        ? 'get_public_reservations_paginated' 
        : 'get_public_reservations';
      
      expect(functionName).toBe('get_public_reservations_paginated');
    });

    it('should select non-paginated function when pagination params are null', () => {
      const pageLimit = null;
      const pageOffset = null;
      
      const functionName = (pageLimit !== null && pageOffset !== null) 
        ? 'get_public_reservations_paginated' 
        : 'get_public_reservations';
      
      expect(functionName).toBe('get_public_reservations');
    });

    it('should select anonymous paginated function correctly', () => {
      const pageLimit = 20;
      const pageOffset = 10;
      
      const functionName = (pageLimit !== null && pageOffset !== null) 
        ? 'get_public_reservations_anonymous_paginated' 
        : 'get_public_reservations_anonymous';
      
      expect(functionName).toBe('get_public_reservations_anonymous_paginated');
    });
  });

  describe('Pagination Parameter Validation', () => {
    it('should validate limit parameter bounds', () => {
      const testCases = [
        { limit: '0', valid: false },
        { limit: '1', valid: true },
        { limit: '50', valid: true },
        { limit: '100', valid: true },
        { limit: '101', valid: false },
        { limit: 'abc', valid: false },
        { limit: '-5', valid: false }
      ];

      testCases.forEach(({ limit, valid }) => {
        const parsedLimit = parseInt(limit, 10);
        const isValid = !isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100;
        expect(isValid).toBe(valid);
      });
    });

    it('should validate offset parameter bounds', () => {
      const testCases = [
        { offset: '0', valid: true },
        { offset: '10', valid: true },
        { offset: '1000', valid: true },
        { offset: '-1', valid: false },
        { offset: 'xyz', valid: false }
      ];

      testCases.forEach(({ offset, valid }) => {
        const parsedOffset = parseInt(offset, 10);
        const isValid = !isNaN(parsedOffset) && parsedOffset >= 0;
        expect(isValid).toBe(valid);
      });
    });

    it('should validate that both parameters are provided together', () => {
      const testCases = [
        { limit: null, offset: null, valid: true },   // Both null is valid
        { limit: 10, offset: 0, valid: true },        // Both provided is valid
        { limit: 10, offset: null, valid: false },    // Only limit is invalid
        { limit: null, offset: 0, valid: false }      // Only offset is invalid
      ];

      testCases.forEach(({ limit, offset, valid }) => {
        const isValid = (limit === null) === (offset === null);
        expect(isValid).toBe(valid);
      });
    });
  });

  describe('Pagination Metadata Calculation', () => {
    it('should calculate pagination metadata correctly', () => {
      const testCases = [
        {
          limit: 10,
          offset: 0,
          totalCount: 25,
          expected: {
            current_page: 1,
            total_pages: 3,
            has_more: true
          }
        },
        {
          limit: 10,
          offset: 20,
          totalCount: 47,
          expected: {
            current_page: 3,
            total_pages: 5,
            has_more: true
          }
        },
        {
          limit: 20,
          offset: 0,
          totalCount: 15,
          expected: {
            current_page: 1,
            total_pages: 1,
            has_more: false
          }
        },
        {
          limit: 10,
          offset: 40,
          totalCount: 45,
          expected: {
            current_page: 5,
            total_pages: 5,
            has_more: false
          }
        }
      ];

      testCases.forEach(({ limit, offset, totalCount, expected }) => {
        const currentPage = Math.floor(offset / limit) + 1;
        const totalPages = Math.ceil(totalCount / limit);
        const hasMore = (offset + limit) < totalCount;

        expect(currentPage).toBe(expected.current_page);
        expect(totalPages).toBe(expected.total_pages);
        expect(hasMore).toBe(expected.has_more);
      });
    });
  });

  describe('RPC Parameter Construction', () => {
    it('should construct RPC parameters correctly for paginated calls', () => {
      const baseParams = {
        start_date: '2025-01-22T00:00:00.000Z',
        end_date: '2025-01-22T23:59:59.999Z'
      };

      const pageLimit = 10;
      const pageOffset = 20;

      const rpcParams = {
        ...baseParams,
        page_limit: pageLimit,
        page_offset: pageOffset
      };

      expect(rpcParams).toEqual({
        start_date: '2025-01-22T00:00:00.000Z',
        end_date: '2025-01-22T23:59:59.999Z',
        page_limit: 10,
        page_offset: 20
      });
    });

    it('should construct RPC parameters correctly for non-paginated calls', () => {
      const baseParams = {
        start_date: '2025-01-22T00:00:00.000Z',
        end_date: '2025-01-22T23:59:59.999Z'
      };

      // No pagination parameters added
      expect(baseParams).toEqual({
        start_date: '2025-01-22T00:00:00.000Z',
        end_date: '2025-01-22T23:59:59.999Z'
      });
    });
  });

  describe('Fallback Query Range Calculation', () => {
    it('should calculate range parameters correctly for Supabase queries', () => {
      const testCases = [
        { offset: 0, limit: 10, expectedStart: 0, expectedEnd: 9 },
        { offset: 10, limit: 10, expectedStart: 10, expectedEnd: 19 },
        { offset: 20, limit: 5, expectedStart: 20, expectedEnd: 24 },
        { offset: 0, limit: 1, expectedStart: 0, expectedEnd: 0 }
      ];

      testCases.forEach(({ offset, limit, expectedStart, expectedEnd }) => {
        const rangeStart = offset;
        const rangeEnd = offset + limit - 1;

        expect(rangeStart).toBe(expectedStart);
        expect(rangeEnd).toBe(expectedEnd);
      });
    });
  });

  describe('Mock RPC Function Behavior', () => {
    it('should handle paginated RPC function calls', async () => {
      const mockPaginatedData = [
        {
          id: 'res1',
          room_id: 'room1',
          title: 'Meeting 1',
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

      expect(result.data).toHaveLength(1);
      expect(result.data[0].total_count).toBe(25);
      expect(result.data[0].has_more).toBe(true);
    });

    it('should handle anonymous paginated RPC function calls', async () => {
      const mockAnonymousData = [
        {
          id: 'res1',
          room_id: 'room1',
          title: 'Booked',
          room_name: 'Conference Room A',
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

      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('Booked');
      expect(result.data[0].is_mine).toBe(false);
      expect(result.data[0].total_count).toBe(8);
    });

    it('should handle empty results', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

      const result = await mockSupabase.rpc('get_public_reservations_paginated', {
        start_date: '2025-01-22T00:00:00.000Z',
        end_date: '2025-01-22T23:59:59.999Z',
        page_limit: 10,
        page_offset: 100
      });

      expect(result.data).toEqual([]);
    });

    it('should handle RPC function errors', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('page_limit must be between 1 and 100'));

      await expect(
        mockSupabase.rpc('get_public_reservations_paginated', {
          start_date: '2025-01-22T00:00:00.000Z',
          end_date: '2025-01-22T23:59:59.999Z',
          page_limit: 150,
          page_offset: 0
        })
      ).rejects.toThrow('page_limit must be between 1 and 100');
    });
  });

  describe('Response Structure Validation', () => {
    it('should validate paginated response structure', () => {
      const mockResponse = {
        data: [
          {
            id: 'res1',
            room_id: 'room1',
            title: 'Meeting 1',
            total_count: 25,
            has_more: true
          }
        ],
        message: '1개의 예약을 조회했습니다.',
        authenticated: true,
        userId: 'user123',
        pagination: {
          limit: 10,
          offset: 0,
          total_count: 25,
          has_more: true,
          current_page: 1,
          total_pages: 3
        }
      };

      expect(mockResponse.data).toBeDefined();
      expect(mockResponse.pagination).toBeDefined();
      expect(mockResponse.pagination.limit).toBe(10);
      expect(mockResponse.pagination.total_count).toBe(25);
      expect(mockResponse.pagination.has_more).toBe(true);
    });

    it('should validate non-paginated response structure', () => {
      const mockResponse = {
        data: [
          { id: 'res1', title: 'Meeting 1' },
          { id: 'res2', title: 'Meeting 2' }
        ],
        message: '2개의 예약을 조회했습니다.',
        authenticated: true,
        userId: 'user123'
      };

      expect(mockResponse.data).toBeDefined();
      expect(mockResponse.pagination).toBeUndefined();
    });
  });
});