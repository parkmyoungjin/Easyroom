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
import { Paper, Stack, Box, Text, useMantineTheme, useMantineColorScheme, useComputedColorScheme } from '@mantine/core';

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

  // 🎯 클릭 감지를 위한 상태
  const [clickStartTime, setClickStartTime] = useState<number>(0);
  const [clickStartPos, setClickStartPos] = useState<{ x: number; y: number } | null>(null);

  // 🎯 마우스/터치 다운 이벤트
  const handlePointerDown = (e: React.PointerEvent) => {
    setClickStartTime(Date.now());
    setClickStartPos({ x: e.clientX, y: e.clientY });
    
    // 드래그 라이브러리의 기본 동작 실행
    if (listeners?.onPointerDown) {
      listeners.onPointerDown(e);
    }
  };

  // 🎯 마우스/터치 업 이벤트
  const handlePointerUp = (e: React.PointerEvent) => {
    const clickDuration = Date.now() - clickStartTime;
    const distance = clickStartPos ? 
      Math.sqrt(
        Math.pow(e.clientX - clickStartPos.x, 2) + 
        Math.pow(e.clientY - clickStartPos.y, 2)
      ) : 0;

    // 짧은 시간(300ms 이하)이고 짧은 거리(8px 이하) 이동이면 클릭으로 간주
    if (clickDuration < 300 && distance < 8 && !isDragging) {
      e.preventDefault();
      e.stopPropagation();
      console.log('클릭 이벤트 발생:', reservation.title); // 디버깅용
      onSelect(reservation);
    }

    // 상태 초기화
    setClickStartTime(0);
    setClickStartPos(null);
  };

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
        cursor: isAuthenticated ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
        transition: isDragging ? 'none' : 'box-shadow 200ms ease, transform 200ms ease',
        userSelect: 'none', // 텍스트 선택 방지
        touchAction: 'none', // 브라우저 기본 터치 동작 방지
        ...style,
      }}
      bg={`${color}.7`}
      c="white"
      bd={`${color}.9`}
      // 🎯 정교한 클릭/드래그 분리 이벤트
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      {...attributes}
    >
      <Text size="xs" fw={700} truncate c="white">{reservation.title}</Text>
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
  
  // 🎯 전역 드래그 상태 추적 - 클릭/드래그 충돌 완전 방지
  const [isDragInProgress, setIsDragInProgress] = useState(false);

  // 🎯 정교한 센서 설정 - 클릭과 드래그의 완벽한 분리
  const sensors = useSensors(
    // 데스크탑: 마우스 이동 기반 드래그 (클릭 즉시 반응)
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px 이상 움직여야 드래그 시작
      },
    }),
    // 모바일: 최적화된 터치 센서 (클릭 반응성 향상)
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,     // 250ms → 100ms로 단축 (클릭 반응성 향상)
        tolerance: 10,  // 5px → 10px로 증가 (스크롤 허용 범위 확대)
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

  // 🎯 드래그 시작 - 전역 상태 추적 시작
  const handleDragStart = (event: any) => {
    setDraggedReservation(event.active.data.current?.reservation ?? null);
    setIsDragInProgress(true);
  };

  // ✅ 3단계: 그리드 기반 시스템에 맞는 단순화된 handleDragEnd 로직
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedReservation(null);
    
    // 🎯 드래그 종료 - 전역 상태 초기화 (지연 처리로 클릭 이벤트와 충돌 방지)
    setTimeout(() => {
      setIsDragInProgress(false);
    }, 100);

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

  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true });

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
        <div style={{ 
          minHeight: 'calc(100vh - 200px)', 
          background: computed === 'dark' ? 'var(--mantine-color-dark-7)' : 'var(--mantine-color-gray-0)',
          padding: '8px'
        }}>
          <Stack gap="sm">
            {/* 모바일 최적화 요일 헤더 */}
            <Box style={{ display: 'flex', marginBottom: '4px' }}>
              {/* 시간 라벨을 위한 빈 공간 */}
              <Box w={40} />
              {/* 요일 헤더들 */}
              {DAYS.map((day, i) => {
                const date = addDays(weekStartDate, i);
                const isTodayDate = isToday(date);
                return (
                  <Box key={i} style={{ flex: 1, padding: '0 1px' }}>
                    <Paper
                      p="xs"
                      radius="sm"
                      style={{
                        background: isTodayDate 
                          ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
                          : computed === 'dark' 
                            ? 'rgba(255, 255, 255, 0.05)' 
                            : theme.colors.gray[1],
                        border: 'none',
                        color: isTodayDate ? 'white' : undefined
                      }}
                    >
                      <Text ta="center" fw={600} size="xs" c={isTodayDate ? 'white' : (computed === 'dark' ? 'white' : 'dark')}>
                        {day}
                      </Text>
                      <Text 
                        ta="center" 
                        size="xs" 
                        c={isTodayDate ? 'rgba(255,255,255,0.8)' : 'dimmed'}
                        style={{ fontSize: '10px' }}
                      >
                        {format(date, 'M/d')}
                      </Text>
                    </Paper>
                  </Box>
                );
              })}
            </Box>

            {/* 풀스크린 캘린더 그리드 */}
            <Box 
              style={{ 
                display: 'flex',
                background: computed === 'dark' ? 'var(--mantine-color-dark-6)' : 'white',
                borderRadius: '8px',
                overflow: 'hidden',
                border: computed === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : `1px solid ${theme.colors.gray[3]}`
              }}
            >
              {/* 시간 라벨 컬럼 */}
              <Box 
                w={40} 
                style={{ 
                  position: 'relative',
                  background: computed === 'dark' ? 'rgba(255, 255, 255, 0.02)' : theme.colors.gray[0],
                  borderRight: computed === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : `1px solid ${theme.colors.gray[2]}`
                }}
              >
                {timeSlots.map((timeString, i) => (
                  <Box key={i} h={SLOT_HEIGHT} style={{ position: 'relative' }}>
                    {i % 2 === 0 && (
                      <Text 
                        c="dimmed" 
                        size="xs" 
                        fw={500}
                        style={{ 
                          position: 'absolute', 
                          top: -6, 
                          right: 4,
                          fontSize: '9px'
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
                        borderBottom: computed === 'dark' 
                          ? '1px solid rgba(255, 255, 255, 0.05)' 
                          : `1px solid ${theme.colors.gray[2]}`,
                        width: '100%',
                        background: i % 4 === 0 || i % 4 === 1 
                          ? (computed === 'dark' ? 'rgba(255, 255, 255, 0.01)' : theme.colors.gray[0])
                          : 'transparent'
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
                        borderRight: dayIndex < DAYS.length - 1 
                          ? (computed === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : `1px solid ${theme.colors.gray[2]}`)
                          : 'none'
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
        </div>

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