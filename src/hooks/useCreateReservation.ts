// src/hooks/useCreateReservation.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationService } from '@/lib/services/reservations';
import { toast } from 'sonner';
import { reservationKeys } from '@/lib/queryKeys';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
import type { ReservationInsert } from '@/types/database';
import { logger } from '@/lib/utils/logger';

export function useCreateReservation() {
  const queryClient = useQueryClient();
  // ✅ [핵심 수정] 지연된 바인딩: useSupabaseClient 훅을 사용하여 클라이언트에 접근
  const supabase = useSupabaseClient();

  return useMutation({
    // ✅ [핵심 수정] mutationFn이 실행되는 바로 이 순간에 의존성을 주입한다.
    mutationFn: async (data: ReservationInsert) => {
      // ✅ 새로운 SSR 아키텍처에서는 클라이언트가 항상 준비되어 있음
      if (!supabase) {
        logger.error('Supabase 클라이언트를 사용할 수 없습니다');
        throw new Error('Supabase 클라이언트를 사용할 수 없습니다. 페이지를 새로고침해주세요.');
      }
      
      logger.debug('Creating reservation with Supabase client');

      // ✅ [수정] 서비스 함수에 supabase 클라이언트를 첫 번째 인자로 전달합니다.
      const result = await reservationService.createReservation(supabase, data); 
      
      logger.info('Reservation created successfully');
      return result;
    },
    onSuccess: () => {
      toast.success('예약 완료', {
        description: '회의실 예약이 성공적으로 완료되었습니다.',
      });
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
    },
    onError: (error: Error) => {
      logger.error('예약 생성 실패', error);
      toast.error('예약 실패', {
        description: error.message,
      });
    },
  });
}