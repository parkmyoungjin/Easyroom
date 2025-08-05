'use client';

import { useState } from 'react';
import { Modal, Button as MantineButton, Textarea as MantineTextarea, Text, Stack, Group } from '@mantine/core';
import { useCancelReservation } from '@/hooks/useReservations';
import { Reservation } from '@/types/database';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { logger } from '@/lib/utils/logger';
import { canCancelReservation, getPermissionErrorMessage } from '@/lib/utils/reservation-permissions';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
import { useAuth } from '@/hooks/useAuth';
import { ReservationErrorHandler } from '@/lib/utils/error-handler';

interface ReservationCancelDialogProps {
  reservation: Reservation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReservationCancelDialog({ reservation, open, onOpenChange }: ReservationCancelDialogProps) {
  const { mutate: cancelReservation, isPending } = useCancelReservation();

  const { userProfile } = useAuth();
  const supabase = useSupabaseClient();
  const [cancelReason, setCancelReason] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const handleCancel = () => {
    if (!confirmStep) {
      setConfirmStep(true);
      return;
    }

    // ✅ 권한 검증 로직 사용
    if (!userProfile) {
      toast.error("인증 오류", {
        description: "사용자 정보를 확인할 수 없습니다.",
      });
      return;
    }

    const permissionResult = canCancelReservation(reservation as any, userProfile);
    
    // ✅ 잘못된 user_id 자동 수정 로직
    if (permissionResult.allowed && permissionResult.details.isOwnerByAuthId && !permissionResult.details.isOwnerByDbId && userProfile.dbId) {
      logger.debug('잘못된 user_id 감지, 자동 수정 시도', {
        reservationId: reservation.id,
        currentUserId: reservation.user_id,
        correctDbId: userProfile.dbId
      });
      
      // 백그라운드에서 user_id 수정 (실패해도 취소는 계속)
      if (supabase) {
        import('@/lib/utils/reservation-permissions').then(({ fixReservationUserId }) => {
          fixReservationUserId(supabase, reservationId, userProfile.dbId!).then(success => {
            if (success) {
              logger.debug('예약 user_id 자동 수정 완료', {
                reservationId,
                newUserId: userProfile.dbId
              });
            }
          });
        });
      }
    }
    
    if (!permissionResult.allowed) {
      const errorMessage = getPermissionErrorMessage('cancel', permissionResult.reason || 'unknown');
      toast.error(errorMessage.title, {
        description: errorMessage.description,
      });
      setConfirmStep(false);
      return;
    }

    const reason = cancelReason.trim();
    
    // ✅ 안전하게 ID 추출
    const reservationId = typeof reservation.id === 'string' ? reservation.id : String(reservation.id);
    
    // ✅ 디버깅: 예약 취소 요청 시작
    const startTime = new Date(reservation.start_time);
    const now = new Date();
    const timeDiff = startTime.getTime() - now.getTime();
    const minutesDiff = Math.floor(timeDiff / (1000 * 60));
    
    logger.debug('예약 취소 요청 시작', {
      reservationId,
      reservationUserId: reservation.user_id,
      reservationTitle: reservation.title,
      cancelReason: reason,
      minutesUntilStart: minutesDiff
    });
    
    cancelReservation(
      {
        id: reservationId,
        reason: reason || undefined,
      },
      {
        onSuccess: () => {
          logger.debug('예약 취소 성공', {
            reservationId,
            cancelReason: reason
          });
          
          toast.success("취소 완료", {
            description: "예약이 취소되었습니다.",
          });
          onOpenChange(false);
          setConfirmStep(false);
          setCancelReason('');
        },
        onError: (error) => {
          // ✅ 구조화된 오류 처리 시스템 사용
          const reservationError = ReservationErrorHandler.handleReservationError(error, {
            action: 'cancel',
            reservationId,
            userId: userProfile?.authId,
            userRole: userProfile?.role,
            timestamp: new Date().toISOString(),
            retryCount,
          });
          
          const userMessage = ReservationErrorHandler.getUserFriendlyMessage(reservationError, 'cancel');
          
          // 네트워크 오류이고 재시도 횟수가 3회 미만인 경우 재시도 옵션 제공
          if (reservationError.type === 'network' && retryCount < 3) {
            toast.error(userMessage.title, {
              description: `${userMessage.description} (재시도 ${retryCount + 1}/3)`,
              action: {
                label: "재시도",
                onClick: () => {
                  setRetryCount(prev => prev + 1);
                  handleCancel();
                }
              }
            });
          } else {
            toast.error(userMessage.title, {
              description: userMessage.description,
            });
          }
          setConfirmStep(false);
        },
      }
    );
  };

  const handleClose = () => {
    onOpenChange(false);
    setConfirmStep(false);
    setCancelReason('');
    setRetryCount(0);
  };

  return (
    <Modal
      opened={open}
      onClose={handleClose}
      title="예약 취소"
      size="md"
      centered
      zIndex={1001} // ✅ Drawer보다 높은 z-index 설정
      overlayProps={{
        backgroundOpacity: 0.55,
        blur: 3,
      }}
    >
      <Stack gap="md">
        {!confirmStep ? (
          <>
            <Text size="sm">다음 예약을 취소하시겠습니까?</Text>
            
            <div>
              <Text fw={600} size="md">{reservation.title}</Text>
              <Text size="sm" c="dimmed">
                {format(new Date(reservation.start_time), 'PPP EEEE p', { locale: ko })} ~{' '}
                {format(new Date(reservation.end_time), 'p', { locale: ko })}
              </Text>
            </div>

            <div>
              <Text size="sm" fw={500} mb="xs">취소 사유 (선택)</Text>
              <MantineTextarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="취소 사유를 입력해주세요"
                disabled={isPending}
                rows={3}
              />
            </div>
          </>
        ) : (
          <Text size="sm" c="red">
            정말로 이 예약을 취소하시겠습니까? 이 작업은 되돌릴 수 없습니다.
          </Text>
        )}

        <Group justify="flex-end" gap="sm" mt="md">
          <MantineButton
            variant="subtle"
            onClick={handleClose}
            disabled={isPending}
          >
            {confirmStep ? '아니오' : '닫기'}
          </MantineButton>
          
          <MantineButton
            color="red"
            onClick={handleCancel}
            disabled={isPending}
            loading={isPending}
            style={{ minWidth: '120px' }}
          >
            {confirmStep ? '예, 취소합니다' : '예약 취소'}
          </MantineButton>
        </Group>
      </Stack>
    </Modal>
  );
} 