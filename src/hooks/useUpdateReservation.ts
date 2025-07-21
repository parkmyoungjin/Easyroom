import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationService } from '@/lib/services/reservations';
import { useToast } from '@/hooks/use-toast';
import { ReservationFormData } from '@/lib/validations/schemas';
import { ReservationUpdate } from '@/types/database';
import { reservationKeys } from './useReservations';

export function useUpdateReservation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ReservationFormData> }) => {
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
      
      return reservationService.updateReservation(id, updateData);
    },
    onSuccess: () => {
      // ✅ 통일된 키 시스템으로 관련 쿼리 무효화
      queryClient.invalidateQueries({ 
        queryKey: reservationKeys.all,
        exact: false // 'reservations'로 시작하는 모든 쿼리 무효화
      });
      toast({
        title: '예약이 수정되었습니다.',
        variant: 'default',
      });
    },
    onError: (error) => {
      toast({
        title: '예약 수정 실패',
        description: error instanceof Error ? error.message : '예약 수정 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    },
  });
} 