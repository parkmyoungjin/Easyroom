/**
 * Pagination Hook Utilities
 * Standardized pagination controls for data fetching hooks
 * Requirements: 3.4
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { 
  PaginationState, 
  PaginationActions,
  PaginatedResponse,
  PAGINATION_DEFAULTS,
  PAGINATION_CONFIGS,
  validatePaginationParams
} from '@/types/pagination';
import { logger } from '@/lib/utils/logger';

// ============================================================================
// PAGINATION STATE HOOK
// ============================================================================

/**
 * Hook for managing pagination state
 */
export function usePaginationState(
  initialState?: Partial<PaginationState>,
  config?: {
    maxLimit?: number;
    allowedSortFields?: readonly string[];
    onStateChange?: (state: PaginationState) => void;
  }
): [PaginationState, PaginationActions] {
  const defaultState: PaginationState = {
    limit: PAGINATION_DEFAULTS.DEFAULT_LIMIT,
    offset: PAGINATION_DEFAULTS.DEFAULT_OFFSET,
    sortOrder: PAGINATION_DEFAULTS.DEFAULT_SORT_ORDER,
    ...initialState,
  };

  const [state, setState] = useState<PaginationState>(defaultState);

  const updateState = useCallback((newState: PaginationState) => {
    // Validate the new state
    const validation = validatePaginationParams(newState, {
      maxLimit: config?.maxLimit,
      allowedSortFields: config?.allowedSortFields,
    });

    const finalState = validation.isValid ? newState : {
      ...newState,
      ...validation.sanitized,
    };

    setState(finalState);
    config?.onStateChange?.(finalState);

    if (!validation.isValid) {
      logger.warn('Pagination state validation failed', {
        errors: validation.errors,
        originalState: newState,
        sanitizedState: finalState,
      });
    }
  }, [config]);

  const actions: PaginationActions = useMemo(() => ({
    setLimit: (limit: number) => {
      updateState({ ...state, limit, offset: 0 });
    },
    setOffset: (offset: number) => {
      updateState({ ...state, offset });
    },
    setSortBy: (sortBy?: string) => {
      updateState({ ...state, sortBy, offset: 0 });
    },
    setSortOrder: (sortOrder: 'asc' | 'desc') => {
      updateState({ ...state, sortOrder, offset: 0 });
    },
    setSearch: (search?: string) => {
      updateState({ ...state, search, offset: 0 });
    },
    nextPage: () => {
      updateState({ ...state, offset: state.offset + state.limit });
    },
    previousPage: () => {
      const newOffset = Math.max(state.offset - state.limit, 0);
      updateState({ ...state, offset: newOffset });
    },
    goToPage: (page: number) => {
      const validPage = Math.max(page, 1);
      const newOffset = (validPage - 1) * state.limit;
      updateState({ ...state, offset: newOffset });
    },
    reset: () => {
      updateState(defaultState);
    },
  }), [state, updateState, defaultState]);

  return [state, actions];
}

// ============================================================================
// PAGINATED QUERY HOOK
// ============================================================================

/**
 * Hook for paginated data fetching with React Query
 */
export function usePaginatedQuery<T>(
  queryKey: any[],
  queryFn: (pagination: PaginationState) => Promise<PaginatedResponse<T>>,
  options?: {
    initialPagination?: Partial<PaginationState>;
    endpointConfig?: keyof typeof PAGINATION_CONFIGS;
    enabled?: boolean;
    staleTime?: number;
    gcTime?: number;
    retry?: number | boolean;
    retryDelay?: number | ((attemptIndex: number) => number);
  }
) {
  const config = options?.endpointConfig ? PAGINATION_CONFIGS[options.endpointConfig] : undefined;
  
  const [paginationState, paginationActions] = usePaginationState(
    {
      limit: config?.defaultLimit,
      sortBy: config?.defaultSortBy,
      sortOrder: config?.defaultSortOrder,
      ...options?.initialPagination,
    },
    {
      maxLimit: config?.maxLimit,
      allowedSortFields: config?.allowedSortFields,
    }
  );

  const query = useQuery({
    queryKey: [...queryKey, 'paginated', paginationState],
    queryFn: () => {
      logger.debug('Executing paginated query', {
        queryKey,
        paginationState,
        endpointConfig: options?.endpointConfig,
      });
      return queryFn(paginationState);
    },
    enabled: options?.enabled !== false,
    staleTime: options?.staleTime || 5 * 60 * 1000, // 5 minutes
    gcTime: options?.gcTime || 10 * 60 * 1000, // 10 minutes
    retry: options?.retry !== undefined ? options.retry : 3,
    retryDelay: options?.retryDelay || ((attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)),
  });

  return {
    ...query,
    pagination: paginationState,
    paginationActions,
    // Convenience properties
    currentPage: query.data?.pagination.current_page || 1,
    totalPages: query.data?.pagination.total_pages || 0,
    totalCount: query.data?.pagination.total_count || 0,
    hasNextPage: query.data?.pagination.has_more || false,
    hasPreviousPage: (query.data?.pagination.current_page || 1) > 1,
  };
}

