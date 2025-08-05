// FILE: src/features/reservation/components/GoogleCalendarView.tsx

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format, addDays, getDay, getHours, getMinutes, isToday } from 'date-fns';
import { utcToKst } from "@/lib/utils/date";
import type { PublicReservation } from "@/types/database";
import { ReservationDetailDialog } from "@/features/reservation/components/ReservationDetailDialog";

// cn 함수 제거 - Mantine 스타일링 사용
import { useReservationsRealtime } from '@/hooks/useReservationsRealtime';
import { useUpdateReservation } from '@/hooks/useReservations';

import { toast } from 'sonner';
import {
  DndContext,
  DragEndEvent,
  useDraggable,
  useDroppable,
  DragOverlay,
  closestCenter,
} from '@dnd-kit/core';

// --- ⚙️ 설정 상수 ---
const DAYS = ['월', '화', '수', '목', '금'];
const START_HOUR = 8;
const END_HOUR = 19;
const SLOT_HEIGHT = 40; // 30분당 40px

// --- 🎨 동적 색상 시스템 (변경 없음) ---
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
// 🎯 드래그 가능한 예약 블록 컴포넌트
// ============================================================================
interface DraggableReservationBlockProps {
  reservation: PublicReservation;
  top: number;
  height: number;
  colors: { bg: string; text: string; border: string };
  onSelect: (reservation: PublicReservation) => void;
  isAuthenticated: boolean;
}

