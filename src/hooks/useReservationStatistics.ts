import { useQuery, useMutation } from '@tanstack/react-query';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
import { logger } from '@/lib/utils/logger';
import { 
  createQueryKeyFactory, 
  buildQueryOptions, 
  createStandardFetch 
} from '@/lib/utils/query-optimization';

interface StatisticsParams {
  startDate: string;
  endDate: string;
}

// Optimized query keys using factory pattern
const statisticsKeyFactory = createQueryKeyFactory<{
  startDate?: string;
  endDate?: string;
}>('statistics');

export const statisticsKeys = {
  ...statisticsKeyFactory,
  reservations: (startDate: string, endDate: string) => 
    statisticsKeyFactory.custom('reservations', startDate, endDate),
};

// Optimized hook using RPC function for better performance
export function useReservationStatisticsQuery(startDate: string, endDate: string) {
  const supabase = useSupabaseClient();
  
  return useQuery(buildQueryOptions({
    queryKey: statisticsKeys.reservations(startDate, endDate),
    queryFn: createStandardFetch(
      async () => {
        if (!supabase) throw new Error('Supabase client not available');
        const { data, error } = await supabase
          .rpc('get_reservation_statistics', {
            start_date: startDate,
            end_date: endDate
          });

        if (error) {
          logger.error('Statistics RPC failed', error);
          throw new Error(`통계 조회 실패: ${error.message}`);
        }

        return data;
      },
      {
        operation: 'fetch reservation statistics',
        params: { startDate, endDate }
      }
    ),
    enabled: !!startDate && !!endDate && !!supabase,
    dataType: 'dynamic',
    cacheConfig: {
      customStaleTime: 10 * 60 * 1000, // 10 minutes for statistics
      customGcTime: 30 * 60 * 1000 // 30 minutes
    }
  }));
}

// Legacy mutation hook for CSV download functionality
export function useReservationStatistics() {
  const supabase = useSupabaseClient();
  
  return useMutation({
    mutationFn: async ({ startDate, endDate }: StatisticsParams) => {
      if (!supabase) throw new Error('Supabase client not available');
      
      // Use the optimized RPC function instead of multiple queries
      const { data: statisticsData, error } = await supabase
        .rpc('get_reservation_statistics', {
          start_date: startDate,
          end_date: endDate
        });

      if (error) {
        logger.error('Statistics RPC failed', error);
        throw new Error(`통계 조회 실패: ${error.message}`);
      }

      // Extract data from RPC response
      const roomStats = statisticsData?.room_stats || [];
      const timeStats = statisticsData?.time_stats || [];
      const deptStats = statisticsData?.dept_stats || [];
      const cancelStats = statisticsData?.cancel_stats || [];

      // CSV 데이터 생성
      const csvData = [
        // 헤더
        ['구분', '항목', '건수'],
        // 회의실별 통계
        ...roomStats.map((stat: any) => ['회의실', stat.room_name, stat.reservation_count]),
        // 시간대별 통계
        ...timeStats.map((stat: any) => ['시간대', `${stat.hour}시`, stat.reservation_count]),
        // 부서별 통계
        ...deptStats.map((stat: any) => ['부서', stat.department, stat.reservation_count]),
        // 취소 통계
        ...cancelStats.map((stat: any) => ['취소사유', stat.reason, stat.count]),
      ];

      // CSV 파일 생성 및 다운로드 (브라우저에서만 실행)
      if (typeof window !== 'undefined') {
        const csv = csvData.map((row) => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `회의실_통계_${startDate}_${endDate}.csv`;
        link.click();
      }

      return statisticsData;
    },
  });
} 