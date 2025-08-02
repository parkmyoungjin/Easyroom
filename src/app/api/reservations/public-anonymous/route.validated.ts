/**
 * Example: Refactored public-anonymous route with validation middleware
 * This demonstrates how to apply the mandatory input validation middleware
 */

'use server';

import { NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase/actions';
import { normalizeDateForQuery } from '@/lib/utils/date';
import { logger } from '@/lib/utils/logger';
import { ReservationErrorHandler } from '@/lib/utils/error-handler';
import { withValidation, validationSchemas, ValidatedRequest } from '@/lib/middleware/validation';

/**
 * Validated handler for public reservations (anonymous users)
 */
async function getPublicReservationsHandler(
  req: ValidatedRequest<never, { startDate: string; endDate: string; limit?: number; offset?: number }>
): Promise<NextResponse> {
  const endpoint = '/api/reservations/public-anonymous';
  
  try {
    // Extract validated query parameters
    const { startDate, endDate, limit: pageLimit, offset: pageOffset } = req.validatedQuery!;

    logger.info('비인증 공개 예약 API 호출 (검증됨)', { 
      startDate, 
      endDate, 
      pageLimit, 
      pageOffset 
    });

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
        endpoint,
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
      // 페이지네이션이 요청된 경우 paginated 함수 사용
      const functionName = (pageLimit !== undefined && pageOffset !== undefined) 
        ? 'get_public_reservations_anonymous_paginated' 
        : 'get_public_reservations_anonymous';
      
      const rpcParams: any = {
        start_date: normalizedStartDate,
        end_date: normalizedEndDate
      };

      // 페이지네이션 파라미터 추가
      if (pageLimit !== undefined && pageOffset !== undefined) {
        rpcParams.page_limit = pageLimit;
        rpcParams.page_offset = pageOffset;
      }

      const { data, error } = await supabase.rpc(functionName, rpcParams);

      if (error) {
        logger.error('RPC 함수 호출 실패', error);
        throw error;
      }

      logger.info('비인증 공개 예약 조회 성공', { 
        count: data?.length || 0,
        paginated: pageLimit !== undefined && pageOffset !== undefined,
        limit: pageLimit,
        offset: pageOffset
      });

      // 페이지네이션 메타데이터 처리
      let paginationMeta = {};
      if (pageLimit !== undefined && pageOffset !== undefined && data && data.length > 0) {
        const firstRow = data[0];
        paginationMeta = {
          pagination: {
            limit: pageLimit,
            offset: pageOffset,
            total_count: firstRow.total_count || 0,
            has_more: firstRow.has_more || false,
            current_page: Math.floor(pageOffset / pageLimit) + 1,
            total_pages: Math.ceil((firstRow.total_count || 0) / pageLimit)
          }
        };
      }

      return NextResponse.json({
        data: data || [],
        message: `${data?.length || 0}개의 예약을 조회했습니다.`,
        authenticated: false,
        ...paginationMeta
      });

    } catch (rpcError) {
      logger.warn('RPC 함수 사용 불가, 직접 쿼리 시도', rpcError instanceof Error ? { error: rpcError.message } : { error: String(rpcError) });

      // Fallback: 직접 쿼리 (RLS 정책 적용됨)
      let query = supabase
        .from('reservations')
        .select(`
          id,
          room_id,
          start_time,
          end_time,
          room:rooms!inner(name)
        `)
        .eq('status', 'confirmed')
        .gte('start_time', normalizedStartDate)
        .lte('end_time', normalizedEndDate)
        .order('start_time', { ascending: true });

      // 페이지네이션 적용
      if (pageLimit !== undefined && pageOffset !== undefined) {
        query = query.range(pageOffset, pageOffset + pageLimit - 1);
      }

      const { data, error } = await query;

      if (error) {
        const structuredError = ReservationErrorHandler.handleApiError(error, {
          action: 'query_reservations',
          endpoint,
          startDate: normalizedStartDate,
          endDate: normalizedEndDate,
          timestamp: new Date().toISOString()
        });

        logger.error('직접 쿼리 실패', { structuredError, originalError: error });
        return NextResponse.json(
          { 
            error: structuredError.userMessage,
            code: structuredError.code 
          },
          { status: 500 }
        );
      }

      // 비인증 사용자용 최소 정보만 반환
      const anonymousReservations = (data || []).map((reservation: any) => ({
        id: reservation.id,
        room_id: reservation.room_id,
        title: 'Booked', // 모든 예약은 'Booked'로 마스킹
        start_time: reservation.start_time,
        end_time: reservation.end_time,
        room_name: reservation.room?.name || '',
        is_mine: false // 비인증 사용자는 항상 false
      }));

      logger.info('비인증 공개 예약 조회 성공 (직접 쿼리)', { count: anonymousReservations.length });

      return NextResponse.json({
        data: anonymousReservations,
        message: `${anonymousReservations.length}개의 예약을 조회했습니다.`,
        authenticated: false
      });
    }

  } catch (error) {
    const structuredError = ReservationErrorHandler.handleApiError(error, {
      action: 'get_public_reservations_anonymous',
      endpoint,
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

// Apply validation middleware to the handler
export const GET = withValidation(
  validationSchemas.publicReservations,
  getPublicReservationsHandler
);