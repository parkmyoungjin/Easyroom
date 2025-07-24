'use client';

import { useState } from 'react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { useReservationStatistics } from '@/hooks/useReservationStatistics';
import { ReservationErrorHandler } from '@/lib/utils/error-handler';

export function StatisticsDownload() {
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const { mutate: downloadStatistics, isPending } = useReservationStatistics();

  const handleDownload = () => {
    const startDate = startOfMonth(selectedMonth);
    const endDate = endOfMonth(selectedMonth);

    downloadStatistics(
      {
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd"),
      },
      {
        onSuccess: () => {
          toast({
            title: '다운로드 완료',
            description: '통계 파일이 다운로드되었습니다.',
          });
        },
        onError: (error) => {
          const reservationError = ReservationErrorHandler.handleReservationError(error, {
            action: 'download_statistics',
            startDate: format(startDate, "yyyy-MM-dd"),
            endDate: format(endDate, "yyyy-MM-dd"),
            timestamp: new Date().toISOString()
          });

          const userMessage = ReservationErrorHandler.getUserFriendlyMessage(reservationError, 'download');

          toast({
            variant: 'destructive',
            title: userMessage.title,
            description: userMessage.description,
          });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <div className="w-[280px]">
          <Calendar
            mode="single"
            selected={selectedMonth}
            onSelect={(date) => date && setSelectedMonth(date)}
            className="rounded-md border"
          />
        </div>

        <div className="flex-1">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium">선택된 기간</h4>
              <p className="text-sm text-muted-foreground">
                {format(startOfMonth(selectedMonth), 'PPP', { locale: ko })} ~{' '}
                {format(endOfMonth(selectedMonth), 'PPP', { locale: ko })}
              </p>
            </div>

            <div>
              <h4 className="font-medium">포함되는 데이터</h4>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                <li>• 회의실별 예약 건수</li>
                <li>• 시간대별 예약 분포</li>
                <li>• 부서별 사용 통계</li>
                <li>• 취소율 및 사유</li>
                <li>• 평균 회의 시간</li>
              </ul>
            </div>

            <Button
              onClick={handleDownload}
              disabled={isPending}
              className="w-full"
            >
              {isPending ? '다운로드 중...' : 'CSV 다운로드'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 