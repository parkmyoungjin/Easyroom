'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  checkInReservation, 
  checkOutReservation, 
  getReservationStatus,
  getErrorMessage 
} from '@/lib/api/checkin-checkout';
import type { ExtendedReservationStatus } from '@/types/database';
import { toast } from 'sonner';
import { 
  Clock, 
  Play, 
  Square, 
  AlertTriangle, 
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';

interface CheckInOutButtonProps {
  reservationId: string;
  currentStatus?: ExtendedReservationStatus;
  startTime: string;
  endTime: string;
  roomName: string;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
}

export function CheckInOutButton({
  reservationId,
  currentStatus,
  startTime,
  endTime,
  roomName,
  className,
  size = 'default',
  variant = 'default'
}: CheckInOutButtonProps) {
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);

  // 예약 상태 조회
  const { data: statusData, isLoading: isStatusLoading } = useQuery({
    queryKey: ['reservation-status', reservationId],
    queryFn: () => getReservationStatus(reservationId),
    refetchInterval: 30000, // 30초마다 상태 확인
    enabled: !!reservationId
  });

  // 체크인 뮤테이션
  const checkInMutation = useMutation({
    mutationFn: checkInReservation,
    onMutate: () => {
      setIsProcessing(true);
    },
    onSuccess: (response) => {
      if (response.success) {
        toast.success(`${roomName} 체크인 완료`, {
          description: response.message || '회의실 사용을 시작합니다.'
        });
        
        // 관련 쿼리 무효화하여 UI 업데이트
        queryClient.invalidateQueries({ queryKey: ['reservation-status', reservationId] });
        queryClient.invalidateQueries({ queryKey: ['user-reservations'] });
        queryClient.invalidateQueries({ queryKey: ['room-status'] });
      } else {
        const errorMessage = getErrorMessage(response.code || '', response.error || '체크인 실패');
        toast.error('체크인 실패', {
          description: errorMessage
        });
      }
    },
    onError: (error) => {
      toast.error('체크인 오류', {
        description: '네트워크 오류가 발생했습니다. 다시 시도해주세요.'
      });
      console.error('Check-in error:', error);
    },
    onSettled: () => {
      setIsProcessing(false);
    }
  });

  // 체크아웃 뮤테이션
  const checkOutMutation = useMutation({
    mutationFn: checkOutReservation,
    onMutate: () => {
      setIsProcessing(true);
    },
    onSuccess: (response) => {
      if (response.success) {
        const duration = response.data?.actual_duration_minutes 
          ? Math.round(response.data.actual_duration_minutes) 
          : 0;
        
        toast.success(`${roomName} 체크아웃 완료`, {
          description: `${duration}분간 사용하셨습니다.${response.data?.was_overtime ? ' (연장 사용)' : ''}`
        });
        
        // 관련 쿼리 무효화
        queryClient.invalidateQueries({ queryKey: ['reservation-status', reservationId] });
        queryClient.invalidateQueries({ queryKey: ['user-reservations'] });
        queryClient.invalidateQueries({ queryKey: ['room-status'] });
      } else {
        const errorMessage = getErrorMessage(response.code || '', response.error || '체크아웃 실패');
        toast.error('체크아웃 실패', {
          description: errorMessage
        });
      }
    },
    onError: (error) => {
      toast.error('체크아웃 오류', {
        description: '네트워크 오류가 발생했습니다. 다시 시도해주세요.'
      });
      console.error('Check-out error:', error);
    },
    onSettled: () => {
      setIsProcessing(false);
    }
  });

  // 현재 상태 결정 (props 또는 API 응답 사용)
  const status = statusData?.success ? statusData.data?.current_status : currentStatus;
  const canCheckIn = statusData?.success ? statusData.data?.can_checkin : false;
  const canCheckOut = statusData?.success ? statusData.data?.can_checkout : false;
  const statusMessage = statusData?.success ? statusData.data?.status_message : '';
  const isOvertime = statusData?.success ? statusData.data?.is_overtime : false;

  // 버튼 설정 결정
  const getButtonConfig = () => {
    if (isStatusLoading || isProcessing) {
      return {
        text: '확인 중...',
        icon: Loader2,
        disabled: true,
        variant: 'outline' as const,
        onClick: () => {}
      };
    }

    switch (status) {
      case 'confirmed':
        if (canCheckIn) {
          return {
            text: '체크인',
            icon: Play,
            disabled: false,
            variant: 'default' as const,
            onClick: () => checkInMutation.mutate(reservationId)
          };
        } else {
          return {
            text: '대기 중',
            icon: Clock,
            disabled: true,
            variant: 'outline' as const,
            onClick: () => {}
          };
        }

      case 'checked_in':
        return {
          text: isOvertime ? '연장 중 - 체크아웃' : '체크아웃',
          icon: Square,
          disabled: false,
          variant: isOvertime ? 'destructive' as const : 'secondary' as const,
          onClick: () => checkOutMutation.mutate(reservationId)
        };

      case 'overtime':
        return {
          text: '연장 중 - 체크아웃',
          icon: AlertTriangle,
          disabled: false,
          variant: 'destructive' as const,
          onClick: () => checkOutMutation.mutate(reservationId)
        };

      case 'completed':
        return {
          text: '완료됨',
          icon: CheckCircle,
          disabled: true,
          variant: 'outline' as const,
          onClick: () => {}
        };

      case 'no_show':
        return {
          text: 'No-Show',
          icon: XCircle,
          disabled: true,
          variant: 'outline' as const,
          onClick: () => {}
        };

      case 'cancelled':
        return {
          text: '취소됨',
          icon: XCircle,
          disabled: true,
          variant: 'outline' as const,
          onClick: () => {}
        };

      default:
        return {
          text: '상태 확인',
          icon: Clock,
          disabled: true,
          variant: 'outline' as const,
          onClick: () => {}
        };
    }
  };

  const buttonConfig = getButtonConfig();
  const IconComponent = buttonConfig.icon;

  return (
    <div className="flex flex-col gap-1 w-full">
      <Button
        size={size}
        variant={buttonConfig.variant}
        disabled={buttonConfig.disabled}
        onClick={buttonConfig.onClick}
        className={`${className} w-full min-h-[44px] touch-manipulation`}
        style={{
          fontSize: '14px',
          fontWeight: 600,
          borderRadius: '12px',
          transition: 'all 0.2s ease',
        }}
      >
        <IconComponent 
          className={`w-4 h-4 mr-2 ${isProcessing || isStatusLoading ? 'animate-spin' : ''}`} 
        />
        {buttonConfig.text}
      </Button>
      
      {statusMessage && (
        <p className={`text-xs text-center ${
          isOvertime 
            ? 'text-red-600' 
            : status === 'completed' 
              ? 'text-green-600' 
              : 'text-gray-600'
        }`}>
          {statusMessage}
        </p>
      )}
    </div>
  );
}

