'use client';

import { useQuery } from '@tanstack/react-query';
import { getCurrentRoomStatus } from '@/lib/api/checkin-checkout';
import type { RoomStatusData } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Calendar,
  Loader2
} from 'lucide-react';
import { useEffect } from 'react';
import { format, isWithinInterval, addMinutes } from 'date-fns';
import { ko } from 'date-fns/locale';

interface RoomStatusGridProps {
  className?: string;
  refreshInterval?: number;
}

export function RoomStatusGrid({ 
  className, 
  refreshInterval = 30000 
}: RoomStatusGridProps) {
  // 실시간 회의실 상태 조회
  const { data: roomStatuses, isLoading, error, refetch } = useQuery({
    queryKey: ['room-status'],
    queryFn: getCurrentRoomStatus,
    refetchInterval: refreshInterval,
    staleTime: 10000 // 10초간 캐시 유지
  });

  // 실시간 구독은 나중에 구현 (현재는 폴링으로 대체)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">회의실 상태 확인 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600">회의실 상태를 불러올 수 없습니다.</p>
        <button 
          onClick={() => refetch()} 
          className="mt-2 text-blue-600 hover:underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${className}`}>
      {roomStatuses?.map((room: RoomStatusData) => (
        <RoomStatusCard key={room.room_id} room={room} />
      ))}
    </div>
  );
}

interface RoomStatusCardProps {
  room: RoomStatusData;
}

function RoomStatusCard({ room }: RoomStatusCardProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'available':
        return {
          color: 'bg-green-50 border-green-200',
          badgeColor: 'bg-green-100 text-green-800',
          icon: CheckCircle,
          iconColor: 'text-green-600',
          text: '사용 가능'
        };
      case 'occupied':
        return {
          color: 'bg-red-50 border-red-200',
          badgeColor: 'bg-red-100 text-red-800',
          icon: AlertCircle,
          iconColor: 'text-red-600',
          text: '사용 중'
        };
      case 'reserved_soon':
        return {
          color: 'bg-yellow-50 border-yellow-200',
          badgeColor: 'bg-yellow-100 text-yellow-800',
          icon: Clock,
          iconColor: 'text-yellow-600',
          text: '곧 예약됨'
        };
      case 'reserved':
        return {
          color: 'bg-blue-50 border-blue-200',
          badgeColor: 'bg-blue-100 text-blue-800',
          icon: Calendar,
          iconColor: 'text-blue-600',
          text: '예약됨'
        };
      default:
        return {
          color: 'bg-gray-50 border-gray-200',
          badgeColor: 'bg-gray-100 text-gray-800',
          icon: Clock,
          iconColor: 'text-gray-600',
          text: '알 수 없음'
        };
    }
  };

  const statusConfig = getStatusConfig(room.current_status);
  const StatusIcon = statusConfig.icon;

  // 시간 포맷팅
  const formatTime = (timeString: string | null) => {
    if (!timeString) return '';
    try {
      return format(new Date(timeString), 'HH:mm', { locale: ko });
    } catch {
      return '';
    }
  };

  // 현재 시간과 예약 시간 비교하여 추가 정보 표시
  const getTimeInfo = () => {
    if (!room.current_start_time || !room.current_end_time) return null;

    const now = new Date();
    const startTime = new Date(room.current_start_time);
    const endTime = new Date(room.current_end_time);

    if (room.current_status === 'occupied') {
      const remainingMinutes = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / (1000 * 60)));
      return `${remainingMinutes}분 남음`;
    }

    if (room.current_status === 'reserved_soon') {
      const minutesUntilStart = Math.max(0, Math.floor((startTime.getTime() - now.getTime()) / (1000 * 60)));
      return `${minutesUntilStart}분 후 시작`;
    }

    return null;
  };

  const timeInfo = getTimeInfo();

  return (
    <Card className={`${statusConfig.color} transition-all duration-200 hover:shadow-md`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            {room.room_name}
          </CardTitle>
          <Badge className={statusConfig.badgeColor}>
            <StatusIcon className={`w-3 h-3 mr-1 ${statusConfig.iconColor}`} />
            {statusConfig.text}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* 위치 및 수용 인원 */}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center">
            <MapPin className="w-4 h-4 mr-1" />
            {room.location || '위치 미정'}
          </div>
          <div className="flex items-center">
            <Users className="w-4 h-4 mr-1" />
            {room.capacity}명
          </div>
        </div>

        {/* 현재 예약 정보 */}
        {room.current_reservation_id && (
          <div className="space-y-2 p-3 bg-white/50 rounded-lg">
            <div className="font-medium text-gray-900">
              {room.current_reservation_title}
            </div>
            
            <div className="flex items-center text-sm text-gray-600">
              <Clock className="w-4 h-4 mr-1" />
              {formatTime(room.current_start_time)} - {formatTime(room.current_end_time)}
            </div>

            {room.current_user_name && (
              <div className="text-sm text-gray-600">
                {room.current_user_name}
                {room.current_user_department && (
                  <span className="text-gray-500"> · {room.current_user_department}</span>
                )}
              </div>
            )}

            {timeInfo && (
              <div className={`text-sm font-medium ${
                room.current_status === 'occupied' 
                  ? 'text-red-600' 
                  : 'text-yellow-600'
              }`}>
                {timeInfo}
              </div>
            )}
          </div>
        )}

        {/* 사용 가능한 경우 다음 예약 정보 표시 (선택사항) */}
        {room.current_status === 'available' && (
          <div className="text-sm text-gray-500 text-center py-2">
            현재 사용 가능
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 간단한 회의실 상태 요약 컴포넌트
 */
export function RoomStatusSummary() {
  const { data: roomStatuses, isLoading } = useQuery({
    queryKey: ['room-status'],
    queryFn: getCurrentRoomStatus,
    refetchInterval: 30000
  });

  if (isLoading || !roomStatuses) {
    return (
      <div className="flex items-center space-x-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm text-gray-600">상태 확인 중...</span>
      </div>
    );
  }

  const summary = roomStatuses.reduce((acc: Record<string, number>, room: RoomStatusData) => {
    acc[room.current_status] = (acc[room.current_status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const total = roomStatuses.length;
  const available = summary.available || 0;
  const occupied = summary.occupied || 0;
  const reserved = (summary.reserved || 0) + (summary.reserved_soon || 0);

  return (
    <div className="flex items-center space-x-4 text-sm">
      <div className="flex items-center">
        <div className="w-3 h-3 bg-green-500 rounded-full mr-1"></div>
        <span>사용 가능: {available}</span>
      </div>
      <div className="flex items-center">
        <div className="w-3 h-3 bg-red-500 rounded-full mr-1"></div>
        <span>사용 중: {occupied}</span>
      </div>
      <div className="flex items-center">
        <div className="w-3 h-3 bg-blue-500 rounded-full mr-1"></div>
        <span>예약됨: {reserved}</span>
      </div>
      <div className="text-gray-600">
        총 {total}개 회의실
      </div>
    </div>
  );
}