// FILE: src/app/api/reservations/public-authenticated/route.ts

'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server'; // createClient는 이제 async 함수일 수 있음
import { normalizeDateForQuery } from '@/lib/utils/date';
import { logger } from '@/lib/utils/logger';
import { ReservationErrorHandler } from '@/lib/utils/error-handler';
import { 
  extractPaginationFromRequest,
  createPaginatedApiResponse,
  createPaginationErrorResponse,
  executePaginatedQuery
} from '@/lib/utils/api-pagination';
import type { PublicReservation } from '@/types/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    const paginationValidation = extractPaginationFromRequest(request, 'reservations');
    
    if (!paginationValidation.isValid) {
      return NextResponse.json(createPaginationErrorResponse(paginationValidation.errors), { status: 400 });
    }
    
    const { limit, offset, sortBy, sortOrder, search } = paginationValidation.pagination;

    logger.info('인증 공개 예약 API 호출', { startDate, endDate, limit, offset });

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate와 endDate가 필요합니다' }, { status: 400 });
    }

    // ✅ [핵심 수정] createClient()가 Promise를 반환하므로, await를 사용합니다.
    const supabase = await createClient(); 
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    logger.debug('인증된 사용자 확인', { userId: user.id });

    const normalizedStartDate = normalizeDateForQuery(startDate, false);
    const normalizedEndDate = normalizeDateForQuery(endDate, true);

    // RPC 함수 호출로 변경 - 모든 데이터 가공이 서버에서 처리됨
    const { data, error } = await supabase.rpc('get_reservations_for_period', {
      start_date: normalizedStartDate,
      end_date: normalizedEndDate
    });

    if (error) {
      throw new Error(`RPC 함수 호출 실패: ${error.message}`);
    }

    // RPC 함수가 이미 가공된 데이터를 반환하므로 그대로 사용
    const authenticatedReservations: PublicReservation[] = data || [];

    logger.info('인증 공개 예약 조회 성공 (RPC 함수)', { 
      count: authenticatedReservations.length,
      userId: user.id,
    });

    const paginatedResponse = createPaginatedApiResponse(
      authenticatedReservations,
      authenticatedReservations.length, // RPC 함수는 전체 결과를 반환
      { limit, offset },
      `${authenticatedReservations.length}개의 예약을 조회했습니다.`,
      { authenticated: true, userId: user.id }
    );

    return NextResponse.json(paginatedResponse);

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
      },
      { status: 500 }
    );
  }
}