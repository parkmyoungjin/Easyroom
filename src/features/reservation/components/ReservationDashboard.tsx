'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { usePublicReservations } from '@/hooks/useReservations';
import { useRooms } from '@/hooks/useRooms';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, formatTime, utcToKst } from '@/lib/utils/date';
import type { PublicReservation, Room } from '@/types/database';
import { format } from 'date-fns';

interface TimeSlot {
  time: string;
  hour: number;
  reservations: PublicReservation[];
}

interface CurrentReservation {
  reservation: PublicReservation;
  room: Room;
}

interface ReservationDashboardProps {
  readOnly?: boolean;
}

export default function ReservationDashboard({ readOnly = false }: ReservationDashboardProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { user } = useAuth();

  // 오늘 날짜 범위 설정
  const today = format(new Date(), 'yyyy-MM-dd');
  const startDate = today;
  const endDate = today;

  // 데이터 가져오기 - 보안 강화된 버전
  const { data: reservations = [], isLoading: reservationsLoading, error: reservationsError } = usePublicReservations(startDate, endDate, !!user);
  const { data: rooms = [], isLoading: roomsLoading, error: roomsError } = useRooms();

  // 실시간 구독
  useRealtimeSubscription();

  // 예약 블록 색상 팔레트 (status 페이지와 동일)
  const colorPalette = [
    { border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-900', textLight: 'text-blue-700' },
    { border: 'border-green-500', bg: 'bg-green-50', text: 'text-green-900', textLight: 'text-green-700' },
    { border: 'border-purple-500', bg: 'bg-purple-50', text: 'text-purple-900', textLight: 'text-purple-700' },
    { border: 'border-orange-500', bg: 'bg-orange-50', text: 'text-orange-900', textLight: 'text-orange-700' },
    { border: 'border-pink-500', bg: 'bg-pink-50', text: 'text-pink-900', textLight: 'text-pink-700' },
    { border: 'border-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-900', textLight: 'text-indigo-700' },
  ];

  // 예약 ID를 기반으로 색상 선택 (status 페이지와 동일)
  const getReservationColor = (reservationId: string) => {
    const index = reservationId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colorPalette.length;
    return colorPalette[index];
  };

  // 현재 시간 업데이트 (1분마다)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // 1분마다 업데이트

    return () => clearInterval(timer);
  }, []);

  // 오늘 날짜의 예약만 필터링 (UTC to KST 변환 적용, 데이터 검증 강화)
  const todayReservations = useMemo(() => {
    if (!reservations.length) return [];

    const filteredReservations = reservations
      .filter(reservation => {
        // 데이터 검증: 필수 필드 확인
        if (!reservation.start_time || !reservation.end_time || !reservation.id) {
          console.warn('Invalid reservation data:', reservation);
          return false;
        }

        try {
          const kstStartTime = utcToKst(reservation.start_time);
          const reservationDate = format(kstStartTime, 'yyyy-MM-dd');
          return reservationDate === today;
        } catch (error) {
          console.error('Error processing reservation date:', error, reservation);
          return false;
        }
      })
      .map(reservation => ({
        ...reservation,
        is_mine: reservation.user_id === user?.id // Status 페이지와 동일한 방식으로 is_mine 필드 설정
      }))
      .sort((a, b) => {
        // Status 페이지와 동일한 방식으로 시간순 정렬
        try {
          const timeA = utcToKst(a.start_time).getTime();
          const timeB = utcToKst(b.start_time).getTime();
          return timeA - timeB;
        } catch (error) {
          console.error('Error sorting reservations:', error);
          return 0;
        }
      });

    // 개발 환경에서 디버깅 정보 출력
    if (process.env.NODE_ENV === 'development') {
      console.log('Dashboard - Today reservations:', {
        total: reservations.length,
        filtered: filteredReservations.length,
        date: today
      });
    }

    return filteredReservations;
  }, [reservations, today, user?.id]);

  // 현재 활성 예약 찾기 (에러 처리 강화)
  const currentReservation: CurrentReservation | null = useMemo(() => {
    if (!todayReservations.length || !rooms.length) return null;

    const now = new Date();
    const activeReservation = todayReservations.find(reservation => {
      try {
        const kstStartTime = utcToKst(reservation.start_time);
        const kstEndTime = utcToKst(reservation.end_time);
        return now >= kstStartTime && now <= kstEndTime;
      } catch (error) {
        console.error('Error processing reservation time:', error, reservation);
        return false;
      }
    });

    if (!activeReservation) return null;

    const room = rooms.find(r => r.id === activeReservation.room_id);
    return room ? { reservation: activeReservation, room } : null;
  }, [todayReservations, rooms, currentTime]);

  // 타임테이블 데이터 생성 (8시-20시, Status 페이지와 동일한 범위, 에러 처리 강화)
  const timeSlots: TimeSlot[] = useMemo(() => {
    const slots: TimeSlot[] = [];

    for (let hour = 8; hour <= 19; hour++) {
      const time = `${hour.toString().padStart(2, '0')}:00`;
      const hourReservations = todayReservations.filter(reservation => {
        try {
          const kstStartTime = utcToKst(reservation.start_time);
          const kstEndTime = utcToKst(reservation.end_time);

          // 오늘 날짜 기준으로 시간 슬롯 생성
          const slotStart = new Date();
          slotStart.setHours(hour, 0, 0, 0);
          const slotEnd = new Date();
          slotEnd.setHours(hour + 1, 0, 0, 0);

          // 예약이 해당 시간대와 겹치는지 확인 (KST 기준)
          return kstStartTime < slotEnd && kstEndTime > slotStart;
        } catch (error) {
          console.error('Error processing time slot reservation:', error, reservation);
          return false;
        }
      });

      slots.push({
        time,
        hour,
        reservations: hourReservations,
      });
    }

    return slots;
  }, [todayReservations]);

  const isLoading = reservationsLoading || roomsLoading;
  const hasError = reservationsError || roomsError;

  // 로딩 상태 처리
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            예약 대시보드
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="ml-3 text-gray-600">대시보드를 불러오고 있습니다...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 에러 상태 처리
  if (hasError) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            예약 대시보드
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-32 space-y-3">
            <div className="text-red-500">
              <Calendar className="h-8 w-8" />
            </div>
            <div className="text-center">
              <p className="text-gray-800 font-medium">데이터를 불러올 수 없습니다</p>
              <p className="text-gray-600 text-sm mt-1">
                {reservationsError ? '예약 정보를 ' : ''}
                {roomsError ? '회의실 정보를 ' : ''}
                불러오는 중 오류가 발생했습니다.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
              >
                새로고침
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            예약 대시보드
          </CardTitle>
          <p className="text-xl font-bold text-gray-900">
            {currentTime.toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            })}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatDate(new Date(), 'yyyy년 MM월 dd일 (E)')}
        </p>
      </CardHeader>
      <CardContent>
        {/* 반응형 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* 현재 예약 상태 - 모바일에서는 상단, 데스크탑에서는 좌측 (더 큰 비율) */}
          <div className="lg:col-span-3 order-1 lg:order-1">
            <CurrentReservationCard
              reservation={currentReservation}
              reservations={todayReservations}
              rooms={rooms}
              getReservationColor={getReservationColor}
              readOnly={readOnly}
            />
          </div>

          {/* 오늘 일정 타임테이블 - 모바일에서는 하단, 데스크탑에서는 우측 (작은 비율) */}
          <div className="lg:col-span-2 order-2 lg:order-2">
            <TodayScheduleCard timeSlots={timeSlots} rooms={rooms} currentTime={currentTime} getReservationColor={getReservationColor} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 현재 예약 상태 카드
