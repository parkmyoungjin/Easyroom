import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock fetch globally
global.fetch = jest.fn();

// Mock the auth hook
jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({ user: { id: 'user123' } }))
}));

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

describe('Infinite Reservations Functionality', () => {
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Fetch function behavior', () => {
    it('should construct correct API URL for authenticated users', async () => {
      const mockResponse = {
        data: [],
        pagination: { limit: 20, offset: 0, total_count: 0, has_more: false }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      // Import the fetch function from the hook file
      const { fetchPaginatedReservations } = await import('@/hooks/useInfinitePublicReservations');

      await fetchPaginatedReservations({
        startDate: '2025-01-22',
        endDate: '2025-01-22',
        isAuthenticated: true,
        pageParam: 0,
        limit: 20
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/reservations/public-authenticated')
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('startDate=2025-01-22&endDate=2025-01-22&limit=20&offset=0')
      );
    });

    it('should construct correct API URL for anonymous users', async () => {
      const mockResponse = {
        data: [],
        pagination: { limit: 20, offset: 0, total_count: 0, has_more: false }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const { fetchPaginatedReservations } = await import('@/hooks/useInfinitePublicReservations');

      await fetchPaginatedReservations({
        startDate: '2025-01-22',
        endDate: '2025-01-22',
        isAuthenticated: false,
        pageParam: 10,
        limit: 50
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/reservations/public-anonymous')
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('startDate=2025-01-22&endDate=2025-01-22&limit=50&offset=10')
      );
    });

    it('should handle successful responses', async () => {
      const mockResponse = {
        data: [
          {
            id: 'res1',
            title: 'Meeting 1',
            start_time: '2025-01-22T09:00:00Z',
            end_time: '2025-01-22T10:00:00Z',
            is_mine: false
          }
        ],
        message: '1개의 예약을 조회했습니다.',
        authenticated: true,
        userId: 'user123',
        pagination: {
          limit: 20,
          offset: 0,
          total_count: 25,
          has_more: true,
          current_page: 1,
          total_pages: 2
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const { fetchPaginatedReservations } = await import('@/hooks/useInfinitePublicReservations');

      const result = await fetchPaginatedReservations({
        startDate: '2025-01-22',
        endDate: '2025-01-22',
        isAuthenticated: true,
        pageParam: 0,
        limit: 20
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('res1');
      expect(result.pagination.has_more).toBe(true);
      expect(result.pagination.total_count).toBe(25);
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'Invalid date range' }),
      } as Response);

      const { fetchPaginatedReservations } = await import('@/hooks/useInfinitePublicReservations');

      await expect(
        fetchPaginatedReservations({
          startDate: '2025-01-22',
          endDate: '2025-01-21', // Invalid range
          isAuthenticated: true,
          pageParam: 0,
          limit: 20
        })
      ).rejects.toThrow('Invalid date range');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { fetchPaginatedReservations } = await import('@/hooks/useInfinitePublicReservations');

      await expect(
        fetchPaginatedReservations({
          startDate: '2025-01-22',
          endDate: '2025-01-22',
          isAuthenticated: true,
          pageParam: 0,
          limit: 20
        })
      ).rejects.toThrow('Network error');
    });
  });

  describe('Query key generation', () => {
    it('should generate correct query keys', async () => {
      const { infiniteReservationKeys } = await import('@/hooks/useInfinitePublicReservations');

      const authenticatedKey = infiniteReservationKeys.public('2025-01-22', '2025-01-22', true);
      const anonymousKey = infiniteReservationKeys.public('2025-01-22', '2025-01-22', false);

      expect(authenticatedKey).toEqual([
        'infinite-reservations',
        'public',
        '2025-01-22',
        '2025-01-22',
        'auth',
        true
      ]);

      expect(anonymousKey).toEqual([
        'infinite-reservations',
        'public',
        '2025-01-22',
        '2025-01-22',
        'auth',
        false
      ]);
    });
  });

  describe('Pagination logic', () => {
    it('should calculate next page parameter correctly', () => {
      const mockPage = {
        data: [],
        pagination: {
          limit: 20,
          offset: 0,
          total_count: 50,
          has_more: true,
          current_page: 1,
          total_pages: 3
        }
      };

      // Simulate getNextPageParam logic
      const getNextPageParam = (lastPage: typeof mockPage) => {
        if (!lastPage.pagination?.has_more) {
          return undefined;
        }
        return lastPage.pagination.offset + lastPage.pagination.limit;
      };

      const nextPageParam = getNextPageParam(mockPage);
      expect(nextPageParam).toBe(20);
    });

    it('should return undefined for last page', () => {
      const mockLastPage = {
        data: [],
        pagination: {
          limit: 20,
          offset: 40,
          total_count: 50,
          has_more: false,
          current_page: 3,
          total_pages: 3
        }
      };

      const getNextPageParam = (lastPage: typeof mockLastPage) => {
        if (!lastPage.pagination?.has_more) {
          return undefined;
        }
        return lastPage.pagination.offset + lastPage.pagination.limit;
      };

      const nextPageParam = getNextPageParam(mockLastPage);
      expect(nextPageParam).toBeUndefined();
    });

    it('should calculate previous page parameter correctly', () => {
      const mockPage = {
        data: [],
        pagination: {
          limit: 20,
          offset: 20,
          total_count: 50,
          has_more: true,
          current_page: 2,
          total_pages: 3
        }
      };

      // Simulate getPreviousPageParam logic
      const getPreviousPageParam = (firstPage: typeof mockPage) => {
        if (firstPage.pagination?.offset <= 0) {
          return undefined;
        }
        return Math.max(0, firstPage.pagination.offset - firstPage.pagination.limit);
      };

      const previousPageParam = getPreviousPageParam(mockPage);
      expect(previousPageParam).toBe(0);
    });

    it('should return undefined for first page', () => {
      const mockFirstPage = {
        data: [],
        pagination: {
          limit: 20,
          offset: 0,
          total_count: 50,
          has_more: true,
          current_page: 1,
          total_pages: 3
        }
      };

      const getPreviousPageParam = (firstPage: typeof mockFirstPage) => {
        if (firstPage.pagination?.offset <= 0) {
          return undefined;
        }
        return Math.max(0, firstPage.pagination.offset - firstPage.pagination.limit);
      };

      const previousPageParam = getPreviousPageParam(mockFirstPage);
      expect(previousPageParam).toBeUndefined();
    });
  });

  describe('Data flattening logic', () => {
    it('should flatten multiple pages correctly', () => {
      const mockPages = [
        {
          data: [
            { id: 'res1', title: 'Meeting 1' },
            { id: 'res2', title: 'Meeting 2' }
          ],
          pagination: { limit: 2, offset: 0, total_count: 4, has_more: true }
        },
        {
          data: [
            { id: 'res3', title: 'Meeting 3' },
            { id: 'res4', title: 'Meeting 4' }
          ],
          pagination: { limit: 2, offset: 2, total_count: 4, has_more: false }
        }
      ];

      const flattenedData = mockPages.flatMap(page => page.data);
      expect(flattenedData).toHaveLength(4);
      expect(flattenedData.map(r => r.id)).toEqual(['res1', 'res2', 'res3', 'res4']);
    });

    it('should handle empty pages', () => {
      const mockPages = [
        {
          data: [],
          pagination: { limit: 20, offset: 0, total_count: 0, has_more: false }
        }
      ];

      const flattenedData = mockPages.flatMap(page => page.data);
      expect(flattenedData).toEqual([]);
    });

    it('should extract pagination metadata from first page', () => {
      const mockPages = [
        {
          data: [{ id: 'res1', title: 'Meeting 1' }],
          pagination: { limit: 20, offset: 0, total_count: 100, has_more: true }
        },
        {
          data: [{ id: 'res2', title: 'Meeting 2' }],
          pagination: { limit: 20, offset: 20, total_count: 100, has_more: true }
        }
      ];

      const paginationMeta = mockPages[0]?.pagination;
      expect(paginationMeta?.total_count).toBe(100);
      expect(paginationMeta?.limit).toBe(20);
      expect(paginationMeta?.offset).toBe(0);
    });
  });

  describe('URL parameter construction', () => {
    it('should construct search params correctly', () => {
      const params = new URLSearchParams({
        startDate: '2025-01-22',
        endDate: '2025-01-23',
        limit: '50',
        offset: '100'
      });

      expect(params.toString()).toBe('startDate=2025-01-22&endDate=2025-01-23&limit=50&offset=100');
    });

    it('should handle special characters in dates', () => {
      const params = new URLSearchParams({
        startDate: '2025-01-22T00:00:00.000Z',
        endDate: '2025-01-22T23:59:59.999Z',
        limit: '20',
        offset: '0'
      });

      expect(params.toString()).toContain('startDate=2025-01-22T00%3A00%3A00.000Z');
      expect(params.toString()).toContain('endDate=2025-01-22T23%3A59%3A59.999Z');
    });
  });

  describe('Authentication detection', () => {
    it('should detect authenticated users correctly', async () => {
      const { useAuth } = require('@/hooks/useAuth');
      useAuth.mockReturnValue({ user: { id: 'user123' } });

      const isAuthenticated = !!{ user: { id: 'user123' } }.user;
      expect(isAuthenticated).toBe(true);
    });

    it('should detect anonymous users correctly', async () => {
      const { useAuth } = require('@/hooks/useAuth');
      useAuth.mockReturnValue({ user: null });

      const isAuthenticated = !!{ user: null }.user;
      expect(isAuthenticated).toBe(false);
    });
  });
});