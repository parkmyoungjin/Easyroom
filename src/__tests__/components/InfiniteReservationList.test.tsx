import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Mock the infinite reservations hook
jest.mock('@/hooks/useInfinitePublicReservations', () => ({
  useFlattenedReservations: jest.fn()
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

// Mock Intersection Observer
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
});
window.IntersectionObserver = mockIntersectionObserver;

import InfiniteReservationList from '@/components/reservations/InfiniteReservationList';
import { useFlattenedReservations } from '@/hooks/useInfinitePublicReservations';

// Get the mocked function
const mockUseFlattenedReservations = useFlattenedReservations as jest.MockedFunction<typeof useFlattenedReservations>;

// Test wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('InfiniteReservationList', () => {
  const defaultProps = {
    startDate: '2025-01-22',
    endDate: '2025-01-22',
    limit: 20
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading states', () => {
    it('should show loading skeleton when initially loading', () => {
      mockUseFlattenedReservations.mockReturnValue({
        data: [],
        totalCount: 0,
        hasNextPage: false,
        isFetchingNextPage: false,
        fetchNextPage: jest.fn(),
        isLoading: true,
        isError: false,
        error: null,
        refetch: jest.fn()
      });

      render(<InfiniteReservationList {...defaultProps} />, { wrapper: createWrapper() });

      expect(document.querySelectorAll('.animate-pulse')).toHaveLength(5);
    });

    it('should show loading indicator when fetching next page', () => {
      mockUseFlattenedReservations.mockReturnValue({
        data: [
          {
            id: 'res1',
            title: 'Meeting 1',
            start_time: '2025-01-22T09:00:00Z',
            end_time: '2025-01-22T10:00:00Z',
            is_mine: false
          }
        ],
        totalCount: 10,
        hasNextPage: true,
        isFetchingNextPage: true,
        fetchNextPage: jest.fn(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn()
      });

      render(<InfiniteReservationList {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByText(/더 많은 예약을 불러오는 중/)).toBeInTheDocument();
    });
  });

  describe('Error states', () => {
    it('should show error message when there is an error', () => {
      const mockError = new Error('Failed to fetch reservations');
      mockUseFlattenedReservations.mockReturnValue({
        data: [],
        totalCount: 0,
        hasNextPage: false,
        isFetchingNextPage: false,
        fetchNextPage: jest.fn(),
        isLoading: false,
        isError: true,
        error: mockError,
        refetch: jest.fn()
      });

      render(<InfiniteReservationList {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByText('예약 목록을 불러올 수 없습니다')).toBeInTheDocument();
      expect(screen.getByText('네트워크 연결을 확인해주세요')).toBeInTheDocument();
      expect(screen.getByText('다시 시도')).toBeInTheDocument();
    });

    it('should call refetch when retry button is clicked', () => {
      const mockRefetch = jest.fn();
      mockUseFlattenedReservations.mockReturnValue({
        data: [],
        totalCount: 0,
        hasNextPage: false,
        isFetchingNextPage: false,
        fetchNextPage: jest.fn(),
        isLoading: false,
        isError: true,
        error: new Error('Test error'),
        refetch: mockRefetch
      });

      render(<InfiniteReservationList {...defaultProps} />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByText('다시 시도'));
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty state', () => {
    it('should show empty state when no reservations', () => {
      mockUseFlattenedReservations.mockReturnValue({
        data: [],
        totalCount: 0,
        hasNextPage: false,
        isFetchingNextPage: false,
        fetchNextPage: jest.fn(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn()
      });

      render(<InfiniteReservationList {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByText('예약이 없습니다')).toBeInTheDocument();
      expect(screen.getByText('선택한 기간에 예약된 회의실이 없습니다.')).toBeInTheDocument();
    });
  });

  describe('Reservation display', () => {
    it('should display reservations correctly', () => {
      const mockReservations = [
        {
          id: 'res1',
          user_id: 'user1',
          title: 'Team Meeting',
          purpose: 'Weekly sync',
          start_time: '2025-01-22T09:00:00Z',
          end_time: '2025-01-22T10:00:00Z',
          department: 'Engineering',
          user_name: 'John Doe',
          is_mine: true
        },
        {
          id: 'res2',
          user_id: 'user2',
          title: 'Client Call',
          purpose: null,
          start_time: '2025-01-22T14:00:00Z',
          end_time: '2025-01-22T15:00:00Z',
          department: 'Sales',
          user_name: 'Jane Smith',
          is_mine: false
        }
      ];

      mockUseFlattenedReservations.mockReturnValue({
        data: mockReservations,
        totalCount: 2,
        hasNextPage: false,
        isFetchingNextPage: false,
        fetchNextPage: jest.fn(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn()
      });

      render(<InfiniteReservationList {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByText('Team Meeting')).toBeInTheDocument();
      expect(screen.getByText('Client Call')).toBeInTheDocument();
      expect(screen.getByText('내 예약')).toBeInTheDocument(); // Badge for own reservation
      expect(screen.getByText('총 2개 중 2개 표시')).toBeInTheDocument();
    });

    it('should display anonymous reservations correctly', () => {
      const mockReservations = [
        {
          id: 'res1',
          title: 'Booked',
          start_time: '2025-01-22T09:00:00Z',
          end_time: '2025-01-22T10:00:00Z',
          room_name: 'Conference Room A',
          is_mine: false
        }
      ];

      mockUseFlattenedReservations.mockReturnValue({
        data: mockReservations,
        totalCount: 1,
        hasNextPage: false,
        isFetchingNextPage: false,
        fetchNextPage: jest.fn(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn()
      });

      render(<InfiniteReservationList {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByText('Booked')).toBeInTheDocument();
      expect(screen.getByText('Conference Room A')).toBeInTheDocument();
      expect(screen.queryByText('내 예약')).not.toBeInTheDocument();
    });
  });

  describe('Infinite scrolling', () => {
    it('should show load more button when has next page', () => {
      mockUseFlattenedReservations.mockReturnValue({
        data: [
          {
            id: 'res1',
            title: 'Meeting 1',
            start_time: '2025-01-22T09:00:00Z',
            end_time: '2025-01-22T10:00:00Z',
            is_mine: false
          }
        ],
        totalCount: 10,
        hasNextPage: true,
        isFetchingNextPage: false,
        fetchNextPage: jest.fn(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn()
      });

      render(<InfiniteReservationList {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByText('더 보기 (9개 남음)')).toBeInTheDocument();
    });

    it('should call fetchNextPage when load more button is clicked', () => {
      const mockFetchNextPage = jest.fn().mockResolvedValue({});
      mockUseFlattenedReservations.mockReturnValue({
        data: [
          {
            id: 'res1',
            title: 'Meeting 1',
            start_time: '2025-01-22T09:00:00Z',
            end_time: '2025-01-22T10:00:00Z',
            is_mine: false
          }
        ],
        totalCount: 10,
        hasNextPage: true,
        isFetchingNextPage: false,
        fetchNextPage: mockFetchNextPage,
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn()
      });

      render(<InfiniteReservationList {...defaultProps} />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByText('더 보기 (9개 남음)'));
      expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
    });

    it('should show completion message when no more pages', () => {
      mockUseFlattenedReservations.mockReturnValue({
        data: [
          {
            id: 'res1',
            title: 'Meeting 1',
            start_time: '2025-01-22T09:00:00Z',
            end_time: '2025-01-22T10:00:00Z',
            is_mine: false
          }
        ],
        totalCount: 1,
        hasNextPage: false,
        isFetchingNextPage: false,
        fetchNextPage: jest.fn(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn()
      });

      render(<InfiniteReservationList {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByText(/모든 예약을 불러왔습니다/)).toBeInTheDocument();
    });
  });

  describe('Intersection Observer', () => {
    it('should set up intersection observer on mount', () => {
      mockUseFlattenedReservations.mockReturnValue({
        data: [],
        totalCount: 0,
        hasNextPage: true,
        isFetchingNextPage: false,
        fetchNextPage: jest.fn(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn()
      });

      render(<InfiniteReservationList {...defaultProps} />, { wrapper: createWrapper() });

      expect(mockIntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          root: null,
          rootMargin: '200px',
          threshold: 0.1,
        })
      );
    });

    it('should trigger fetchNextPage when intersection occurs', async () => {
      const mockFetchNextPage = jest.fn();
      let intersectionCallback: (entries: IntersectionObserverEntry[]) => void;

      mockIntersectionObserver.mockImplementation((callback) => {
        intersectionCallback = callback;
        return {
          observe: jest.fn(),
          unobserve: jest.fn(),
          disconnect: jest.fn(),
        };
      });

      mockUseFlattenedReservations.mockReturnValue({
        data: [
          {
            id: 'res1',
            title: 'Meeting 1',
            start_time: '2025-01-22T09:00:00Z',
            end_time: '2025-01-22T10:00:00Z',
            is_mine: false
          }
        ],
        totalCount: 10,
        hasNextPage: true,
        isFetchingNextPage: false,
        fetchNextPage: mockFetchNextPage,
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn()
      });

      render(<InfiniteReservationList {...defaultProps} />, { wrapper: createWrapper() });

      // Simulate intersection
      intersectionCallback!([
        {
          isIntersecting: true,
          target: document.createElement('div'),
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRatio: 0.5,
          intersectionRect: {} as DOMRectReadOnly,
          rootBounds: {} as DOMRectReadOnly,
          time: Date.now()
        }
      ]);

      expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
    });
  });

  describe('Props handling', () => {
    it('should apply custom className', () => {
      mockUseFlattenedReservations.mockReturnValue({
        data: [],
        totalCount: 0,
        hasNextPage: false,
        isFetchingNextPage: false,
        fetchNextPage: jest.fn(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn()
      });

      const { container } = render(
        <InfiniteReservationList {...defaultProps} className="custom-class" />,
        { wrapper: createWrapper() }
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should use custom limit parameter', () => {
      mockUseFlattenedReservations.mockReturnValue({
        data: [],
        totalCount: 0,
        hasNextPage: false,
        isFetchingNextPage: false,
        fetchNextPage: jest.fn(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn()
      });

      render(<InfiniteReservationList {...defaultProps} limit={50} />, { wrapper: createWrapper() });

      expect(mockUseFlattenedReservations).toHaveBeenCalledWith(
        '2025-01-22',
        '2025-01-22',
        { limit: 50 }
      );
    });
  });
});