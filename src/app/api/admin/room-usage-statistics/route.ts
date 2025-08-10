'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
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

    // 보안 함수 호출 (SECURITY INVOKER로 관리자 권한 자동 확인)
    const { data, error } = await supabase.rpc('get_room_usage_statistics');

    if (error) {
      logger.error('Room usage statistics RPC error:', error);
      
      // 권한 없음 에러 처리
      if (error.message.includes('Access denied')) {
        return NextResponse.json(
          { success: false, error: 'Admin access required', code: 'ACCESS_DENIED' },
          { status: 403 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: error.message, code: 'RPC_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);

  } catch (error) {
    logger.error('Room usage statistics API error:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}