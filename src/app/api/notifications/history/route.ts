/**
 * 사용자별 알림 히스토리 조회 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 현재 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ 
        error: '인증이 필요합니다' 
      }, { status: 401 });
    }

    // 사용자 프로필 조회
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ 
        error: '사용자 정보를 찾을 수 없습니다' 
      }, { status: 404 });
    }

    // URL 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // 최대 100개
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);
    const status = searchParams.get('status'); // 'sent', 'failed', 'pending_retry'
    const type = searchParams.get('type') || 'checkin_reminder';

    // 기본 쿼리 구성
    let query = supabase
      .from('notification_logs')
      .select(`
        id,
        notification_type,
        sent_at,
        status,
        error_message,
        retry_count,
        reservations!inner (
          id,
          title,
          start_time,
          end_time,
          rooms!inner (name)
        )
      `)
      .eq('user_id', userProfile.id)
      .eq('notification_type', type)
      .order('sent_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // 상태 필터 적용
    if (status && ['sent', 'failed', 'pending_retry'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data: notifications, error: notificationError } = await query;

    if (notificationError) {
      console.error('Failed to fetch notification history:', notificationError);
      return NextResponse.json({ 
        error: '알림 히스토리 조회에 실패했습니다',
        details: notificationError.message
      }, { status: 500 });
    }

    // 전체 개수 조회 (페이지네이션용)
    let countQuery = supabase
      .from('notification_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userProfile.id)
      .eq('notification_type', type);

    if (status && ['sent', 'failed', 'pending_retry'].includes(status)) {
      countQuery = countQuery.eq('status', status);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.warn('Failed to get notification count:', countError);
    }

    // 통계 정보 계산
    const stats = {
      total: count || 0,
      sent: notifications?.filter(n => n.status === 'sent').length || 0,
      failed: notifications?.filter(n => n.status === 'failed').length || 0,
      pending_retry: notifications?.filter(n => n.status === 'pending_retry').length || 0
    };

    return NextResponse.json({
      notifications: notifications || [],
      pagination: {
        limit,
        offset,
        total: count || 0,
        hasMore: (offset + limit) < (count || 0)
      },
      stats,
      filters: {
        status,
        type
      }
    });

  } catch (error: any) {
    console.error('Notification history API error:', error);
    return NextResponse.json({
      error: '서버 오류가 발생했습니다',
      message: error.message
    }, { status: 500 });
  }
}

// POST, PUT, DELETE 메서드는 지원하지 않음
export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}