// src/features/reservation/components/ReservationView.tsx

'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import ReservationCalendarView from './ReservationCalendarView'; // 현재 폴더에 있는 컴포넌트
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { addDays, startOfWeek, endOfWeek, format } from 'date-fns';
import { ChevronLeft, ChevronRight, LocateFixed } from 'lucide-react';
import { usePublicReservations } from '@/hooks/useReservations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReservationListView } from './ReservationListView'; // ListView 컴포넌트 (가정)

// 스켈레톤 로딩 컴포넌트
const CalendarSkeleton = () => (
  <div className="border rounded-lg p-4 bg-card">
    <div className="flex justify-between items-center mb-4">
      <Skeleton className="h-10 w-10" />
      <div className="flex flex-col items-center gap-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-32" />
      </div>
      <Skeleton className="h-10 w-10" />
    </div>
    <div className="grid grid-cols-5 gap-2 mb-4">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
    <Skeleton className="h-[600px] w-full" />
  </div>
);

export function ReservationView() {
  const { isAuthenticated, user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekRange = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(start, { weekStartsOn: 1 });
    return { start, end };
  }, [currentDate]);

  const startDateStr = format(weekRange.start, 'yyyy-MM-dd');
  const endDateStr = format(weekRange.end, 'yyyy-MM-dd');

  // ✅ 1. 이 컴포넌트가 직접 데이터를 가져옵니다.
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
    <Tabs defaultValue="calendar" className="w-full">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
        {/* 주간 네비게이션 */}
        <div className="flex justify-between items-center p-2 border rounded-lg bg-card w-full sm:w-auto">
          <Button variant="ghost" size="icon" onClick={handlePreviousWeek} aria-label="이전 주">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center mx-4">
            <p className="font-semibold text-sm">{format(weekRange.start, 'yyyy년')}</p>
            <p className="text-base">{weekDisplay}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleNextWeek} aria-label="다음 주">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* 탭 리스트 */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleGoToToday}>
            <LocateFixed className="mr-2 h-4 w-4" />
            오늘
          </Button>
          <TabsList>
            <TabsTrigger value="calendar">캘린더</TabsTrigger>
            <TabsTrigger value="list">목록</TabsTrigger>
          </TabsList>
        </div>
      </div>
      
      {/* 탭 콘텐츠 */}
      {isLoading && <CalendarSkeleton />}
      {isError && <p className="text-destructive text-center p-8">예약 정보를 불러오는 데 실패했습니다.</p>}
      
      {!isLoading && !isError && (
        <>
          <TabsContent value="calendar">
            {/* ✅ 2. onCellClick을 제거하고, 필요한 데이터 props를 전달합니다. */}
            <ReservationCalendarView 
              reservations={reservations || []}
              weekStartDate={weekRange.start}
              isAuthenticated={isAuthenticated()}
              currentUserId={user?.id}
            />
          </TabsContent>
          <TabsContent value="list">
            <ReservationListView 
              reservations={reservations || []} 
              // isAuthenticated={isAuthenticated()} 
            />
          </TabsContent>
        </>
      )}
    </Tabs>
  );
}