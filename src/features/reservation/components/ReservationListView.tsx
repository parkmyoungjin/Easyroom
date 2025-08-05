// src/features/reservation/components/ReservationListView.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Accordion, Badge, Group, Text, ActionIcon, Stack, Button, Tooltip } from '@mantine/core';
import { IconPencil, IconTrash, IconCalendar, IconClock, IconMapPin } from '@tabler/icons-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ReservationActionDrawer } from '@/features/reservation/components/ReservationActionDrawer';
import type { ReservationWithDetails } from '@/types/database';

// ✅ Props 인터페이스 정의
interface ReservationListViewProps {
  reservations?: ReservationWithDetails[];
  isError: boolean;
}

// ✅ props로 데이터를 직접 받습니다.
export function ReservationListView({ reservations = [], isError }: ReservationListViewProps) {
  const router = useRouter();
  const [selectedReservation, setSelectedReservation] = useState<ReservationWithDetails | null>(null);

  if (isError) {
    return (
      <Stack align="center" py="xl">
        <Text c="red" ta="center">예약 목록을 불러오는데 실패했습니다.</Text>
      </Stack>
    );
  }

  if (reservations.length === 0) {
    return (
      <Stack align="center" py="xl" gap="md">
        <IconCalendar size={48} color="gray" />
        <Text size="lg" fw={600}>예약이 없습니다</Text>
        <Text c="dimmed" ta="center">새로운 회의실을 예약해보세요.</Text>
        <Button onClick={() => router.push('/reservations/new')}>새 예약하기</Button>
      </Stack>
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
      <Accordion variant="separated">
        {reservations.map((reservation) => (
          <Accordion.Item key={reservation.id} value={reservation.id}>
            <Accordion.Control>
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={4} style={{ flex: 1 }}>
                  <Text fw={500} size="sm" lineClamp={1}>
                    {reservation.title}
                  </Text>
                  <Group gap="xs" wrap="nowrap">
                    <IconClock size={14} color="gray" />
                    <Text size="xs" c="dimmed">
                      {format(new Date(reservation.start_time), 'M월 d일 (E) HH:mm', { locale: ko })}
                      {' - '}
                      {format(new Date(reservation.end_time), 'HH:mm', { locale: ko })}
                    </Text>
                  </Group>
                </Stack>
                <Badge 
                  color={reservation.status === 'confirmed' ? 'blue' : 'gray'}
                  size="sm"
                  style={{ flexShrink: 0 }}
                >
                  {reservation.status === 'confirmed' ? '확정됨' : '취소됨'}
                </Badge>
              </Group>
            </Accordion.Control>
            
            <Accordion.Panel>
              <Stack gap="md">
                <Group gap="xs">
                  <IconMapPin size={16} color="gray" />
                  <Text size="sm">
                    <Text component="span" fw={500}>회의실:</Text> {reservation.room?.name || '알 수 없는 회의실'}
                  </Text>
                </Group>
                
                {reservation.purpose && (
                  <Text size="sm">
                    <Text component="span" fw={500}>목적:</Text> {reservation.purpose}
                  </Text>
                )}
                
                {reservation.status === 'confirmed' && (
                  <Group justify="flex-end" mt="sm">
                    <Tooltip label="예약 수정" withArrow position="top">
                      <ActionIcon 
                        variant="default" 
                        size="lg"
                        onClick={() => handleEdit(reservation)}
                      >
                        <IconPencil size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="예약 취소" withArrow position="top">
                      <ActionIcon 
                        variant="default" 
                        color="red" 
                        size="lg"
                        onClick={() => handleCancel(reservation)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                )}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>

      <ReservationActionDrawer
        opened={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
        reservation={selectedReservation}
      />
    </>
  );
}