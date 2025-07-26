'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useCancelReservation } from '@/hooks/useReservations';
import { Reservation } from '@/types/database';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/utils/logger';
import { canCancelReservation, getPermissionErrorMessage } from '@/lib/utils/reservation-permissions';
import { useAuth } from '@/hooks/useAuth';
import { ReservationErrorHandler } from '@/lib/utils/error-handler';

interface ReservationCancelDialogProps {
  reservation: Reservation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReservationCancelDialog({ reservation, open, onOpenChange }: ReservationCancelDialogProps) {
  const { mutate: cancelReservation, isPending } = useCancelReservation();
  const { toast } = useToast();
  const { userProfile } = useAuth();
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
      toast({
        variant: "destructive",
        title: "인증 오류",
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
      import('@/lib/utils/reservation-permissions').then(({ fixReservationUserId }) => {
        fixReservationUserId(reservationId, userProfile.dbId!).then(success => {
          if (success) {
            logger.debug('예약 user_id 자동 수정 완료', {
              reservationId,
              newUserId: userProfile.dbId
            });
          }
        });
      });
    }
    
    if (!permissionResult.allowed) {
      const errorMessage = getPermissionErrorMessage('cancel', permissionResult.reason || 'unknown');
      toast({
        variant: "destructive",
        title: errorMessage.title,
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
          
          toast({
            title: "취소 완료",
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
            toast({
              variant: "destructive",
              title: userMessage.title,
              description: `${userMessage.description} (재시도 ${retryCount + 1}/3)`,
              action: (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRetryCount(prev => prev + 1);
                    handleCancel();
                  }}
                >
                  재시도
                </Button>
              ),
            });
          } else {
            toast({
              variant: "destructive",
              title: userMessage.title,
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
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>예약 취소</DialogTitle>
          <DialogDescription asChild>
            {!confirmStep ? (
              <div>
                <div className="mb-2">다음 예약을 취소하시겠습니까?</div>
                <div className="mt-2">
                  <div className="font-semibold">{reservation.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(reservation.start_time), 'PPP EEEE p', { locale: ko })} ~{' '}
                    {format(new Date(reservation.end_time), 'p', { locale: ko })}
                  </div>
                </div>
                <div className="mt-4">
                  <label className="text-sm font-medium">취소 사유 (선택)</label>
                  <Textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="취소 사유를 입력해주세요"
                    className="mt-1"
                    disabled={isPending}
                  />
                </div>
              </div>
            ) : (
              <div className="text-red-500">
                정말로 이 예약을 취소하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            {confirmStep ? '아니오' : '닫기'}
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isPending}
            className="min-w-[120px]"
          >
            {isPending ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                취소 중...
              </div>
            ) : confirmStep ? (
              '예, 취소합니다'
            ) : (
              '예약 취소'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 