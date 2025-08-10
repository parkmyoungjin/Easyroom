// src/features/reservation/components/ReservationListView.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Paper, Badge, Group, Text, ActionIcon, Stack, Button,
  ThemeIcon, useMantineColorScheme, SimpleGrid, Title, Divider
} from '@mantine/core';
import {
  Edit, Trash2, Calendar, Clock, MapPin, Plus,
  CalendarX, CheckCircle, XCircle
} from 'lucide-react';
import { CheckInOutButton } from '@/components/reservations/CheckInOutButton';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ReservationActionDrawer } from '@/features/reservation/components/ReservationActionDrawer';
import type { ReservationWithDetails } from '@/types/database';

// ✅ Props 인터페이스 정의
interface ReservationListViewProps {
  reservations?: ReservationWithDetails[];
  isError: boolean;
  showActions?: boolean;
}

// ✅ props로 데이터를 직접 받습니다.
export function ReservationListView({ reservations = [], isError, showActions = true }: ReservationListViewProps) {
  const router = useRouter();
  const { colorScheme } = useMantineColorScheme();
  const [selectedReservation, setSelectedReservation] = useState<ReservationWithDetails | null>(null);

  if (isError) {
    return (
      <Paper
        p="xl"
        radius="xl"
        style={{
          border: colorScheme === 'dark' ? '2px solid rgba(255, 0, 0, 0.3)' : '2px solid #dc2626'
        }}
      >
        <Stack align="center" gap="md">
          <ThemeIcon size="xl" radius="xl" color="red" variant="light">
            <XCircle size={32} />
          </ThemeIcon>
          <Title order={3} c="red">오류 발생</Title>
          <Text c="dimmed" ta="center">예약 목록을 불러오는데 실패했습니다.</Text>
        </Stack>
      </Paper>
    );
  }

  if (reservations.length === 0) {
    return (
      <Paper
        p="xl"
        radius="xl"
        style={{
          border: colorScheme === 'dark' ? '2px solid rgba(255, 255, 255, 0.3)' : '2px solid #4f46e5'
        }}
      >
        <Stack align="center" gap="lg">
          <ThemeIcon size="xl" radius="xl" color="blue" variant="light">
            <CalendarX size={32} />
          </ThemeIcon>
          <Stack align="center" gap="xs">
            <Title order={3}>예약이 없습니다</Title>
            <Text c="dimmed" ta="center">새로운 회의실을 예약해보세요.</Text>
          </Stack>
          <Button
            size="lg"
            radius="xl"
            leftSection={<Plus size={18} />}
            onClick={() => router.push('/reservations/new')}
          >
            새 예약하기
          </Button>
        </Stack>
      </Paper>
    );
  }

  const handleEdit = (reservation: ReservationWithDetails) => {
    setSelectedReservation(reservation);
  };

  const handleCancel = (reservation: ReservationWithDetails) => {
    setSelectedReservation(reservation);
  };

  return (
    <>
      <Stack gap="md">
        {reservations.map((reservation) => (
          <Paper
            key={reservation.id}
            shadow="lg"
            p="xl"
            radius="xl"
            style={{
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: colorScheme === 'dark' ? '2px solid rgba(255, 255, 255, 0.3)' : '2px solid #e5e7eb',
              background: 'var(--mantine-color-body)',
            }}
            styles={{
              root: {
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  borderColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.5)' : '#4f46e5',
                },
              },
            }}
          >
            <Stack gap="md">
              {/* 헤더 영역 */}
              <Group align="center" gap="md">
                <ThemeIcon
                  size="lg"
                  radius="xl"
                  color={reservation.status === 'confirmed' ? 'blue' : 'gray'}
                  variant="light"
                >
                  {reservation.status === 'confirmed' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                </ThemeIcon>
                <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                  <Title order={4} lineClamp={1}>
                    {reservation.title}
                  </Title>
                  <Group gap="xs" align="center">
                    <Text size="sm" fw={500} c="dark">
                      {format(new Date(reservation.start_time), 'M월 d일 (E)', { locale: ko })}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {format(new Date(reservation.start_time), 'HH:mm', { locale: ko })}
                      {' - '}
                      {format(new Date(reservation.end_time), 'HH:mm', { locale: ko })}
                    </Text>
                  </Group>
                </Stack>
              </Group>

              <Divider />

              {/* 모바일 친화적 액션 버튼 영역 */}
              <Stack gap="sm">
                {/* 체크인/체크아웃 버튼 - 전체 너비로 강조 */}
                <CheckInOutButton
                  reservationId={reservation.id}
                  startTime={reservation.start_time}
                  endTime={reservation.end_time}
                  roomName={reservation.room?.name || '회의실'}
                  size="sm"
                  variant="default"
                  className="w-full"
                />

                {/* 편집/삭제 버튼 - 하단에 작게 배치 */}
                {showActions && reservation.status === 'confirmed' && (
                  <Group justify="flex-end" gap="xs">
                    <Button
                      variant="light"
                      color="blue"
                      size="xs"
                      radius="xl"
                      leftSection={<Edit size={14} />}
                      onClick={() => handleEdit(reservation)}
                    >
                      수정
                    </Button>
                    <Button
                      variant="light"
                      color="red"
                      size="xs"
                      radius="xl"
                      leftSection={<Trash2 size={14} />}
                      onClick={() => handleCancel(reservation)}
                    >
                      취소
                    </Button>
                  </Group>
                )}
              </Stack>

              <Divider />

              {/* 정보 영역 */}
              <Group gap="xs" align="flex-start">
                <ThemeIcon size="sm" radius="xl" color="orange" variant="light">
                  <MapPin size={14} />
                </ThemeIcon>
                <Stack gap={2}>
                  <Text size="xs" c="dimmed" fw={500}>회의실</Text>
                  <Group gap="xs" align="center">
                    <Text size="sm" fw={500} c="dark">
                      {reservation.room?.name || '알 수 없는 회의실'}
                    </Text>
                    {reservation.room?.capacity && (
                      <Text size="sm" c="dimmed">
                        ({reservation.room.capacity}인실)
                      </Text>
                    )}
                  </Group>
                </Stack>
              </Group>

              {reservation.purpose && (
                <>
                  <Divider />
                  <Group gap="xs" align="flex-start">
                    <ThemeIcon size="sm" radius="xl" color="gray" variant="light">
                      <Calendar size={14} />
                    </ThemeIcon>
                    <Stack gap={2}>
                      <Text size="xs" c="dimmed" fw={500}>회의 목적</Text>
                      <Text size="sm">{reservation.purpose}</Text>
                    </Stack>
                  </Group>
                </>
              )}
            </Stack>
          </Paper>
        ))}
      </Stack>

      <ReservationActionDrawer
        opened={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
        reservation={selectedReservation}
      />
    </>
  );
}