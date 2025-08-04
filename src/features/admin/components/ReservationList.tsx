// FILE: src/features/admin/components/ReservationList.tsx

'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { utcToKst } from '@/lib/utils/date';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
// ✅ [핵심 수정] 모든 예약 관련 훅을 단일 파일에서 import 합니다.
import { 
    useReservationsWithDetails,
    useUpdateReservation,
    useCancelReservation 
} from '@/hooks/useReservations';
import { useRooms } from '@/hooks/useRooms';
import { ReservationErrorHandler } from '@/lib/utils/error-handler';
import type { Reservation } from '@/types/database';

export function ReservationList() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  
  const queryStartDate = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
  const queryEndDate = queryStartDate;
  
  const { data: reservations, isLoading } = useReservationsWithDetails(
    queryStartDate,
    queryEndDate
  );
  const { data: rooms } = useRooms();
  const { mutate: updateReservation } = useUpdateReservation();
  const { mutate: cancelReservation } = useCancelReservation();

  const filteredReservations = reservations?.filter((reservation) => {
    const isRoomMatch = selectedRoom
      ? reservation.room_id === selectedRoom
      : true;
    return isRoomMatch;
  });

  const handleCancel = (reservation: Reservation) => {
    if (window.confirm('이 예약을 취소하시겠습니까?')) {
      cancelReservation(
        {
          id: reservation.id,
          reason: '관리자에 의한 취소',
        },
        {
          onSuccess: () => {
            toast({
              title: '예약 취소 완료',
              description: '예약이 취소되었습니다.',
            });
          },
          onError: (error) => {
            const reservationError = ReservationErrorHandler.handleReservationError(error, {
              action: 'cancel',
              reservationId: reservation.id,
              userRole: 'admin',
              timestamp: new Date().toISOString()
            });

            const userMessage = ReservationErrorHandler.getUserFriendlyMessage(reservationError, 'cancel');

            toast({
              variant: 'destructive',
              title: userMessage.title,
              description: userMessage.description,
            });
          },
        }
      );
    }
  };

  if (isLoading) {
    return <div>로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <div className="w-[280px]">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="rounded-md border"
          />
        </div>

        <div className="flex-1">
          <Select value={selectedRoom} onValueChange={setSelectedRoom}>
            <SelectTrigger>
              <SelectValue placeholder="전체 회의실" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">전체 회의실</SelectItem>
              {rooms?.map((room) => (
                <SelectItem key={room.id} value={room.id}>
                  {room.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>회의실</TableHead>
              <TableHead>제목</TableHead>
              <TableHead>예약자</TableHead>
              <TableHead>시간</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReservations?.map((reservation) => {
              const room = rooms?.find((r) => r.id === reservation.room_id);
              return (
                <TableRow key={reservation.id}>
                  <TableCell>{room?.name}</TableCell>
                  <TableCell>{reservation.title}</TableCell>
                  <TableCell>{(reservation as any).user?.name || 'Unknown'}</TableCell>
                  <TableCell>
                    {format(utcToKst(reservation.start_time), 'PPP EEEE p', {
                      locale: ko,
                    })}
                    {' ~ '}
                    {format(utcToKst(reservation.end_time), 'p', { locale: ko })}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        reservation.status === 'confirmed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {reservation.status === 'confirmed' ? '확정' : '취소됨'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {reservation.status === 'confirmed' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleCancel(reservation)}
                      >
                        취소
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}