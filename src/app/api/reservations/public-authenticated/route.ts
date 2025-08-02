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
import type { PublicReservation } from '@/types/database';

/**
 * 인증된 사용자를 위한 공개 예약 조회 API
 * - authenticated 클라이언트 사용 (RLS 정책 적용)
 * - 사용자 컨텍스트 기반 정보 제공
 * - 자신의 예약에 대해서는 상세 정보 제공
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
      logger.warn('인증 공개 예약 API: 페이지네이션 파라미터 검증 실패', {
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
      userId: undefined, // Will be set after authentication
      endpoint: '/api/reservations/public-authenticated',
      method: 'GET',
      userAgent: request.headers.get('user-agent') || 'unknown',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      metadata: {
        requestId,
        parameters: { startDate, endDate, limit, offset }
      }
    });

    logger.info('인증 공개 예약 API 호출', { startDate, endDate, limit, offset, requestId });

    // 입력 검증
    if (!startDate || !endDate) {
      logger.warn('인증 공개 예약 API: 필수 파라미터 누락', { startDate, endDate });
      return NextResponse.json(
        { error: 'startDate와 endDate가 필요합니다' },
        { status: 400 }
      );
    }

    // authenticated 클라이언트 사용 - auth-helpers 방식으로 변경
    const supabase = createRouteClient();

    // 사용자 인증 상태 확인 with performance monitoring (getSession 사용으로 변경)
    const authResult = await performanceMonitor.measureAuthentication(
      async () => await supabase.auth.getSession(),
      {
        endpoint: '/api/reservations/public-authenticated',
        method: 'getSession',
        requestId
      }
    );

    const { data: { session }, error: authError } = authResult;
    const user = session?.user;

    if (authError || !user) {
      // Security monitoring: Record authentication failure
      securityMonitor.recordAuthFailure({
        endpoint: '/api/reservations/public-authenticated',
        reason: authError?.message || 'No user found',
        userAgent: request.headers.get('user-agent') || 'unknown',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        metadata: { requestId, authError: authError?.message }
      });

      logger.warn('인증 공개 예약 API: 인증 실패', authError ? { error: authError.message } : { error: 'No user found' });
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    // Security monitoring: Update event with authenticated user
    securityMonitor.recordEvent({
      type: 'authenticated_api_access',
      severity: 'low',
      userId: user.id,
      endpoint: '/api/reservations/public-authenticated',
      method: 'GET',
      userAgent: request.headers.get('user-agent') || 'unknown',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      metadata: {
        requestId,
        parameters: { startDate, endDate, limit, offset }
      }
    });

    logger.debug('인증된 사용자 확인', { userId: user.id, requestId });

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
        endpoint: '/api/reservations/public-authenticated',
        userId: user?.id,
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

    // RPC 함수 호출 - 인증된 사용자용 (사용자 컨텍스트 포함)
    try {
      // Use standardized paginated RPC execution
      const rpcResult = await executePaginatedRPC<PublicReservation>(
        supabase,
        'get_public_reservations_paginated',
        {
          p_start_date: normalizedStartDate,
          p_end_date: normalizedEndDate
        },
        {
          limit: limit,
          offset: offset
        }
      );

      logger.info('인증 공개 예약 조회 성공', { 
        count: rpcResult.data.length,
        userId: user.id,
        totalCount: rpcResult.totalCount,
        hasMore: rpcResult.hasMore
      });

      // Performance monitoring: Record successful request
      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        operation: 'api_request_complete',
        duration,
        success: true,
        metadata: {
          endpoint: '/api/reservations/public-authenticated',
          userId: user.id,
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
          authenticated: true,
          userId: user.id
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
          user_id,
          title,
          purpose,
          start_time,
          end_time,
          user:users!inner(department, name),
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
        search ? ['title', 'purpose'] : undefined
      );

      // 현재 사용자의 데이터베이스 ID 조회
      let currentUserId: number | null = null;
      try {
        const userResult = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .single();
        
        if (!userResult.error && userResult.data) {
          currentUserId = (userResult.data as any).id;
        }
      } catch (error) {
        logger.warn('사용자 ID 조회 실패', { error, userId: user.id });
      }

      // 인증된 사용자용 데이터 변환 (자신의 예약은 상세 정보 제공)
      const authenticatedReservations: PublicReservation[] = fallbackResult.data.map((reservation: any) => {
        const isMyReservation = currentUserId && reservation.user_id === currentUserId;
        
        return {
          id: reservation.id,
          room_id: reservation.room_id,
          user_id: reservation.user_id,
          title: isMyReservation ? reservation.title : 'Booked',
          purpose: isMyReservation ? reservation.purpose : null,
          start_time: reservation.start_time,
          end_time: reservation.end_time,
          department: reservation.user?.department || '',
          user_name: reservation.user?.name || '',
          is_mine: isMyReservation || false
        };
      });

      logger.info('인증 공개 예약 조회 성공 (직접 쿼리)', { 
        count: authenticatedReservations.length,
        userId: user.id,
        totalCount: fallbackResult.totalCount,
        myReservations: authenticatedReservations.filter(r => r.is_mine).length
      });

      // Create standardized paginated response for fallback
      const fallbackPaginatedResponse = createPaginatedApiResponse(
        authenticatedReservations,
        fallbackResult.totalCount,
        { limit, offset },
        `${authenticatedReservations.length}개의 예약을 조회했습니다.`,
        {
          authenticated: true,
          userId: user.id,
          fallback: true
        }
      );

      return NextResponse.json(fallbackPaginatedResponse);
    }

  } catch (error) {
    const structuredError = ReservationErrorHandler.handleApiError(error, {
      action: 'get_public_reservations_authenticated',
      endpoint: '/api/reservations/public-authenticated',
      timestamp: new Date().toISOString()
    });

    logger.error('인증 공개 예약 API 치명적 오류', { 
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