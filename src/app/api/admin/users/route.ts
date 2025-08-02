/**
 * Admin Users API Endpoint with Pagination Support
 * Provides paginated access to user data for administrators
 * Requirements: 3.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteClient, createAdminRouteClient } from '@/lib/supabase/actions';
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
import type { User } from '@/types/database';

/**
 * GET /api/admin/users - Get paginated list of users (admin only)
 */
export async function GET(request: NextRequest) {
  const startTime = performance.now();
  const requestId = crypto.randomUUID();
  
  try {
    // Extract and validate pagination parameters
    const paginationValidation = extractPaginationFromRequest(request, 'users');
    
    if (!paginationValidation.isValid) {
      logger.warn('Admin Users API: 페이지네이션 파라미터 검증 실패', {
        errors: paginationValidation.errors,
        requestId
      });
      return NextResponse.json(
        createPaginationErrorResponse(paginationValidation.errors),
        { status: 400 }
      );
    }
    
    const { limit, offset, sortBy, sortOrder, search } = paginationValidation.pagination;

    const supabase = createRouteClient();

    // Check authentication and admin privileges
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      // Security monitoring: Record authentication failure
      securityMonitor.recordAuthFailure({
        endpoint: '/api/admin/users',
        reason: authError?.message || 'No user found',
        userAgent: request.headers.get('user-agent') || 'unknown',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        metadata: { requestId, authError: authError?.message }
      });

      logger.warn('Admin Users API: 인증 실패', authError ? { error: authError.message } : { error: 'No user found' });
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (profileError || !userProfile || userProfile.role !== 'admin') {
      // Security monitoring: Record unauthorized access attempt
      securityMonitor.recordEvent({
        type: 'privilege_escalation_attempt',
        severity: 'high',
        userId: user.id,
        endpoint: '/api/admin/users',
        method: 'GET',
        userAgent: request.headers.get('user-agent') || 'unknown',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        metadata: {
          requestId,
          attemptedRole: userProfile?.role || 'unknown',
          requiredRole: 'admin'
        }
      });

      logger.warn('Admin Users API: 관리자 권한 없음', { 
        userId: user.id, 
        userRole: userProfile?.role 
      });
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    // Security monitoring: Record admin API access
    securityMonitor.recordEvent({
      type: 'authenticated_api_access',
      severity: 'medium',
      userId: user.id,
      endpoint: '/api/admin/users',
      method: 'GET',
      userAgent: request.headers.get('user-agent') || 'unknown',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      metadata: {
        requestId,
        pagination: { limit, offset, sortBy, sortOrder, search }
      }
    });

    logger.info('Admin Users API 호출', { 
      adminUserId: user.id,
      limit, 
      offset, 
      sortBy, 
      sortOrder, 
      search, 
      requestId 
    });

    // Use admin client for privileged operations (bypasses RLS)
    const supabaseAdmin = createAdminRouteClient({
      endpoint: '/api/admin/users',
      userId: user.id
    });

    // Execute paginated query for users
    const result = await executePaginatedQuery<User>(
      supabaseAdmin,
      'users',
      `
        id,
        auth_id,
        employee_id,
        name,
        email,
        department,
        role,
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
      {}, // No default filters - admin can see all users
      search ? ['name', 'email', 'department', 'employee_id'] : undefined
    );

    logger.info('Admin Users 조회 성공', { 
      count: result.data.length,
      totalCount: result.totalCount,
      adminUserId: user.id
    });

    // Performance monitoring: Record successful request
    const duration = performance.now() - startTime;
    performanceMonitor.recordMetric({
      operation: 'admin_api_request_complete',
      duration,
      success: true,
      metadata: {
        endpoint: '/api/admin/users',
        userId: user.id,
        requestId,
        resultCount: result.data.length
      }
    });

    // Create standardized paginated response
    const paginatedResponse = createPaginatedApiResponse(
      result.data,
      result.totalCount,
      { limit, offset },
      `${result.data.length}명의 사용자를 조회했습니다.`,
      {
        authenticated: true,
        adminUserId: user.id,
        endpoint: 'admin/users'
      }
    );

    return NextResponse.json(paginatedResponse);

  } catch (error) {
    const structuredError = ReservationErrorHandler.handleApiError(error, {
      action: 'get_admin_users',
      endpoint: '/api/admin/users',
      timestamp: new Date().toISOString()
    });

    logger.error('Admin Users API 치명적 오류', { 
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