function CurrentReservationCard({
  reservation,
  reservations,
  rooms,
  getReservationColor,
  readOnly = false
}: {
  reservation: CurrentReservation | null;
  reservations: PublicReservation[];
  rooms: Room[];
  getReservationColor: (id: string) => any;
  readOnly?: boolean;
}) {
  const currentTime = new Date();
  const currentHour = currentTime.getHours();

  // 현재 시간대의 다음 예약 찾기 (예약 없음 표시용)
  const getNextTimeSlot = () => {
    const last = getLastEndedReservation();
    const next = nextReservation ? utcToKst(nextReservation.start_time) : null;
    const start = last ? utcToKst(last.end_time) : new Date();

    if (!next) return `${formatTime(start)} ~ 종료`;

    return `${formatTime(start)} ~ ${formatTime(next)}`;
  };

  const getLastEndedReservation = () => {
    const now = new Date();

    const pastReservations = reservations
      .filter(res => {
        try {
          const kstEndTime = utcToKst(res.end_time);
          return kstEndTime <= now;
        } catch (error) {
          console.error('Error processing reservation date:', error, res);
          return false;
        }
      })
      .sort((a, b) => {
        const endA = utcToKst(a.end_time).getTime();
        const endB = utcToKst(b.end_time).getTime();
        return endB - endA;
      });

    return pastReservations.length > 0 ? pastReservations[0] : null;
  };

  // 다음 예약 찾기 (이미 오늘 날짜로 필터링된 reservations 사용)
  const getNextReservation = () => {
    const now = new Date();
    const futureReservations = reservations
      .filter(res => {
        try {
          const kstStartTime = utcToKst(res.start_time);
          return kstStartTime > now;
        } catch (error) {
          console.error('Error processing reservation date:', error, res);
          return false;
        }
      })
      .sort((a, b) => {
        try {
          const aKstTime = utcToKst(a.start_time);
          const bKstTime = utcToKst(b.start_time);
          return aKstTime.getTime() - bKstTime.getTime();
        } catch (error) {
          console.error('Error sorting reservations:', error);
          return 0;
        }
      });

    return futureReservations.length > 0 ? futureReservations[0] : null;
  };

  const nextReservation = getNextReservation();

  if (!reservation) {
    return (
      <Card className="h-full bg-gray-50">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg text-gray-800">J동 9층 회의실</CardTitle>
              <p className="text-sm text-gray-600">{formatDate(currentTime, 'MM월 dd일')}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-2xl font-bold text-gray-700 mb-2">
              {getNextTimeSlot()} 예약없음
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-lg text-gray-600">사용 가능</p>
            {nextReservation ? (
              <p className="text-sm text-gray-500">
                다음 회의: {formatTime(nextReservation.start_time)} ({nextReservation.department})
              </p>
            ) : (
              <p className="text-sm text-gray-500">오늘 예정된 회의가 없습니다</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const { reservation: res, room } = reservation;
  const startTime = formatTime(res.start_time);
  const endTime = formatTime(res.end_time);
  const colors = getReservationColor(res.id);

  return (
    <Card className={`h-full ${colors.bg} border-l-4 ${colors.border}`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className={`text-lg ${colors.text}`}>{room.name}</CardTitle>
            <p className={`text-sm ${colors.textLight}`}>{formatDate(currentTime, 'MM월 dd일')}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className={`text-2xl font-bold ${colors.text} mb-2`}>
            {startTime} ~ {endTime} 진행중
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className={`text-xl font-bold ${colors.text}`}>
              {readOnly ? '회의 진행중' : res.title}
            </h3>
            {!readOnly && res.purpose && (
              <p className={`text-base ${colors.textLight} mt-1 truncate`}>{res.purpose}</p>
            )}
          </div>

          <div className={`border-t ${colors.border} pt-3`}>
            <p className={`text-base font-medium ${colors.textLight}`}>
              {res.department} {readOnly ? '' : `/ ${res.user_name ? '나' : '동료'}`}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 오늘 일정 타임테이블 카드 (시간 그리드 + 예약 오버레이 방식)
function TodayScheduleCard({
  timeSlots,
  rooms,
  currentTime,
  getReservationColor
}: {
  timeSlots: TimeSlot[],
  rooms: Room[],
  currentTime: Date,
  getReservationColor: (id: string) => any;
}) {
  const currentHour = currentTime.getHours();

  // 시간 범위 설정 (8시-20시, Status 페이지와 동일)
  const startHour = 8;
  const endHour = 20;
  const totalHours = endHour - startHour;
  const hourHeight = 80; // 각 시간당 80px (Status 페이지와 동일)

  // 시간 그리드 생성
  const timeGrid = Array.from({ length: totalHours }, (_, i) => {
    const hour = startHour + i;
    return {
      hour,
      time: `${hour.toString().padStart(2, '0')}:00`,
      isCurrentHour: hour === currentHour,
    };
  });

  // Status 페이지와 동일한 방식으로 예약 카드 생성
  const reservationCards = useMemo(() => {
    // timeSlots에서 모든 예약을 추출하고 중복 제거
    const allReservations = timeSlots.flatMap(slot => slot.reservations);
    const uniqueReservations = Array.from(
      new Map(allReservations.map(reservation => [reservation.id, reservation])).values()
    );

    return uniqueReservations
      .map(reservation => {
        try {
          const room = rooms.find(r => r.id === reservation.room_id);
          const kstStartTime = utcToKst(reservation.start_time);
          const kstEndTime = utcToKst(reservation.end_time);

          // KST 기준으로 시간 계산
          const startHours = kstStartTime.getHours();
          const startMinutes = kstStartTime.getMinutes();
          const endHours = kstEndTime.getHours();
          const endMinutes = kstEndTime.getMinutes();

          // 시작 시간이 표시 범위 내에 있는지 확인
          if (startHours < startHour || startHours >= endHour) {
            return null; // 범위 밖 예약은 표시하지 않음
          }

          // 8시부터의 상대적 위치 계산 (분 단위) - Status 페이지와 동일
          const startOffsetMinutes = (startHours - 8) * 60 + startMinutes;
          const endOffsetMinutes = (endHours - 8) * 60 + endMinutes;
          const durationMinutes = endOffsetMinutes - startOffsetMinutes;

          // 픽셀 단위로 변환 (80px = 1시간) - Status 페이지와 동일
          const topPosition = (startOffsetMinutes / 60) * 80;
          const height = Math.max((durationMinutes / 60) * 80, 32); // 최소 32px

          return {
            id: reservation.id,
            reservation,
            room,
            topPosition,
            height,
            startTime: formatTime(reservation.start_time),
            endTime: formatTime(reservation.end_time),
          };
        } catch (error) {
          console.error('Error processing reservation card:', error, reservation);
          return null;
        }
      })
      .filter((card): card is NonNullable<typeof card> => card !== null);
  }, [timeSlots, rooms, startHour, endHour]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">오늘 일정</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative overflow-y-auto rounded-lg border bg-gray-50" style={{ maxHeight: '480px' }}>
          {/* 시간 그리드 배경 */}
          <div
            className="relative"
            style={{ height: `${totalHours * hourHeight}px` }}
          >
            {/* 시간 라벨과 그리드 라인 */}
            {timeGrid.map((timeData, index) => (
              <div
                key={timeData.hour}
                className="absolute w-full border-b border-gray-200 bg-white"
                style={{
                  top: `${index * hourHeight}px`,
                  height: `${hourHeight}px`,
                }}
              >
                <div className="absolute left-2 top-2 text-sm font-medium text-gray-600">
                  {timeData.time}
                </div>
              </div>
            ))}

            {/* 예약 카드 오버레이 */}
            <div className="absolute inset-0" style={{ left: '64px' }}>
              {reservationCards.map((card, index) => {
                // 동일한 시간에 시작하는 예약들의 인덱스 계산 (가로 배치용)
                const sameTimeCards = reservationCards.filter((otherCard, otherIndex) =>
                  otherIndex < index && Math.abs(card.topPosition - otherCard.topPosition) < 5
                );
                const columnIndex = sameTimeCards.length;
                const maxColumns = Math.max(1, sameTimeCards.length + 1);
                const colors = getReservationColor(card.id);

                return (
                  <div
                    key={card.id}
                    className={`absolute rounded-md border-l-4 ${colors.border} ${colors.bg} p-1.5 hover:shadow-lg transition-all duration-200 cursor-pointer border border-gray-200`}
                    style={{
                      top: `${card.topPosition}px`,
                      height: `${card.height}px`,
                      left: `${(columnIndex * 100) / maxColumns + 1}%`,
                      width: `${100 / maxColumns - 2}%`,
                      zIndex: 10 + index,
                    }}
                    title={`${card.reservation.title} (${card.startTime}-${card.endTime})`}
                  >
                    <div className="text-[10px] sm:text-xs h-full flex items-center justify-between px-2">
                      <div className={`font-medium ${colors.text} truncate leading-tight`}>
                        {card.reservation.is_mine ? card.reservation.title : card.reservation.department}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 예약이 없을 때 메시지 */}
            {reservationCards.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-gray-500">오늘 예약이 없습니다</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 