// src/hooks/useUpdateReservation.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationService } from '@/lib/services/reservations';
// Using console for now instead of sonner
const toast = {
  success: (message: string) => console.log(`✅ ${message}`),
  error: (title: string, options?: { description?: string }) => console.error(`❌ ${title}`, options?.description || '')
};
import { ReservationFormData } from '@/lib/validations/schemas';
import { ReservationUpdate } from '@/types/database';
import { reservationKeys } from '@/hooks/useReservations';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';

export function useUpdateReservation() {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ReservationFormData> }) => {
      // ✅ [추가] 뮤테이션 실행 전 supabase 클라이언트가 있는지 확인합니다.
      if (!supabase) {
        throw new Error('인증 컨텍스트를 사용할 수 없어 예약을 수정할 수 없습니다.');
      }
      
      // Transform Date objects to ISO strings for database
      const updateData: Partial<ReservationUpdate> = {};
      if (data.title) {
        updateData.title = data.title;
      }
      if (data.purpose) {
        updateData.purpose = data.purpose;
      }
      if (data.start_time) {
        updateData.start_time = data.start_time.toISOString();
      }
      if (data.end_time) {
        updateData.end_time = data.end_time.toISOString();
      }
      
      // ✅ [수정] 서비스 함수에 supabase 클라이언트를 첫 번째 인자로 전달합니다.
      return reservationService.updateReservation(supabase, id, updateData);
    },
    onSuccess: (updatedReservation) => { // ✅ onSuccess에서 수정된 예약 데이터를 받을 수 있습니다.
      queryClient.invalidateQueries({ 
        queryKey: reservationKeys.all,
        exact: false
      });
      // ✅ 상세 뷰 캐시도 무효화하여 즉시 업데이트되도록 합니다.
      queryClient.invalidateQueries({
        queryKey: reservationKeys.detail(updatedReservation.id)
      });
      toast.success('예약이 수정되었습니다.');
    },
    onError: (error) => {
      toast.error('예약 수정 실패', {
        description: error instanceof Error ? error.message : '예약 수정 중 오류가 발생했습니다.',
      });
    },
  });
}