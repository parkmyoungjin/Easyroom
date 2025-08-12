/**
 * 관리자용 알림 시스템 통계 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 관리자 권한 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ 
        error: '인증이 필요합니다' 
      }, { status: 401 });
    }

    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (profileError || !userProfile || userProfile.role !== 'admin') {
      return NextResponse.json({ 
        error: '관리자 권한이 필요합니다' 
      }, { status: 403 });
    }

    // URL 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days') || '7'), 30); // 최대 30일
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 1. 전체 통계
    const { data: totalStats, error: totalError } = await supabase
      .from('notification_logs')
      .select('status')
      .gte('sent_at', startDate.toISOString());

    if (totalError) {
      console.error('Failed to fetch total stats:', totalError);
      return NextResponse.json({ 
        error: '통계 조회에 실패했습니다' 
      }, { status: 500 });
    }

    // 2. 일별 통계
    const { data: dailyStats, error: dailyError } = await supabase
      .from('notification_stats_view')
      .select('*')
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (dailyError) {
      console.warn('Failed to fetch daily stats:', dailyError);
    }

    // 3. 사용자별 구독 현황
    const { data: subscriptionStats, error: subError } = await supabase
      .from('users')
      .select('push_subscription, notification_preferences')
      .not('push_subscription', 'is', null);

    if (subError) {
      console.warn('Failed to fetch subscription stats:', subError);
    }

    // 4. 최근 실패한 알림들
    const { data: recentFailures, error: failureError } = await supabase
      .from('notification_logs')
      .select(`
        id,
        sent_at,
        error_message,
        retry_count,
        users!inner (name, email),
        reservations!inner (title, start_time, rooms!inner (name))
      `)
      .eq('status', 'failed')
      .gte('sent_at', startDate.toISOString())
      .order('sent_at', { ascending: false })
      .limit(10);

    if (failureError) {
      console.warn('Failed to fetch recent failures:', failureError);
    }

    // 5. 재시도 대기 중인 알림들
    const { data: pendingRetries, error: retryError } = await supabase
      .from('notification_logs')
      .select(`
        id,
        sent_at,
        retry_count,
        next_retry_at,
        users!inner (name, email),
        reservations!inner (title, start_time, rooms!inner (name))
      `)
      .eq('status', 'pending_retry')
      .order('next_retry_at', { ascending: true })
      .limit(10);

    if (retryError) {
      console.warn('Failed to fetch pending retries:', retryError);
    }

    // 통계 계산
    const stats = {
      total: totalStats?.length || 0,
      sent: totalStats?.filter(s => s.status === 'sent').length || 0,
      failed: totalStats?.filter(s => s.status === 'failed').length || 0,
      pending_retry: totalStats?.filter(s => s.status === 'pending_retry').length || 0
    };

    const successRate = stats.total > 0 ? 
      ((stats.sent / stats.total) * 100).toFixed(2) : '0.00';

    // 구독 통계 계산
    const subscriptionCount = subscriptionStats?.length || 0;
    const enabledNotifications = subscriptionStats?.filter(s => 
      s.notification_preferences?.enabled !== false && 
      s.notification_preferences?.checkin_reminder !== false
    ).length || 0;

    return NextResponse.json({
      summary: {
        ...stats,
        successRate: parseFloat(successRate),
        period: `${days}일`,
        lastUpdated: new Date().toISOString()
      },
      subscriptions: {
        total: subscriptionCount,
        enabled: enabledNotifications,
        disabled: subscriptionCount - enabledNotifications
      },
      dailyStats: dailyStats || [],
      recentFailures: recentFailures || [],
      pendingRetries: pendingRetries || [],
      systemHealth: {
        configValid: process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        cronSecret: !!process.env.CRON_SECRET,
        lastCronRun: null // TODO: Cron 실행 로그에서 가져오기
      }
    });

  } catch (error: any) {
    console.error('Notification stats API error:', error);
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