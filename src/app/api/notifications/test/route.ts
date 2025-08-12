import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import webpush from 'web-push';

// VAPID 설정
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;
const vapidEmail = process.env.VAPID_EMAIL!;

if (vapidPublicKey && vapidPrivateKey && vapidEmail) {
  webpush.setVapidDetails(
    `mailto:${vapidEmail}`,
    vapidPublicKey,
    vapidPrivateKey
  );
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Supabase 클라이언트 생성
    const supabase = await createClient();

    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 사용자의 푸시 구독 정보 조회
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, push_subscription, notification_preferences')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!userData.push_subscription) {
      return NextResponse.json(
        { error: 'User has no push subscription' },
        { status: 400 }
      );
    }

    // 테스트 알림 페이로드
    const payload = {
      title: '🧪 테스트 알림',
      body: '푸시 알림이 정상적으로 작동합니다!',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      data: {
        url: '/notifications',
        action: 'test_notification'
      }
    };

    // 푸시 알림 발송
    await webpush.sendNotification(
      userData.push_subscription,
      JSON.stringify(payload)
    );

    // 알림 로그 기록
    await supabase
      .from('notification_logs')
      .insert({
        reservation_id: null, // 테스트 알림이므로 null
        user_id: userData.id || user.id,
        notification_type: 'test_notification',
        status: 'sent',
        sent_at: new Date().toISOString()
      });

    return NextResponse.json({
      success: true,
      message: 'Test notification sent successfully'
    });

  } catch (error: any) {
    console.error('Test notification error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to send test notification',
        details: error.message 
      },
      { status: 500 }
    );
  }
}