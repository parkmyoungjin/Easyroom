// src/hooks/useCreateReservation.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationService } from '@/lib/services/reservations';
// Using console for now instead of sonner
const toast = {
  success: (title: string, options?: { description?: string }) => console.log(`✅ ${title}`, options?.description || ''),
  error: (title: string, options?: { description?: string }) => console.error(`❌ ${title}`, options?.description || '')
};
import { reservationKeys } from '@/hooks/useReservations';
import { useSupabase } from '@/contexts/SupabaseProvider';
import type { ReservationInsert } from '@/types/database';
import { logger } from '@/lib/utils/logger';

export function useCreateReservation() {
  const queryClient = useQueryClient();
  // ✅ [핵심 수정] 지연된 바인딩: useSupabase 훅을 사용하여 전체 컨텍스트에 접근
  const supabaseContext = useSupabase();

  return useMutation({
    // ✅ [핵심 수정] mutationFn이 실행되는 바로 이 순간에 의존성을 주입한다.
    mutationFn: async (data: ReservationInsert) => {
      // ✅ 올바른 위치: 실제 작업 직전에 클라이언트를 가져옴
      // 이 시점에는 모든 Provider가 초기화되었을 확률이 매우 높다.
      const { client: supabase, isReady, error } = supabaseContext;
      
      if (error) {
        logger.error('Supabase 초기화 오류:', error);
        throw new Error(`Supabase 초기화 실패: ${error.message}`);
      }
      
      if (!isReady || !supabase) {
        logger.warn('Supabase 클라이언트가 아직 준비되지 않음:', { isReady, hasClient: !!supabase });
        throw new Error('Supabase 클라이언트가 아직 초기화되지 않았습니다. 잠시 후 다시 시도해주세요.');
      }
      
      logger.debug('Late Binding: Creating reservation with a valid client instance.');

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