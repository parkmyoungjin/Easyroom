"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, addDays, addWeeks, addMonths, startOfDay, endOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import InfiniteReservationList from '@/components/reservations/InfiniteReservationList';
import MobileHeader from '@/components/ui/mobile-header';

type DateRange = {
  from: Date;
  to: Date;
};

type RangePreset = {
  label: string;
  value: string;
  getRange: () => DateRange;
};

const rangePresets: RangePreset[] = [
  {
    label: '오늘',
    value: 'today',
    getRange: () => {
      const today = new Date();
      return { from: startOfDay(today), to: endOfDay(today) };
    }
  },
  {
    label: '이번 주',
    value: 'this-week',
    getRange: () => {
      const today = new Date();
      return { from: startOfDay(today), to: endOfDay(addDays(today, 6)) };
    }
  },
  {
    label: '다음 주',
    value: 'next-week',
    getRange: () => {
      const nextWeek = addWeeks(new Date(), 1);
      return { from: startOfDay(nextWeek), to: endOfDay(addDays(nextWeek, 6)) };
    }
  },
  {
    label: '이번 달',
    value: 'this-month',
    getRange: () => {
      const today = new Date();
      return { from: startOfDay(today), to: endOfDay(addMonths(today, 1)) };
    }
  },
  {
    label: '다음 달',
    value: 'next-month',
    getRange: () => {
      const nextMonth = addMonths(new Date(), 1);
      return { from: startOfDay(nextMonth), to: endOfDay(addMonths(nextMonth, 1)) };
    }
  }
];

export default function BrowseReservationsPage() {
  const router = useRouter();
  const [dateRange, setDateRange] = useState<DateRange>(() => rangePresets[2].getRange()); // Default to "this week"
  const [selectedPreset, setSelectedPreset] = useState('this-week');
  const [pageSize, setPageSize] = useState(20);

  const handleBack = () => {
    router.back();
  };

  const handlePresetChange = (presetValue: string) => {
    const preset = rangePresets.find(p => p.value === presetValue);
    if (preset) {
      setSelectedPreset(presetValue);
      setDateRange(preset.getRange());
    }
  };



  const formatDateRange = (range: DateRange) => {
    if (format(range.from, 'yyyy-MM-dd') === format(range.to, 'yyyy-MM-dd')) {
      return format(range.from, 'yyyy년 MM월 dd일 (EEE)', { locale: ko });
    }
    return `${format(range.from, 'MM월 dd일', { locale: ko })} ~ ${format(range.to, 'MM월 dd일 (EEE)', { locale: ko })}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader title="예약 둘러보기" onBack={handleBack} />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">예약 둘러보기</h1>
          <p className="text-muted-foreground">
            회의실 예약 현황을 확인하고 원하는 시간대를 찾아보세요.
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>필터 설정</CardTitle>
            <CardDescription>
              조회할 기간과 표시 옵션을 선택하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Date Range Preset */}
              <div className="space-y-2">
                <label className="text-sm font-medium">기간 선택</label>
                <Select value={selectedPreset} onValueChange={handlePresetChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="기간을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {rangePresets.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">직접 선택</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Date Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">사용자 정의 기간</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={format(dateRange.from, 'yyyy-MM-dd')}
                    onChange={(e) => {
                      if (e.target.value && selectedPreset === 'custom') {
                        const newFrom = new Date(e.target.value);
                        setDateRange(prev => ({ ...prev, from: startOfDay(newFrom) }));
                      }
                    }}
                    disabled={selectedPreset !== 'custom'}
                    className="flex-1 px-3 py-2 border border-input bg-background rounded-md text-sm disabled:opacity-50"
                  />
                  <span className="flex items-center text-sm text-muted-foreground">~</span>
                  <input
                    type="date"
                    value={format(dateRange.to, 'yyyy-MM-dd')}
                    onChange={(e) => {
                      if (e.target.value && selectedPreset === 'custom') {
                        const newTo = new Date(e.target.value);
                        setDateRange(prev => ({ ...prev, to: endOfDay(newTo) }));
                      }
                    }}
                    disabled={selectedPreset !== 'custom'}
                    className="flex-1 px-3 py-2 border border-input bg-background rounded-md text-sm disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Page Size */}
              <div className="space-y-2">
                <label className="text-sm font-medium">페이지 크기</label>
                <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10개씩</SelectItem>
                    <SelectItem value="20">20개씩</SelectItem>
                    <SelectItem value="50">50개씩</SelectItem>
                    <SelectItem value="100">100개씩</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Current selection display */}
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <span className="font-medium">선택된 기간:</span> {formatDateRange(dateRange)}
                <span className="ml-4 font-medium">페이지 크기:</span> {pageSize}개
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Infinite Reservation List */}
        <InfiniteReservationList
          startDate={format(dateRange.from, 'yyyy-MM-dd')}
          endDate={format(dateRange.to, 'yyyy-MM-dd')}
          limit={pageSize}
          className="mb-8"
        />
      </div>
    </div>
  );
}