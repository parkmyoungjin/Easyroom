/**
 * Paginated Reservations Hooks
 * Enhanced reservation data fetching with standardized pagination
 * Requirements: 3.4
 */

import { usePaginatedQuery, usePaginatedInfiniteQuery } from '@/hooks/usePagination';
import { PaginationState, PaginatedResponse } from '@/types/pagination';
import { PublicReservation, PublicReservationAnonymous, Room, User } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/utils/logger';

// ============================================================================
// FETCH FUNCTIONS
// ============================================================================

/**
 * Fetch paginated public reservations
 */
async function fetchPaginatedPublicReservations(
  startDate: string,
  endDate: string,
  isAuthenticated: boolean,
  pagination: PaginationState
): Promise<PaginatedResponse<PublicReservation | PublicReservationAnonymous>> {
  // Validate required parameters
  if (!startDate || !endDate) {
    const error = new Error('startDate and endDate are required');
    logger.error('Invalid parameters for fetchPaginatedPublicReservations', {
      startDate,
      endDate,
      error: error.message,
    });
    throw error;
  }

  // Validate date format and range
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    const error = new Error('Invalid date format for startDate or endDate');
    logger.error('Invalid date format in fetchPaginatedPublicReservations', {
      startDate,
      endDate,
      error: error.message,
    });
    throw error;
  }

  if (start > end) {
    const error = new Error('startDate must be before or equal to endDate');
    logger.warn('Invalid date range in fetchPaginatedPublicReservations', {
      startDate,
      endDate,
      error: error.message,
    });
    throw error;
  }

  const endpoint = isAuthenticated 
    ? '/api/reservations/public-authenticated'
    : '/api/reservations/public-anonymous';
  
  const params = new URLSearchParams({
    startDate,
    endDate,
    limit: pagination.limit.toString(),
    offset: pagination.offset.toString(),
    sortOrder: pagination.sortOrder,
  });

  if (pagination.sortBy) {
    params.set('sortBy', pagination.sortBy);
  }

  if (pagination.search) {
    params.set('search', pagination.search);
  }

  logger.debug('Fetching paginated public reservations', {
    endpoint,
    startDate,
    endDate,
    isAuthenticated,
    pagination,
  });

  const response = await fetch(`${endpoint}?${params}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
    
    logger.error('Failed to fetch paginated public reservations', {
      status: response.status,
      statusText: response.statusText,
      errorData,
      endpoint,
      params: Object.fromEntries(params),
    });
    
    // Create structured error with additional context
    const error = new Error(errorMessage);
    (error as any).status = response.status;
    (error as any).statusText = response.statusText;
    (error as any).endpoint = endpoint;
    throw error;
  }

  const data = await response.json();
  
  logger.debug('Paginated public reservations fetched successfully', {
    count: data.data?.length || 0,
    totalCount: data.pagination?.total_count || 0,
    hasMore: data.pagination?.has_more || false,
  });

  return data;
}

/**
 * Fetch paginated rooms
 */
async function fetchPaginatedRooms(
  pagination: PaginationState
): Promise<PaginatedResponse<Room>> {
  const params = new URLSearchParams({
    limit: pagination.limit.toString(),
    offset: pagination.offset.toString(),
    sortOrder: pagination.sortOrder,
  });

  if (pagination.sortBy) {
    params.set('sortBy', pagination.sortBy);
  }

  if (pagination.search) {
    params.set('search', pagination.search);
  }

  logger.debug('Fetching paginated rooms', { pagination });

  const response = await fetch(`/api/rooms?${params}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
    
    logger.error('Failed to fetch paginated rooms', {
      status: response.status,
      statusText: response.statusText,
      errorData,
      endpoint: '/api/rooms',
      params: Object.fromEntries(params),
    });
    
    // Create structured error with additional context
    const error = new Error(errorMessage);
    (error as any).status = response.status;
    (error as any).statusText = response.statusText;
    (error as any).endpoint = '/api/rooms';
    throw error;
  }

  const data = await response.json();
  
  logger.debug('Paginated rooms fetched successfully', {
    count: data.data?.length || 0,
    totalCount: data.pagination?.total_count || 0,
  });

  return data;
}

/**
 * Fetch paginated admin users
 */
