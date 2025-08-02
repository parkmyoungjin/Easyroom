/**
 * Standardized query optimization utilities for data fetching hooks
 * Based on patterns from useInfinitePublicReservations
 */

import { logger } from '@/lib/utils/logger';

// Standard retry configuration with exponential backoff
export const createRetryConfig = (options: {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: Error) => boolean;
} = {}) => {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    shouldRetry = (error: Error) => {
      // Don't retry on client errors (4xx), only on server errors (5xx) and network errors
      if (error.message.includes('HTTP 4')) {
        return false;
      }
      return true;
    }
  } = options;

  return {
    retry: (failureCount: number, error: Error) => {
      if (!shouldRetry(error)) {
        return false;
      }
      return failureCount < maxRetries;
    },
    retryDelay: (attemptIndex: number) => {
      // Exponential backoff with jitter
      const jitter = Math.random() * 1000;
      return Math.min(baseDelay * 2 ** attemptIndex + jitter, maxDelay);
    }
  };
};

// Standard cache configuration based on data characteristics
export const createCacheConfig = (options: {
  dataType?: 'static' | 'semi-static' | 'dynamic' | 'real-time';
  customStaleTime?: number;
  customGcTime?: number;
} = {}) => {
  const { dataType = 'dynamic', customStaleTime, customGcTime } = options;

  let staleTime: number;
  let gcTime: number;

  switch (dataType) {
    case 'static': // Rooms, user profiles
      staleTime = customStaleTime ?? 30 * 60 * 1000; // 30 minutes
      gcTime = customGcTime ?? 60 * 60 * 1000; // 1 hour
      break;
    case 'semi-static': // My reservations, room availability
      staleTime = customStaleTime ?? 5 * 60 * 1000; // 5 minutes
      gcTime = customGcTime ?? 15 * 60 * 1000; // 15 minutes
      break;
    case 'dynamic': // Public reservations, statistics
      staleTime = customStaleTime ?? 2 * 60 * 1000; // 2 minutes
      gcTime = customGcTime ?? 10 * 60 * 1000; // 10 minutes
      break;
    case 'real-time': // Live data, notifications
      staleTime = customStaleTime ?? 30 * 1000; // 30 seconds
      gcTime = customGcTime ?? 2 * 60 * 1000; // 2 minutes
      break;
    default:
      staleTime = customStaleTime ?? 5 * 60 * 1000;
      gcTime = customGcTime ?? 10 * 60 * 1000;
  }

  return {
    staleTime,
    gcTime,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    networkMode: 'online' as const
  };
};

// Standard fetch wrapper with logging and error handling
export const createStandardFetch = <T>(
  fetchFn: () => Promise<T>,
  context: {
    operation: string;
    params?: Record<string, any>;
  }
) => {
  return async (): Promise<T> => {
    const { operation, params } = context;
    
    logger.debug(`Starting ${operation}`, params);
    
    try {
      const result = await fetchFn();
      
      logger.debug(`${operation} completed successfully`, {
        hasResult: !!result,
        resultType: typeof result,
        ...(Array.isArray(result) && { count: result.length })
      });
      
      return result;
    } catch (error) {
      logger.error(`${operation} failed`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        params
      });
      
      // Re-throw with enhanced error message
      if (error instanceof Error) {
        throw new Error(`${operation} failed: ${error.message}`);
      }
      throw new Error(`${operation} failed: Unknown error`);
    }
  };
};

// Query key factory generator
export const createQueryKeyFactory = <T extends Record<string, any>>(
  baseKey: string
) => {
  return {
    all: [baseKey] as const,
    lists: () => [baseKey, 'list'] as const,
    list: (filters: T) => [baseKey, 'list', filters] as const,
    details: () => [baseKey, 'detail'] as const,
    detail: (id: string) => [baseKey, 'detail', id] as const,
    custom: (type: string, ...params: any[]) => [baseKey, type, ...params] as const
  };
};

// Performance optimization for date range queries
export const optimizeForDateRange = (startDate: string, endDate: string) => {
  const dateRangeSize = startDate && endDate ? 
    Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
  
  // Adjust cache times based on date range size
  const isLargeRange = dateRangeSize > 30;
  
  return {
    dateRangeSize,
    isLargeRange,
    staleTime: isLargeRange ? 15 * 60 * 1000 : 5 * 60 * 1000, // 15 min for large ranges, 5 min for small
    gcTime: isLargeRange ? 30 * 60 * 1000 : 10 * 60 * 1000, // 30 min for large ranges, 10 min for small
    maxPages: isLargeRange ? 50 : undefined, // Limit pages for very large date ranges
    retryDelay: (attemptIndex: number) => {
      const baseDelay = isLargeRange ? 2000 : 1000;
      const jitter = Math.random() * 1000;
      return Math.min(baseDelay * 2 ** attemptIndex + jitter, 30000);
    }
  };
};

// Standard query options builder
export const buildQueryOptions = <T>(options: {
  queryKey: readonly unknown[];
  queryFn: () => Promise<T>;
  enabled?: boolean;
  dataType?: 'static' | 'semi-static' | 'dynamic' | 'real-time';
  retryConfig?: Parameters<typeof createRetryConfig>[0];
  cacheConfig?: Parameters<typeof createCacheConfig>[0];
}) => {
  const {
    queryKey,
    queryFn,
    enabled = true,
    dataType = 'dynamic',
    retryConfig = {},
    cacheConfig = {}
  } = options;

  const retry = createRetryConfig(retryConfig);
  const cache = createCacheConfig({ dataType, ...cacheConfig });

  return {
    queryKey,
    queryFn,
    enabled,
    ...retry,
    ...cache
  };
};