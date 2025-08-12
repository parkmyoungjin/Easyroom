/**
 * 관리자용 알림 시스템 대시보드
 */

import { useState } from 'react';
import { 
  Card, 
  Stack, 
  Title, 
  Text, 
  Button, 
  Group, 
  Badge, 
  Alert,
  Divider,
  Grid,
  Progress,
  Table,
  ActionIcon,
  Tooltip
} from '@mantine/core';
import { 
  IconBell, 
  IconSend, 
  IconRefresh, 
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconClock,
  IconUsers,
  IconTrendingUp
} from '@tabler/icons-react';
import { useNotificationStats } from '@/hooks/useNotificationHistory';
import { toast } from 'sonner';

export function NotificationDashboard() {
  const [isManualTriggerLoading, setIsManualTriggerLoading] = useState(false);
  const { data: stats, isLoading, refetch } = useNotificationStats(7);

  const handleManualTrigger = async () => {
    setIsManualTriggerLoading(true);
    
    try {
      const response = await fetch('/api/check-and-send-reminders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(`수동 실행 완료: ${result.successful}개 성공, ${result.failed}개 실패`);
        refetch(); // 통계 새로고침
      } else {
        toast.error(result.error || '수동 실행에 실패했습니다');
      }
    } catch (error) {
      console.error('Manual trigger error:', error);
      toast.error('수동 실행 중 오류가 발생했습니다');
    } finally {
      setIsManualTriggerLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card withBorder>
        <Stack gap="md">
          <Title order={3}>알림 시스템 대시보드</Title>
          <Text c="dimmed">로딩 중...</Text>
        </Stack>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card withBorder>
        <Alert color="red" icon={<IconAlertTriangle size={16} />}>
          통계 데이터를 불러올 수 없습니다.
        </Alert>
      </Card>
    );
  }

  const successRate = stats.summary.successRate;
  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return 'green';
    if (rate >= 85) return 'yellow';
    return 'red';
  };

  return (
    <Stack gap="lg">
      {/* 헤더 */}
      <Group justify="space-between" align="center">
        <div>
          <Title order={3}>알림 시스템 대시보드</Title>
          <Text c="dimmed" size="sm">
            최근 {stats.summary.period} 동안의 푸시 알림 통계
          </Text>
        </div>
        <Group gap="sm">
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={() => refetch()}
            size="sm"
          >
            새로고침
          </Button>
          <Button
            leftSection={<IconSend size={16} />}
            onClick={handleManualTrigger}
            loading={isManualTriggerLoading}
            size="sm"
          >
            수동 실행
          </Button>
        </Group>
      </Group>

      {/* 시스템 상태 */}
      <Card withBorder>
        <Stack gap="md">
          <Title order={4}>시스템 상태</Title>
          <Grid>
            <Grid.Col span={6}>
              <Group gap="xs">
                <IconCheck size={16} color={stats.systemHealth.configValid ? 'green' : 'red'} />
                <Text size="sm">
                  VAPID 설정: {stats.systemHealth.configValid ? '정상' : '오류'}
                </Text>
              </Group>
            </Grid.Col>
            <Grid.Col span={6}>
              <Group gap="xs">
                <IconCheck size={16} color={stats.systemHealth.cronSecret ? 'green' : 'red'} />
                <Text size="sm">
                  Cron 보안: {stats.systemHealth.cronSecret ? '설정됨' : '미설정'}
                </Text>
              </Group>
            </Grid.Col>
          </Grid>
        </Stack>
      </Card>

      {/* 주요 통계 */}
      <Grid>
        <Grid.Col span={3}>
          <Card withBorder>
            <Stack gap="xs" align="center">
              <IconBell size={24} color="blue" />
              <Text size="xl" fw={700}>{stats.summary.total}</Text>
              <Text size="sm" c="dimmed">총 발송</Text>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={3}>
          <Card withBorder>
            <Stack gap="xs" align="center">
              <IconCheck size={24} color="green" />
              <Text size="xl" fw={700}>{stats.summary.sent}</Text>
              <Text size="sm" c="dimmed">성공</Text>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={3}>
          <Card withBorder>
            <Stack gap="xs" align="center">
              <IconX size={24} color="red" />
              <Text size="xl" fw={700}>{stats.summary.failed}</Text>
              <Text size="sm" c="dimmed">실패</Text>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={3}>
          <Card withBorder>
            <Stack gap="xs" align="center">
              <IconClock size={24} color="orange" />
              <Text size="xl" fw={700}>{stats.summary.pending_retry}</Text>
              <Text size="sm" c="dimmed">재시도 대기</Text>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* 성공률 */}
      <Card withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={4}>성공률</Title>
            <Badge color={getSuccessRateColor(successRate)} size="lg">
              {successRate}%
            </Badge>
          </Group>
          <Progress 
            value={successRate} 
            color={getSuccessRateColor(successRate)}
            size="lg"
          />
        </Stack>
      </Card>

      {/* 구독 현황 */}
      <Card withBorder>
        <Stack gap="md">
          <Title order={4}>구독 현황</Title>
          <Grid>
            <Grid.Col span={4}>
              <Group gap="xs">
                <IconUsers size={16} />
                <Text size="sm">총 구독자: {stats.subscriptions.total}명</Text>
              </Group>
            </Grid.Col>
            <Grid.Col span={4}>
              <Group gap="xs">
                <IconCheck size={16} color="green" />
                <Text size="sm">활성: {stats.subscriptions.enabled}명</Text>
              </Group>
            </Grid.Col>
            <Grid.Col span={4}>
              <Group gap="xs">
                <IconX size={16} color="red" />
                <Text size="sm">비활성: {stats.subscriptions.disabled}명</Text>
              </Group>
            </Grid.Col>
          </Grid>
        </Stack>
      </Card>

      {/* 최근 실패 */}
      {stats.recentFailures && stats.recentFailures.length > 0 && (
        <Card withBorder>
          <Stack gap="md">
            <Title order={4}>최근 실패한 알림</Title>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>시간</Table.Th>
                  <Table.Th>사용자</Table.Th>
                  <Table.Th>예약</Table.Th>
                  <Table.Th>재시도</Table.Th>
                  <Table.Th>오류</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {stats.recentFailures.map((failure: any) => (
                  <Table.Tr key={failure.id}>
                    <Table.Td>
                      <Text size="sm">
                        {new Date(failure.sent_at).toLocaleString('ko-KR')}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{failure.users.name}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" truncate>
                        {failure.reservations.title}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color="orange" size="sm">
                        {failure.retry_count}회
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label={failure.error_message}>
                        <ActionIcon variant="subtle" size="sm">
                          <IconAlertTriangle size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        </Card>
      )}

      {/* 재시도 대기 */}
      {stats.pendingRetries && stats.pendingRetries.length > 0 && (
        <Card withBorder>
          <Stack gap="md">
            <Title order={4}>재시도 대기 중</Title>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>다음 재시도</Table.Th>
                  <Table.Th>사용자</Table.Th>
                  <Table.Th>예약</Table.Th>
                  <Table.Th>시도 횟수</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {stats.pendingRetries.map((retry: any) => (
                  <Table.Tr key={retry.id}>
                    <Table.Td>
                      <Text size="sm">
                        {new Date(retry.next_retry_at).toLocaleString('ko-KR')}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{retry.users.name}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" truncate>
                        {retry.reservations.title}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color="blue" size="sm">
                        {retry.retry_count}/3
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}