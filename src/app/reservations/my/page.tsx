// src/app/reservations/my/page.tsx

'use client';

import { ReservationListView } from '@/features/reservation/components/ReservationListView';
import AppLayout from '@/components/layout/AppLayout';
import { useMyReservations } from '@/hooks/useReservations';
import { useAuth } from '@/hooks/useAuth';
import { Container, Stack, Paper, Group, ThemeIcon, Title, Text, Skeleton, Tabs, Badge } from '@mantine/core';
import { Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function MyReservationsPage() {
  const { userProfile } = useAuth();

  const { data: reservations, isLoading, isError } = useMyReservations(userProfile?.dbId);

  // 예약을 사용자 친화적으로 분류
  const categorizeReservations = (reservations: any[]) => {
    const now = new Date();

    return {
      // 1. '예정된 예약' - 사용자가 행동을 취해야 하거나 현재 이용 중인 예약
      upcoming: reservations.filter(r => {
        const isActive = ['confirmed', 'checked_in', 'overtime'].includes(r.status);
        const isFuture = new Date(r.start_time) > now;
        const isInProgress = ['checked_in', 'overtime'].includes(r.status);

        // 미래 예약이거나 현재 진행 중인 예약
        return isActive && (isFuture || isInProgress);
      }),

      // 2. '이용 내역' - 과거의 모든 기록 (정상 완료 + 노쇼)
      completed: reservations.filter(r =>
        ['completed', 'no_show'].includes(r.status)
      ),

      // 3. '취소 내역' - 사용자가 직접 취소한 예약
      cancelled: reservations.filter(r => r.status === 'cancelled')
    };
  };

  const categorizedReservations = reservations ? categorizeReservations(reservations) : {
    upcoming: [],
    completed: [],
    cancelled: []
  };

  return (
    <AppLayout headerTitle="내 예약 관리">
      <Container my="xl" size="lg">
        <Stack gap="xl">
          {/* 헤더 섹션 */}
          <Paper
            p="xl"
            radius="xl"
            style={{
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              color: 'white'
            }}
          >
            <Group align="center" gap="md">
              <ThemeIcon size="lg" radius="xl" color="white" variant="light" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <Calendar size={24} />
              </ThemeIcon>
              <Stack gap={4}>
                <Title order={2} c="white">
                  내 예약 관리
                </Title>
                <Text c="rgba(255,255,255,0.8)" size="sm">
                  {userProfile?.name || '사용자'}님의 회의실 예약 현황을 확인하고 관리하세요
                </Text>
              </Stack>
            </Group>
          </Paper>

          {/* 탭 섹션 */}
          {isLoading ? (
            <Stack gap="md">
              <Skeleton height={60} radius="xl" />
              <Skeleton height={120} radius="xl" />
              <Skeleton height={120} radius="xl" />
              <Skeleton height={120} radius="xl" />
            </Stack>
          ) : (
            <Tabs
              defaultValue="upcoming"
              radius="lg"
              styles={{
                list: {
                  gap: '4px',
                  [`@media (max-width: 768px)`]: {
                    gap: '2px',
                  }
                },
                tab: {
                  minHeight: '48px',
                  fontSize: '14px',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                  [`@media (max-width: 768px)`]: {
                    minHeight: '44px',
                    fontSize: '12px',
                    padding: '6px 4px',
                  },
                  '&[data-active]': {
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }
                }
              }}
            >
              <Tabs.List grow>
                <Tabs.Tab value="upcoming">
                  <Group gap="xs" align="center" justify="center" wrap="nowrap">
                    <Clock size={14} className="hidden sm:block" />
                    <Clock size={12} className="block sm:hidden" />
                    <Stack gap={2} align="center">
                      <Text size="sm" fw={600} ta="center" className="hidden sm:block">
                        예정된 예약
                      </Text>
                      <Text size="xs" fw={600} ta="center" className="block sm:hidden">
                        예정
                      </Text>
                      <Badge
                        size="xs"
                        variant="filled"
                        color="blue"
                        className="min-w-[20px] h-[18px] text-[10px] sm:min-w-[24px] sm:h-[20px] sm:text-xs"
                      >
                        {categorizedReservations.upcoming.length}
                      </Badge>
                    </Stack>
                  </Group>
                </Tabs.Tab>

                <Tabs.Tab value="completed">
                  <Group gap="xs" align="center" justify="center" wrap="nowrap">
                    <CheckCircle size={14} className="hidden sm:block" />
                    <CheckCircle size={12} className="block sm:hidden" />
                    <Stack gap={2} align="center">
                      <Text size="sm" fw={600} ta="center" className="hidden sm:block">
                        이용 내역
                      </Text>
                      <Text size="xs" fw={600} ta="center" className="block sm:hidden">
                        이용
                      </Text>
                      <Badge
                        size="xs"
                        variant="filled"
                        color="green"
                        className="min-w-[20px] h-[18px] text-[10px] sm:min-w-[24px] sm:h-[20px] sm:text-xs"
                      >
                        {categorizedReservations.completed.length}
                      </Badge>
                    </Stack>
                  </Group>
                </Tabs.Tab>

                <Tabs.Tab value="cancelled">
                  <Group gap="xs" align="center" justify="center" wrap="nowrap">
                    <XCircle size={14} className="hidden sm:block" />
                    <XCircle size={12} className="block sm:hidden" />
                    <Stack gap={2} align="center">
                      <Text size="sm" fw={600} ta="center" className="hidden sm:block">
                        취소 내역
                      </Text>
                      <Text size="xs" fw={600} ta="center" className="block sm:hidden">
                        취소
                      </Text>
                      <Badge
                        size="xs"
                        variant="filled"
                        color="red"
                        className="min-w-[20px] h-[18px] text-[10px] sm:min-w-[24px] sm:h-[20px] sm:text-xs"
                      >
                        {categorizedReservations.cancelled.length}
                      </Badge>
                    </Stack>
                  </Group>
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="upcoming" pt="lg">
                <ReservationListView
                  reservations={categorizedReservations.upcoming}
                  isError={isError}
                  showActions={true}
                />
              </Tabs.Panel>

              <Tabs.Panel value="completed" pt="lg">
                <ReservationListView
                  reservations={categorizedReservations.completed}
                  isError={isError}
                  showActions={false}
                />
              </Tabs.Panel>

              <Tabs.Panel value="cancelled" pt="lg">
                <ReservationListView
                  reservations={categorizedReservations.cancelled}
                  isError={isError}
                  showActions={false}
                />
              </Tabs.Panel>
            </Tabs>
          )}
        </Stack>
      </Container>
    </AppLayout>
  );
}