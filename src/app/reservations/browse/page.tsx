"use client";

import { useState } from 'react';
import { Card, Select, Text } from '@mantine/core';
import { format, addDays, addWeeks, addMonths, startOfDay, endOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';

import InfiniteReservationList from '@/components/reservations/InfiniteReservationList';
import AppLayout from '@/components/layout/AppLayout';

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
  const [dateRange, setDateRange] = useState<DateRange>(() => rangePresets[2].getRange()); // Default to "this week"
  const [selectedPreset, setSelectedPreset] = useState('this-week');
  const [pageSize, setPageSize] = useState(20);

  const handleBack = () => {
    window.history.back();
  };

  const handlePresetChange = (presetValue: string | null) => {
    if (!presetValue) return;
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
    <AppLayout headerTitle="예약 둘러보기" onBack={handleBack}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">예약 둘러보기</h1>
          <p className="text-muted-foreground">
            회의실 예약 현황을 확인하고 원하는 시간대를 찾아보세요.
          </p>
        </div>

        {/* Filters */}
        <Card withBorder mb="xl">
          <Card.Section withBorder inheritPadding py="xs">
            <Text fw={600}>필터 설정</Text>
            <Text size="sm" c="dimmed">조회할 기간과 표시 옵션을 선택하세요.</Text>
          </Card.Section>
          <Card.Section inheritPadding py="md">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Date Range Preset */}
              <div className="space-y-2">
                <Text size="sm" fw={500}>기간 선택</Text>
                <Select 
                  value={selectedPreset} 
                  onChange={handlePresetChange}
                  placeholder="기간을 선택하세요"
                  data={[
                    ...rangePresets.map(preset => ({ value: preset.value, label: preset.label })),
                    { value: 'custom', label: '직접 선택' }
                  ]}
                />
              </div>

              {/* Custom Date Range */}
              <div className="space-y-2">
                <Text size="sm" fw={500}>사용자 정의 기간</Text>
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
                <Text size="sm" fw={500}>페이지 크기</Text>
                <Select 
                  value={pageSize.toString()} 
                  onChange={(value) => setPageSize(parseInt(value || '20'))}
                  data={[
                    { value: '10', label: '10개씩' },
                    { value: '20', label: '20개씩' },
                    { value: '50', label: '50개씩' },
                    { value: '100', label: '100개씩' }
                  ]}
                />
              </div>
            </div>

            {/* Current selection display */}
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <Text size="sm">
                <span className="font-medium">선택된 기간:</span> {formatDateRange(dateRange)}
                <span className="ml-4 font-medium">페이지 크기:</span> {pageSize}개
              </Text>
            </div>
          </Card.Section>
        </Card>

        {/* Infinite Reservation List */}
        <InfiniteReservationList
          startDate={format(dateRange.from, 'yyyy-MM-dd')}
          endDate={format(dateRange.to, 'yyyy-MM-dd')}
          limit={pageSize}
          className="mb-8"
        />
      </div>
    </AppLayout>
  );
}