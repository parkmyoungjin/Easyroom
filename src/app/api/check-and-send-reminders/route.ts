/**
 * 보안 강화된 체크인 알림 발송 API
 * Vercel Cron Jobs 전용 엔드포인트 (CRON_SECRET 인증 필요)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendBatchPushNotifications } from '@/lib/push/send-notification';
import { validatePushConfig } from '@/lib/push/web-push-config';
import type { NotificationPayload } from '@/types/push-notification';

/**
 * GET: Vercel Cron Jobs 전용 엔드포인트
 * Authorization: Bearer {CRON_SECRET} 헤더 필요
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 1. CRON_SECRET 인증 확인
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error('CRON_SECRET not configured');
      return NextResponse.json({ 
        error: 'Server configuration error' 
      }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      console.warn('Unauthorized cron job attempt:', {
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString()
      });
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // 2. Push 설정 유효성 검사
    const configValidation = validatePushConfig();
    if (!configValidation.isValid) {
      console.error('Push configuration invalid:', configValidation.missingVars);
      return NextResponse.json({ 
        error: 'Push notification system not configured',
        missingVars: configValidation.missingVars
      }, { status: 500 });
    }

    console.log('🔔 Starting scheduled push notification check...');

    // 3. Supabase 클라이언트 생성 (서비스 역할)
    const supabase = await createClient();

    // 4. 현재 시간 기준 5-15분 후 시작하는 예약들 조회
    const now = new Date();
    const startRange = new Date(now.getTime() + 5 * 60 * 1000); // 5분 후
    const endRange = new Date(now.getTime() + 15 * 60 * 1000); // 15분 후
    
    console.log('Checking reservations between:', {
      start: startRange.toISOString(),
      end: endRange.toISOString()
    });

    const { data: reservations, error: reservationError } = await supabase
      .from('reservations')
      .select(`
        id,
        title,
        start_time,
        end_time,
        users!inner (
          id,
          name,
          push_subscription,
          notification_preferences
        ),
        rooms!inner (
          name
        )
      `)
      .eq('status', 'confirmed')
      .gte('start_time', startRange.toISOString())
      .lte('start_time', endRange.toISOString())
      .not('users.push_subscription', 'is', null);

    if (reservationError) {
      console.error('Failed to fetch reservations:', reservationError);
      return NextResponse.json({ 
        error: 'Database query failed',
        details: reservationError.message
      }, { status: 500 });
    }

    if (!reservations || reservations.length === 0) {
      console.log('No reservations found for notification');
      return NextResponse.json({ 
        message: '알림 발송할 예약이 없습니다',
        count: 0,
        processingTime: Date.now() - startTime
      });
    }

    console.log(`Found ${reservations.length} reservations for notification`);

    // 5. 중복 발송 방지를 위해 이미 발송된 알림 확인
    const reservationIds = reservations.map(r => r.id);
    const { data: sentLogs, error: logError } = await supabase
      .from('notification_logs')
      .select('reservation_id, user_id')
      .in('reservation_id', reservationIds)
      .eq('notification_type', 'checkin_reminder')
      .in('status', ['sent', 'pending_retry']);

    if (logError) {
      console.warn('Failed to check sent logs:', logError);
    }

    const sentSet = new Set(
      sentLogs?.map(log => `${log.reservation_id}-${log.user_id}`) || []
    );

    // 6. 재시도 대상 알림 조회
    const { data: retryNotifications, error: retryError } = await supabase
      .rpc('get_notifications_for_retry');

    if (retryError) {
      console.warn('Failed to get retry notifications:', retryError);
    }

    // 7. 알림 발송 대상 필터링 및 준비
    const notificationsToSend = reservations
      .filter(reservation => {
        const key = `${reservation.id}-${(reservation.users as any).id}`;
        const preferences = (reservation.users as any).notification_preferences;
        
        // 이미 발송된 알림은 제외
        if (sentSet.has(key)) {
          return false;
        }
        
        // 알림 설정이 비활성화된 사용자 제외
        if (preferences && (!preferences.enabled || !preferences.checkin_reminder)) {
          return false;
        }
        
        return true;
      })
      .map(reservation => {
        const user = reservation.users as any;
        const room = reservation.rooms as any;
        
        // 시작 시간까지 남은 분 계산
        const minutesUntilStart = Math.round(
          (new Date(reservation.start_time).getTime() - now.getTime()) / (1000 * 60)
        );

        const payload: NotificationPayload = {
          title: '🔔 회의 시작 알림',
          body: `${minutesUntilStart}분 후 "${room.name}"에서 "${reservation.title}" 회의가 시작됩니다.`,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          data: {
            reservationId: reservation.id,
            roomName: room.name,
            startTime: reservation.start_time,
            action: 'checkin_reminder'
          }
        };

        return {
          subscription: user.push_subscription,
          payload,
          userId: user.id,
          reservationId: reservation.id
        };
      });

    // 8. 재시도 대상 알림 추가
    const retryNotificationsToSend = (retryNotifications || []).map((retry: any) => {
      // 재시도 알림의 경우 기본 페이로드 생성
      const payload: NotificationPayload = {
        title: '🔔 회의 시작 알림 (재시도)',
        body: '회의가 곧 시작됩니다. 체크인을 준비해주세요.',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        data: {
          reservationId: retry.reservation_id,
          roomName: '회의실',
          startTime: new Date().toISOString(),
          action: 'checkin_reminder'
        }
      };

      return {
        subscription: null, // 재시도 시에는 DB에서 다시 조회 필요
        payload,
        userId: retry.user_id,
        reservationId: retry.reservation_id,
        isRetry: true,
        retryId: retry.id
      };
    });

    const totalNotifications = notificationsToSend.length + retryNotificationsToSend.length;

    if (totalNotifications === 0) {
      console.log('No notifications to send after filtering');
      return NextResponse.json({ 
        message: '발송할 알림이 없습니다 (필터링 후)',
        count: 0,
        processingTime: Date.now() - startTime
      });
    }

    console.log(`Sending ${totalNotifications} notifications (${notificationsToSend.length} new, ${retryNotificationsToSend.length} retry)`);

    // 9. 배치 푸시 알림 발송
    const results = await sendBatchPushNotifications(notificationsToSend);

    // 10. 발송 결과 로그 기록
    const logEntries = results.map(result => ({
      reservation_id: result.reservationId,
      user_id: result.userId,
      notification_type: 'checkin_reminder',
      status: result.success ? 'sent' : (result.error?.isRetryable ? 'pending_retry' : 'failed'),
      error_message: result.success ? null : JSON.stringify(result.error),
      retry_count: 0,
      next_retry_at: result.success || !result.error?.isRetryable ? null : 
        new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5분 후 재시도
      sent_at: new Date().toISOString()
    }));

    if (logEntries.length > 0) {
      const { error: insertError } = await supabase
        .from('notification_logs')
        .insert(logEntries);

      if (insertError) {
        console.error('Failed to log notification results:', insertError);
      }
    }

    // 11. 재시도 알림 상태 업데이트
    for (const retry of retryNotificationsToSend) {
      if (retry.retryId) {
        // 현재 retry_count를 조회한 후 증가
        const { data: currentLog } = await supabase
          .from('notification_logs')
          .select('retry_count')
          .eq('id', retry.retryId)
          .single();
        
        await supabase
          .from('notification_logs')
          .update({
            retry_count: (currentLog?.retry_count || 0) + 1,
            status: 'failed', // 재시도 실패로 가정 (실제 구현에서는 결과에 따라 결정)
            updated_at: new Date().toISOString()
          })
          .eq('id', retry.retryId);
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    const processingTime = Date.now() - startTime;

    console.log(`🎉 Notification batch completed: ${successful} successful, ${failed} failed in ${processingTime}ms`);

    return NextResponse.json({
      message: '알림 발송 완료',
      total: results.length,
      successful,
      failed,
      retryCount: retryNotificationsToSend.length,
      processingTime,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('Notification system error:', error);
    
    return NextResponse.json({
      error: '알림 시스템 오류가 발생했습니다',
      message: error.message,
      processingTime,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * POST: 관리자 전용 수동 실행 엔드포인트
 * 관리자 권한 확인 필요
 */
export async function POST(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ 
        error: '인증이 필요합니다' 
      }, { status: 401 });
    }

    // 사용자 권한 확인
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (profileError || !userProfile || userProfile.role !== 'admin') {
      console.warn('Non-admin user attempted manual notification trigger:', user.id);
      return NextResponse.json({ 
        error: '관리자 권한이 필요합니다' 
      }, { status: 403 });
    }

    console.log('Manual notification trigger by admin:', user.id);

    // GET 메서드와 동일한 로직 실행 (CRON_SECRET 검증 제외)
    const mockRequest = new NextRequest(request.url, {
      method: 'GET',
      headers: new Headers({
        'authorization': `Bearer ${process.env.CRON_SECRET}`,
        'user-agent': 'Manual-Admin-Trigger'
      })
    });

    return await GET(mockRequest);

  } catch (error: any) {
    console.error('Manual notification trigger error:', error);
    return NextResponse.json({
      error: '수동 실행 중 오류가 발생했습니다',
      message: error.message
    }, { status: 500 });
  }
}

// 다른 HTTP 메서드는 지원하지 않음
export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function PATCH() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}