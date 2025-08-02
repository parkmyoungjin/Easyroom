/**
 * Rooms API Endpoint with Pagination Support
 * Provides paginated access to room data
 * Requirements: 3.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase/actions';
import { logger } from '@/lib/utils/logger';
import { ReservationErrorHandler } from '@/lib/utils/error-handler';
import { securityMonitor } from '@/lib/monitoring/security-monitor';
import { performanceMonitor } from '@/lib/monitoring/performance-monitor';
import { 
  extractPaginationFromRequest,
  createPaginatedApiResponse,
  createPaginationErrorResponse,
  executePaginatedQuery
} from '@/lib/utils/api-pagination';
import type { Room } from '@/types/database';

/**
 * GET /api/rooms - Get paginated list of rooms
 */
export async function GET(request: NextRequest) {
  const startTime = performance.now();
  const requestId = crypto.randomUUID();
  
  try {
    // Extract and validate pagination parameters
    const paginationValidation = extractPaginationFromRequest(request, 'rooms');
    
    if (!paginationValidation.isValid) {
      logger.warn('Rooms API: 페이지네이션 파라미터 검증 실패', {
        errors: paginationValidation.errors,
        requestId
      });
      return NextResponse.json(
        createPaginationErrorResponse(paginationValidation.errors),
        { status: 400 }
      );
    }
    
    const { limit, offset, sortBy, sortOrder, search } = paginationValidation.pagination;

    // Security monitoring: Record API access
    securityMonitor.recordEvent({
      type: 'api_access',
      severity: 'low',
      endpoint: '/api/rooms',
      method: 'GET',
      userAgent: request.headers.get('user-agent') || 'unknown',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      metadata: {
        requestId,
        pagination: { limit, offset, sortBy, sortOrder, search }
      }
    });

    logger.info('Rooms API 호출', { 
      limit, 
      offset, 
      sortBy, 
      sortOrder, 
      search, 
      requestId 
    });

    const supabase = createRouteClient();

    // Check if user is authenticated for additional room details
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    const isAuthenticated = !authError && !!user;

    // Execute paginated query for rooms
    const result = await executePaginatedQuery<Room>(
      supabase,
      'rooms',
      `
        id,
        name,
        description,
        capacity,
        location,
        amenities,
        is_active,
        created_at,
        updated_at
      `,
      {
        limit,
        offset,
        sortBy: sortBy || 'name',
        sortOrder,
        search
      },
      {
        is_active: true // Only show active rooms by default
      },
      search ? ['name', 'description', 'location'] : undefined
    );

    logger.info('Rooms 조회 성공', { 
      count: result.data.length,
      totalCount: result.totalCount,
      authenticated: isAuthenticated
    });

    // Performance monitoring: Record successful request
    const duration = performance.now() - startTime;
    performanceMonitor.recordMetric({
      operation: 'api_request_complete',
      duration,
      success: true,
      metadata: {
        endpoint: '/api/rooms',
        requestId,
        resultCount: result.data.length,
        authenticated: isAuthenticated
      }
    });

    // Create standardized paginated response
    const paginatedResponse = createPaginatedApiResponse(
      result.data,
      result.totalCount,
      { limit, offset },
      `${result.data.length}개의 회의실을 조회했습니다.`,
      {
        authenticated: isAuthenticated,
        userId: user?.id
      }
    );

    return NextResponse.json(paginatedResponse);

  } catch (error) {
    const structuredError = ReservationErrorHandler.handleApiError(error, {
      action: 'get_rooms',
      endpoint: '/api/rooms',
      timestamp: new Date().toISOString()
    });

    logger.error('Rooms API 치명적 오류', { 
      structuredError, 
      originalError: error instanceof Error ? error : new Error(String(error)) 
    });

    return NextResponse.json(
      {
        error: structuredError.userMessage,
        code: structuredError.code,
        details: process.env.NODE_ENV === 'development' 
          ? structuredError.message
          : undefined
      },
      { status: 500 }
    );
  }
}