async function fetchPaginatedAdminUsers(
  pagination: PaginationState
): Promise<PaginatedResponse<User>> {
  const params = new URLSearchParams({
    limit: pagination.limit.toString(),
    offset: pagination.offset.toString(),
    sortOrder: pagination.sortOrder,
  });

  if (pagination.sortBy) {
    params.set('sortBy', pagination.sortBy);
  }

  if (pagination.search) {
    params.set('search', pagination.search);
  }

  logger.debug('Fetching paginated admin users', { pagination });

  const response = await fetch(`/api/admin/users?${params}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
    
    logger.error('Failed to fetch paginated admin users', {
      status: response.status,
      statusText: response.statusText,
      errorData,
      endpoint: '/api/admin/users',
      params: Object.fromEntries(params),
    });
    
    // Create structured error with additional context
    const error = new Error(errorMessage);
    (error as any).status = response.status;
    (error as any).statusText = response.statusText;
    (error as any).endpoint = '/api/admin/users';
    throw error;
  }

  const data = await response.json();
  
  logger.debug('Paginated admin users fetched successfully', {
    count: data.data?.length || 0,
    totalCount: data.pagination?.total_count || 0,
  });

  return data;
}

// ============================================================================
// PAGINATED HOOKS
// ============================================================================

/**
 * Hook for paginated public reservations
 */
export function usePaginatedPublicReservations(
  startDate: string,
  endDate: string,
  options?: {
    initialPagination?: Partial<PaginationState>;
    enabled?: boolean;
  }
) {
  const { user } = useAuth();
  const isAuthenticated = !!user;

  return usePaginatedQuery(
    ['reservations', 'public', startDate, endDate, isAuthenticated],
    (pagination) => fetchPaginatedPublicReservations(startDate, endDate, isAuthenticated, pagination),
    {
      endpointConfig: 'reservations',
      enabled: options?.enabled !== false && !!startDate && !!endDate,
      initialPagination: {
        sortBy: 'start_time',
        sortOrder: 'asc' as const,
        ...options?.initialPagination,
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: process.env.NODE_ENV === 'test' ? false : 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    }
  );
}

/**
 * Hook for infinite scrolling public reservations
 */
export function useInfinitePaginatedPublicReservations(
  startDate: string,
  endDate: string,
  options?: {
    limit?: number;
    enabled?: boolean;
  }
) {
  const { user } = useAuth();
  const isAuthenticated = !!user;

  return usePaginatedInfiniteQuery(
    ['reservations', 'public', 'infinite', startDate, endDate, isAuthenticated],
    ({ limit, offset }) => fetchPaginatedPublicReservations(
      startDate, 
      endDate, 
      isAuthenticated, 
      { 
        limit, 
        offset, 
        sortOrder: 'asc' as const
      }
    ),
    {
      limit: options?.limit || 20,
      enabled: options?.enabled !== false && !!startDate && !!endDate,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    }
  );
}

/**
 * Hook for paginated rooms
 */
export function usePaginatedRooms(
  options?: {
    initialPagination?: Partial<PaginationState>;
    enabled?: boolean;
  }
) {
  return usePaginatedQuery(
    ['rooms'],
    fetchPaginatedRooms,
    {
      endpointConfig: 'rooms',
      enabled: options?.enabled !== false,
      initialPagination: options?.initialPagination,
      staleTime: 10 * 60 * 1000, // 10 minutes for rooms (more static)
      gcTime: 30 * 60 * 1000, // 30 minutes
    }
  );
}

/**
 * Hook for paginated admin users
 */
export function usePaginatedAdminUsers(
  options?: {
    initialPagination?: Partial<PaginationState>;
    enabled?: boolean;
  }
) {
  return usePaginatedQuery(
    ['admin', 'users'],
    fetchPaginatedAdminUsers,
    {
      endpointConfig: 'users',
      enabled: options?.enabled !== false,
      initialPagination: options?.initialPagination,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 15 * 60 * 1000, // 15 minutes
    }
  );
}

// ============================================================================
// QUERY KEY FACTORIES
// ============================================================================

/**
 * Query key factory for paginated reservations
 */
const paginatedReservationKeys = {
  all: ['reservations'] as const,
  public: (startDate: string, endDate: string, isAuthenticated: boolean) =>
    ['reservations', 'public', startDate, endDate, isAuthenticated] as const,
  infinite: (startDate: string, endDate: string, isAuthenticated: boolean) =>
    ['reservations', 'public', 'infinite', startDate, endDate, isAuthenticated] as const,
};

/**
 * Query key factory for paginated rooms
 */
const paginatedRoomKeys = {
  all: ['rooms'] as const,
  list: () => ['rooms'] as const,
};

/**
 * Query key factory for paginated admin users
 */
const paginatedAdminUserKeys = {
  all: ['admin', 'users'] as const,
  list: () => ['admin', 'users'] as const,
};

// ============================================================================
// EXPORTS
// ============================================================================

export {
  paginatedReservationKeys,
  paginatedRoomKeys,
  paginatedAdminUserKeys,
};