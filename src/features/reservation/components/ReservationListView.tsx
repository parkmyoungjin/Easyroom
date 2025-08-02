// src/features/reservation/components/ReservationListView.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Edit2, Trash2 } from 'lucide-react';
import { useMyReservations } from '@/hooks/useReservations'; // ✅ useMyReservations를 직접 사용
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ReservationCancelDialog } from '@/features/reservation/components/ReservationCancelDialog';
import type { ReservationWithDetails } from '@/types/database';
import { logger } from '@/lib/utils/logger';
import { Skeleton } from '@/components/ui/skeleton'; // ✅ Skeleton import

// ✅ 로딩 스켈레톤 UI
const ReservationListSkeleton = () => (
  <div className="space-y-4">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="p-4 border rounded-lg bg-card">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="space-y-3 mt-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    ))}
  </div>
);

// ✅ Props를 받지 않는 독립적인 컴포넌트로 변경
export function ReservationListView() {
  const router = useRouter();
  const [cancelingReservation, setCancelingReservation] = useState<ReservationWithDetails | null>(null);
  
  // ✅ 1. 데이터를 자체적으로 가져옵니다.
  const { data: reservations = [], isLoading, isError } = useMyReservations();

  if (isLoading) {
    return <ReservationListSkeleton />;
  }

  if (isError) {
    return (
      <Card><CardContent className="text-center py-6 text-destructive">예약 목록을 불러오는데 실패했습니다.</CardContent></Card>
    );
  }

  if (reservations.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">예약이 없습니다</h3>
          <p className="text-muted-foreground">새로운 회의실을 예약해보세요.</p>
          <Button className="mt-4" onClick={() => router.push('/reservations/new')}>새 예약하기</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ✅ 2. ReservationWithDetails 타입에 맞는 UI를 렌더링합니다. */}
      {reservations.map((reservation) => (
        <Card key={reservation.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg">{reservation.title}</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {/* ✅ room 객체를 사용합니다. */}
                  {reservation.room?.name || '알 수 없는 회의실'}
                </CardDescription>
              </div>
              <Badge variant={reservation.status === 'confirmed' ? 'default' : 'secondary'}>
                {reservation.status === 'confirmed' ? '확정됨' : '취소됨'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  {format(new Date(reservation.start_time), 'yyyy년 MM월 dd일 (EEE) HH:mm', { locale: ko })}
                  {' ~ '}
                  {format(new Date(reservation.end_time), 'HH:mm', { locale: ko })}
                </span>
              </div>
              
              {reservation.purpose && ( <p className="text-sm p-2 bg-muted rounded">{reservation.purpose}</p> )}

              {reservation.status === 'confirmed' && (
                <div className="flex gap-2 pt-2 border-t">
                  <Button variant="outline" size="sm" onClick={() => router.push(`/reservations/edit/${reservation.id}`)}>
                    <Edit2 className="mr-2 h-4 w-4" /> 수정
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setCancelingReservation(reservation)}>
                    <Trash2 className="mr-2 h-4 w-4" /> 취소
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {cancelingReservation && (
        <ReservationCancelDialog
          reservation={cancelingReservation}
          open={true}
          onOpenChange={(open) => !open && setCancelingReservation(null)}
        />
      )}
    </div>
  );
}