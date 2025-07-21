"use client";

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationService } from '@/lib/services/reservations';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/utils/logger';
import { reservationKeys } from './useReservations';

export function useCreateReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      // ✅ 민감한 정보는 개발 환경에서만 안전하게 로깅
      logger.debug('Creating reservation');
      
      const result = await reservationService.createReservation(data);
      logger.userAction('Reservation created', true);
      return result;
    },
    onSuccess: (data) => {
      // ✅ 성공 로깅은 안전하게
      logger.userAction('Reservation creation successful');
      
      // ✅ 통일된 키 시스템으로 관련 쿼리 무효화
      queryClient.invalidateQueries({ 
        queryKey: reservationKeys.all,
        exact: false // 'reservations'로 시작하는 모든 쿼리 무효화
      });
      
      toast({
        title: "예약이 생성되었습니다",
        description: "회의실 예약이 성공적으로 생성되었습니다.",
      });
    },
    onError: (error: Error) => {
      // ✅ 에러 로깅도 안전하게 처리
      logger.error('예약 생성 실패', error);
      
      toast({
        title: "예약 생성 실패",
        description: error.message || "예약 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });
} 