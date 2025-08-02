// src/hooks/useCancelReservation.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationService } from '@/lib/services/reservations';
// Using console for now instead of sonner
const toast = {
  success: (message: string) => console.log(`✅ ${message}`),
  error: (title: string, options?: { description?: string }) => console.error(`❌ ${title}`, options?.description || '')
};
import { reservationKeys } from '@/hooks/useReservations';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';

interface CancelReservationInput {
  id: string;
  reason?: string;
}

export function useCancelReservation() {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient(); // Use centralized client from SupabaseProvider

  return useMutation({
    mutationFn: async ({ id, reason }: CancelReservationInput) => {
      // ✅ [추가] 뮤테이션 실행 전 supabase 클라이언트가 있는지 확인합니다.
      if (!supabase) {
        throw new Error('인증 컨텍스트를 사용할 수 없어 예약을 취소할 수 없습니다.');
      }
      // ✅ [수정] 서비스 함수에 supabase 클라이언트를 첫 번째 인자로 전달합니다.
      return reservationService.cancelReservation(supabase, id, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: reservationKeys.all,
        exact: false
      });
      toast.success('예약이 취소되었습니다.');
    },
    onError: (error) => {
      toast.error('예약 취소 실패', {
        description: error instanceof Error ? error.message : '예약 취소 중 오류가 발생했습니다.',
      });
    },
  });
}