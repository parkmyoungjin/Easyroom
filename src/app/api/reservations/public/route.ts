'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase/actions';
import { logger } from '@/lib/utils/logger';
import { ReservationErrorHandler } from '@/lib/utils/error-handler';

/**
 * @deprecated This endpoint is deprecated for security reasons.
 * Use /api/reservations/public-anonymous for unauthenticated access
 * or /api/reservations/public-authenticated for authenticated access.
 * 
 * This endpoint will redirect to the appropriate secure endpoint based on authentication status.
 */
export async function GET(request: NextRequest) {
  try {
    logger.warn('레거시 공개 예약 API 호출 감지', {
      url: request.url,
      userAgent: request.headers.get('user-agent'),
      timestamp: new Date().toISOString()
    });

    // 쿼리 파라미터 추출
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();

    // 사용자 인증 상태 확인
    const supabase = createRouteClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    const isAuthenticated = !authError && !!user;

    // 인증 상태에 따라 적절한 엔드포인트로 리디렉션
    const targetEndpoint = isAuthenticated 
      ? '/api/reservations/public-authenticated'
      : '/api/reservations/public-anonymous';

    const redirectUrl = new URL(targetEndpoint, request.url);
    
    // 기존 쿼리 파라미터 유지
    if (queryString) {
      redirectUrl.search = queryString;
    }

    logger.info('보안 엔드포인트로 리디렉션', {
      from: '/api/reservations/public',
      to: targetEndpoint,
      authenticated: isAuthenticated,
      userId: user?.id || 'anonymous'
    });

    // 임시 리디렉션 (307) - POST 요청도 유지됨
    return NextResponse.redirect(redirectUrl, { status: 307 });

  } catch (error) {
    const structuredError = ReservationErrorHandler.handleApiError(error, {
      action: 'redirect_legacy_api',
      endpoint: '/api/reservations/public',
      timestamp: new Date().toISOString()
    });

    logger.error('레거시 API 리디렉션 중 구조화된 오류', {
      error: structuredError,
      originalError: error instanceof Error ? error.message : String(error)
    });
    
    // 오류 발생 시 안전한 기본값으로 비인증 엔드포인트 사용
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    const fallbackUrl = new URL('/api/reservations/public-anonymous', request.url);
    
    if (queryString) {
      fallbackUrl.search = queryString;
    }

    return NextResponse.redirect(fallbackUrl, { status: 307 });
  }
}