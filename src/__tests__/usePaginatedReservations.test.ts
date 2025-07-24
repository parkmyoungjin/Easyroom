/**
 * Paginated Reservations Hooks Integration Tests
 * Tests for complete data fetching workflows
 * Requirements: 2.2, 2.3, 4.5
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { usePaginatedPublicReservations } from '@/hooks/usePaginatedReservations';

// Mock the auth hook
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
  }),
}));

// Mock the logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn();

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('usePaginatedPublicReservations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch paginated reservations successfully', async () => {
    const mockResponse = {
      data: [
        {
          id: '1',
          room_id: 'room-1',
          user_id: 'user-1',
          title: 'Test Meeting',
          start_time: '2024-01-01T10:00:00Z',
          end_time: '2024-01-01T11:00:00Z',
          is_mine: true,
        },
      ],
      pagination: {
        limit: 20,
        offset: 0,
        total_count: 1,
        has_more: false,
        current_page: 1,
        total_pages: 1,
        current_count: 1,
      },
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(
      () => usePaginatedPublicReservations('2024-01-01', '2024-01-31'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].title).toBe('Test Meeting');
    expect(result.current.totalCount).toBe(1);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('should handle API errors gracefully', async () => {
    const mockErrorResponse = {
      error: 'Internal Server Error',
      message: 'Something went wrong',
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => mockErrorResponse,
    });

    const { result } = renderHook(
      () => usePaginatedPublicReservations('2024-01-01', '2024-01-31'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeTruthy();
  });

  it('should be disabled when dates are not provided', () => {
    const { result } = renderHook(
      () => usePaginatedPublicReservations('', ''),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('should use correct endpoint based on authentication state', async () => {
    const mockResponse = {
      data: [],
      pagination: {
        limit: 20,
        offset: 0,
        total_count: 0,
        has_more: false,
        current_page: 1,
        total_pages: 0,
        current_count: 0,
      },
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    renderHook(
      () => usePaginatedPublicReservations('2024-01-01', '2024-01-31'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/reservations/public-authenticated')
      );
    });
  });

  it('should apply initial pagination configuration', async () => {
    const mockResponse = {
      data: [],
      pagination: {
        limit: 10,
        offset: 0,
        total_count: 0,
        has_more: false,
        current_page: 1,
        total_pages: 0,
        current_count: 0,
      },
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    renderHook(
      () => usePaginatedPublicReservations('2024-01-01', '2024-01-31', {
        initialPagination: {
          limit: 10,
          sortBy: 'end_time',
          sortOrder: 'desc',
        },
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10')
      );
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('sortBy=end_time')
      );
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('sortOrder=desc')
      );
    });
  });
});