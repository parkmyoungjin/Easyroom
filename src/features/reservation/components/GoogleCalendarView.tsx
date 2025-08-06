// FILE: src/features/reservation/components/GoogleCalendarView.tsx

'use client';

import { useState, useMemo, FC, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, addDays, getDay, getHours, getMinutes, isToday } from 'date-fns';
import { utcToKst } from "@/lib/utils/date";
import type { PublicReservation } from "@/types/database";
import { ReservationDetailDialog } from "@/features/reservation/components/ReservationDetailDialog";
import { useReservationsRealtime } from '@/hooks/useReservationsRealtime';
import { useUpdateReservation } from '@/hooks/useReservations';
import { toast } from 'sonner';
import { DndContext, DragEndEvent, useDraggable, useDroppable, DragOverlay, closestCenter, useSensor, useSensors, PointerSensor, TouchSensor } from '@dnd-kit/core';
// ✅ [핵심] Mantine 컴포넌트들을 import 합니다.
import { Paper, Stack, Box, Text, useMantineTheme } from '@mantine/core';

// --- 설정 상수 ---
const DAYS = ['월', '화', '수', '목', '금'];
const START_HOUR = 8;
const END_HOUR = 19;
const SLOT_HEIGHT = 40;


// 색상 시스템은 CalendarControlHeader에서 중앙 관리


// ============================================================================
// 🎯 드래그 가능한 예약 블록 컴포넌트 (Mantine 버전)
// ============================================================================
interface DraggableReservationBlockProps {
  reservation: PublicReservation;
  top: number;
  height: number;
  color: string;
  onSelect: (reservation: PublicReservation) => void;
  isAuthenticated: boolean;
}

const DraggableReservationBlock: FC<DraggableReservationBlockProps> = ({ reservation, top, height, color, onSelect, isAuthenticated }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: reservation.id,
    disabled: !isAuthenticated,
    data: { reservation }, // 드래그 시 원본 데이터를 함께 전달
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 100, // 드래그 중일 때 다른 요소 위로 올라오도록
  } : {};

  return (
    <Paper
      ref={setNodeRef}
      shadow="sm"
      p="xs"
      radius="sm"
      withBorder
      style={{
        position: 'absolute',
        top: `${top}px`,
        height: `${height - 2}px`,
        width: 'calc(100% - 4px)',
        marginLeft: '2px',
        opacity: isDragging ? 0.5 : 1,
        cursor: isAuthenticated ? 'grab' : 'default',
        transition: 'box-shadow 200ms ease',
        ...style,
      }}
      bg={`${color}.7`}
      c="white"
      bd={`${color}.9`}
      onClick={(e) => { e.stopPropagation(); onSelect(reservation); }}
      {...listeners}
      {...attributes}
    >
      <Text size="xs" fw={700} truncate>{reservation.title}</Text>
    </Paper>
  );
};

// ============================================================================
// 🎯 드롭 가능한 시간 슬롯 컴포넌트 (그리드 기반 최종 진화형)
// ============================================================================
interface DroppableTimeSlotProps {
  dayIndex: number;
  timeString: string;
  onEmptySlotClick: (dayIndex: number, time: string) => void;
  isAuthenticated: boolean;
}

const DroppableTimeSlot: FC<DroppableTimeSlotProps> = ({
  dayIndex,
  timeString,
  onEmptySlotClick,
  isAuthenticated
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `day-${dayIndex}_time-${timeString}`
  });
  const theme = useMantineTheme();

  return (
    <Box
      ref={setNodeRef}
      h={SLOT_HEIGHT}
      style={{
        position: 'relative',
        borderBottom: `1px solid ${theme.colors.gray[3]}`,
        transition: 'all 200ms ease',
        backgroundColor: isOver ? theme.colors.blue[1] : 'transparent',
        border: isOver ? `2px solid ${theme.colors.blue[5]}` : '2px solid transparent',
        cursor: isAuthenticated ? 'pointer' : 'default',
      }}
      onClick={() => {
        if (isAuthenticated) {
          onEmptySlotClick(dayIndex, timeString);
        }
      }}
    />
  );
};




