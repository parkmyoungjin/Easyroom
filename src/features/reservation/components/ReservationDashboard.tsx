// src/features/reservation/components/ReservationDashboard.tsx

import { useState, useEffect, useMemo } from 'react';
import { Card, Text, Group, Stack, Loader } from '@mantine/core';
import { Calendar } from 'lucide-react';
import { usePublicReservations } from '@/hooks/useReservations';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ReservationDashboardProps {
  readOnly?: boolean;
}

export default function ReservationDashboard({ readOnly = false }: ReservationDashboardProps) {
  const [currentDate] = useState(new Date());
  
  // 오늘의 예약 데이터 가져오기
  const startDateStr = format(startOfDay(currentDate), 'yyyy-MM-dd');
  const endDateStr = format(endOfDay(currentDate), 'yyyy-MM-dd');
  
  const { data: reservations, isLoading, isError } = usePublicReservations(
    startDateStr,
    endDateStr,
    true // 항상 public 데이터 사용
  );

  // 통계 계산
  const stats = useMemo(() => {
    if (!reservations) return null;
    
    const totalReservations = reservations.length;
    const uniqueRooms = new Set(reservations.map(r => r.room_id)).size;
    const uniqueDepartments = new Set(reservations.map(r => r.department)).size;
    
    // 시간대별 분석
    const currentHour = new Date().getHours();
    const currentReservations = reservations.filter(r => {
      const startTime = new Date(r.start_time);
      const endTime = new Date(r.end_time);
      const now = new Date();
      return startTime <= now && endTime >= now;
    });
    
    return {
      totalReservations,
      uniqueRooms,
      uniqueDepartments,
      currentReservations: currentReservations.length,
    };
  }, [reservations]);

  // 로딩 상태 처리
  if (isLoading) {
    return (
      <Card withBorder>
        <Card.Section withBorder inheritPadding py="xs">
          <Group gap="xs">
            <Calendar size={20} />
            <Text fw={600}>예약 대시보드</Text>
          </Group>
        </Card.Section>
        <Card.Section inheritPadding py="md">
          <div className="flex items-center justify-center h-32">
            <Stack align="center" gap="md">
              <Loader size="md" />
              <Text c="dimmed">대시보드를 불러오고 있습니다...</Text>
            </Stack>
          </div>
        </Card.Section>
      </Card>
    );
  }

  // 에러 상태 처리
  if (isError) {
    return (
      <Card withBorder>
        <Card.Section withBorder inheritPadding py="xs">
          <Group gap="xs">
            <Calendar size={20} />
            <Text fw={600}>예약 대시보드</Text>
          </Group>
        </Card.Section>
        <Card.Section inheritPadding py="md">
          <div className="text-center py-8">
            <Text c="red">대시보드 데이터를 불러오는데 실패했습니다.</Text>
          </div>
        </Card.Section>
      </Card>
    );
  }

  return (
    <Card withBorder>
      <Card.Section withBorder inheritPadding py="xs">
        <Group gap="xs">
          <Calendar size={20} />
          <Text fw={600}>예약 대시보드</Text>
        </Group>
        <Text size="sm" c="dimmed">
          {format(currentDate, 'yyyy년 MM월 dd일 (EEEE)', { locale: ko })} 현황
        </Text>
      </Card.Section>
      
      <Card.Section inheritPadding py="md">
        {stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Text size="xl" fw={700} c="blue">
                {stats.totalReservations}
              </Text>
              <Text size="sm" c="dimmed">총 예약</Text>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <Text size="xl" fw={700} c="green">
                {stats.currentReservations}
              </Text>
              <Text size="sm" c="dimmed">현재 사용 중</Text>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <Text size="xl" fw={700} c="purple">
                {stats.uniqueRooms}
              </Text>
              <Text size="sm" c="dimmed">사용 회의실</Text>
            </div>
            
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <Text size="xl" fw={700} c="orange">
                {stats.uniqueDepartments}
              </Text>
              <Text size="sm" c="dimmed">예약 부서</Text>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Text c="dimmed">오늘은 예약이 없습니다.</Text>
          </div>
        )}
      </Card.Section>

      {!readOnly && (
        <Card.Section withBorder inheritPadding py="xs">
          <Text size="sm" c="dimmed" ta="center">
            더 자세한 정보는 로그인 후 확인할 수 있습니다.
          </Text>
        </Card.Section>
      )}
    </Card>
  );
}