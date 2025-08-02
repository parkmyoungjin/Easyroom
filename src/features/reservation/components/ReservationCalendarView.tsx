'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from '@/components/ui/card';
import { addDays, format, getDay, getHours, getMinutes, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { utcToKst } from "@/lib/utils/date";
import type { PublicReservation } from "@/types/database";
import { ReservationDetailDialog } from "@/features/reservation/components/ReservationDetailDialog";
import { useQueryClient } from '@tanstack/react-query'; // ✅ QueryClient 훅 import
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { reservationKeys } from '@/hooks/useReservations';

// 상수 정의
const DAYS = ['월', '화', '수', '목', '금'];
const START_HOUR = 8;
const END_HOUR = 19;
const SLOT_HEIGHT_PX = 40;

// 데이터를 요일별로 그룹화하는 헬퍼 함수
function groupReservationsByDay(reservations: PublicReservation[], weekStartDate: Date) {
  const grouped: Record<string, PublicReservation[]> = {};
  for (let i = 0; i < 5; i++) {
    const dayKey = format(addDays(weekStartDate, i), 'yyyy-MM-dd');
    grouped[dayKey] = [];
  }

  reservations.forEach(res => {
    const dayKey = format(utcToKst(res.start_time), 'yyyy-MM-dd');
    if (grouped[dayKey]) {
      grouped[dayKey].push(res);
    }
  });

  Object.values(grouped).forEach(dayReservations => {
    dayReservations.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  });

  return grouped;
}

// 하루치 타임라인을 렌더링하는 컴포넌트
function DayTimeline({ reservations, date, isAuthenticated, currentUserId, onReservationClick }: { 
  reservations: PublicReservation[], 
  date: Date, 
  isAuthenticated: boolean, 
  currentUserId?: string,
  onReservationClick: (reservation: PublicReservation) => void 
}) {
  const router = useRouter();

  const handleSlotClick = (hour: number, minute: number) => {
    if (!isAuthenticated) return;
    const dateString = format(date, 'yyyy-MM-dd');
    const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    router.push(`/reservations/new?date=${dateString}&startTime=${timeString}`);
  };

  return (
    <div className="relative h-[calc((19-8)*2*40px)] ml-12">
      {/* 시간 눈금 및 클릭 가능한 슬롯 */}
      {Array.from({ length: (END_HOUR - START_HOUR) * 2 }).map((_, i) => {
        const hour = START_HOUR + Math.floor(i / 2);
        const minute = (i % 2) * 30;
        return (
          <div
            key={i}
            className={`absolute left-0 right-0 border-t border-dashed ${isAuthenticated ? 'cursor-pointer hover:bg-muted/50' : ''}`}
            style={{ top: `${i * SLOT_HEIGHT_PX}px` }}
            onClick={() => handleSlotClick(hour, minute)}
          >
            {minute === 0 && (
              <span className="absolute -left-12 top-[-0.7em] text-xs text-muted-foreground text-right w-10">
                {hour}:00
              </span>
            )}
          </div>
        );
      })}
      
      {/* 예약 블록 */}
      {reservations.map(res => {
        const start = utcToKst(res.start_time);
        const end = utcToKst(res.end_time);
        const startOffset = ((getHours(start) - START_HOUR) * 60 + getMinutes(start));
        const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
        
        const top = (startOffset / 30) * SLOT_HEIGHT_PX;
        const height = (durationMinutes / 30) * SLOT_HEIGHT_PX;

        const isMine = res.user_id === currentUserId;

        return (
          <div
            key={res.id}
            className={`absolute left-1 right-1 rounded-md p-2 text-xs overflow-hidden cursor-pointer transition-shadow hover:shadow-md ${isMine ? 'bg-primary/80 text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
            style={{ top: `${top}px`, height: `${height - 2}px` }}
            onClick={() => onReservationClick(res)}
          >
            <p className="font-bold truncate">{res.title}</p>
            <p className="opacity-90 truncate">{res.department}</p>
            {isAuthenticated && <p className="opacity-90 truncate">{isMine ? '내 예약' : res.user_name}</p>}
          </div>
        );
      })}
    </div>
  );
}

// 메인 캘린더 뷰 컴포넌트
export default function ReservationCalendarView({ reservations, weekStartDate, isAuthenticated, currentUserId }: { 
  reservations: PublicReservation[], 
  weekStartDate: Date,
  isAuthenticated: boolean,
  currentUserId?: string
}) {
  // ✅✅✅ 이 라인을 추가하여 queryClient 인스턴스를 가져옵니다. ✅✅✅
  const queryClient = useQueryClient();
  const [selectedReservation, setSelectedReservation] = useState<PublicReservation | null>(null);
  
  const reservationsByDay = useMemo(() => {
    return groupReservationsByDay(reservations, weekStartDate);
  }, [reservations, weekStartDate]);
  
  // 실시간 구독 로직 (이제 정상적으로 작동합니다)
  useRealtimeSubscription();

  const todayIndex = getDay(new Date());
  const defaultTabValue = (todayIndex >= 1 && todayIndex <= 5) ? DAYS[todayIndex - 1] : '월';

  return (
    <>
      <Tabs defaultValue={defaultTabValue} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          {DAYS.map((day, index) => {
            const date = addDays(weekStartDate, index);
            return (
              <TabsTrigger key={day} value={day} className={`flex-col h-auto ${isToday(date) ? 'data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent' : ''}`}>
                <span className="font-semibold">{day}</span>
                <span className="text-xs text-muted-foreground">{format(date, 'd')}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {DAYS.map((day, index) => {
          const date = addDays(weekStartDate, index);
          const dayKey = format(date, 'yyyy-MM-dd');
          return (
            <TabsContent key={day} value={day}>
              <Card>
                <CardContent className="p-2 sm:p-4 pt-4">
                  <DayTimeline 
                    reservations={reservationsByDay[dayKey] || []}
                    date={date}
                    isAuthenticated={isAuthenticated}
                    currentUserId={currentUserId}
                    onReservationClick={setSelectedReservation}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
      
      {/* 예약 상세 정보 모달 */}
      <ReservationDetailDialog
        reservation={selectedReservation}
        isOpen={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
      />
    </>
  );
}