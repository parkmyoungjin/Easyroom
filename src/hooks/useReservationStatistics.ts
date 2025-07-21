import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

interface StatisticsParams {
  startDate: string;
  endDate: string;
}

export function useReservationStatistics() {
  return useMutation({
    mutationFn: async ({ startDate, endDate }: StatisticsParams) => {
      // 회의실별 예약 건수
      const { data: reservations, error: roomError } = await supabase
        .from('reservations')
        .select(`
          room_id,
          rooms (name)
        `)
        .gte('start_time', `${startDate}T00:00:00`)
        .lte('start_time', `${endDate}T23:59:59`)
        .eq('status', 'confirmed');

      if (roomError) throw roomError;

      // 클라이언트에서 그룹화
      const roomStats = reservations?.reduce((acc: any[], reservation: any) => {
        const existing = acc.find(item => item.room_id === reservation.room_id);
        if (existing) {
          existing.count += 1;
        } else {
          acc.push({
            room_id: reservation.room_id,
            rooms: reservation.rooms,
            count: 1
          });
        }
        return acc;
      }, []) || [];

      // 시간대별 예약 분포
      const { data: timeReservations, error: timeError } = await supabase
        .from('reservations')
        .select('start_time')
        .gte('start_time', `${startDate}T00:00:00`)
        .lte('start_time', `${endDate}T23:59:59`)
        .eq('status', 'confirmed');

      if (timeError) throw timeError;

      // 시간대별 그룹화
      const timeStats = timeReservations?.reduce((acc: any[], reservation: any) => {
        const hour = new Date(reservation.start_time).getHours();
        const existing = acc.find(item => item.hour === hour);
        if (existing) {
          existing.count += 1;
        } else {
          acc.push({ hour, count: 1 });
        }
        return acc;
      }, []) || [];

      // 부서별 사용 통계
      const { data: deptReservations, error: deptError } = await supabase
        .from('reservations')
        .select('users (department)')
        .gte('start_time', `${startDate}T00:00:00`)
        .lte('start_time', `${endDate}T23:59:59`)
        .eq('status', 'confirmed');

      if (deptError) throw deptError;

      // 부서별 그룹화
      const deptStats = deptReservations?.reduce((acc: any[], reservation: any) => {
        const department = reservation.users?.department;
        if (!department) return acc;
        const existing = acc.find(item => item.department === department);
        if (existing) {
          existing.count += 1;
        } else {
          acc.push({ department, count: 1 });
        }
        return acc;
      }, []) || [];

      // 취소율 및 사유
      const { data: cancelReservations, error: cancelError } = await supabase
        .from('reservations')
        .select('status, cancellation_reason')
        .gte('start_time', `${startDate}T00:00:00`)
        .lte('start_time', `${endDate}T23:59:59`)
        .eq('status', 'cancelled');

      if (cancelError) throw cancelError;

      // 취소 사유별 그룹화
      const cancelStats = cancelReservations?.reduce((acc: any[], reservation: any) => {
        const reason = reservation.cancellation_reason || '사유 없음';
        const existing = acc.find(item => item.reason === reason);
        if (existing) {
          existing.count += 1;
        } else {
          acc.push({ reason, count: 1 });
        }
        return acc;
      }, []) || [];

      // CSV 데이터 생성
      const csvData = [
        // 헤더
        ['구분', '항목', '건수'],
        // 회의실별 통계
        ...roomStats.map((stat) => ['회의실', stat.rooms.name, stat.count]),
        // 시간대별 통계
        ...timeStats.map((stat) => ['시간대', `${stat.hour}시`, stat.count]),
        // 부서별 통계
        ...deptStats.map((stat) => ['부서', stat.department, stat.count]),
        // 취소 통계
        ...cancelStats.map((stat) => ['취소사유', stat.reason, stat.count]),
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
    },
  });
} 