'use client';

import { useState, useEffect } from 'react';
import { Button, Card, Text, Group, Alert, Switch, Stack } from '@mantine/core';
import { IconBell, IconBellOff, IconCheck, IconX } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export function PushNotificationSubscription() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  const supabase = createClient();

  // 브라우저 지원 여부 및 현재 상태 확인
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window;
      setIsSupported(supported);
      setPermission(Notification.permission);

      if (supported) {
        checkCurrentSubscription();
      }
    }
  }, []);

  // 현재 구독 상태 확인
  const checkCurrentSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const currentSubscription = await registration.pushManager.getSubscription();
      
      if (currentSubscription) {
        setSubscription(currentSubscription);
        setIsSubscribed(true);
        
        // 서버에 구독 정보가 저장되어 있는지 확인
        await syncSubscriptionWithServer(currentSubscription);
      }
    } catch (error) {
      console.error('구독 상태 확인 실패:', error);
    }
  };

  // 서버와 구독 정보 동기화
  const syncSubscriptionWithServer = async (pushSubscription: PushSubscription) => {
    if (!user) return;

    try {
      const subscriptionData: PushSubscriptionData = {
        endpoint: pushSubscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(pushSubscription.getKey('p256dh')!),
          auth: arrayBufferToBase64(pushSubscription.getKey('auth')!)
        }
      };

      const { error } = await supabase
        .from('users')
        .update({
          push_subscription: subscriptionData,
          notification_preferences: {
            enabled: true,
            checkin_reminder: true,
            minutes_before: 10
          }
        })
        .eq('auth_id', user.id);

      if (error) {
        console.error('구독 정보 저장 실패:', error);
      } else {
        console.log('구독 정보가 서버에 저장되었습니다.');
      }
    } catch (error) {
      console.error('서버 동기화 실패:', error);
    }
  };

  // ArrayBuffer를 Base64로 변환
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // 푸시 알림 구독
  const subscribeToPush = async () => {
    if (!isSupported || !user) return;

    setIsLoading(true);

    try {
      // 알림 권한 요청
      const permission = await Notification.requestPermission();
      setPermission(permission);

      if (permission !== 'granted') {
        alert('알림 권한이 필요합니다. 브라우저 설정에서 알림을 허용해주세요.');
        return;
      }

      // Service Worker 등록 확인
      const registration = await navigator.serviceWorker.ready;

      // VAPID 공개키 가져오기
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error('VAPID 공개키가 설정되지 않았습니다.');
      }

      // 푸시 구독 생성
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource
      });

      setSubscription(pushSubscription);
      setIsSubscribed(true);

      // 서버에 구독 정보 저장
      await syncSubscriptionWithServer(pushSubscription);

      alert('푸시 알림 구독이 완료되었습니다! 이제 체크인 알림을 받을 수 있습니다.');

    } catch (error) {
      console.error('푸시 구독 실패:', error);
      alert('푸시 알림 구독에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 푸시 알림 구독 해제
  const unsubscribeFromPush = async () => {
    if (!subscription || !user) return;

    setIsLoading(true);

    try {
      // 브라우저에서 구독 해제
      await subscription.unsubscribe();
      
      // 서버에서 구독 정보 제거
      const { error } = await supabase
        .from('users')
        .update({
          push_subscription: null,
          notification_preferences: {
            enabled: false,
            checkin_reminder: false,
            minutes_before: 10
          }
        })
        .eq('auth_id', user.id);

      if (error) {
        console.error('구독 해제 실패:', error);
      }

      setSubscription(null);
      setIsSubscribed(false);

      alert('푸시 알림 구독이 해제되었습니다.');

    } catch (error) {
      console.error('구독 해제 실패:', error);
      alert('구독 해제에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // Base64 URL을 Uint8Array로 변환
  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  // 테스트 알림 발송
  const sendTestNotification = async () => {
    if (!isSubscribed || !user) return;

    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id
        })
      });

      if (response.ok) {
        alert('테스트 알림이 발송되었습니다!');
      } else {
        alert('테스트 알림 발송에 실패했습니다.');
      }
    } catch (error) {
      console.error('테스트 알림 발송 실패:', error);
      alert('테스트 알림 발송에 실패했습니다.');
    }
  };

  if (!user) {
    return (
      <Alert color="blue" icon={<IconBell size={16} />}>
        푸시 알림을 사용하려면 로그인이 필요합니다.
      </Alert>
    );
  }

  if (!isSupported) {
    return (
      <Alert color="red" icon={<IconX size={16} />}>
        이 브라우저는 푸시 알림을 지원하지 않습니다.
      </Alert>
    );
  }

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Group gap="sm">
            {isSubscribed ? (
              <IconBell size={20} color="green" />
            ) : (
              <IconBellOff size={20} color="gray" />
            )}
            <Text fw={500}>푸시 알림 설정</Text>
          </Group>
          
          <Switch
            checked={isSubscribed}
            onChange={isSubscribed ? unsubscribeFromPush : subscribeToPush}
            disabled={isLoading}
            color="blue"
          />
        </Group>

        <Text size="sm" c="dimmed">
          {isSubscribed 
            ? '체크인 알림을 받을 수 있습니다. 예약 시작 10분 전에 알림이 발송됩니다.'
            : '체크인 알림을 받으려면 푸시 알림을 허용해주세요.'
          }
        </Text>

        {permission === 'denied' && (
          <Alert color="orange" icon={<IconX size={16} />}>
            브라우저에서 알림이 차단되었습니다. 브라우저 설정에서 알림을 허용해주세요.
          </Alert>
        )}

        <Group gap="sm">
          <Button
            variant={isSubscribed ? "light" : "filled"}
            color={isSubscribed ? "red" : "blue"}
            leftSection={isSubscribed ? <IconBellOff size={16} /> : <IconBell size={16} />}
            onClick={isSubscribed ? unsubscribeFromPush : subscribeToPush}
            loading={isLoading}
            fullWidth
          >
            {isSubscribed ? '알림 해제' : '알림 허용'}
          </Button>

          {isSubscribed && (
            <Button
              variant="outline"
              color="blue"
              leftSection={<IconCheck size={16} />}
              onClick={sendTestNotification}
              fullWidth
            >
              테스트 알림 발송
            </Button>
          )}
        </Group>

        {isSubscribed && subscription && (
          <Alert color="green" icon={<IconCheck size={16} />}>
            <Text size="sm">
              구독 완료! 엔드포인트: {subscription.endpoint.substring(0, 50)}...
            </Text>
          </Alert>
        )}
      </Stack>
    </Card>
  );
}