"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Edit2, Trash2 } from 'lucide-react';
import { useMyReservations } from '@/hooks/useReservations';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ReservationCancelDialog } from './ReservationCancelDialog';
import type { Reservation, ReservationWithDetails } from '@/types/database';
import { logger } from '@/lib/utils/logger';

export function ReservationListView() {
  const router = useRouter();
  const [cancelingReservation, setCancelingReservation] = useState<ReservationWithDetails | null>(null);
  
  const { userProfile: user } = useAuth();
  const { data: reservations = [], isLoading, isError, error } = useMyReservations();

  // ✅ 민감한 정보는 개발 환경에서만 안전하게 로깅
  logger.debug('ReservationListView render', {
    userExists: !!user,
    reservationsCount: reservations?.length || 0,
    isLoading,
    isError
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-1/3"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-3 bg-muted rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (isError) {
    logger.error('내 예약 목록 조회 실패');
    return (
      <Card>
        <CardContent className="text-center py-6">
          <p className="text-muted-foreground">예약 목록을 불러오는데 실패했습니다.</p>
        </CardContent>
      </Card>
    );
  }

  if (reservations.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-6">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">예약이 없습니다</h3>
          <p className="text-muted-foreground">새로운 회의실을 예약해보세요.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reservations.map((reservation: ReservationWithDetails) => (
        <Card key={reservation.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg">{reservation.title}</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
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
              
              {reservation.purpose && (
                <p className="text-sm truncate">{reservation.purpose}</p>
              )}

              {reservation.status === 'confirmed' && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/reservations/edit/${reservation.id}`)}
                    className="flex items-center gap-2"
                  >
                    <Edit2 className="h-4 w-4" />
                    수정
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCancelingReservation(reservation)}
                    className="flex items-center gap-2 bg-orange-600 text-white hover:bg-orange-500 hover:text-white"
                  >
                    <Trash2 className="h-4 w-4" />
                    취소
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* ✅ shadcn/ui 표준 Dialog 패턴 */}
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