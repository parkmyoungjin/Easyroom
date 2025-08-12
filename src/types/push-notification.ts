/**
 * 푸시 알림 시스템 타입 정의
 */

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: {
    reservationId: string;
    roomName: string;
    startTime: string;
    action: 'checkin_reminder';
  };
}

export interface NotificationPreferences {
  checkin_reminder: boolean;
  minutes_before: number;
  enabled: boolean;
}

export interface NotificationLog {
  id: string;
  reservation_id: string;
  user_id: string;
  notification_type: 'checkin_reminder';
  sent_at: string;
  status: 'sent' | 'failed' | 'pending_retry';
  error_message?: string;
  retry_count?: number;
}

export interface PushNotificationResult {
  success: boolean;
  result?: any;
  error?: any;
}

export interface NotificationStats {
  total: number;
  successful: number;
  failed: number;
  pending_retry: number;
  timestamp: string;
}