/**
 * 알림 히스토리 및 설정 통합 페이지
 */

'use client';

import { useState } from 'react';
import {
  Container,
  Stack,
  Title,
  Text,
  Paper,
  Tabs,
  Group,
  ThemeIcon,
  Badge,
  Table,
  Button,
  Select,
  Pagination,
  Alert,
  Skeleton,
  ActionIcon,
  Tooltip
} from '@mantine/core';
import {
  Bell,
  Settings,
  History,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { PushNotificationSubscription } from '@/components/notifications/PushNotificationSubscription';
import { useNotificationHistory } from '@/hooks/useNotificationHistory';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState('settings');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Mantine Tabs와 React useState 간의 타입 호환성을 위한 핸들러
  const handleTabChange = (value: string | null) => {
    // null이 오면 기본값으로 처리하여 타입 안전성 보장
    if (value === null) {
      setActiveTab('settings'); // 기본 탭으로 복귀
    } else {
      setActiveTab(value);
    }
  };

  const {
    notifications,
    stats,
    pagination,
    isLoading,
    isError,
    error,
    updateFilters,
    refresh,
    hasMore,
    isEmpty
  } = useNotificationHistory({
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
    status: statusFilter as any
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle size={16} color="green" />;
      case 'failed':
        return <XCircle size={16} color="red" />;
      case 'pending_retry':
        return <Clock size={16} color="orange" />;
      default:
        return <AlertTriangle size={16} color="gray" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      sent: { color: 'green', label: '발송 완료' },
      failed: { color: 'red', label: '발송 실패' },
      pending_retry: { color: 'orange', label: '재시도 대기' }
    };

    const { color, label } = config[status as keyof typeof config] || { color: 'gray', label: '알 수 없음' };
    
    return (
      <Badge color={color} variant="light" size="sm">
        {label}
      </Badge>
    );
  };

  const handleStatusFilterChange = (value: string | null) => {
    setStatusFilter(value || '');
    setCurrentPage(1);
    updateFilters({ status: value as any });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'MM월 dd일 HH:mm', { locale: ko });
  };

  return (
    <AppLayout headerTitle="알림 관리">
      <Container my="xl" size="lg">
        <Stack gap="xl">
          {/* 헤더 */}
          <Paper
            p="xl"
            radius="xl"
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              color: 'white'
            }}
          >
            <Group align="center" gap="md">
              <ThemeIcon size="lg" radius="xl" color="white" variant="light" 
                style={{ background: 'rgba(255,255,255,0.2)' }}>
                <Bell size={24} />
              </ThemeIcon>
              <Stack gap={4}>
                <Title order={2} c="white">
                  알림 관리
                </Title>
                <Text c="rgba(255,255,255,0.8)" size="sm">
                  푸시 알림 설정을 관리하고 발송 내역을 확인하세요
                </Text>
              </Stack>
            </Group>
          </Paper>

          {/* 탭 메뉴 */}
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tabs.List>
              <Tabs.Tab value="settings" leftSection={<Settings size={16} />}>
                알림 설정
              </Tabs.Tab>
              <Tabs.Tab value="history" leftSection={<History size={16} />}>
                발송 내역
                {stats && (
                  <Badge color="blue" variant="light" size="xs" ml="xs">
                    {stats.total}
                  </Badge>
                )}
              </Tabs.Tab>
            </Tabs.List>

            {/* 알림 설정 탭 */}
            <Tabs.Panel value="settings" pt="md">
              <Stack gap="lg">
                <PushNotificationSubscription />
                <NotificationSettings />
              </Stack>
            </Tabs.Panel>

            {/* 발송 내역 탭 */}
            <Tabs.Panel value="history" pt="md">
              <Stack gap="lg">
                {/* 통계 카드 */}
                {stats && (
                  <Group grow>
                    <Paper p="md" withBorder radius="lg">
                      <Stack gap="xs" align="center">
                        <CheckCircle size={24} color="green" />
                        <Text size="xl" fw={700}>{stats.sent}</Text>
                        <Text size="sm" c="dimmed">발송 성공</Text>
                      </Stack>
                    </Paper>
                    <Paper p="md" withBorder radius="lg">
                      <Stack gap="xs" align="center">
                        <XCircle size={24} color="red" />
                        <Text size="xl" fw={700}>{stats.failed}</Text>
                        <Text size="sm" c="dimmed">발송 실패</Text>
                      </Stack>
                    </Paper>
                    <Paper p="md" withBorder radius="lg">
                      <Stack gap="xs" align="center">
                        <Clock size={24} color="orange" />
                        <Text size="xl" fw={700}>{stats.pending_retry}</Text>
                        <Text size="sm" c="dimmed">재시도 대기</Text>
                      </Stack>
                    </Paper>
                  </Group>
                )}

                {/* 필터 및 새로고침 */}
                <Group justify="space-between">
                  <Select
                    placeholder="상태별 필터"
                    value={statusFilter}
                    onChange={handleStatusFilterChange}
                    data={[
                      { value: '', label: '전체' },
                      { value: 'sent', label: '발송 완료' },
                      { value: 'failed', label: '발송 실패' },
                      { value: 'pending_retry', label: '재시도 대기' }
                    ]}
                    clearable
                    w={200}
                  />
                  <Tooltip label="새로고침">
                    <ActionIcon
                      variant="light"
                      onClick={refresh}
                      loading={isLoading}
                    >
                      <RefreshCw size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>

                {/* 알림 내역 테이블 */}
                <Paper withBorder radius="lg">
                  {isError ? (
                    <Alert color="red" icon={<AlertTriangle size={16} />} m="md">
                      알림 내역을 불러오는 중 오류가 발생했습니다.
                      <br />
                      <Text size="sm" c="dimmed">{error?.message}</Text>
                    </Alert>
                  ) : isLoading ? (
                    <Stack gap="md" p="md">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Skeleton key={index} height={60} radius="md" />
                      ))}
                    </Stack>
                  ) : isEmpty ? (
                    <Stack align="center" gap="md" p="xl">
                      <Bell size={48} color="var(--mantine-color-gray-5)" />
                      <Stack align="center" gap="xs">
                        <Text size="lg" fw={500} c="dimmed">
                          알림 내역이 없습니다
                        </Text>
                        <Text size="sm" c="dimmed">
                          알림을 활성화하면 발송 내역이 여기에 표시됩니다
                        </Text>
                      </Stack>
                    </Stack>
                  ) : (
                    <>
                      <Table>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>상태</Table.Th>
                            <Table.Th>회의 정보</Table.Th>
                            <Table.Th>회의실</Table.Th>
                            <Table.Th>발송 시간</Table.Th>
                            <Table.Th>재시도</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {notifications.map((notification) => (
                            <Table.Tr key={notification.id}>
                              <Table.Td>
                                <Group gap="xs">
                                  {getStatusIcon(notification.status)}
                                  {getStatusBadge(notification.status)}
                                </Group>
                              </Table.Td>
                              <Table.Td>
                                <Stack gap="xs">
                                  <Text size="sm" fw={500} lineClamp={1}>
                                    {notification.reservations.title}
                                  </Text>
                                  <Text size="xs" c="dimmed">
                                    {formatDateTime(notification.reservations.start_time)}
                                  </Text>
                                </Stack>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">
                                  {notification.reservations.rooms.name}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">
                                  {formatDateTime(notification.sent_at)}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                {notification.retry_count > 0 ? (
                                  <Badge color="orange" variant="light" size="sm">
                                    {notification.retry_count}회
                                  </Badge>
                                ) : (
                                  <Text size="sm" c="dimmed">-</Text>
                                )}
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>

                      {/* 페이지네이션 */}
                      {pagination && pagination.total > pageSize && (
                        <Group justify="center" p="md">
                          <Pagination
                            value={currentPage}
                            onChange={handlePageChange}
                            total={Math.ceil(pagination.total / pageSize)}
                            size="sm"
                          />
                        </Group>
                      )}
                    </>
                  )}
                </Paper>
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Container>
    </AppLayout>
  );
}