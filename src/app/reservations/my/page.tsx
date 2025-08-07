// src/app/reservations/my/page.tsx

'use client';

import { ReservationListView } from '@/features/reservation/components/ReservationListView';
import AppLayout from '@/components/layout/AppLayout';
import { useMyReservations } from '@/hooks/useReservations';
import { useAuth } from '@/hooks/useAuth';
import { Container, Stack, Paper, Group, ThemeIcon, Title, Text, Skeleton, Tabs } from '@mantine/core';
import { Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function MyReservationsPage() {
  const { userProfile } = useAuth();

  const { data: reservations, isLoading, isError } = useMyReservations(userProfile?.dbId);

  // 예약을 상태별로 분류
  const categorizeReservations = (reservations: any[]) => {
    const now = new Date();

    return {
      upcoming: reservations.filter(r =>
        r.status === 'confirmed' && new Date(r.start_time) > now
      ),
      completed: reservations.filter(r =>
        r.status === 'confirmed' && new Date(r.end_time) <= now
      ),
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
            <Tabs defaultValue="upcoming" radius="lg">
              <Tabs.List grow>
                <Tabs.Tab
                  value="upcoming"
                  leftSection={<Clock size={16} />}
                >
                  예약 ({categorizedReservations.upcoming.length})
                </Tabs.Tab>
                <Tabs.Tab
                  value="completed"
                  leftSection={<CheckCircle size={16} />}
                >
                  완료 ({categorizedReservations.completed.length})
                </Tabs.Tab>
                <Tabs.Tab
                  value="cancelled"
                  leftSection={<XCircle size={16} />}
                >
                  취소 ({categorizedReservations.cancelled.length})
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