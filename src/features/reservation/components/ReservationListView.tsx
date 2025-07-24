// src/features/reservation/components/ReservationListView.tsx

'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, User, Building } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { PublicReservation } from '@/types/database'; // ✅ 타입을 PublicReservation으로 변경
import { useAuth } from '@/hooks/useAuth';

// ✅ 1. props를 통해 reservations 데이터를 받도록 인터페이스를 정의합니다.
interface ReservationListViewProps {
  reservations: PublicReservation[];
}

export function ReservationListView({ reservations }: ReservationListViewProps) {
  const router = useRouter();
  const { userProfile } = useAuth(); // ✅ 현재 사용자 정보를 가져와 '내 예약'인지 비교

  // ✅ 2. 데이터가 없는 경우를 위한 UI
  if (!reservations || reservations.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">예약 없음</h3>
          <p className="text-muted-foreground">선택된 주에는 예약이 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ✅ 3. props로 받은 reservations 데이터를 사용하여 목록을 렌더링 */}
      {reservations.map((reservation) => {
        // ✅ is_mine 속성을 현재 로그인한 사용자와 비교하여 동적으로 결정
        const isMine = userProfile?.id === reservation.user_id;
        
        return (
          <Card 
            key={reservation.id} 
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => router.push(`/reservations/${reservation.id}`)} // 상세 페이지로 이동 (가정)
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{reservation.title}</CardTitle>
                  {/* PublicReservation 타입에는 room 객체가 없으므로 department를 표시 */}
                  <CardDescription className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    {reservation.department}
                  </CardDescription>
                </div>
                {isMine && <Badge>내 예약</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>
                    {format(new Date(reservation.start_time), 'yyyy년 MM월 dd일 (EEE) HH:mm', { locale: ko })}
                    {' ~ '}
                    {format(new Date(reservation.end_time), 'HH:mm', { locale: ko })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{reservation.user_name}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}