/**
 * 간단한 상태 표시 컴포넌트 (버튼 없이 상태만 표시)
 */
interface ReservationStatusBadgeProps {
  status: ExtendedReservationStatus;
  isOvertime?: boolean;
  size?: 'sm' | 'default';
}

export function ReservationStatusBadge({ 
  status, 
  isOvertime = false, 
  size = 'default' 
}: ReservationStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'confirmed':
        return {
          text: '예약됨',
          color: 'bg-blue-100 text-blue-800',
          icon: Clock
        };
      case 'checked_in':
        return {
          text: isOvertime ? '연장 중' : '사용 중',
          color: isOvertime ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800',
          icon: isOvertime ? AlertTriangle : Play
        };
      case 'overtime':
        return {
          text: '연장 중',
          color: 'bg-red-100 text-red-800',
          icon: AlertTriangle
        };
      case 'completed':
        return {
          text: '완료',
          color: 'bg-gray-100 text-gray-800',
          icon: CheckCircle
        };
      case 'no_show':
        return {
          text: 'No-Show',
          color: 'bg-orange-100 text-orange-800',
          icon: XCircle
        };
      case 'cancelled':
        return {
          text: '취소됨',
          color: 'bg-gray-100 text-gray-800',
          icon: XCircle
        };
      default:
        return {
          text: '알 수 없음',
          color: 'bg-gray-100 text-gray-800',
          icon: Clock
        };
    }
  };

  const config = getStatusConfig();
  const IconComponent = config.icon;
  const sizeClasses = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${config.color} ${sizeClasses}`}>
      <IconComponent className="w-3 h-3 mr-1" />
      {config.text}
    </span>
  );
}