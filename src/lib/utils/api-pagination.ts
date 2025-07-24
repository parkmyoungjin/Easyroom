/**
 * API Pagination Utilities
 * Standardized pagination support for API endpoints
 * Requirements: 3.4
 */

import { NextRequest } from 'next/server';
import { 
  PaginatedRequest, 
  PaginatedResponse, 
  validatePaginationParams, 
  createPaginatedResponse,
  extractPaginationFromSearchParams,
  PAGINATION_CONFIGS 
} from '@/types/pagination';
import { paginationRequestSchema } from '@/lib/validations/schemas';
import { logger } from '@/lib/utils/logger';

// ============================================================================
// API REQUEST PROCESSING
// ============================================================================

/**
 * Extract and validate pagination parameters from Next.js request
 */
export function extractPaginationFromRequest(
  request: NextRequest,
  endpointConfig?: keyof typeof PAGINATION_CONFIGS
): {
  isValid: boolean;
  errors: string[];
  pagination: Required<Pick<PaginatedRequest, 'limit' | 'offset' | 'sortOrder'>> & 
              Pick<PaginatedRequest, 'sortBy' | 'search'>;
} {
  const { searchParams } = new URL(request.url);
  
  // Extract raw parameters
  const rawParams = extractPaginationFromSearchParams(searchParams, endpointConfig);
  
  // Get endpoint-specific configuration
  const config = endpointConfig ? PAGINATION_CONFIGS[endpointConfig] : undefined;
  
  // Validate parameters
  const validation = validatePaginationParams(rawParams, {
    maxLimit: config?.maxLimit,
    allowedSortFields: config?.allowedSortFields,
  });

  logger.debug('Pagination parameters extracted', {
    endpoint: endpointConfig,
    rawParams,
    validation: {
      isValid: validation.isValid,
      errors: validation.errors,
      sanitized: validation.sanitized,
    },
  });

  return {
    isValid: validation.isValid,
    errors: validation.errors,
    pagination: validation.sanitized,
  };
}

/**
 * Validate pagination parameters using Zod schema
 */
export function validatePaginationWithSchema(params: unknown): {
  success: boolean;
  data?: PaginatedRequest;
  errors?: string[];
} {
  try {
    const result = paginationRequestSchema.safeParse(params);
    
    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    } else {
      return {
        success: false,
        errors: result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
      };
    }
  } catch (error) {
    logger.error('Pagination schema validation error', { error, params });
    return {
      success: false,
      errors: ['Invalid pagination parameters'],
    };
  }
}

// ============================================================================
// DATABASE QUERY HELPERS
// ============================================================================

/**
 * Apply pagination to Supabase query builder
 */
export function applyPaginationToQuery(
  query: any, // Supabase query builder
  pagination: {
    limit: number;
    offset: number;
    sortBy?: string;
    sortOrder: 'asc' | 'desc';
  }
): any {
  let paginatedQuery = query;

  // Apply sorting if specified
  if (pagination.sortBy) {
    paginatedQuery = paginatedQuery.order(pagination.sortBy, { 
      ascending: pagination.sortOrder === 'asc' 
    });
  }

  // Apply pagination
  const endIndex = pagination.offset + pagination.limit - 1;
  paginatedQuery = paginatedQuery.range(pagination.offset, endIndex);

  return paginatedQuery;
}

/**
 * Get total count for pagination metadata
 */
export async function getTotalCount(
  supabase: any,
  tableName: string,
  filters?: Record<string, any>
): Promise<number> {
  try {
    let countQuery = supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    // Apply filters if provided
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          countQuery = countQuery.eq(key, value);
        }
      });
    }

    const { count, error } = await countQuery;

    if (error) {
      logger.error('Failed to get total count', { error, tableName, filters });
      throw new Error(`Failed to get total count: ${error.message}`);
    }

    return count || 0;
  } catch (error) {
    logger.error('Total count query error', { error, tableName, filters });
    throw error;
  }
}

/**
 * Execute paginated query with total count
 */
