// src/app/reservations/status/page.tsx

'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
// 캘린더 컴포넌트 이름을 최종본으로 가정합니다.
import GoogleCalendarView from '@/features/reservation/components/GoogleCalendarView'; 
import MobileAppLayout from '@/components/layout/MobileAppLayout';
import { Button, Skeleton, Badge } from '@mantine/core';
import { addDays, startOfWeek, endOfWeek, format } from 'date-fns';
import { ChevronLeft, ChevronRight, LocateFixed } from 'lucide-react';
import { usePublicReservations } from '@/hooks/useReservations';

// --- 🎨 동적 색상 시스템 (캘린더와 동일한 로직) ---
const COLOR_PALETTE = [
  { bg: 'bg-blue-500/90', text: 'text-white', border: 'border-blue-600' },
  { bg: 'bg-purple-500/90', text: 'text-white', border: 'border-purple-600' },
  { bg: 'bg-green-500/90', text: 'text-white', border: 'border-green-600' },
  { bg: 'bg-orange-500/90', text: 'text-white', border: 'border-orange-600' },
  { bg: 'bg-red-500/90', text: 'text-white', border: 'border-red-600' },
  { bg: 'bg-teal-500/90', text: 'text-white', border: 'border-teal-600' },
  { bg: 'bg-pink-500/90', text: 'text-white', border: 'border-pink-600' },
];
const departmentColorMap = new Map<string, { bg: string; text: string; border: string }>();
let colorIndex = 0;
const defaultColors = { bg: 'bg-gray-500/90', text: 'text-white', border: 'border-gray-600' };

function getDepartmentColors(department: string) {
  if (!departmentColorMap.has(department)) {
    departmentColorMap.set(department, COLOR_PALETTE[colorIndex % COLOR_PALETTE.length]);
    colorIndex++;
  }
  return departmentColorMap.get(department) || defaultColors;
}


// 스켈레톤 로딩 컴포넌트 (변경 없음)
const CalendarSkeleton = () => (
    <div className="border rounded-lg p-4 bg-card">
    {/* ... 스켈레톤 내용은 그대로 ... */}
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

  // ✅ [신규] 이번 주 예약이 있는 부서 목록 (중복 제거)
  const uniqueDepartments = useMemo(() => {
    if (!reservations) return [];
    return Array.from(new Set(reservations.map(r => r.department)));
  }, [reservations]);

  const handlePreviousWeek = () => setCurrentDate(addDays(currentDate, -7));
  const handleNextWeek = () => setCurrentDate(addDays(currentDate, 7));
  const handleGoToToday = () => setCurrentDate(new Date());

  const weekDisplay = `${format(weekRange.start, 'M월 d일')} ~ ${format(addDays(weekRange.start, 4), 'd일')}`;

  return (
    <MobileAppLayout 
      headerTitle="전체 예약 현황"
      showBackButton={true}
    >
      <div className="min-h-screen bg-background text-foreground">
        <main className="container mx-auto p-4 sm:p-6 lg:p-8 pt-0">
          
          {/* ✅ [수정] 주간 네비게이션: '오늘로 이동' 버튼 통합 */}
          <div className="flex justify-between items-center my-4 p-4 border rounded-lg bg-card">
            <Button variant="outline" size="compact-sm" onClick={handlePreviousWeek} aria-label="이전 주">
              <ChevronLeft size={16} />
            </Button>
            
            <div className="flex flex-col items-center gap-2">
              <div className="text-center">
                <p className="font-semibold text-sm sm:text-base">{format(weekRange.start, 'yyyy년')}</p>
                <p className="text-base sm:text-lg">{weekDisplay}</p>
              </div>
              <Button variant="subtle" size="compact-sm" onClick={handleGoToToday}>
                <LocateFixed size={16} style={{ marginRight: '8px' }} />
                오늘
              </Button>
            </div>

            <Button variant="outline" size="compact-sm" onClick={handleNextWeek} aria-label="다음 주">
              <ChevronRight size={16} />
            </Button>
          </div>
          
          {/* ✅ [신규] 이번 주 예약팀 정보 박스 */}
          <div className="mb-4 p-4 border rounded-lg bg-card min-h-[80px]">
              <h3 className="text-sm font-semibold mb-2 text-foreground">이번 주 예약팀</h3>
              {isLoading ? (
                  <div className="flex flex-wrap gap-2">
                      <Skeleton className="h-6 w-20 rounded-full" />
                      <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
              ) : uniqueDepartments.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                      {uniqueDepartments.map(dept => {
                          const colors = getDepartmentColors(dept);
                          return (
                            <Badge 
                              key={dept} 
                              color="blue"
                              variant="filled"
                              style={{ 
                                backgroundColor: colors.bg.replace('bg-', '').replace('/90', ''),
                                color: colors.text.replace('text-', '')
                              }}
                            >
                              {dept}
                            </Badge>
                          );
                      })}
                  </div>
              ) : (
                  <p className="text-sm text-muted-foreground">이번 주에는 예약이 없습니다.</p>
              )}
          </div>

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
    </MobileAppLayout>
  );
}