"use client";

import { useState, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { format, startOfWeek, endOfWeek, addDays, startOfDay, endOfDay, isSameDay, parseISO, isToday } from "date-fns";
import { ko } from "date-fns/locale";
import { usePublicReservations } from "@/hooks/useReservations";
import { formatDateTimeKorean, utcToKst } from "@/lib/utils/date";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ReservationDetailDialog } from "./ReservationDetailDialog";
import type { PublicReservation } from "@/types/database";
import { useAuth } from "@/hooks/useAuth";
import { reservationKeys } from "@/hooks/useReservations";

interface ReservationCalendarViewProps {
  onCellClick?: (date: Date, hour: number) => void;
  readOnly?: boolean;
}

export default function ReservationCalendarView({ onCellClick, readOnly = false }: ReservationCalendarViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedReservation, setSelectedReservation] = useState<PublicReservation | null>(null);
  const [date, setDate] = useState<Date>(new Date());
  
  // 선택된 날짜가 포함된 주의 월~금 범위 계산
  const weekRange = useMemo(() => {
    const start = startOfWeek(date, { weekStartsOn: 1 }); // 월요일 시작
    const end = addDays(start, 4); // 금요일까지 (월~금 5일)
    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd'),
      dates: Array.from({ length: 5 }, (_, i) => addDays(start, i))
    };
  }, [date]);

  // 주간 예약 데이터 조회 - 보안 강화된 버전
  const { data: reservations, isLoading } = usePublicReservations(
    weekRange.start,
    weekRange.end,
    !!user
  );

  // 실시간 업데이트 구독
  useRealtimeSubscription();

  // 예약 블록 색상 팔레트
  const colorPalette = [
    { border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-900', textLight: 'text-blue-700' },
    { border: 'border-green-500', bg: 'bg-green-50', text: 'text-green-900', textLight: 'text-green-700' },
    { border: 'border-purple-500', bg: 'bg-purple-50', text: 'text-purple-900', textLight: 'text-purple-700' },
    { border: 'border-orange-500', bg: 'bg-orange-50', text: 'text-orange-900', textLight: 'text-orange-700' },
    { border: 'border-pink-500', bg: 'bg-pink-50', text: 'text-pink-900', textLight: 'text-pink-700' },
    { border: 'border-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-900', textLight: 'text-indigo-700' },
  ];

  // 예약 ID를 기반으로 색상 선택
  const getReservationColor = (reservationId: string) => {
    const index = reservationId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colorPalette.length;
    return colorPalette[index];
  };

  // 시간 슬롯 생성 (08:00 ~ 19:00)
  const timeSlots = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const hour = 8 + i;
      return {
        hour,
        label: `${hour.toString().padStart(2, '0')}:00`,
        shortLabel: `${hour.toString().padStart(2, '0')}` // 짧은 버전 추가
      };
    });
  }, []);

  // 예약을 날짜별로 그룹화하고 시간 기준으로 정렬
  const reservationsByDate = useMemo(() => {
    if (!reservations) return {};
    
    const groupedReservations: { [key: string]: PublicReservation[] } = {};
    
    reservations.forEach(reservation => {
      const kstStartTime = utcToKst(reservation.start_time);
      const reservationDate = format(kstStartTime, 'yyyy-MM-dd');
      
      // is_mine 필드를 현재 사용자 정보로 업데이트
      const updatedReservation: PublicReservation = {
        ...reservation,
        is_mine: reservation.user_id === user?.id
      };
      
      if (!groupedReservations[reservationDate]) {
        groupedReservations[reservationDate] = [];
      }
      groupedReservations[reservationDate].push(updatedReservation);
    });
    
    // 각 날짜별로 시간순 정렬
    Object.keys(groupedReservations).forEach(date => {
      groupedReservations[date].sort((a, b) => {
        const timeA = utcToKst(a.start_time).getTime();
        const timeB = utcToKst(b.start_time).getTime();
        return timeA - timeB;
      });
    });
    
    return groupedReservations;
  }, [reservations, user?.id]);

  // 예약 블록 클릭 핸들러
  const handleReservationClick = (reservation: PublicReservation, e: React.MouseEvent) => {
    e.stopPropagation(); // 버블링 방지
    setSelectedReservation(reservation);
  };

  // ✅ 수동 새로고침 함수 강화 (강제 refetch 추가)
  const handleManualRefresh = async () => {
    // 캐시 무효화
    queryClient.invalidateQueries({ 
      queryKey: reservationKeys.public(weekRange.start, weekRange.end)
    });
    
    // 강제로 새 데이터 가져오기
    queryClient.refetchQueries({ 
      queryKey: reservationKeys.public(weekRange.start, weekRange.end)
    });
  };

  // 빈 셀 클릭 핸들러 수정
  const handleEmptyCellClick = (date: Date, hour: number) => {
    // 읽기 전용 모드에서는 클릭 비활성화
    if (readOnly) {
      return;
    }

    // 과거 시간인지 확인
    const clickedDateTime = new Date(date);
    clickedDateTime.setHours(hour, 0, 0, 0);

    const now = new Date();
    
    if (clickedDateTime.getTime() < now.getTime() - (60 * 60 * 1000)) {
      alert('과거 시간은 예약할 수 없습니다.');
      return; // 과거 시간은 예약할 수 없음
    }
    
    // onCellClick props 사용
    if (onCellClick) {
      onCellClick(date, hour);
    }
  };

  return (
    <div className="space-y-6">
      {/* 달력 컴포넌트 임시 주석 처리
      <Calendar
        mode="single"
        selected={date}
        onSelect={(newDate) => newDate && setDate(newDate)}
        locale={ko}
      />
      */}
      
      {/* 주간 시간표 그리드 */}
      <Card className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        {/* 네비게이터와 제목을 포함한 헤더 */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-lg border border-gray-200">
          <button
            onClick={() => setDate(addDays(date, -7))}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors shadow-sm border border-gray-200"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-800">
              {format(weekRange.dates[0], "MM월 dd일", { locale: ko })} ~ {format(weekRange.dates[4], "dd일 (E)", { locale: ko })} 
            </h2>
            
            {/* ✅ 수동 새로고침 버튼 */}
            <button
              onClick={handleManualRefresh}
              className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-700 transition-colors border border-gray-200"
              title="새로고침"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          
          <button
            onClick={() => setDate(addDays(date, 7))}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors shadow-sm border border-gray-200"
          >
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* 그리드 컨테이너 - 예약 카드 오버플로우를 위해 relative 추가 */}
            <div className="w-full relative">
              {/* 헤더 - 6열 (시간 + 5요일) */}
              <div className="grid grid-cols-6 border-b border-gray-200">
                {/* 시간 헤더 */}
                <div className="p-3 font-medium text-center bg-gray-50 text-gray-700 border-r border-gray-200">
                  <span className="text-sm">시간</span>
                </div>
                {/* 요일 헤더 */}
                {weekRange.dates.map((headerDate, index) => {
                  const isCurrentDay = isToday(headerDate);
                  return (
                    <div 
                      key={index} 
                      className={`p-2 sm:p-3 font-medium text-center border-r border-gray-200 last:border-r-0 ${
                        isCurrentDay ? 'bg-blue-50 text-blue-900' : 'bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="text-xs sm:text-sm">{format(headerDate, "E", { locale: ko })}</div>
                      <div className="text-xs sm:text-sm font-normal">{format(headerDate, "MM/dd", { locale: ko })}</div>
                    </div>
                  );
                })}
              </div>
              
              {/* 시간표 그리드 - 6열 (시간 + 5요일) */}
              {timeSlots.map(({ hour, label, shortLabel }) => (
                <div key={hour} className="grid grid-cols-6 border-b border-gray-200 last:border-b-0">
                  {/* 시간 열 */}
                  <div className="p-2 sm:p-3 text-center font-medium bg-gray-50 text-gray-700 border-r border-gray-200 min-h-[80px] flex items-center justify-center">
                    <span className="text-xs sm:text-sm">
                      <span className="hidden sm:inline">{label}</span>
                      <span className="sm:hidden">{shortLabel}</span>
                    </span>
                  </div>
                  {/* 요일 열 */}
                  {weekRange.dates.map((cellDate, dayIndex) => {
                    const dateStr = format(cellDate, 'yyyy-MM-dd');
                    
                    return (
                      <div 
                        key={dayIndex} 
                        className={`border-r border-gray-200 last:border-r-0 min-h-[80px] relative transition-colors ${
                          readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-gray-50'
                        }`}
                        onClick={() => handleEmptyCellClick(cellDate, hour)}
                      >
                        {/* 첫 번째 시간 슬롯(8시)에서만 해당 날짜의 모든 예약을 렌더링 */}
                        {hour === 8 && (
                          <div className="absolute inset-0" style={{ top: 0, height: `${timeSlots.length * 80}px` }}>
                            {(reservationsByDate[dateStr] || []).map((reservation, resIndex) => {
                              const kstStartTime = utcToKst(reservation.start_time);
                              const kstEndTime = utcToKst(reservation.end_time);
                              
                              // 시간 계산
                              const startHour = kstStartTime.getHours();
                              const startMinutes = kstStartTime.getMinutes();
                              const endHour = kstEndTime.getHours();
                              const endMinutes = kstEndTime.getMinutes();
                              
                              // 8시부터의 상대적 위치 계산 (분 단위)
                              const startOffsetMinutes = (startHour - 8) * 60 + startMinutes;
                              const endOffsetMinutes = (endHour - 8) * 60 + endMinutes;
                              const durationMinutes = endOffsetMinutes - startOffsetMinutes;
                              
                              // 픽셀 단위로 변환 (80px = 1시간)
                              const topPosition = (startOffsetMinutes / 60) * 80;
                              const height = Math.max((durationMinutes / 60) * 80, 32); // 최소 32px
                              
                              const cardWidth = 'calc(100% - 12px)'; // 고정 너비
                              
                              const colors = getReservationColor(reservation.id);
                              
                              return (
                                <div
                                  key={reservation.id}
                                  className={`absolute rounded-md border-l-4 ${colors.border} ${colors.bg} p-1.5 hover:shadow-lg transition-all duration-200 cursor-pointer border border-gray-200`}
                                  style={{
                                    top: `${topPosition}px`,
                                    height: `${height}px`,
                                    width: cardWidth,
                                    zIndex: 10 + resIndex,
                                  }}
                                  onClick={(e) => handleReservationClick(reservation, e)}
                                  title={`${reservation.title} (${format(kstStartTime, 'HH:mm')}-${format(kstEndTime, 'HH:mm')})`}
                                >
                                  <div className="text-[10px] sm:text-xs h-full flex items-center justify-between px-2">
                                    <div className={`font-medium ${colors.text} truncate leading-tight`}>
                                      {reservation.is_mine ? reservation.title : reservation.department}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
      
      {/* 예약 상세 정보 모달 */}
      <ReservationDetailDialog
        reservation={selectedReservation}
        isOpen={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
      />

    </div>
  );
}
