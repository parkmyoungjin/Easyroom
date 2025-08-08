
/**
 * Standardized Pagination Types
 * Comprehensive pagination support for all list-based API endpoints
 * Requirements: 3.4
 */

// ============================================================================
// CORE PAGINATION INTERFACES
// ============================================================================

/**
 * Standardized pagination request parameters
 */
export interface PaginatedRequest {
  /** Number of items per page (1-100) */
  limit?: number;
  /** Number of items to skip (0 or greater) */
  offset?: number;
  /** Field to sort by */
  sortBy?: string;
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
  /** Search query for filtering */
  search?: string;
}

/**
 * Standardized pagination metadata
 */
export interface PaginationMetadata {
  /** Current limit (items per page) */
  limit: number;
  /** Current offset (items skipped) */
  offset: number;
  /** Total number of items available */
  total_count: number;
  /** Whether there are more items available */
  has_more: boolean;
  /** Current page number (1-based) */
  current_page: number;
  /** Total number of pages */
  total_pages: number;
  /** Number of items in current page */
  current_count: number;
}

/**
 * Standardized paginated response wrapper
 */
export interface PaginatedResponse<T> {
  /** Array of data items */
  data: T[];
  /** Pagination metadata */
  pagination: PaginationMetadata;
  /** Response message */
  message?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

// ============================================================================
// PAGINATION CONFIGURATION
// ============================================================================

/**
 * Default pagination configuration
 */
export const PAGINATION_DEFAULTS = {
  /** Default page size */
  DEFAULT_LIMIT: 20,
  /** Maximum page size */
  MAX_LIMIT: 100,
  /** Minimum page size */
  MIN_LIMIT: 1,
  /** Default offset */
  DEFAULT_OFFSET: 0,
  /** Default sort order */
  DEFAULT_SORT_ORDER: 'asc' as const,
} as const;

/**
 * Pagination configuration for different endpoints
 */
export const PAGINATION_CONFIGS = {
  reservations: {
    defaultLimit: 20,
    maxLimit: 100,
    allowedSortFields: ['start_time', 'end_time', 'created_at', 'title'],
    defaultSortBy: 'start_time',
    defaultSortOrder: 'asc' as const,
  },
  rooms: {
    defaultLimit: 50,
    maxLimit: 100,
    allowedSortFields: ['name', 'capacity', 'created_at'],
    defaultSortBy: 'name',
    defaultSortOrder: 'asc' as const,
  },
  users: {
    defaultLimit: 25,
    maxLimit: 100,
    allowedSortFields: ['name', 'email', 'department', 'created_at'],
    defaultSortBy: 'name',
    defaultSortOrder: 'asc' as const,
  },
  monitoring: {
    defaultLimit: 50,
    maxLimit: 200,
    allowedSortFields: ['timestamp', 'severity', 'type'],
    defaultSortBy: 'timestamp',
    defaultSortOrder: 'desc' as const,
  },
} as const;

// ============================================================================
// PAGINATION UTILITIES
// ============================================================================

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(
  params: PaginatedRequest,
  config?: {
    maxLimit?: number;
    allowedSortFields?: readonly string[];
  }
): {
  isValid: boolean;
  errors: string[];
  sanitized: Required<Pick<PaginatedRequest, 'limit' | 'offset' | 'sortOrder'>> & 
             Pick<PaginatedRequest, 'sortBy' | 'search'>;
} {
  const errors: string[] = [];
  const maxLimit = config?.maxLimit || PAGINATION_DEFAULTS.MAX_LIMIT;
  const allowedSortFields = config?.allowedSortFields;

  // Validate and sanitize limit
  let limit = params.limit !== undefined ? params.limit : PAGINATION_DEFAULTS.DEFAULT_LIMIT;
  if (limit < PAGINATION_DEFAULTS.MIN_LIMIT) {
    errors.push(`limit must be at least ${PAGINATION_DEFAULTS.MIN_LIMIT}`);
    limit = PAGINATION_DEFAULTS.MIN_LIMIT;
  }
  if (limit > maxLimit) {
    errors.push(`limit cannot exceed ${maxLimit}`);
    limit = maxLimit;
  }

  // Validate and sanitize offset
  let offset = params.offset || PAGINATION_DEFAULTS.DEFAULT_OFFSET;
  if (offset < 0) {
    errors.push('offset must be 0 or greater');
    offset = 0;
  }

  // Validate sort order
  const sortOrder = params.sortOrder || PAGINATION_DEFAULTS.DEFAULT_SORT_ORDER;
  if (sortOrder !== 'asc' && sortOrder !== 'desc') {
    errors.push('sortOrder must be "asc" or "desc"');
  }

  // Validate sort field
  let sortBy = params.sortBy;
  if (sortBy && allowedSortFields && !allowedSortFields.includes(sortBy)) {
    errors.push(`sortBy must be one of: ${allowedSortFields.join(', ')}`);
    sortBy = undefined;
  }

  // Validate search
  const search = params.search?.trim() || undefined;

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      limit,
      offset,
      sortOrder,
      sortBy,
      search,
    },
  };
}

