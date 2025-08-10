/**
 * Check-in/Check-out 관련 React Query 훅들
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  checkInReservation,
  checkOutReservation,
  getReservationStatus,
  getCurrentRoomStatus,
  getRoomUsageStatistics,
  getNoShowReservations,
  runAutomationManually,
  getCronJobsStatus
} from '@/lib/api/checkin-checkout';
import { useEffect } from 'react';
import { toast } from 'sonner';

/**
 * 예약 상태 조회 훅
 */
export function useReservationStatus(reservationId: string, enabled = true) {
  return useQuery({
    queryKey: ['reservation-status', reservationId],
    queryFn: () => getReservationStatus(reservationId),
    enabled: enabled && !!reservationId,
    refetchInterval: 30000, // 30초마다 갱신
    staleTime: 10000, // 10초간 캐시 유지
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  });
}

/**
 * 체크인 뮤테이션 훅
 */
export function useCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: checkInReservation,
    onSuccess: (response, reservationId) => {
      if (response.success) {
        // 관련 쿼리들 무효화
        queryClient.invalidateQueries({ queryKey: ['reservation-status', reservationId] });
        queryClient.invalidateQueries({ queryKey: ['user-reservations'] });
        queryClient.invalidateQueries({ queryKey: ['room-status'] });
        queryClient.invalidateQueries({ queryKey: ['public-reservations'] });
        
        toast.success('체크인 완료', {
          description: response.message || '회의실 사용을 시작합니다.'
        });
      } else {
        toast.error('체크인 실패', {
          description: response.error || '체크인 중 오류가 발생했습니다.'
        });
      }
    },
    onError: (error) => {
      console.error('Check-in error:', error);
      toast.error('체크인 오류', {
        description: '네트워크 오류가 발생했습니다. 다시 시도해주세요.'
      });
    }
  });
}

/**
 * 체크아웃 뮤테이션 훅
 */
export function useCheckOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: checkOutReservation,
    onSuccess: (response, reservationId) => {
      if (response.success) {
        // 관련 쿼리들 무효화
        queryClient.invalidateQueries({ queryKey: ['reservation-status', reservationId] });
        queryClient.invalidateQueries({ queryKey: ['user-reservations'] });
        queryClient.invalidateQueries({ queryKey: ['room-status'] });
        queryClient.invalidateQueries({ queryKey: ['public-reservations'] });
        queryClient.invalidateQueries({ queryKey: ['room-usage-statistics'] });
        
        const duration = response.data?.actual_duration_minutes 
          ? Math.round(response.data.actual_duration_minutes) 
          : 0;
        
        toast.success('체크아웃 완료', {
          description: `${duration}분간 사용하셨습니다.${response.data?.was_overtime ? ' (연장 사용)' : ''}`
        });
      } else {
        toast.error('체크아웃 실패', {
          description: response.error || '체크아웃 중 오류가 발생했습니다.'
        });
      }
    },
    onError: (error) => {
      console.error('Check-out error:', error);
      toast.error('체크아웃 오류', {
        description: '네트워크 오류가 발생했습니다. 다시 시도해주세요.'
      });
    }
  });
}

/**
 * 실시간 회의실 상태 조회 훅
 */
export function useRoomStatus(refreshInterval = 30000) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['room-status'],
    queryFn: getCurrentRoomStatus,
    refetchInterval: refreshInterval,
    staleTime: 10000,
    retry: 3
  });

  // 실시간 구독은 나중에 구현 (현재는 폴링으로 대체)

  return query;
}

/**
 * 회의실 사용률 통계 훅 (관리자 전용)
 */
export function useRoomUsageStatistics() {
  return useQuery({
    queryKey: ['room-usage-statistics'],
    queryFn: getRoomUsageStatistics,
    refetchInterval: 60000, // 1분마다 갱신
    staleTime: 30000,
    retry: 2
  });
}

/**
 * No-Show 예약 목록 훅 (관리자 전용)
 */
export function useNoShowReservations() {
  return useQuery({
    queryKey: ['no-show-reservations'],
    queryFn: getNoShowReservations,
    refetchInterval: 60000,
    staleTime: 30000,
    retry: 2
  });
}

/**
 * Cron 작업 상태 훅 (관리자 전용)
 */
export function useCronJobsStatus() {
  return useQuery({
    queryKey: ['cron-jobs-status'],
    queryFn: getCronJobsStatus,
    refetchInterval: 30000,
    staleTime: 15000,
    retry: 2
  });
}

/**
 * 수동 자동화 실행 훅 (관리자 전용)
 */
export function useManualAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: runAutomationManually,
    onSuccess: (result) => {
      if (result.success !== false) {
        // 관련 통계 쿼리들 무효화
        queryClient.invalidateQueries({ queryKey: ['room-usage-statistics'] });
        queryClient.invalidateQueries({ queryKey: ['no-show-reservations'] });
        queryClient.invalidateQueries({ queryKey: ['room-status'] });
        queryClient.invalidateQueries({ queryKey: ['user-reservations'] });
        
        toast.success('자동화 작업 완료', {
          description: `처리된 항목: ${result.total_processed}개`
        });
      } else {
        toast.error('자동화 작업 실패', {
          description: result.error || '알 수 없는 오류가 발생했습니다.'
        });
      }
    },
    onError: (error) => {
      console.error('Manual automation error:', error);
      toast.error('자동화 작업 오류', {
        description: '네트워크 오류가 발생했습니다.'
      });
    }
  });
}

/**
 * 특정 예약의 실시간 상태 변경 구독 훅
 */
export function useReservationSubscription(reservationId: string) {
  // 실시간 구독은 나중에 구현
  // 현재는 폴링으로 상태 업데이트
}

/**
 * 체크인/체크아웃 가능 여부를 판단하는 유틸리티 훅
 */
export function useReservationActions(reservationId: string) {
  const { data: statusData, isLoading } = useReservationStatus(reservationId);
  const checkInMutation = useCheckIn();
  const checkOutMutation = useCheckOut();

  const canCheckIn = statusData?.success && statusData.data?.can_checkin;
  const canCheckOut = statusData?.success && statusData.data?.can_checkout;
  const currentStatus = statusData?.success ? statusData.data?.current_status : undefined;
  const isOvertime = statusData?.success ? statusData.data?.is_overtime : false;

  const handleCheckIn = () => {
    if (canCheckIn && !checkInMutation.isPending) {
      checkInMutation.mutate(reservationId);
    }
  };

  const handleCheckOut = () => {
    if (canCheckOut && !checkOutMutation.isPending) {
      checkOutMutation.mutate(reservationId);
    }
  };

  return {
    // 상태
    currentStatus,
    canCheckIn,
    canCheckOut,
    isOvertime,
    isLoading,
    statusMessage: statusData?.success ? statusData.data?.status_message : '',
    
    // 액션
    handleCheckIn,
    handleCheckOut,
    
    // 뮤테이션 상태
    isCheckingIn: checkInMutation.isPending,
    isCheckingOut: checkOutMutation.isPending,
    isProcessing: checkInMutation.isPending || checkOutMutation.isPending
  };
}