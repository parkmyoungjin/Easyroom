"use client";

import { Button, Modal, Text, Group, Stack, Badge } from "@mantine/core";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useCancelReservation } from "@/hooks/useReservations";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ReservationErrorHandler } from "@/lib/utils/error-handler";
import type { PublicReservation } from "@/types/database";

interface ReservationDetailDialogProps {
  reservation: PublicReservation | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ReservationDetailDialog({
  reservation,
  isOpen,
  onClose,
}: ReservationDetailDialogProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { mutate: cancelReservation, isPending: isCancelling } = useCancelReservation();

  if (!reservation) return null;

  const startTime = new Date(reservation.start_time);
  const endTime = new Date(reservation.end_time);
  const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

  const handleEdit = () => {
    router.push(`/reservations/edit/${reservation.id}`);
    onClose();
  };

  const handleCancel = () => {
    if (!window.confirm('정말로 이 예약을 취소하시겠습니까?')) {
      return;
    }

    cancelReservation({ id: reservation.id }, {
      onSuccess: () => {
        toast.success('예약이 취소되었습니다');
        onClose();
      },
      onError: (error) => {
        const reservationError = ReservationErrorHandler.handleReservationError(error, {
          action: 'cancel_reservation',
          reservationId: reservation.id,
          timestamp: new Date().toISOString()
        });

        const userMessage = ReservationErrorHandler.getUserFriendlyMessage(reservationError, 'cancel');

        toast.error(userMessage.title, {
          description: userMessage.description,
        });
      },
    });
  };

  const canModify = isAuthenticated() && reservation.is_mine;
  const isPastReservation = endTime < new Date();

  return (
    <Modal 
      opened={isOpen} 
      onClose={onClose} 
      title="예약 정보" 
      size="md"
      centered
    >
      <Stack gap="md">
        {/* 예약 제목 */}
        <div>
          <Text fw={600} size="lg" c="dark">{reservation.title}</Text>
          {reservation.purpose && (
            <Text size="sm" c="dimmed" mt="xs">{reservation.purpose}</Text>
          )}
        </div>

        {/* 예약 정보 */}
        <Stack gap="sm">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">예약자</Text>
            <Text size="sm">{reservation.user_name}</Text>
          </Group>

          <Group justify="space-between">
            <Text size="sm" c="dimmed">부서</Text>
            <Badge variant="light" size="sm">{reservation.department}</Badge>
          </Group>

          <Group justify="space-between">
            <Text size="sm" c="dimmed">회의실</Text>
            <Text size="sm">{reservation.room_name}</Text>
          </Group>

          <Group justify="space-between">
            <Text size="sm" c="dimmed">날짜</Text>
            <Text size="sm">
              {format(startTime, 'yyyy년 MM월 dd일 (EEEE)', { locale: ko })}
            </Text>
          </Group>

          <Group justify="space-between">
            <Text size="sm" c="dimmed">시간</Text>
            <Text size="sm">
              {format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')} ({duration}분)
            </Text>
          </Group>
        </Stack>

        {/* 액션 버튼 */}
        {canModify && !isPastReservation && (
          <Group justify="flex-end" gap="sm" mt="md">
            <Button variant="outline" onClick={handleEdit}>
              수정
            </Button>
            <Button 
              color="red" 
              onClick={handleCancel}
              loading={isCancelling}
            >
              취소
            </Button>
          </Group>
        )}

        {isPastReservation && (
          <Text size="sm" c="dimmed" ta="center" mt="md">
            종료된 예약입니다
          </Text>
        )}

        {!canModify && !isPastReservation && (
          <Text size="sm" c="dimmed" ta="center" mt="md">
            본인의 예약만 수정/취소할 수 있습니다
          </Text>
        )}
      </Stack>
    </Modal>
  );
}