/**
 * Calculate pagination metadata
 */
export function calculatePaginationMetadata(
  totalCount: number,
  limit: number,
  offset: number,
  currentCount: number
): PaginationMetadata {
  const totalPages = Math.ceil(totalCount / limit);
  const currentPage = Math.floor(offset / limit) + 1;
  const hasMore = offset + limit < totalCount;

  return {
    limit,
    offset,
    total_count: totalCount,
    has_more: hasMore,
    current_page: currentPage,
    total_pages: totalPages,
    current_count: currentCount,
  };
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  totalCount: number,
  limit: number,
  offset: number,
  message?: string,
  metadata?: Record<string, any>
): PaginatedResponse<T> {
  const paginationMetadata = calculatePaginationMetadata(
    totalCount,
    limit,
    offset,
    data.length
  );

  return {
    data,
    pagination: paginationMetadata,
    message,
    metadata,
  };
}

/**
 * Extract pagination parameters from URL search params
 */
export function extractPaginationFromSearchParams(
  searchParams: URLSearchParams,
  endpointConfig?: keyof typeof PAGINATION_CONFIGS
): PaginatedRequest {
  const config = endpointConfig ? PAGINATION_CONFIGS[endpointConfig] : undefined;

  const limit = searchParams.get('limit');
  const offset = searchParams.get('offset');
  const sortBy = searchParams.get('sortBy');
  const sortOrder = searchParams.get('sortOrder');
  const search = searchParams.get('search');

  return {
    limit: limit ? parseInt(limit, 10) : config?.defaultLimit,
    offset: offset ? parseInt(offset, 10) : PAGINATION_DEFAULTS.DEFAULT_OFFSET,
    sortBy: sortBy || config?.defaultSortBy,
    sortOrder: (sortOrder as 'asc' | 'desc') || config?.defaultSortOrder || PAGINATION_DEFAULTS.DEFAULT_SORT_ORDER,
    search: search || undefined,
  };
}

// ============================================================================
// HOOK UTILITIES
// ============================================================================

/**
 * Pagination state for React hooks
 */
export interface PaginationState {
  limit: number;
  offset: number;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
  search?: string;
}

/**
 * Pagination actions for React hooks
 */
export interface PaginationActions {
  setLimit: (limit: number) => void;
  setOffset: (offset: number) => void;
  setSortBy: (sortBy?: string) => void;
  setSortOrder: (sortOrder: 'asc' | 'desc') => void;
  setSearch: (search?: string) => void;
  nextPage: () => void;
  previousPage: () => void;
  goToPage: (page: number) => void;
  reset: () => void;
}



// ============================================================================
// TYPE EXPORTS
// ============================================================================
// All types, constants, and functions are exported individually above