function DraggableReservationBlock({
  reservation,
  top,
  height,
  colors,
  onSelect,
  isAuthenticated,
}: DraggableReservationBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: reservation.id,
    disabled: !isAuthenticated,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{ top: `${top}px`, height: `${height - 2}px`, ...style }}
      className={`absolute w-[calc(100%_-_4px)] ml-[2px] p-1 rounded-md border cursor-pointer shadow-sm hover:shadow-lg transition-all z-10 ${colors.bg} ${colors.text} ${colors.border} ${isDragging ? 'opacity-50 shadow-2xl' : ''} ${!isAuthenticated ? 'cursor-default' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(reservation);
      }}
      {...listeners}
      {...attributes}
    >
      <div className="overflow-hidden text-xs font-semibold truncate">
        {reservation.title}
      </div>
    </div>
  );
}

// ============================================================================
// 🎯 드롭 가능한 요일 컬럼 컴포넌트
// ============================================================================
interface DroppableDayColumnProps {
  dayIndex: number;
  reservations: PublicReservation[];
  weekStartDate: Date;
  timeSlots: string[];
  onEmptySlotClick: (dayIndex: number, time: string) => void;
  onSelectReservation: (reservation: PublicReservation) => void;
  isAuthenticated: boolean;
}

function DroppableDayColumn({
  dayIndex,
  reservations,
  weekStartDate,
  timeSlots,
  onEmptySlotClick,
  onSelectReservation,
  isAuthenticated,
}: DroppableDayColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `day-${dayIndex}`,
  });

  const dayReservations = reservations.filter(
    res => getDay(utcToKst(res.start_time)) - 1 === dayIndex
  );

  return (
    <div
      ref={setNodeRef}
      className={`relative h-full transition-colors ${isOver ? 'bg-blue-50/50' : ''}`}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        const slotIndex = Math.floor(clickY / SLOT_HEIGHT);
        if (timeSlots[slotIndex]) {
          onEmptySlotClick(dayIndex, timeSlots[slotIndex]);
        }
      }}
    >
      {dayReservations.map(res => {
        const start = utcToKst(res.start_time);
        const end = utcToKst(res.end_time);
        const startMinutes = (getHours(start) * 60 + getMinutes(start)) - (START_HOUR * 60);
        const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
        const top = (startMinutes / 30) * SLOT_HEIGHT;
        const height = (durationMinutes / 30) * SLOT_HEIGHT;
        const colors = getDepartmentColors(res.department);

        return (
          <DraggableReservationBlock
            key={res.id}
            reservation={res}
            top={top}
            height={height}
            colors={colors}
            onSelect={onSelectReservation}
            isAuthenticated={isAuthenticated}
          />
        );
      })}
    </div>
  );
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
  const [draggedReservation, setDraggedReservation] = useState<PublicReservation | null>(null);

  // 🚀 실시간 동기화 활성화 - 주간 범위 계산
  const startDate = format(weekStartDate, 'yyyy-MM-dd');
  const endDate = format(addDays(weekStartDate, 6), 'yyyy-MM-dd'); // 주간 범위 (월~일)
  useReservationsRealtime(startDate, endDate, isAuthenticated);

  // 🔄 데이터 업데이트 훅
  const updateReservation = useUpdateReservation();

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
      slots.push(`${String(h).padStart(2, '0')}:30`);
    }
    return slots;
  }, []);

  const handleEmptySlotClick = (dayIndex: number, time: string) => {
    if (!isAuthenticated) return;
    const date = addDays(weekStartDate, dayIndex);
    const dateString = format(date, 'yyyy-MM-dd');
    router.push(`/reservations/new?date=${dateString}&startTime=${time}`);
  };

  // 🎯 드래그 앤 드롭 핵심 로직
  const handleDragStart = (event: any) => {
    const reservation = reservations.find(r => r.id === event.active.id);
    setDraggedReservation(reservation || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedReservation(null);

    if (!over || !active) return;

    const reservationId = active.id as string;
    const reservation = reservations.find(r => r.id === reservationId);
    if (!reservation) return;

    // 드롭된 요일 추출
    const dayMatch = over.id.toString().match(/^day-(\d+)$/);
    if (!dayMatch) return;

    const newDayIndex = parseInt(dayMatch[1]);
    const newDate = addDays(weekStartDate, newDayIndex);

    // 마우스 Y좌표를 통한 시간 계산
    const activatorEvent = event.activatorEvent as MouseEvent;
    const dropY = event.delta.y + (activatorEvent?.clientY || 0);
    const containerRect = document.querySelector(`[data-rbd-droppable-id="day-${newDayIndex}"]`)?.getBoundingClientRect();

    if (!containerRect) return;

    const relativeY = dropY - containerRect.top;
    const slotIndex = Math.max(0, Math.floor(relativeY / SLOT_HEIGHT));
    const newStartHour = START_HOUR + Math.floor(slotIndex / 2);
    const newStartMinute = (slotIndex % 2) * 30;

    // 기존 예약 시간 계산
    const originalStart = utcToKst(reservation.start_time);
    const originalEnd = utcToKst(reservation.end_time);
    const durationMs = originalEnd.getTime() - originalStart.getTime();

    // 새로운 시작/종료 시간 계산
    const newStartTime = new Date(newDate);
    newStartTime.setHours(newStartHour, newStartMinute, 0, 0);
    const newEndTime = new Date(newStartTime.getTime() + durationMs);

    // 시간 범위 검증
    if (newStartTime.getHours() < START_HOUR || newEndTime.getHours() >= END_HOUR) {
      toast.error('운영 시간 내에서만 예약을 이동할 수 있습니다.');
      return;
    }

    // 충돌 검사 - 같은 방의 다른 예약들과 비교
    const conflictingReservation = reservations.find(r =>
      r.id !== reservationId &&
      r.room_id === reservation.room_id &&
      ((newStartTime >= utcToKst(r.start_time) && newStartTime < utcToKst(r.end_time)) ||
        (newEndTime > utcToKst(r.start_time) && newEndTime <= utcToKst(r.end_time)) ||
        (newStartTime <= utcToKst(r.start_time) && newEndTime >= utcToKst(r.end_time)))
    );

    if (conflictingReservation) {
      toast.error('해당 시간에는 다른 예약이 있어 이동할 수 없습니다.');
      return;
    }

    // 데이터베이스 업데이트 - Promise 기반 동적 알림
    const updatePromise = new Promise((resolve, reject) => {
      updateReservation.mutate({
        id: reservationId,
        data: {
          start_time: newStartTime,
          end_time: newEndTime,
        }
      }, {
        onSuccess: (data) => resolve(data),
        onError: (error) => reject(error)
      });
    });

    toast.promise(updatePromise, {
      loading: '예약 시간을 변경하는 중...',
      success: '예약이 성공적으로 변경되었습니다.',
      error: '예약 변경에 실패했습니다.'
    });
  };

  const allDepartments = useMemo(() => Array.from(new Set(reservations.map(r => r.department))), [reservations]);
  const totalSlots = (END_HOUR - START_HOUR) * 2;

  return (
    <>
      <DndContext
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col bg-white rounded-lg p-4 border">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-[60px_repeat(5,1fr)] gap-x-2 flex-shrink-0">
            <div />
            {DAYS.map((day, i) => {
              const date = addDays(weekStartDate, i);
              return (
                <div key={i} className={`text-center p-2 rounded-md ${isToday(date) ? 'bg-primary/10' : ''}`}>
                  <div className="font-semibold text-sm">{day}</div>
                  <div className="text-xs text-muted-foreground">{format(date, 'M/d')}</div>
                </div>
              )
            })}
          </div>

          {/* 메인 캘린더 영역 */}
          <div className="mt-2 flex">
            {/* 시간 라벨 컬럼 */}
            <div className="w-[60px] flex-shrink-0">
              {Array.from({ length: totalSlots }).map((_, i) => (
                <div key={i} className="h-10 relative">
                  {i % 2 === 0 && (
                    <span className="absolute -top-2 right-1 text-xs text-muted-foreground">
                      {`${String(START_HOUR + i / 2).padStart(2, '0')}:00`}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* 드래그 앤 드롭 가능한 캘린더 그리드 */}
            <div className="flex-grow relative">
              {/* 배경 그리드 */}
              <div className="absolute inset-0 grid grid-cols-5 pointer-events-none">
                {Array.from({ length: DAYS.length * totalSlots }).map((_, i) => (
                  <div key={i} className="h-10 border-b border-r border-gray-200" />
                ))}
              </div>

              {/* 드롭 가능한 요일 컬럼들 */}
              <div className="absolute inset-0 grid grid-cols-5">
                {DAYS.map((_, dayIndex) => (
                  <DroppableDayColumn
                    key={dayIndex}
                    dayIndex={dayIndex}
                    reservations={reservations}
                    weekStartDate={weekStartDate}
                    timeSlots={timeSlots}
                    onEmptySlotClick={handleEmptySlotClick}
                    onSelectReservation={setSelectedReservation}
                    isAuthenticated={isAuthenticated}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 드래그 오버레이 */}
        <DragOverlay>
          {draggedReservation ? (
            <div className={`p-1 rounded-md border shadow-2xl opacity-90 ${getDepartmentColors(draggedReservation.department).bg} ${getDepartmentColors(draggedReservation.department).text} ${getDepartmentColors(draggedReservation.department).border}`}>
              <div className="text-xs font-semibold truncate">
                {draggedReservation.title}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <ReservationDetailDialog
        reservation={selectedReservation}
        isOpen={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
      />
    </>
  );
}