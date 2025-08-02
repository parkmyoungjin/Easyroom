"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription, // 추가
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useCancelReservation } from "@/hooks/useCancelReservation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
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
  const { mutate: cancelReservation } = useCancelReservation();
  const { user } = useAuth(); 
  const { toast } = useToast();

  if (!reservation) return null;

  // 현재 사용자가 예약자이거나 관리자인 경우 수정/취소 가능
  const canManageReservation = user && (
    reservation.user_id === user.id || 
    user.role === 'admin'
  );

  // ✅ 시간 제한 체크 추가
  const canCancelReservation = () => {
    if (!canManageReservation) return false;
      
    const startTime = new Date(reservation.start_time);
    const now = new Date();
    const timeDiff = startTime.getTime() - now.getTime();
    const minutesDiff = Math.floor(timeDiff / (1000 * 60));
      
    return minutesDiff >= 10; // 10분 전까지만 취소 가능
  };

  const handleEdit = () => {
    // ✅ 시간 제한 체크
    const startTime = new Date(reservation.start_time);
    const now = new Date();
    const timeDiff = startTime.getTime() - now.getTime();
    const minutesDiff = Math.floor(timeDiff / (1000 * 60));

    if (minutesDiff < 10) {
      toast({
        variant: "destructive",
        title: "수정 불가",
        description: "회의 시작 10분 전부터는 수정할 수 없습니다.",
      });
      return;
    }

    onClose(); // 다이얼로그 닫기
    router.push(`/reservations/edit/${reservation.id}`);
  };

  const handleCancel = () => {
    if (!canCancelReservation()) {
      toast({
        variant: "destructive",
        title: "취소 불가",
        description: "회의 시작 10분 전부터는 취소할 수 없습니다.",
      });
      return;
    }

    // ✅ 확인 없이 바로 취소하는 것은 위험할 수 있음
    if (!confirm("정말로 이 예약을 취소하시겠습니까?")) {
      return;
    }    

    cancelReservation({ 
      id: reservation.id,
      reason: "사용자 취소" 
    }, {
      onSuccess: () => {
        toast({
          title: "취소 완료",
          description: "예약이 취소되었습니다.",
        });
      onClose();
      },
      onError: (error) => {
        const reservationError = ReservationErrorHandler.handleReservationError(error, {
          action: 'cancel',
          reservationId: reservation.id,
          userId: user?.id,
          timestamp: new Date().toISOString()
        });

        const userMessage = ReservationErrorHandler.getUserFriendlyMessage(reservationError, 'cancel');

        toast({
          variant: "destructive",
          title: userMessage.title,
          description: userMessage.description,
        });
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] w-[calc(100%-2rem)] max-w-md mx-auto">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-xl font-bold text-gray-900">예약 정보</DialogTitle>
          <DialogDescription className="text-gray-600">
            예약 상세 정보를 확인하고 관리할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-6">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">부서명</h3>
            <p className="text-lg font-medium text-gray-900">{reservation.department}</p>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">목적</h3>
            <p className="text-base text-gray-900">{reservation.purpose || reservation.title}</p>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">예약자</h3>
            <p className="text-base text-gray-900">{reservation.user_name}</p>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">예약 시간</h3>
            <div className="bg-gray-50 p-4 rounded-lg border">
              <p className="text-base font-medium text-gray-900">
                {format(new Date(reservation.start_time), "PPP a h:mm", { locale: ko })} 
              </p>
              <p className="text-sm text-gray-600 mt-1">
                ~ {format(new Date(reservation.end_time), "a h:mm", { locale: ko })}
              </p>
            </div>
          </div>
          
          {/* ✅ 개선된 버튼 조건 */}
          {canManageReservation && (
            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button variant="outline" onClick={handleEdit} className="px-6">
                수정
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleCancel} 
                className="px-6"
                disabled={!canCancelReservation()} // 시간 제한 반영
              >
                취소
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}