// ============================================================================
// INFINITE QUERY HOOK
// ============================================================================

/**
 * Hook for infinite scrolling with standardized pagination
 */
export function usePaginatedInfiniteQuery<T>(
  queryKey: any[],
  queryFn: (pagination: { limit: number; offset: number }) => Promise<PaginatedResponse<T>>,
  options?: {
    limit?: number;
    enabled?: boolean;
    staleTime?: number;
    gcTime?: number;
    maxPages?: number;
  }
) {
  const limit = options?.limit || PAGINATION_DEFAULTS.DEFAULT_LIMIT;

  const query = useInfiniteQuery({
    queryKey: [...queryKey, 'infinite', limit],
    queryFn: ({ pageParam = 0 }) => {
      logger.debug('Fetching infinite query page', {
        queryKey,
        pageParam,
        limit,
      });
      
      return queryFn({
        limit,
        offset: pageParam as number,
      });
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.pagination.has_more) {
        logger.debug('No more pages available for infinite query', {
          queryKey,
          totalCount: lastPage.pagination.total_count,
          currentOffset: lastPage.pagination.offset,
          limit: lastPage.pagination.limit,
        });
        return undefined;
      }
      
      const nextOffset = lastPage.pagination.offset + lastPage.pagination.limit;
      logger.debug('Next page parameter calculated for infinite query', {
        queryKey,
        nextOffset,
        currentOffset: lastPage.pagination.offset,
        limit: lastPage.pagination.limit,
      });
      
      return nextOffset;
    },
    getPreviousPageParam: (firstPage) => {
      if (firstPage.pagination.offset <= 0) {
        return undefined;
      }
      return Math.max(0, firstPage.pagination.offset - firstPage.pagination.limit);
    },
    initialPageParam: 0,
    enabled: options?.enabled !== false,
    staleTime: options?.staleTime || 5 * 60 * 1000,
    gcTime: options?.gcTime || 10 * 60 * 1000,
    maxPages: options?.maxPages,
    retry: (failureCount, error) => {
      // Don't retry on client errors (4xx), only on server errors (5xx) and network errors
      if (error instanceof Error && error.message.includes('HTTP 4')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => {
      const jitter = Math.random() * 1000;
      return Math.min(1000 * 2 ** attemptIndex + jitter, 30000);
    },
  });

  // Flatten all pages into a single array
  const flattenedData: T[] = useMemo(() => {
    return query.data?.pages.flatMap(page => page.data) || [];
  }, [query.data]);

  // Get pagination metadata from the first page
  const paginationMeta = query.data?.pages[0]?.pagination;

  return {
    ...query,
    data: flattenedData,
    totalCount: paginationMeta?.total_count || 0,
    hasNextPage: query.hasNextPage,
    hasPreviousPage: query.hasPreviousPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isFetchingPreviousPage: query.isFetchingPreviousPage,
    fetchNextPage: query.fetchNextPage,
    fetchPreviousPage: query.fetchPreviousPage,
  };
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook for creating pagination query parameters
 */
export function usePaginationParams(paginationState: PaginationState): URLSearchParams {
  return useMemo(() => {
    const params = new URLSearchParams();
    
    params.set('limit', paginationState.limit.toString());
    params.set('offset', paginationState.offset.toString());
    
    if (paginationState.sortBy) {
      params.set('sortBy', paginationState.sortBy);
    }
    
    params.set('sortOrder', paginationState.sortOrder);
    
    if (paginationState.search) {
      params.set('search', paginationState.search);
    }
    
    return params;
  }, [paginationState]);
}

/**
 * Hook for pagination info display
 */
export function usePaginationInfo(paginationData?: {
  current_page: number;
  total_pages: number;
  total_count: number;
  current_count: number;
  limit: number;
  offset: number;
}) {
  return useMemo(() => {
    if (!paginationData) {
      return {
        displayText: '',
        rangeText: '',
        pageText: '',
      };
    }

    const { current_page, total_pages, total_count, current_count, limit, offset } = paginationData;
    
    const startItem = offset + 1;
    const endItem = offset + current_count;
    
    return {
      displayText: `${startItem}-${endItem} of ${total_count} items`,
      rangeText: `${startItem}-${endItem}`,
      pageText: `Page ${current_page} of ${total_pages}`,
      totalText: `${total_count} total`,
      currentPageItems: current_count,
      itemsPerPage: limit,
    };
  }, [paginationData]);
}

// ============================================================================
// EXPORTS
// ============================================================================
// All functions are exported in their declarations above