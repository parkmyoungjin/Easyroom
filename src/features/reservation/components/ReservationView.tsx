// src/features/reservation/components/ReservationView.tsx

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import GoogleCalendarView from '@/features/reservation/components/GoogleCalendarView';
import { Button, Skeleton, Tabs, Card, Text, Group } from '@mantine/core';
import { addDays, startOfWeek, endOfWeek, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, LocateFixed, Calendar, Clock, User, Building } from 'lucide-react';
import { usePublicReservations } from '@/hooks/useReservations';
import type { PublicReservation } from '@/types/database';

// 간단한 목록 뷰 컴포넌트
function PublicListView({ reservations }: { reservations: PublicReservation[] }) {
  const router = useRouter();

  if (reservations.length === 0) {
    return (
      <Card withBorder p="xl" style={{ textAlign: 'center' }}>
        <Calendar size={48} className="mx-auto mb-4 text-gray-400" />
        <Text size="lg" fw={500}>예약 없음</Text>
        <Text size="sm" c="dimmed">선택된 주에는 예약이 없습니다.</Text>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reservations.map((reservation) => {
        const startTime = new Date(reservation.start_time);
        const endTime = new Date(reservation.end_time);
        const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

        return (
          <Card key={reservation.id} withBorder p="md" className="hover:shadow-md transition-shadow">
            <Group justify="space-between" align="flex-start">
              <div className="flex-1">
                <Text fw={600} size="md" mb="xs">{reservation.title}</Text>
                
                <div className="space-y-2">
                  <Group gap="xs">
                    <User size={14} className="text-gray-500" />
                    <Text size="sm" c="dimmed">{reservation.user_name}</Text>
                    <Text size="sm" c="dimmed">({reservation.department})</Text>
                  </Group>
                  
                  <Group gap="xs">
                    <Building size={14} className="text-gray-500" />
                    <Text size="sm" c="dimmed">{reservation.room_id}</Text>
                  </Group>
                  
                  <Group gap="xs">
                    <Clock size={14} className="text-gray-500" />
                    <Text size="sm" c="dimmed">
                      {format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')} ({duration}분)
                    </Text>
                  </Group>
                </div>

                {reservation.purpose && (
                  <Text size="sm" c="dimmed" mt="xs" className="italic">
                    {reservation.purpose}
                  </Text>
                )}
              </div>
            </Group>
          </Card>
        );
      })}
    </div>
  );
}

// 스켈레톤 로딩 컴포넌트
const CalendarSkeleton = () => (
  <Card withBorder p="md">
    <div className="space-y-4">
      <Skeleton height={40} />
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} height={80} />
        ))}
      </div>
    </div>
  </Card>
);

export default function ReservationView() {
  const { isAuthenticated } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('calendar');

  const weekRange = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(start, { weekStartsOn: 1 });
    return { start, end };
  }, [currentDate]);

  const startDateStr = format(weekRange.start, 'yyyy-MM-dd');
  const endDateStr = format(weekRange.end, 'yyyy-MM-dd');

  const { data: reservations, isLoading, isError } = usePublicReservations(
    startDateStr,
    endDateStr,
    isAuthenticated()
  );

  const handlePreviousWeek = () => setCurrentDate(addDays(currentDate, -7));
  const handleNextWeek = () => setCurrentDate(addDays(currentDate, 7));
  const handleGoToToday = () => setCurrentDate(new Date());

  const weekDisplay = `${format(weekRange.start, 'M월 d일')} ~ ${format(addDays(weekRange.start, 4), 'd일')}`;

  return (
    <div className="space-y-6">
      {/* 주간 네비게이션 */}
      <div className="flex justify-between items-center p-4 border rounded-lg bg-card">
        <Button variant="outline" size="compact-sm" onClick={handlePreviousWeek}>
          <ChevronLeft size={16} />
        </Button>
        
        <div className="flex flex-col items-center gap-2">
          <div className="text-center">
            <Text fw={600} size="sm">{format(weekRange.start, 'yyyy년')}</Text>
            <Text size="lg">{weekDisplay}</Text>
          </div>
          <Button variant="subtle" size="compact-sm" onClick={handleGoToToday}>
            <LocateFixed size={16} style={{ marginRight: '8px' }} />
            오늘
          </Button>
        </div>

        <Button variant="outline" size="compact-sm" onClick={handleNextWeek}>
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* 탭 네비게이션 */}
      <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'calendar')}>
        <Tabs.List>
          <Tabs.Tab value="calendar">캘린더</Tabs.Tab>
          <Tabs.Tab value="list">목록</Tabs.Tab>
        </Tabs.List>

        {isLoading && <CalendarSkeleton />}
        {isError && (
          <Text c="red" ta="center" p="xl">
            예약 정보를 불러오는 데 실패했습니다.
          </Text>
        )}

        {!isLoading && !isError && (
          <>
            <Tabs.Panel value="calendar" pt="md">
              <GoogleCalendarView
                reservations={reservations || []}
                weekStartDate={weekRange.start}
                isAuthenticated={isAuthenticated()}
              />
            </Tabs.Panel>

            <Tabs.Panel value="list" pt="md">
              <PublicListView reservations={reservations || []} />
            </Tabs.Panel>
          </>
        )}
      </Tabs>
    </div>
  );
}