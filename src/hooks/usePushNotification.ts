/**
 * 푸시 알림 구독 관리 훅
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
import { toast } from 'sonner';
import type { NotificationPreferences } from '@/types/push-notification';

export function usePushNotification() {
  const { user, userProfile } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    checkin_reminder: true,
    minutes_before: 10,
    enabled: true
  });

  const supabase = useSupabaseClient();

  // 브라우저 지원 여부 및 권한 상태 확인
  useEffect(() => {
    const checkSupport = () => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      setIsSupported(supported);
      
      if (supported) {
        setPermission(Notification.permission);
      }
    };

    checkSupport();
  }, []);

  // 사용자 구독 상태 및 설정 확인
  useEffect(() => {
    if (userProfile && isSupported) {
      checkSubscriptionStatus();
      loadNotificationPreferences();
    }
  }, [userProfile, isSupported]);

  /**
   * 현재 구독 상태 확인
   */
  const checkSubscriptionStatus = useCallback(async () => {
    if (!userProfile || !supabase) return;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('push_subscription')
        .eq('id', userProfile.dbId)
        .single();
      
      if (error) {
        console.error('구독 상태 확인 실패:', error);
        return;
      }
      
      const hasSubscription = !!data?.push_subscription;
      setIsSubscribed(hasSubscription);

      // 서비스 워커의 실제 구독 상태와 DB 상태 동기화
      if (hasSubscription && 'serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          
          // DB에는 구독 정보가 있지만 실제 구독이 없는 경우
          if (!subscription) {
            console.warn('DB와 실제 구독 상태 불일치 감지, 동기화 중...');
            await updateSubscriptionInDB(null);
            setIsSubscribed(false);
          }
        } catch (error) {
          console.error('서비스 워커 구독 상태 확인 실패:', error);
        }
      }
    } catch (error) {
      console.error('구독 상태 확인 중 오류:', error);
    }
  }, [userProfile, supabase]);

  /**
   * 알림 설정 로드
   */
  const loadNotificationPreferences = useCallback(async () => {
    if (!userProfile || !supabase) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('notification_preferences')
        .eq('id', userProfile.dbId)
        .single();

      if (error) {
        console.error('알림 설정 로드 실패:', error);
        return;
      }

      if (data?.notification_preferences) {
        setPreferences(data.notification_preferences);
      }
    } catch (error) {
      console.error('알림 설정 로드 중 오류:', error);
    }
  }, [userProfile, supabase]);

  /**
   * 알림 권한 요청
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error('이 브라우저는 푸시 알림을 지원하지 않습니다.');
      return false;
    }
    
    setIsLoading(true);
    
    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      
      if (permission === 'granted') {
        const success = await subscribeToPush();
        if (success) {
          toast.success('푸시 알림이 활성화되었습니다!');
          return true;
        }
      } else if (permission === 'denied') {
        toast.error('알림 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.');
      } else {
        toast.warning('알림 권한 요청이 취소되었습니다.');
      }
      
      return false;
    } catch (error) {
      console.error('권한 요청 실패:', error);
      toast.error('권한 요청 중 오류가 발생했습니다.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  /**
   * 푸시 구독 등록
   */
  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    if (!userProfile || permission !== 'granted') {
      return false;
    }

    try {
      // 서비스 워커 등록 대기
      const registration = await navigator.serviceWorker.ready;
      
      // VAPID 공개키 가져오기
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error('VAPID 공개키가 설정되지 않았습니다.');
      }

      // 푸시 구독 생성
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey
      });

      // 구독 정보를 데이터베이스에 저장
      const success = await updateSubscriptionInDB(subscription.toJSON());
      
      if (success) {
        setIsSubscribed(true);
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('푸시 구독 실패:', error);
      
      if (error.name === 'NotSupportedError') {
        toast.error('이 브라우저는 푸시 알림을 지원하지 않습니다.');
      } else if (error.name === 'NotAllowedError') {
        toast.error('알림 권한이 거부되었습니다.');
      } else {
        toast.error('푸시 알림 설정 중 오류가 발생했습니다.');
      }
      
      return false;
    }
  }, [userProfile, permission]);

  /**
   * 푸시 구독 해제
   */
  const unsubscribeFromPush = useCallback(async (): Promise<boolean> => {
    if (!userProfile) return false;

    setIsLoading(true);

    try {
      // 서비스 워커의 구독 해제
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
          await subscription.unsubscribe();
        }
      }

      // 데이터베이스에서 구독 정보 제거
      const success = await updateSubscriptionInDB(null);
      
      if (success) {
        setIsSubscribed(false);
        toast.success('푸시 알림이 비활성화되었습니다.');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('푸시 구독 해제 실패:', error);
      toast.error('푸시 알림 해제 중 오류가 발생했습니다.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [userProfile]);

  /**
   * 데이터베이스의 구독 정보 업데이트
   */
  const updateSubscriptionInDB = useCallback(async (subscriptionData: any): Promise<boolean> => {
    if (!userProfile || !supabase) return false;

    try {
      const { error } = await supabase
        .from('users')
        .update({
          push_subscription: subscriptionData,
          updated_at: new Date().toISOString()
        })
        .eq('id', userProfile.dbId);

      if (error) {
        console.error('구독 정보 업데이트 실패:', error);
        toast.error('구독 정보 저장에 실패했습니다.');
        return false;
      }

      return true;
    } catch (error) {
      console.error('구독 정보 업데이트 중 오류:', error);
      return false;
    }
  }, [userProfile, supabase]);

  /**
   * 알림 설정 업데이트
   */
  const updateNotificationPreferences = useCallback(async (newPreferences: Partial<NotificationPreferences>): Promise<boolean> => {
    if (!userProfile || !supabase) return false;

    const updatedPreferences = { ...preferences, ...newPreferences };

    try {
      const { error } = await supabase
        .from('users')
        .update({
          notification_preferences: updatedPreferences,
          updated_at: new Date().toISOString()
        })
        .eq('id', userProfile.dbId);

      if (error) {
        console.error('알림 설정 업데이트 실패:', error);
        toast.error('알림 설정 저장에 실패했습니다.');
        return false;
      }

      setPreferences(updatedPreferences);
      toast.success('알림 설정이 저장되었습니다.');
      return true;
    } catch (error) {
      console.error('알림 설정 업데이트 중 오류:', error);
      return false;
    }
  }, [userProfile, preferences, supabase]);

  /**
   * 테스트 알림 발송
   */
  const sendTestNotification = useCallback(async (): Promise<boolean> => {
    if (!isSubscribed) {
      toast.error('먼저 푸시 알림을 활성화해주세요.');
      return false;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        toast.success('테스트 알림이 발송되었습니다!');
        return true;
      } else {
        toast.error(result.message || '테스트 알림 발송에 실패했습니다.');
        return false;
      }
    } catch (error) {
      console.error('테스트 알림 발송 실패:', error);
      toast.error('테스트 알림 발송 중 오류가 발생했습니다.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSubscribed]);

  return {
    // 상태
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    preferences,
    
    // 액션
    requestPermission,
    subscribeToPush,
    unsubscribeFromPush,
    updateNotificationPreferences,
    sendTestNotification,
    
    // 유틸리티
    checkSubscriptionStatus,
    loadNotificationPreferences
  };
}