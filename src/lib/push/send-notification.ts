/**
 * 푸시 알림 발송 유틸리티
 */

import webpush from 'web-push';
import type { PushSubscriptionData, NotificationPayload, PushNotificationResult } from '@/types/push-notification';

/**
 * 단일 사용자에게 푸시 알림 발송
 */
export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: NotificationPayload
): Promise<PushNotificationResult> {
  try {
    // 구독 정보 유효성 검사
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      throw new Error('Invalid push subscription data');
    }

    // 페이로드 유효성 검사
    if (!payload?.title || !payload?.body) {
      throw new Error('Invalid notification payload: title and body are required');
    }

    // 푸시 알림 발송
    const result = await webpush.sendNotification(
      subscription,
      JSON.stringify(payload),
      {
        TTL: 60 * 60 * 24, // 24시간 TTL
        urgency: 'high',   // 높은 우선순위
        topic: 'checkin-reminder' // 중복 알림 방지를 위한 토픽
      }
    );
    
    console.log('Push notification sent successfully:', {
      endpoint: subscription.endpoint.substring(0, 50) + '...',
      statusCode: result.statusCode,
      title: payload.title
    });

    return { 
      success: true, 
      result: {
        statusCode: result.statusCode,
        headers: result.headers,
        body: result.body
      }
    };

  } catch (error: any) {
    console.error('Push notification failed:', {
      endpoint: subscription?.endpoint?.substring(0, 50) + '...',
      error: error.message,
      statusCode: error.statusCode,
      title: payload?.title
    });

    // 에러 타입별 분류
    const errorInfo = {
      message: error.message,
      statusCode: error.statusCode,
      isRetryable: isRetryableError(error)
    };

    return { 
      success: false, 
      error: errorInfo
    };
  }
}

/**
 * 여러 사용자에게 배치로 푸시 알림 발송
 */
export async function sendBatchPushNotifications(
  notifications: Array<{
    subscription: PushSubscriptionData;
    payload: NotificationPayload;
    userId: string;
    reservationId: string;
  }>
): Promise<Array<{
  userId: string;
  reservationId: string;
  success: boolean;
  result?: any;
  error?: any;
}>> {
  console.log(`Sending batch push notifications to ${notifications.length} users`);

  // 병렬 처리로 성능 최적화 (최대 10개씩 동시 처리)
  const batchSize = 10;
  const results: Array<{
    userId: string;
    reservationId: string;
    success: boolean;
    result?: any;
    error?: any;
  }> = [];

  for (let i = 0; i < notifications.length; i += batchSize) {
    const batch = notifications.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async ({ subscription, payload, userId, reservationId }) => {
      const result = await sendPushNotification(subscription, payload);
      return {
        userId,
        reservationId,
        success: result.success,
        result: result.result,
        error: result.error
      };
    });

    const batchResults = await Promise.allSettled(batchPromises);
    
    // Promise.allSettled 결과 처리
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        const notification = batch[index];
        results.push({
          userId: notification.userId,
          reservationId: notification.reservationId,
          success: false,
          error: { message: result.reason?.message || 'Unknown error' }
        });
      }
    });

    // 배치 간 짧은 지연 (서버 부하 방지)
    if (i + batchSize < notifications.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.length - successful;

  console.log(`Batch push notification completed: ${successful} successful, ${failed} failed`);

  return results;
}

/**
 * 에러가 재시도 가능한지 판단
 */
function isRetryableError(error: any): boolean {
  // HTTP 상태 코드 기반 재시도 가능 여부 판단
  const statusCode = error.statusCode;
  
  if (!statusCode) return true; // 네트워크 오류 등은 재시도 가능
  
  // 5xx 서버 오류는 재시도 가능
  if (statusCode >= 500 && statusCode < 600) {
    return true;
  }
  
  // 429 Too Many Requests는 재시도 가능
  if (statusCode === 429) {
    return true;
  }
  
  // 408 Request Timeout은 재시도 가능
  if (statusCode === 408) {
    return true;
  }
  
  // 4xx 클라이언트 오류는 대부분 재시도 불가능
  // 단, 410 Gone (구독 만료)은 특별 처리 필요
  if (statusCode === 410) {
    console.warn('Push subscription expired (410 Gone)');
    return false;
  }
  
  // 기타 4xx 오류는 재시도 불가능
  if (statusCode >= 400 && statusCode < 500) {
    return false;
  }
  
  // 기본적으로 재시도 가능으로 처리
  return true;
}

/**
 * 테스트용 알림 발송
 */
export async function sendTestNotification(
  subscription: PushSubscriptionData,
  userName?: string
): Promise<PushNotificationResult> {
  const payload: NotificationPayload = {
    title: '🔔 테스트 알림',
    body: `안녕하세요${userName ? ` ${userName}님` : ''}! 푸시 알림이 정상적으로 작동합니다.`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: {
      reservationId: 'test',
      roomName: '테스트룸',
      startTime: new Date().toISOString(),
      action: 'checkin_reminder'
    }
  };

  return sendPushNotification(subscription, payload);
}