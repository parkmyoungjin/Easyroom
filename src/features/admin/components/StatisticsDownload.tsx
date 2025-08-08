'use client';

import { useState } from 'react';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import { DatePickerInput } from '@mantine/dates';
import { formatDate } from '@/lib/utils/date';
import { Stack, Text, Group, Card, Button, Progress } from '@mantine/core';
import { toast } from 'sonner';
import { useReservationStatistics } from '@/hooks/useReservationStatistics';
import { ReservationErrorHandler } from '@/lib/utils/error-handler';

export function StatisticsDownload() {
  // ✅ 날짜 범위 선택을 위한 상태 (시작일, 종료일)
  const [dateRange, setDateRange] = useState<[string | null, string | null]>([null, null]);
  const { mutate: downloadStatistics, isPending } = useReservationStatistics();

  const handleDownload = () => {
    const [startDate, endDate] = dateRange;
    
    if (!startDate || !endDate) {
      toast.error('날짜 선택 오류', {
        description: '시작일과 종료일을 모두 선택해주세요.',
      });
      return;
    }

    downloadStatistics(
      {
        startDate: formatDate(new Date(startDate), "yyyy-MM-dd"),
        endDate: formatDate(new Date(endDate), "yyyy-MM-dd"),
      },
      {
        onSuccess: () => {
          toast.success('다운로드 완료', {
            description: '통계 파일이 다운로드되었습니다.',
          });
        },
        onError: (error) => {
          const reservationError = ReservationErrorHandler.handleReservationError(error, {
            action: 'download_statistics',
            startDate: formatDate(new Date(startDate), "yyyy-MM-dd"),
            endDate: formatDate(new Date(endDate), "yyyy-MM-dd"),
            timestamp: new Date().toISOString()
          });

          const userMessage = ReservationErrorHandler.getUserFriendlyMessage(reservationError, 'download');

          toast.error(userMessage.title, {
            description: userMessage.description,
          });
        },
      }
    );
  };

  const [startDate, endDate] = dateRange;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <Stack gap="lg">
          <div>
            <h3 className="text-lg font-semibold mb-2">통계 다운로드</h3>
            <Text size="sm" c="dimmed">
              원하는 기간을 선택하여 예약 통계를 다운로드하세요.
            </Text>
          </div>

          <DatePickerInput
            type="range"
            label="조회 기간 선택"
            placeholder="시작일 - 종료일 선택"
            value={dateRange}
            onChange={setDateRange}
            maxDate={new Date()}
            styles={{
              input: {
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '14px',
              },
            }}
            w={320}
          />

          {startDate && endDate && (
            <div>
              <h4 className="font-medium text-sm mb-2">선택된 기간</h4>
              <Text size="sm" c="dimmed">
                {formatDate(new Date(startDate), 'PPP')} ~{' '}
                {formatDate(new Date(endDate), 'PPP')}
              </Text>
            </div>
          )}

          <div>
            <h4 className="font-medium text-sm mb-2">포함되는 데이터</h4>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>• 회의실별 예약 건수</li>
              <li>• 시간대별 예약 분포</li>
              <li>• 부서별 사용 통계</li>
              <li>• 취소율 및 사유</li>
              <li>• 평균 회의 시간</li>
            </ul>
          </div>

          <Stack gap="md">
            <Button
              onClick={handleDownload}
              disabled={isPending || !startDate || !endDate}
              loading={isPending}
              fullWidth
            >
              CSV 다운로드
            </Button>

            {isPending && (
              <Stack gap="xs">
                <Text size="sm" c="dimmed" ta="center">
                  데이터를 생성 중입니다. 잠시만 기다려주세요...
                </Text>
                <Progress 
                  value={100} 
                  striped 
                  animated 
                  color="blue"
                  size="md"
                />
              </Stack>
            )}
          </Stack>
        </Stack>
      </Card>
    </div>
  );
} 