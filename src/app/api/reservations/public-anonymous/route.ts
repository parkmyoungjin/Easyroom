'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase/actions';
import { normalizeDateForQuery } from '@/lib/utils/date';
import { logger } from '@/lib/utils/logger';
import { ReservationErrorHandler } from '@/lib/utils/error-handler';
import { securityMonitor } from '@/lib/monitoring/security-monitor';
import { performanceMonitor } from '@/lib/monitoring/performance-monitor';
import { 
  extractPaginationFromRequest,
  createPaginatedApiResponse,
  createPaginationErrorResponse,
  executePaginatedRPC,
  executePaginatedQuery
} from '@/lib/utils/api-pagination';

/**
 * 비인증 사용자를 위한 공개 예약 조회 API
 * - anon 클라이언트 사용 (RLS 정책 적용)
 * - 최소한의 공개 정보만 반환
 * - 보안 우선 설계
 */
export async function GET(request: NextRequest) {
  const startTime = performance.now();
  const requestId = crypto.randomUUID();
  
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    // Extract and validate pagination parameters using standardized system
    const paginationValidation = extractPaginationFromRequest(request, 'reservations');
    
    if (!paginationValidation.isValid) {
      logger.warn('비인증 공개 예약 API: 페이지네이션 파라미터 검증 실패', {
        errors: paginationValidation.errors,
        requestId
      });
      return NextResponse.json(
        createPaginationErrorResponse(paginationValidation.errors),
        { status: 400 }
      );
    }
    
    const { limit, offset, sortBy, sortOrder, search } = paginationValidation.pagination;

    // Security monitoring: Record anonymous API access
    securityMonitor.recordEvent({
      type: 'anonymous_api_access',
      severity: 'low',
      userId: undefined,
      endpoint: '/api/reservations/public-anonymous',
      method: 'GET',
      userAgent: request.headers.get('user-agent') || 'unknown',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      metadata: {
        requestId,
        parameters: { startDate, endDate, limit, offset }
      }
    });

    logger.info('비인증 공개 예약 API 호출', { startDate, endDate, limit, offset, requestId });

    // 입력 검증
    if (!startDate || !endDate) {
      logger.warn('비인증 공개 예약 API: 필수 파라미터 누락', { startDate, endDate });
      return NextResponse.json(
        { error: 'startDate와 endDate가 필요합니다' },
        { status: 400 }
      );
    }

    // 날짜 범위 정규화 및 검증
    let normalizedStartDate: string;
    let normalizedEndDate: string;

    try {
      normalizedStartDate = normalizeDateForQuery(startDate, false);
      normalizedEndDate = normalizeDateForQuery(endDate, true);
      logger.debug('날짜 정규화 완료', { normalizedStartDate, normalizedEndDate });
    } catch (error) {
      const structuredError = ReservationErrorHandler.handleApiError(error, {
        action: 'normalize_date',
        endpoint: '/api/reservations/public-anonymous',
        startDate,
        endDate,
        timestamp: new Date().toISOString()
      });

      logger.error('날짜 정규화 실패', { structuredError, originalError: error });
      return NextResponse.json(
        { 
          error: structuredError.userMessage,
          code: structuredError.code 
        },
        { status: 400 }
      );
    }

    // anon 클라이언트 사용 (RLS 정책 적용)
    const supabase = createRouteClient();

    // RPC 함수 호출 - 비인증 사용자용
    try {
      // Use standardized paginated RPC execution
      const rpcResult = await executePaginatedRPC<any>(
        supabase,
        'get_public_reservations_anonymous_paginated',
        {
          p_start_date: normalizedStartDate,
          p_end_date: normalizedEndDate
        },
        {
          limit: limit,
          offset: offset
        }
      );

      logger.info('비인증 공개 예약 조회 성공', { 
        count: rpcResult.data.length,
        totalCount: rpcResult.totalCount,
        hasMore: rpcResult.hasMore
      });

      // Performance monitoring: Record successful anonymous request
      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        operation: 'anonymous_api_request_complete',
        duration,
        success: true,
        metadata: {
          endpoint: '/api/reservations/public-anonymous',
          userId: undefined,
          requestId,
          resultCount: rpcResult.data.length
        }
      });

      // Create standardized paginated response
      const paginatedResponse = createPaginatedApiResponse(
        rpcResult.data,
        rpcResult.totalCount,
        { limit, offset },
        `${rpcResult.data.length}개의 예약을 조회했습니다.`,
        {
          authenticated: false
        }
      );

      return NextResponse.json(paginatedResponse);

    } catch (rpcError) {
      logger.warn('RPC 함수 사용 불가, 직접 쿼리 시도', rpcError instanceof Error ? { error: rpcError.message } : { error: String(rpcError) });

      // Fallback: Use standardized paginated query execution
      const fallbackResult = await executePaginatedQuery<any>(
        supabase,
        'reservations',
        `
          id,
          room_id,
          start_time,
          end_time,
          room:rooms!inner(name)
        `,
        {
          limit,
          offset,
          sortBy: sortBy || 'start_time',
          sortOrder,
          search
        },
        {
          status: 'confirmed',
          start_time: `gte.${normalizedStartDate}`,
          end_time: `lte.${normalizedEndDate}`
        },
        search ? ['title'] : undefined // Limited search fields for anonymous users
      );

      // 비인증 사용자용 최소 정보만 반환
      const anonymousReservations = fallbackResult.data.map((reservation: any) => ({
        id: reservation.id,
        room_id: reservation.room_id,
        title: 'Booked', // 모든 예약은 'Booked'로 마스킹
        start_time: reservation.start_time,
        end_time: reservation.end_time,
        room_name: reservation.room?.name || '',
        is_mine: false // 비인증 사용자는 항상 false
      }));

      logger.info('비인증 공개 예약 조회 성공 (직접 쿼리)', { 
        count: anonymousReservations.length,
        totalCount: fallbackResult.totalCount
      });

      // Create standardized paginated response for fallback
      const fallbackPaginatedResponse = createPaginatedApiResponse(
        anonymousReservations,
        fallbackResult.totalCount,
        { limit, offset },
        `${anonymousReservations.length}개의 예약을 조회했습니다.`,
        {
          authenticated: false,
          fallback: true
        }
      );

      return NextResponse.json(fallbackPaginatedResponse);
    }

  } catch (error) {
    const structuredError = ReservationErrorHandler.handleApiError(error, {
      action: 'get_public_reservations_anonymous',
      endpoint: '/api/reservations/public-anonymous',
      timestamp: new Date().toISOString()
    });

    logger.error('비인증 공개 예약 API 치명적 오류', { 
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