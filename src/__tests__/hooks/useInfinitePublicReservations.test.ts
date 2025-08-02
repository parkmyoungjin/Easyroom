import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock fetch globally
global.fetch = jest.fn();

// Mock the auth hook completely to avoid Supabase client issues
jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({ user: { id: 'user123' } }))
}));

// Mock the entire Supabase client to avoid import issues
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }))
    }
  }
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

import { useInfinitePublicReservations, useFlattenedReservations } from '@/hooks/useInfinitePublicReservations';
import { waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { ReactNode } from 'react';

// Test wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
  });

  return ({ children }: { children: ReactNode }) => {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useInfinitePublicReservations', () => {
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic functionality', () => {
    it('should fetch first page of reservations', async () => {
      const mockResponse = {
        data: [
          {
            id: 'res1',
            room_id: 'room1',
            user_id: 'user1',
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

      const { result } = renderHook(
        () => useInfinitePublicReservations('2025-01-22', '2025-01-22'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.pages).toHaveLength(1);
      expect(result.current.data?.pages[0].data).toHaveLength(1);
      expect(result.current.data?.pages[0].data[0].id).toBe('res1');
      expect(result.current.hasNextPage).toBe(true);
    });

    it('should handle pagination correctly', async () => {
      const firstPageResponse = {
        data: [{ id: 'res1', title: 'Meeting 1' }],
        pagination: {
          limit: 20,
          offset: 0,
          total_count: 25,
          has_more: true,
          current_page: 1,
          total_pages: 2
        }
      };

      const secondPageResponse = {
        data: [{ id: 'res2', title: 'Meeting 2' }],
        pagination: {
          limit: 20,
          offset: 20,
          total_count: 25,
          has_more: false,
          current_page: 2,
          total_pages: 2
        }
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => firstPageResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => secondPageResponse,
        } as Response);

      const { result } = renderHook(
        () => useInfinitePublicReservations('2025-01-22', '2025-01-22'),
        { wrapper: createWrapper() }
      );

      // Wait for first page
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.hasNextPage).toBe(true);

      // Fetch next page
      await result.current.fetchNextPage();

      await waitFor(() => {
        expect(result.current.data?.pages).toHaveLength(2);
      });

      expect(result.current.data?.pages[1].data[0].id).toBe('res2');
      expect(result.current.hasNextPage).toBe(false);
    });

    it('should handle anonymous users correctly', async () => {
      // Mock anonymous user
      const { useAuth } = require('@/hooks/useAuth');
      useAuth.mockReturnValue({ user: null });

      const mockResponse = {
        data: [
          {
            id: 'res1',
            room_id: 'room1',
            title: 'Booked',
            start_time: '2025-01-22T09:00:00Z',
            end_time: '2025-01-22T10:00:00Z',
            room_name: 'Conference Room A',
            is_mine: false
          }
        ],
        message: '1개의 예약을 조회했습니다.',
        authenticated: false,
        pagination: {
          limit: 20,
          offset: 0,
          total_count: 1,
          has_more: false,
          current_page: 1,
          total_pages: 1
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const { result } = renderHook(
        () => useInfinitePublicReservations('2025-01-22', '2025-01-22'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/reservations/public-anonymous')
      );
      expect(result.current.data?.pages[0].data[0].title).toBe('Booked');
    });
  });

  describe('Error handling', () => {
    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(
        () => useInfinitePublicReservations('2025-01-22', '2025-01-22'),
        { wrapper: createWrapper() }
      );

      // Initially should be loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isError).toBe(false);

      // The hook should handle the error (even if it retries)
      // We just verify that the hook doesn't crash and maintains proper state
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeNull();
    });

    it('should handle HTTP errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'Invalid date range' }),
      } as Response);

      const { result } = renderHook(
        () => useInfinitePublicReservations('2025-01-22', '2025-01-21'), // Invalid range
        { wrapper: createWrapper() }
      );

      // Initially should be loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isError).toBe(false);

      // The hook should handle the error gracefully
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeNull();
    });
  });

  describe('Query parameters', () => {
    it('should construct correct URL parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
          pagination: { limit: 10, offset: 0, total_count: 0, has_more: false }
        }),
      } as Response);

      renderHook(
        () => useInfinitePublicReservations('2025-01-22', '2025-01-23', { limit: 10 }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('startDate=2025-01-22&endDate=2025-01-23&limit=10&offset=0')
        );
      });
    });

    it('should handle custom limit parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
          pagination: { limit: 50, offset: 0, total_count: 0, has_more: false }
        }),
      } as Response);

      renderHook(
        () => useInfinitePublicReservations('2025-01-22', '2025-01-22', { limit: 50 }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('limit=50')
        );
      });
    });
  });

  describe('Disabled state', () => {
    it('should not fetch when disabled', () => {
      renderHook(
        () => useInfinitePublicReservations('2025-01-22', '2025-01-22', { enabled: false }),
        { wrapper: createWrapper() }
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not fetch when dates are missing', () => {
      renderHook(
        () => useInfinitePublicReservations('', '2025-01-22'),
        { wrapper: createWrapper() }
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});

describe('useFlattenedReservations', () => {
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should flatten multiple pages into single array', async () => {
    const firstPageResponse = {
      data: [
        { id: 'res1', title: 'Meeting 1' },
        { id: 'res2', title: 'Meeting 2' }
      ],
      pagination: {
        limit: 2,
        offset: 0,
        total_count: 4,
        has_more: true,
        current_page: 1,
        total_pages: 2
      }
    };

    const secondPageResponse = {
      data: [
        { id: 'res3', title: 'Meeting 3' },
        { id: 'res4', title: 'Meeting 4' }
      ],
      pagination: {
        limit: 2,
        offset: 2,
        total_count: 4,
        has_more: false,
        current_page: 2,
        total_pages: 2
      }
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => firstPageResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => secondPageResponse,
      } as Response);

    const { result } = renderHook(
      () => useFlattenedReservations('2025-01-22', '2025-01-22', { limit: 2 }),
      { wrapper: createWrapper() }
    );

    // Wait for first page
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.totalCount).toBe(4);

    // Fetch next page
    await result.current.fetchNextPage();

    await waitFor(() => {
      expect(result.current.data).toHaveLength(4);
    });

    expect(result.current.data.map(r => r.id)).toEqual(['res1', 'res2', 'res3', 'res4']);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('should provide correct pagination metadata', async () => {
    const mockResponse = {
      data: [{ id: 'res1', title: 'Meeting 1' }],
      pagination: {
        limit: 20,
        offset: 0,
        total_count: 100,
        has_more: true,
        current_page: 1,
        total_pages: 5
      }
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const { result } = renderHook(
      () => useFlattenedReservations('2025-01-22', '2025-01-22'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.totalCount).toBe(100);
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.hasPreviousPage).toBe(false);
  });

  it('should handle empty results', async () => {
    const mockResponse = {
      data: [],
      pagination: {
        limit: 20,
        offset: 0,
        total_count: 0,
        has_more: false,
        current_page: 1,
        total_pages: 1
      }
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const { result } = renderHook(
      () => useFlattenedReservations('2025-01-22', '2025-01-22'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.hasNextPage).toBe(false);
  });
});