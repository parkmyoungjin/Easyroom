'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    // 요청 본문에서 reservation_id 추출
    const { reservation_id } = await request.json();
    if (!reservation_id) {
      return NextResponse.json(
        { success: false, error: 'Reservation ID is required', code: 'MISSING_PARAM' },
        { status: 400 }
      );
    }

    // Supabase RPC 함수 호출
    const { data, error } = await supabase.rpc('check_out_reservation', {
      p_reservation_id: reservation_id
    });

    if (error) {
      logger.error('Check-out RPC error:', error);
      return NextResponse.json(
        { success: false, error: error.message, code: 'RPC_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);

  } catch (error) {
    logger.error('Check-out API error:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}