// src/features/reservation/components/GoogleCalendarView.tsx

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format, addDays, getDay, getHours, getMinutes, isToday } from 'date-fns';
import { utcToKst } from "@/lib/utils/date";
import type { PublicReservation } from "@/types/database";
import { ReservationDetailDialog } from "@/features/reservation/components/ReservationDetailDialog";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';

// --- ⚙️ 설정 상수 ---
const DAYS = ['월', '화', '수', '목', '금'];
const START_HOUR = 8;
const END_HOUR = 19;
const SLOT_HEIGHT = 40; // 30분당 40px

// --- 🎨 동적 색상 시스템 ---
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

// ============================================================================
// ✨ 최종 캘린더 컴포넌트 ✨
// ============================================================================
export default function GoogleCalendarView({
  reservations,
  weekStartDate,
  isAuthenticated,
}: {
  reservations: PublicReservation[];
  weekStartDate: Date;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [selectedReservation, setSelectedReservation] = useState<PublicReservation | null>(null);
  
  // ✅ [수정] 1시간 단위의 라벨만 생성
  const timeLabels = useMemo(() => {
    return Array.from({ length: END_HOUR - START_HOUR }, (_, i) => `${String(START_HOUR + i).padStart(2, '0')}:00`);
  }, []);

  const handleEmptySlotClick = (dayIndex: number, time: string) => {
    if (!isAuthenticated) return;
    const date = addDays(weekStartDate, dayIndex);
    const dateString = format(date, 'yyyy-MM-dd');
    router.push(`/reservations/new?date=${dateString}&startTime=${time}`);
  };

  const allDepartments = useMemo(() => Array.from(new Set(reservations.map(r => r.department))), [reservations]);

  return (
    <>
      <div className="flex flex-col">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-[60px_repeat(5,1fr)] gap-2 flex-shrink-0">
          <div />
          {DAYS.map((day, i) => {
            const date = addDays(weekStartDate, i);
            return (
              <div key={i} className={cn("text-center p-2 rounded-md", isToday(date) ? "bg-primary/10" : "bg-muted")}>
                <div className="font-semibold">{day}</div>
                <div className="text-xs text-muted-foreground">{format(date, 'd')}일</div>
              </div>
            )
          })}
        </div>

        {/* 메인 캘린더 영역 */}
        <div className="mt-2 flex">
          {/* ✅ [핵심 수정] 시간 라벨 컬럼: 요일 헤더처럼 독립된 박스로 구성 */}
          <div className="w-[60px] flex-shrink-0 flex flex-col gap-2 pr-2">
            {timeLabels.map(time => (
              <div key={time} className="h-[80px] flex-grow-0 flex items-center justify-center text-xs text-muted-foreground bg-muted rounded-md">
                {time}
              </div>
            ))}
          </div>

          {/* 예약 그리드 */}
          <div className="flex-grow grid grid-cols-5 relative border rounded-lg overflow-hidden">
            {/* 배경 그리드 선 (가로/세로) */}
            <div className="absolute inset-0 grid grid-cols-5 pointer-events-none">
              {Array.from({ length: (END_HOUR - START_HOUR) * 2 }).map((_, i) => (
                <div key={i} className="col-span-5 h-10 border-t border-dashed" />
              ))}
              {DAYS.map((_, i) => (
                <div key={i} className="row-start-1 row-span-full h-full border-r border-dashed" />
              ))}
            </div>

            {/* 실제 예약 블록과 빈 공간 클릭 영역 */}
            <div className="absolute inset-0 grid grid-cols-5">
              {DAYS.map((_, dayIndex) => (
                <div key={dayIndex} className="relative" onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickY = e.clientY - rect.top;
                  const totalSlots = (END_HOUR - START_HOUR) * 2;
                  const slotIndex = Math.floor((clickY / rect.height) * totalSlots);
                  const hour = START_HOUR + Math.floor(slotIndex / 2);
                  const minute = (slotIndex % 2) * 30;
                  const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                  handleEmptySlotClick(dayIndex, timeString);
                }}>
                  {reservations.filter(res => getDay(utcToKst(res.start_time)) - 1 === dayIndex).map(res => {
                    const start = utcToKst(res.start_time);
                    const end = utcToKst(res.end_time);
                    const startMinutes = (getHours(start) * 60 + getMinutes(start)) - (START_HOUR * 60);
                    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
                    const top = (startMinutes / 30) * SLOT_HEIGHT;
                    const height = (durationMinutes / 30) * SLOT_HEIGHT;
                    const colors = getDepartmentColors(res.department);

                    return (
                      <div
                        key={res.id}
                        className={cn("absolute w-[calc(100%_-_4px)] ml-[2px] p-1 rounded-md border cursor-pointer shadow-sm hover:shadow-lg transition-all z-10", colors.bg, colors.text, colors.border)}
                        style={{ top: `${top}px`, height: `${height - 2}px` }}
                        onClick={(e) => { e.stopPropagation(); setSelectedReservation(res); }}
                      >
                        <div className="overflow-hidden text-xs font-semibold truncate">{res.title}</div>
                        {height >= SLOT_HEIGHT * 1.5 && <div className="text-xs opacity-90 truncate">{res.department}</div>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* 범례 */}
      <div className="flex flex-wrap gap-2 mt-4">
        {allDepartments.map(dept => {
          const colors = getDepartmentColors(dept);
          return <Badge key={dept} className={cn("border-0", colors.bg, colors.text)}>{dept}</Badge>
        })}
      </div>

      {/* 상세 정보 모달 */}
      <ReservationDetailDialog
        reservation={selectedReservation}
        isOpen={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
      />
    </>
  );
}