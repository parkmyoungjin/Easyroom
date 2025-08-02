// src/features/reservation/components/ReservationView.tsx

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation'; // useRouter import
import { useAuth } from '@/hooks/useAuth';
import ReservationCalendarView from '@/features/reservation/components/ReservationCalendarView';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { addDays, startOfWeek, endOfWeek, format } from 'date-fns';
import { ko } from 'date-fns/locale'; // ko locale import
import { ChevronLeft, ChevronRight, LocateFixed, Calendar, Clock, User, Building } from 'lucide-react';
import { usePublicReservations } from '@/hooks/useReservations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Card 관련 컴포넌트 import
import type { PublicReservation } from '@/types/database'; // PublicReservation 타입 import

// ✅✅✅ 1. "전체 공개 예약"을 위한 간단한 목록 뷰 컴포넌트를 새로 만듭니다. ✅✅✅
function PublicListView({ reservations }: { reservations: PublicReservation[] }) {
  const router = useRouter();

  if (reservations.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">예약 없음</h3>
          <p className="text-muted-foreground">선택된 주에는 예약이 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  // 날짜별로 예약 그룹화
  const groupedByDate = reservations.reduce((acc, res) => {
    const dateKey = format(new Date(res.start_time), 'yyyy-MM-dd (EEE)', { locale: ko });
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(res);
    return acc;
  }, {} as Record<string, PublicReservation[]>);

  return (
    <div className="space-y-6">
      {Object.entries(groupedByDate).map(([date, dailyReservations]) => (
        <div key={date}>
          <h3 className="font-bold text-lg mb-2 sticky top-14 bg-background py-2 border-b">{date}</h3>
          <div className="space-y-4">
            {dailyReservations.map(reservation => (
              <Card 
                key={reservation.id} 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => router.push(`/reservations/${reservation.id}`)}
              >
                <CardHeader>
                  <CardTitle className="text-base">{reservation.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building className="h-4 w-4" />
                    <span>{reservation.department}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>{reservation.user_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {format(new Date(reservation.start_time), 'HH:mm')}
                      {' ~ '}
                      {format(new Date(reservation.end_time), 'HH:mm')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}


// 스켈레톤 로딩 컴포넌트
const CalendarSkeleton = () => (
    // ... (이전 코드와 동일, 변경 없음) ...
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
      
      {isLoading && <CalendarSkeleton />}
      {isError && <p className="text-destructive text-center p-8">예약 정보를 불러오는 데 실패했습니다.</p>}
      
      {!isLoading && !isError && (
        <>
          <TabsContent value="calendar">
            <ReservationCalendarView 
              reservations={reservations || []}
              weekStartDate={weekRange.start}
              isAuthenticated={isAuthenticated()}
              currentUserId={user?.id}
            />
          </TabsContent>
          <TabsContent value="list">
            {/* ✅✅✅ 2. 새로 만든 PublicListView를 사용하고, prop을 전달합니다. ✅✅✅ */}
            <PublicListView 
              reservations={reservations || []} 
            />
          </TabsContent>
        </>
      )}
    </Tabs>
  );
}