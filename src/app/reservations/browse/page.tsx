"use client";

import { useState } from 'react';
import { Card, Select, Text, SimpleGrid, Stack, Group } from '@mantine/core';
import { addDays, addWeeks, addMonths, startOfDay, endOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { formatDate } from '@/lib/utils/date';

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
    if (formatDate(range.from, 'yyyy-MM-dd') === formatDate(range.to, 'yyyy-MM-dd')) {
      return formatDate(range.from, 'yyyy년 MM월 dd일 (EEE)');
    }
    return `${formatDate(range.from, 'MM월 dd일')} ~ ${formatDate(range.to, 'MM월 dd일 (EEE)')}`;
  };

  return (
    <AppLayout headerTitle="예약 둘러보기" onBack={handleBack}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 16px' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <Text size="xl" fw={700} mb="xs">예약 둘러보기</Text>
          <Text c="dimmed">
            회의실 예약 현황을 확인하고 원하는 시간대를 찾아보세요.
          </Text>
        </div>

        {/* Filters */}
        <Card withBorder mb="xl">
          <Card.Section withBorder inheritPadding py="xs">
            <Text fw={600}>필터 설정</Text>
            <Text size="sm" c="dimmed">조회할 기간과 표시 옵션을 선택하세요.</Text>
          </Card.Section>
          <Card.Section inheritPadding py="md">
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
              {/* Date Range Preset */}
              <Stack gap="xs">
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
              </Stack>

              {/* Custom Date Range */}
              <Stack gap="xs">
                <Text size="sm" fw={500}>사용자 정의 기간</Text>
                <Group gap="xs">
                  <input
                    type="date"
                    value={formatDate(dateRange.from, 'yyyy-MM-dd')}
                    onChange={(e) => {
                      if (e.target.value && selectedPreset === 'custom') {
                        const newFrom = new Date(e.target.value);
                        setDateRange(prev => ({ ...prev, from: startOfDay(newFrom) }));
                      }
                    }}
                    disabled={selectedPreset !== 'custom'}
                    style={{ 
                      flex: 1, 
                      padding: '8px 12px', 
                      border: '1px solid var(--mantine-color-gray-4)', 
                      backgroundColor: 'var(--mantine-color-body)', 
                      borderRadius: '6px', 
                      fontSize: '14px',
                      opacity: selectedPreset !== 'custom' ? 0.5 : 1
                    }}
                  />
                  <Text size="sm" c="dimmed" style={{ display: 'flex', alignItems: 'center' }}>~</Text>
                  <input
                    type="date"
                    value={formatDate(dateRange.to, 'yyyy-MM-dd')}
                    onChange={(e) => {
                      if (e.target.value && selectedPreset === 'custom') {
                        const newTo = new Date(e.target.value);
                        setDateRange(prev => ({ ...prev, to: endOfDay(newTo) }));
                      }
                    }}
                    disabled={selectedPreset !== 'custom'}
                    style={{ 
                      flex: 1, 
                      padding: '8px 12px', 
                      border: '1px solid var(--mantine-color-gray-4)', 
                      backgroundColor: 'var(--mantine-color-body)', 
                      borderRadius: '6px', 
                      fontSize: '14px',
                      opacity: selectedPreset !== 'custom' ? 0.5 : 1
                    }}
                  />
                </Group>
              </Stack>

              {/* Page Size */}
              <Stack gap="xs">
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
              </Stack>
            </SimpleGrid>

            {/* Current selection display */}
            <div style={{ 
              marginTop: '16px', 
              padding: '12px', 
              backgroundColor: 'var(--mantine-color-gray-1)', 
              borderRadius: '8px' 
            }}>
              <Text size="sm">
                <Text component="span" fw={500}>선택된 기간:</Text> {formatDateRange(dateRange)}
                <Text component="span" fw={500} ml="md">페이지 크기:</Text> {pageSize}개
              </Text>
            </div>
          </Card.Section>
        </Card>

        {/* Infinite Reservation List */}
        <div style={{ marginBottom: '32px' }}>
          <InfiniteReservationList
            startDate={formatDate(dateRange.from, 'yyyy-MM-dd')}
            endDate={formatDate(dateRange.to, 'yyyy-MM-dd')}
            limit={pageSize}
          />
        </div>
      </div>
    </AppLayout>
  );
}