export async function executePaginatedQuery<T>(
  supabase: any,
  tableName: string,
  selectClause: string,
  pagination: {
    limit: number;
    offset: number;
    sortBy?: string;
    sortOrder: 'asc' | 'desc';
    search?: string;
  },
  filters?: Record<string, any>,
  searchFields?: string[]
): Promise<{
  data: T[];
  totalCount: number;
}> {
  try {
    // Build base query
    let dataQuery = supabase.from(tableName).select(selectClause);
    let countQuery = supabase.from(tableName).select('*', { count: 'exact', head: true });

// ... executePaginatedQuery 함수 내부 ...
    // Apply filters
    if (filters) {
      for (const key in filters) {
        const value = filters[key];
        if (value !== undefined && value !== null) {
          if (typeof value === 'string' && value.includes('.')) {
            const [operator, filterValue] = value.split('.', 2);
            // Supabase 클라이언트의 필터 함수를 동적으로 호출합니다 (예: gte, lte)
            dataQuery = (dataQuery as any)[operator](key, filterValue);
            countQuery = (countQuery as any)[operator](key, filterValue);
          } else {
            // 기본은 등호(=) 비교입니다.
            dataQuery = dataQuery.eq(key, value);
            countQuery = countQuery.eq(key, value);
          }
        }
      }
    }

    // Apply search if provided
    if (pagination.search && searchFields && searchFields.length > 0) {
      const searchTerm = `%${pagination.search}%`;
      
      // Create OR condition for search across multiple fields
      const searchConditions = searchFields.map(field => `${field}.ilike.${searchTerm}`).join(',');
      dataQuery = dataQuery.or(searchConditions);
      countQuery = countQuery.or(searchConditions);
    }

    // Apply pagination to data query
    dataQuery = applyPaginationToQuery(dataQuery, pagination);

    // Execute both queries
    const [dataResult, countResult] = await Promise.all([
      dataQuery,
      countQuery
    ]);

    if (dataResult.error) {
      throw new Error(`Data query failed: ${dataResult.error.message}`);
    }

    if (countResult.error) {
      throw new Error(`Count query failed: ${countResult.error.message}`);
    }

    logger.debug('Paginated query executed', {
      tableName,
      pagination,
      filters,
      resultCount: dataResult.data?.length || 0,
      totalCount: countResult.count || 0,
    });

    return {
      data: dataResult.data || [],
      totalCount: countResult.count || 0,
    };
  } catch (error) {
    logger.error('Paginated query execution failed', {
      error,
      tableName,
      pagination,
      filters,
    });
    throw error;
  }
}

// ============================================================================
// RPC FUNCTION HELPERS
// ============================================================================

/**
 * Execute paginated RPC function
 */
export async function executePaginatedRPC<T>(
  supabase: any,
  functionName: string,
  params: Record<string, any>,
  pagination: {
    limit: number;
    offset: number;
  }
): Promise<{
  data: T[];
  totalCount: number;
  hasMore: boolean;
}> {
  try {
    const rpcParams = {
      ...params,
      p_limit: pagination.limit,
      p_offset: pagination.offset,
    };

    logger.debug('Executing paginated RPC function', {
      functionName,
      rpcParams,
    });

    const { data, error } = await supabase.rpc(functionName, rpcParams);

    if (error) {
      throw new Error(`RPC function failed: ${error.message}`);
    }

    // Extract pagination metadata from first row (if available)
    const firstRow = data && data.length > 0 ? data[0] : null;
    const totalCount = firstRow?.total_count || 0;
    const hasMore = firstRow?.has_more || false;

    logger.debug('Paginated RPC function executed', {
      functionName,
      resultCount: data?.length || 0,
      totalCount,
      hasMore,
    });

    return {
      data: data || [],
      totalCount,
      hasMore,
    };
  } catch (error) {
    logger.error('Paginated RPC execution failed', {
      error,
      functionName,
      params,
      pagination,
    });
    throw error;
  }
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

/**
 * Create standardized paginated API response
 */
export function createPaginatedApiResponse<T>(
  data: T[],
  totalCount: number,
  pagination: {
    limit: number;
    offset: number;
  },
  message?: string,
  metadata?: Record<string, any>
): PaginatedResponse<T> {
  const response = createPaginatedResponse(
    data,
    totalCount,
    pagination.limit,
    pagination.offset,
    message,
    metadata
  );

  logger.debug('Paginated API response created', {
    dataCount: data.length,
    totalCount,
    pagination: response.pagination,
  });

  return response;
}

/**
 * Create error response for pagination validation failures
 */
export function createPaginationErrorResponse(errors: string[]) {
  return {
    error: 'Invalid pagination parameters',
    details: errors,
    code: 'PAGINATION_VALIDATION_ERROR',
  };
}

// ============================================================================
// MIDDLEWARE HELPERS
// ============================================================================

/**
 * Middleware to validate pagination parameters
 */
export function withPaginationValidation(
  endpointConfig?: keyof typeof PAGINATION_CONFIGS
) {
  return function(handler: Function) {
    return async function(request: NextRequest, ...args: any[]) {
      const validation = extractPaginationFromRequest(request, endpointConfig);
      
      if (!validation.isValid) {
        logger.warn('Pagination validation failed', {
          errors: validation.errors,
          url: request.url,
        });
        
        return Response.json(
          createPaginationErrorResponse(validation.errors),
          { status: 400 }
        );
      }

      // Add validated pagination to request context
      const requestWithPagination = {
        ...request,
        pagination: validation.pagination,
      };

      return handler(requestWithPagination, ...args);
    };
  };
}

// ============================================================================
// EXPORTS
// ============================================================================
// All functions are exported individually above