// ============================================================================
// ✨ 최종 캘린더 컴포넌트 (Mantine 버전) ✨
// ============================================================================
export default function GoogleCalendarView({ 
  reservations, 
  weekStartDate, 
  isAuthenticated,
  departmentColors 
}: {
  reservations: PublicReservation[];
  weekStartDate: Date;
  isAuthenticated: boolean;
  departmentColors: Map<string, string>;
}) {
  const router = useRouter();
  const theme = useMantineTheme();
  const [selectedReservation, setSelectedReservation] = useState<PublicReservation | null>(null);
  const [draggedReservation, setDraggedReservation] = useState<PublicReservation | null>(null);

  // 🎯 모바일 터치 센서 설정 - 드래그 앤 드롭 안정성 확보
  const sensors = useSensors(
    useSensor(PointerSensor), // 데스크탑 마우스, 펜 등 포인터 이벤트용
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,    // 250ms 길게 누르기로 드래그 시작
        tolerance: 5,  // 5px 이상 움직이기 전까지는 스크롤 허용
      },
    })
  );



  const startDateStr = format(weekStartDate, 'yyyy-MM-dd');
  const endDateStr = format(addDays(weekStartDate, 5), 'yyyy-MM-dd');
  useReservationsRealtime(startDateStr, endDateStr, isAuthenticated);

  const { mutate: updateReservation } = useUpdateReservation();

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
    const selectedDate = addDays(weekStartDate, dayIndex);
    const [hours, minutes] = time.split(':').map(Number);
    const startTime = new Date(selectedDate);
    startTime.setHours(hours, minutes, 0, 0);

    router.push(`/reservations/new?date=${format(startTime, 'yyyy-MM-dd')}&time=${time}`);
  };

  const handleDragStart = (event: any) => {
    setDraggedReservation(event.active.data.current?.reservation ?? null);
  };

  // ✅ 3단계: 그리드 기반 시스템에 맞는 단순화된 handleDragEnd 로직
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedReservation(null);

    if (!over || !isAuthenticated) return;

    const draggedReservation = active.data.current?.reservation as PublicReservation;
    if (!draggedReservation) return;

    // ✅ 보안 강화: 내 예약이 아닐 경우 권한 검사
    // Note: 실제 구현에서는 현재 사용자 ID와 draggedReservation.user_id 비교 필요

    const overId = over.id as string;

    // ✅ 좌표 계산 완전 제거: ID 기반 시간 추출로 단순화
    if (!overId.includes('_time-')) {
      toast.error('올바른 시간 슬롯에 드롭해주세요.');
      return;
    }

    // ✅ ID 파싱을 통한 요일과 시간 직접 추출
    const [dayPart, timePart] = overId.split('_time-');
    const targetDayIndex = parseInt(dayPart.replace('day-', ''));
    const timeString = timePart;

    // ✅ 추출된 시간 정보 검증
    if (isNaN(targetDayIndex) || targetDayIndex < 0 || targetDayIndex >= DAYS.length) {
      toast.error('올바른 요일을 선택해주세요.');
      return;
    }

    const [hours, minutes] = timeString.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) {
      toast.error('올바른 시간 형식이 아닙니다.');
      return;
    }

    // ✅ 시간 범위 검증
    if (hours < START_HOUR || hours >= END_HOUR) {
      toast.error('운영 시간 내에서만 예약을 이동할 수 있습니다.');
      return;
    }

    // ✅ 기존 예약 정보 및 새로운 시간 계산
    const originalStart = utcToKst(draggedReservation.start_time);
    const originalEnd = utcToKst(draggedReservation.end_time);
    const duration = originalEnd.getTime() - originalStart.getTime();

    const targetDate = addDays(weekStartDate, targetDayIndex);
    const newStartTime = new Date(targetDate);
    newStartTime.setHours(hours, minutes, 0, 0);
    const newEndTime = new Date(newStartTime.getTime() + duration);

    // ✅ 종료 시간 검증
    if (newEndTime.getHours() >= END_HOUR) {
      toast.error('예약 시간이 운영 시간을 초과합니다.');
      return;
    }

    // ✅ 충돌 검사: 같은 시간대에 다른 예약이 있는지 확인
    const conflictingReservation = reservations.find(res => {
      if (res.id === draggedReservation.id) return false; // 자기 자신 제외

      const resStart = utcToKst(res.start_time);
      const resEnd = utcToKst(res.end_time);

      // 같은 날짜인지 확인
      if (resStart.toDateString() !== newStartTime.toDateString()) return false;

      // 시간 겹침 확인
      return (newStartTime < resEnd && newEndTime > resStart);
    });

    if (conflictingReservation) {
      toast.error('해당 시간에 이미 다른 예약이 있습니다.');
      return;
    }

    // ✅ 예약 업데이트 실행
    updateReservation({
      id: draggedReservation.id,
      data: {
        start_time: newStartTime,
        end_time: newEndTime,
      }
    }, {
      onSuccess: () => {
        toast.success('예약이 성공적으로 이동되었습니다.');
      },
      onError: (error) => {
        console.error('예약 이동 실패:', error);
        toast.error('예약 이동에 실패했습니다.');
      },
    });
  }, [isAuthenticated, weekStartDate, updateReservation, reservations]);

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
        <Paper shadow="xs" p="md" radius="md" withBorder>
          <Stack gap="md">
            {/* 요일 헤더 */}
            <Box style={{ display: 'flex' }}>
              {/* 시간 라벨을 위한 빈 공간 */}
              <Box w={40} />
              {/* 요일 헤더들 */}
              {DAYS.map((day, i) => {
                const date = addDays(weekStartDate, i);
                return (
                  <Box key={i} style={{ flex: 1 }}>
                    <Box
                      p="xs"
                      style={{ borderRadius: theme.radius.sm }}
                      bg={isToday(date) ? theme.colors.blue[0] : 'transparent'}
                    >
                      <Text ta="center" fw={700} size="sm">{day}</Text>
                      <Text ta="center" c="dimmed" size="xs">{format(date, 'M/d')}</Text>
                    </Box>
                  </Box>
                );
              })}
            </Box>

            {/* 메인 캘린더 영역 - 픽셀 완벽 그리드 */}
            <Box style={{ display: 'flex' }}>
              {/* 시간 라벨 컬럼 */}
              <Box w={40} style={{ position: 'relative' }}>
                {timeSlots.map((timeString, i) => (
                  <Box key={i} h={SLOT_HEIGHT} style={{ position: 'relative' }}>
                    {i % 2 === 0 && (
                      <Text 
                        c="dimmed" 
                        size="xs" 
                        style={{ 
                          position: 'absolute', 
                          top: -8, 
                          right: 4,
                          fontSize: '10px'
                        }}
                      >
                        {timeString}
                      </Text>
                    )}
                  </Box>
                ))}
              </Box>

              {/* 메인 그리드 영역 */}
              <Box style={{ flex: 1, position: 'relative' }}>
                {/* 가로선 그리기 */}
                {timeSlots.map((_, i) => (
                  <Box
                    key={`horizontal-${i}`}
                    h={SLOT_HEIGHT}
                    style={{
                      borderBottom: `1px solid ${theme.colors.gray[3]}`,
                      width: '100%'
                    }}
                  />
                ))}

                {/* 세로선 그리기 */}
                {DAYS.map((_, dayIndex) => (
                  <Box
                    key={`vertical-${dayIndex}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: `${(dayIndex / DAYS.length) * 100}%`,
                      width: `${100 / DAYS.length}%`,
                      height: '100%',
                      borderRight: dayIndex < DAYS.length - 1 ? `1px solid ${theme.colors.gray[3]}` : 'none'
                    }}
                  />
                ))}

                {/* 드롭 영역 및 예약 블록 렌더링 */}
                <Box style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                  {DAYS.map((_, dayIndex) => (
                    <Box
                      key={`day-column-${dayIndex}`}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: `${(dayIndex / DAYS.length) * 100}%`,
                        width: `${100 / DAYS.length}%`,
                        height: '100%'
                      }}
                    >
                      {/* 드롭 가능한 시간 슬롯들 */}
                      {timeSlots.map((timeString, slotIndex) => (
                        <DroppableTimeSlot
                          key={`${dayIndex}-${timeString}`}
                          dayIndex={dayIndex}
                          timeString={timeString}
                          onEmptySlotClick={handleEmptySlotClick}
                          isAuthenticated={isAuthenticated}
                        />
                      ))}

                      {/* 예약 블록들 (절대 위치로 오버레이) */}
                      {reservations
                        .filter((res: PublicReservation) => getDay(utcToKst(res.start_time)) - 1 === dayIndex)
                        .map((res: PublicReservation) => {
                          const start = utcToKst(res.start_time);
                          const end = utcToKst(res.end_time);
                          const startMinutes = (getHours(start) * 60 + getMinutes(start)) - (START_HOUR * 60);
                          const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
                          const top = (startMinutes / 30) * SLOT_HEIGHT;
                          const height = (durationMinutes / 30) * SLOT_HEIGHT;
                          const color = departmentColors.get(res.department) || 'gray';

                          return (
                            <DraggableReservationBlock
                              key={res.id}
                              reservation={res}
                              top={top}
                              height={height}
                              color={color}
                              onSelect={setSelectedReservation}
                              isAuthenticated={isAuthenticated}
                            />
                          );
                        })}
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          </Stack>
        </Paper>

        {/* 드래그 오버레이 */}
        <DragOverlay>
          {draggedReservation ? (
            <Paper shadow="xl" p="xs" radius="sm" bg={`${departmentColors.get(draggedReservation.department) || 'gray'}.7`} c="white">
              <Text size="xs" fw={700} truncate>{draggedReservation.title}</Text>
            </Paper>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* 상세 정보 모달 */}
      <ReservationDetailDialog
        reservation={selectedReservation}
        isOpen={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
      />
    </>
  );
}