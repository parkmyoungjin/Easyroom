/**
 * 푸시 알림 설정 컴포넌트
 */

import { useState } from 'react';
import { Button, Switch, Stack, Text, Alert, Card, Group, Select, Divider } from '@mantine/core';
import { IconBell, IconBellOff, IconTestPipe, IconInfoCircle, IconCheck, IconX } from '@tabler/icons-react';
import { usePushNotification } from '@/hooks/usePushNotification';

export function NotificationSettings() {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    preferences,
    requestPermission,
    unsubscribeFromPush,
    updateNotificationPreferences,
    sendTestNotification
  } = usePushNotification();

  const [isTestLoading, setIsTestLoading] = useState(false);

  // 브라우저 미지원 경우
  if (!isSupported) {
    return (
      <Card withBorder>
        <Alert 
          color="yellow" 
          title="푸시 알림 미지원" 
          icon={<IconInfoCircle size={16} />}
        >
          현재 브라우저에서는 푸시 알림을 지원하지 않습니다. 
          Chrome, Firefox, Safari 등의 최신 브라우저를 사용해주세요.
        </Alert>
      </Card>
    );
  }

  // 권한 거부된 경우
  if (permission === 'denied') {
    return (
      <Card withBorder>
        <Alert 
          color="orange" 
          title="알림 권한이 차단되어 있습니다" 
          icon={<IconInfoCircle size={16} />}
        >
          <Stack gap="md">
            <Text size="sm">
              푸시 알림을 받으려면 브라우저에서 알림 권한을 허용해야 합니다.
            </Text>
            
            <div>
              <Text size="sm" fw={500} mb="xs">권한 허용 방법:</Text>
              <Stack gap="xs" style={{ paddingLeft: '1rem' }}>
                <Text size="sm">• 주소창 왼쪽의 🔒 (자물쇠) 아이콘을 클릭</Text>
                <Text size="sm">• "알림" 또는 "Notifications" 설정을 "허용"으로 변경</Text>
                <Text size="sm">• 페이지를 새로고침 (F5 또는 Ctrl+R)</Text>
              </Stack>
            </div>

            <div>
              <Text size="sm" fw={500} mb="xs">브라우저별 설정:</Text>
              <Stack gap="xs" style={{ paddingLeft: '1rem' }}>
                <Text size="sm">• <strong>Chrome:</strong> 설정 → 개인정보 보호 및 보안 → 사이트 설정 → 알림</Text>
                <Text size="sm">• <strong>Firefox:</strong> 설정 → 개인정보 보호 및 보안 → 권한 → 알림</Text>
                <Text size="sm">• <strong>Safari:</strong> 환경설정 → 웹사이트 → 알림</Text>
              </Stack>
            </div>

            <Button
              variant="light"
              size="sm"
              onClick={() => window.location.reload()}
              leftSection={<IconCheck size={16} />}
            >
              권한 설정 후 새로고침
            </Button>
          </Stack>
        </Alert>
      </Card>
    );
  }

  const handleTestNotification = async () => {
    setIsTestLoading(true);
    await sendTestNotification();
    setIsTestLoading(false);
  };

  const handleMinutesChange = (value: number | string) => {
    const minutes = typeof value === 'string' ? parseInt(value) || 10 : value;
    updateNotificationPreferences({ minutes_before: minutes });
  };

  return (
    <Card withBorder>
      <Stack gap="lg">
        <div>
          <Text size="lg" fw={600} mb="xs">
            푸시 알림 설정
          </Text>
          <Text size="sm" c="dimmed">
            회의 시작 전에 알림을 받아 체크인을 놓치지 마세요
          </Text>
        </div>

        {/* 메인 알림 토글 */}
        <Group justify="space-between" align="flex-start">
          <div style={{ flex: 1 }}>
            <Group gap="xs" mb="xs">
              <IconBell size={20} />
              <Text fw={500}>체크인 알림</Text>
              {isSubscribed && (
                <IconCheck size={16} color="green" />
              )}
            </Group>
            <Text size="sm" c="dimmed">
              예약한 회의 시작 전에 푸시 알림을 받습니다
            </Text>
          </div>
          
          {isSubscribed ? (
            <Button
              variant="light"
              color="red"
              leftSection={<IconBellOff size={16} />}
              onClick={unsubscribeFromPush}
              loading={isLoading}
              size="sm"
            >
              알림 끄기
            </Button>
          ) : (
            <Button
              leftSection={<IconBell size={16} />}
              onClick={requestPermission}
              loading={isLoading}
              disabled={permission === 'denied' as NotificationPermission}
              size="sm"
            >
              알림 켜기
            </Button>
          )}
        </Group>

        {/* 알림이 활성화된 경우 세부 설정 */}
        {isSubscribed && (
          <>
            <Divider />
            
            <Stack gap="md">
              <Text fw={500} size="sm">세부 설정</Text>
              
              {/* 알림 시간 설정 */}
              <Group justify="space-between" align="center">
                <div>
                  <Text size="sm" fw={500}>알림 시간</Text>
                  <Text size="xs" c="dimmed">
                    회의 시작 몇 분 전에 알림을 받을지 설정합니다
                  </Text>
                </div>
                <Select
                  value={preferences.minutes_before.toString()}
                  onChange={(value) => handleMinutesChange(parseInt(value || '10'))}
                  data={[
                    { value: '5', label: '5분 전' },
                    { value: '10', label: '10분 전' },
                    { value: '15', label: '15분 전' },
                    { value: '20', label: '20분 전' },
                    { value: '30', label: '30분 전' }
                  ]}
                  size="sm"
                  w={120}
                  disabled={isLoading}
                />
              </Group>

              {/* 알림 활성화 토글 */}
              <Group justify="space-between" align="center">
                <div>
                  <Text size="sm" fw={500}>알림 활성화</Text>
                  <Text size="xs" c="dimmed">
                    체크인 알림을 일시적으로 끄거나 켤 수 있습니다
                  </Text>
                </div>
                <Switch
                  checked={preferences.checkin_reminder}
                  onChange={(event) => 
                    updateNotificationPreferences({ 
                      checkin_reminder: event.currentTarget.checked 
                    })
                  }
                  disabled={isLoading}
                />
              </Group>
            </Stack>

            <Divider />

            {/* 테스트 알림 */}
            <Group justify="space-between" align="center">
              <div>
                <Text size="sm" fw={500}>테스트 알림</Text>
                <Text size="xs" c="dimmed">
                  푸시 알림이 정상적으로 작동하는지 확인해보세요
                </Text>
              </div>
              <Button
                variant="light"
                leftSection={<IconTestPipe size={16} />}
                onClick={handleTestNotification}
                loading={isTestLoading}
                size="sm"
              >
                테스트 발송
              </Button>
            </Group>
          </>
        )}

        {/* 도움말 */}
        <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />}>
          <Text size="sm">
            <strong>알림이 오지 않나요?</strong><br />
            • 브라우저 알림 권한이 허용되어 있는지 확인하세요<br />
            • 기기의 방해 금지 모드가 꺼져 있는지 확인하세요<br />
            • 앱이 백그라운드에서도 알림을 받을 수 있도록 설정하세요
          </Text>
        </Alert>
      </Stack>
    </Card>
  );
}