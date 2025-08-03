// src/app/reservations/status/page.tsx

'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
// 최종 캘린더 컴포넌트를 사용합니다.
import GoogleCalendarView from '@/features/reservation/components/GoogleCalendarView'; 
import MobileHeader from '@/components/ui/mobile-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { addDays, startOfWeek, endOfWeek, format } from 'date-fns';
import { ChevronLeft, ChevronRight, LocateFixed } from 'lucide-react';
import { usePublicReservations } from '@/hooks/useReservations';

// 스켈레톤 로딩 컴포넌트 (변경 없음)
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

export default function ReservationStatusPage() {
  const { isAuthenticated } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());

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
    <div className="min-h-screen bg-background text-foreground">
      <MobileHeader 
        title="전체 예약 현황"
        showBackButton={true}
      />
      
      <main className="container mx-auto p-4 sm:p-6 lg:p-8 pt-0">
        
        {/* ✅ [수정] 주간 네비게이션: '오늘로 이동' 버튼과 날짜를 나란히 배치 */}
        <div className="flex justify-between items-center my-4 p-4 border rounded-lg bg-card">
          <Button variant="outline" size="icon" onClick={handlePreviousWeek} aria-label="이전 주">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="font-semibold text-sm sm:text-base">{format(weekRange.start, 'yyyy년')}</p>
              <p className="text-base sm:text-lg">{weekDisplay}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleGoToToday}>
              <LocateFixed className="mr-2 h-4 w-4" />
              오늘
            </Button>
          </div>

          <Button variant="outline" size="icon" onClick={handleNextWeek} aria-label="다음 주">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        {/* ✅ [삭제] "이번 주 예약팀" 정보 박스(Memo) 삭제 */}

        {isLoading && <CalendarSkeleton />}
        {isError && <p className="text-destructive text-center p-8">예약 정보를 불러오는 데 실패했습니다.</p>}
        
        {!isLoading && !isError && (
          <GoogleCalendarView 
            reservations={reservations || []}
            weekStartDate={weekRange.start}
            isAuthenticated={isAuthenticated()}
          />
        )}
      </main>
    </div>
  );
}