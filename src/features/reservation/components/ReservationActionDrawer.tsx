'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer, Stack, Button, Text, Group, rem } from '@mantine/core';
import { Edit2, Trash2, X } from 'lucide-react';
import { ReservationCancelDialog } from './ReservationCancelDialog';
import type { ReservationWithDetails } from '@/types/database';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ReservationActionDrawerProps {
  opened: boolean;
  onClose: () => void;
  reservation: ReservationWithDetails | null;
}

export function ReservationActionDrawer({
  opened,
  onClose,
  reservation,
}: ReservationActionDrawerProps) {
  const router = useRouter();
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  if (!reservation) return null;

  const handleEdit = () => {
    router.push(`/reservations/edit/${reservation.id}`);
    onClose();
  };

  const handleCancel = () => {
    setShowCancelDialog(true);
  };

  const handleCancelDialogClose = (open: boolean) => {
    setShowCancelDialog(open);
    if (!open) {
      onClose(); // Drawer도 함께 닫기
    }
  };

  const isConfirmed = reservation.status === 'confirmed';

  return (
    <>
      <Drawer
        opened={opened}
        onClose={onClose}
        position="bottom"
        radius="md"
        size="auto"
        styles={{
          content: {
            maxHeight: '50vh',
          },
          header: {
            paddingBottom: rem(8),
          },
          body: {
            paddingTop: 0,
          },
        }}
        overlayProps={{
          backgroundOpacity: 0.5,
          blur: 4,
        }}
      >
        <Drawer.Header>
          <Drawer.Title>
            <div>
              <Text size="lg" fw={600} lineClamp={1} c="dark">
                {reservation.title}
              </Text>
              <Text size="sm" c="dimmed" mt={4}>
                {format(new Date(reservation.start_time), 'yyyy년 MM월 dd일 (EEE) HH:mm', { locale: ko })}
                {' ~ '}
                {format(new Date(reservation.end_time), 'HH:mm', { locale: ko })}
              </Text>
              <Text size="sm" c="dimmed">
                {reservation.room?.name || '알 수 없는 회의실'}
              </Text>
            </div>
          </Drawer.Title>
          <Drawer.CloseButton />
        </Drawer.Header>

        <Drawer.Body>
          <Stack gap="md">
            {isConfirmed && (
              <>
                <Button
                  variant="light"
                  leftSection={<Edit2 size={18} />}
                  onClick={handleEdit}
                  fullWidth
                  size="md"
                  styles={{
                    root: {
                      height: rem(48),
                    },
                  }}
                >
                  예약 수정
                </Button>

                <Button
                  variant="light"
                  color="red"
                  leftSection={<Trash2 size={18} />}
                  onClick={handleCancel}
                  fullWidth
                  size="md"
                  styles={{
                    root: {
                      height: rem(48),
                    },
                  }}
                >
                  예약 취소
                </Button>
              </>
            )}

            <Button
              variant="subtle"
              color="gray"
              leftSection={<X size={18} />}
              onClick={onClose}
              fullWidth
              size="md"
              styles={{
                root: {
                  height: rem(48),
                },
              }}
            >
              닫기
            </Button>
          </Stack>
        </Drawer.Body>
      </Drawer>

      {/* 예약 취소 다이얼로그 */}
      {showCancelDialog && reservation && (
        <ReservationCancelDialog
          reservation={reservation}
          open={showCancelDialog}
          onOpenChange={handleCancelDialogClose}
        />
      )}
    </>
  );
}