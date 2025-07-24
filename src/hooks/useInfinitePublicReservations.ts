"use client";

import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/utils/logger';
import type { PublicReservation, PublicReservationAnonymous, PaginationMetadata } from '@/types/database';

// Types for paginated responses
interface PaginatedPublicReservationsResponse {
  data: PublicReservation[];
  message: string;
  authenticated: true;
  userId: string;
  pagination: PaginationMetadata;
}

interface PaginatedAnonymousReservationsResponse {
  data: PublicReservationAnonymous[];
  message: string;
  authenticated: false;
  pagination: PaginationMetadata;
}

type PaginatedReservationsResponse = PaginatedPublicReservationsResponse | PaginatedAnonymousReservationsResponse;

// Query key factory
export const infiniteReservationKeys = {
  all: ['infinite-reservations'] as const,
  public: (startDate: string, endDate: string, isAuthenticated: boolean) =>
    [...infiniteReservationKeys.all, 'public', startDate, endDate, 'auth', isAuthenticated] as const,
};

// Fetch function for paginated reservations
export async function fetchPaginatedReservations({
  startDate,
  endDate,
  isAuthenticated,
  pageParam = 0,
  limit = 20
}: {
  startDate: string;
  endDate: string;
  isAuthenticated: boolean;
  pageParam?: number;
  limit?: number;
}): Promise<PaginatedReservationsResponse> {
  const endpoint = isAuthenticated 
    ? '/api/reservations/public-authenticated'
    : '/api/reservations/public-anonymous';
  
  const params = new URLSearchParams({
    startDate,
    endDate,
    limit: limit.toString(),
    offset: pageParam.toString()
  });

  logger.debug('Fetching paginated reservations', {
    endpoint,
    startDate,
    endDate,
    isAuthenticated,
    limit,
    offset: pageParam
  });

  const response = await fetch(`${endpoint}?${params}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    logger.error('Failed to fetch paginated reservations', {
      status: response.status,
      statusText: response.statusText,
      errorData
    });
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  
  logger.debug('Paginated reservations fetched successfully', {
    count: data.data?.length || 0,
    hasMore: data.pagination?.has_more || false,
    totalCount: data.pagination?.total_count || 0
  });

  return data;
}

// Hook for infinite scrolling public reservations with performance optimizations
export function useInfinitePublicReservations(
  startDate: string,
  endDate: string,
  options: {
    limit?: number;
    enabled?: boolean;
  } = {}
) {
  const { limit = 20, enabled = true } = options;
  const { user } = useAuth();
  const isAuthenticated = !!user;

  // Calculate date range size for performance optimization
  const dateRangeSize = startDate && endDate ? 
    Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
  
  // Adjust stale time based on date range size - larger ranges get longer cache
  const staleTime = dateRangeSize > 30 ? 15 * 60 * 1000 : 5 * 60 * 1000; // 15 min for large ranges, 5 min for small
  const gcTime = dateRangeSize > 30 ? 30 * 60 * 1000 : 10 * 60 * 1000; // 30 min for large ranges, 10 min for small

  return useInfiniteQuery({
    queryKey: infiniteReservationKeys.public(startDate, endDate, isAuthenticated),
    queryFn: ({ pageParam = 0 }) => {
      logger.debug('Fetching infinite reservations page', {
        startDate,
        endDate,
        isAuthenticated,
        pageParam,
        limit,
        dateRangeSize
      });
      
      return fetchPaginatedReservations({
        startDate,
        endDate,
        isAuthenticated,
        pageParam: pageParam as number,
        limit
      });
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.pagination?.has_more) {
        logger.debug('No more pages available', {
          totalCount: lastPage.pagination?.total_count,
          currentOffset: lastPage.pagination?.offset,
          limit: lastPage.pagination?.limit
        });
        return undefined; // No more pages
      }
      const nextOffset = lastPage.pagination.offset + lastPage.pagination.limit;
      logger.debug('Next page parameter calculated', {
        nextOffset,
        currentOffset: lastPage.pagination.offset,
        limit: lastPage.pagination.limit,
        hasMore: lastPage.pagination.has_more
      });
      return nextOffset;
    },
    getPreviousPageParam: (firstPage) => {
      if (firstPage.pagination?.offset <= 0) {
        return undefined; // No previous pages
      }
      return Math.max(0, firstPage.pagination.offset - firstPage.pagination.limit);
    },
    initialPageParam: 0,
    enabled: enabled && !!startDate && !!endDate,
    staleTime,
    gcTime,
    retry: (failureCount, error) => {
      // Don't retry on client errors (4xx), only on server errors (5xx) and network errors
      if (error instanceof Error && error.message.includes('HTTP 4')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => {
      // Exponential backoff with jitter for large date ranges
      const baseDelay = dateRangeSize > 30 ? 2000 : 1000;
      const jitter = Math.random() * 1000;
      return Math.min(baseDelay * 2 ** attemptIndex + jitter, 30000);
    },
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    // Add network mode for better offline handling
    networkMode: 'online',
    // Optimize for large datasets
    maxPages: dateRangeSize > 30 ? 50 : undefined, // Limit pages for very large date ranges
  });
}

// Helper hook to get flattened data from infinite query
export function useFlattenedReservations(
  startDate: string,
  endDate: string,
  options: {
    limit?: number;
    enabled?: boolean;
  } = {}
) {
  const infiniteQuery = useInfinitePublicReservations(startDate, endDate, options);

  // Flatten all pages into a single array with proper typing
  const flattenedData: (PublicReservation | PublicReservationAnonymous)[] = 
    infiniteQuery.data?.pages.flatMap(page => {
      // Type assertion to handle union type properly
      return page.data as (PublicReservation | PublicReservationAnonymous)[];
    }) || [];

  // Get pagination metadata from the first page
  const paginationMeta = infiniteQuery.data?.pages[0]?.pagination;

  return {
    ...infiniteQuery,
    data: flattenedData,
    totalCount: paginationMeta?.total_count || 0,
    hasNextPage: infiniteQuery.hasNextPage,
    hasPreviousPage: infiniteQuery.hasPreviousPage,
    isFetchingNextPage: infiniteQuery.isFetchingNextPage,
    isFetchingPreviousPage: infiniteQuery.isFetchingPreviousPage,
    fetchNextPage: infiniteQuery.fetchNextPage,
    fetchPreviousPage: infiniteQuery.fetchPreviousPage,
  };
}