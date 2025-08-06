// FILE: src/features/reservation/components/CalendarControlHeader.tsx

'use client';

import { useMemo } from 'react';
import { format, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, LocateFixed } from 'lucide-react';
import { Group, Button, Text, Badge, useMantineTheme, Paper, Stack } from '@mantine/core';

interface CalendarControlHeaderProps {
  currentDate: Date;
  onDateChange: (newDate: Date) => void;
  allDepartments: string[];
  departmentColorMap: Map<string, string>;
}

export default function CalendarControlHeader({
  currentDate,
  onDateChange,
  allDepartments,
  departmentColorMap
}: CalendarControlHeaderProps) {
  const theme = useMantineTheme();

  // 주간 범위 계산
  const weekRange = useMemo(() => {
    // 월요일부터 시작하는 주간 범위
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // 월요일로 조정
    startOfWeek.setDate(diff);

    const endOfWeek = addDays(startOfWeek, 4); // 금요일까지
    return { start: startOfWeek, end: endOfWeek };
  }, [currentDate]);

  const handlePreviousWeek = () => {
    const newDate = addDays(currentDate, -7);
    onDateChange(newDate);
  };

  const handleNextWeek = () => {
    const newDate = addDays(currentDate, 7);
    onDateChange(newDate);
  };

  const handleGoToToday = () => {
    onDateChange(new Date());
  };

  const weekDisplay = `${format(weekRange.start, 'M월 d일')} ~ ${format(weekRange.end, 'd일')}`;

  return (
    <Paper shadow="xs" p="sm" radius="md" withBorder>
      <Stack gap="sm">
        {/* 컴팩트 네비게이션 라인 */}
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <Button
              variant="outline"
              size="compact-sm"
              onClick={handlePreviousWeek}
              aria-label="이전 주"
            >
              <ChevronLeft size={14} />
            </Button>
            <Button
              variant="subtle"
              size="compact-sm"
              onClick={handleGoToToday}
              leftSection={<LocateFixed size={12} />}
            >
              오늘
            </Button>
            <Button
              variant="outline"
              size="compact-sm"
              onClick={handleNextWeek}
              aria-label="다음 주"
            >
              <ChevronRight size={14} />
            </Button>
          </Group>

          <Group gap="xs" align="center">
            <Text fw={500} size="sm" c="dimmed">{format(weekRange.start, 'yyyy년')}</Text>
            <Text fw={700} size="md">{weekDisplay}</Text>
          </Group>
        </Group>

        {/* 컴팩트 범례 라인 */}
        <Group gap="xs" align="center">
          <Text fw={500} size="xs" c="dimmed" style={{ minWidth: '60px' }}>예약팀:</Text>
          {allDepartments.length > 0 ? (
            <Group gap="xs">
              {allDepartments.map(dept => {
                const color = departmentColorMap.get(dept) || 'gray';
                return (
                  <Badge
                    key={dept}
                    color={color}
                    variant="light"
                    size="sm"
                  >
                    {dept}
                  </Badge>
                );
              })}
            </Group>
          ) : (
            <Text size="xs" c="dimmed">이번 주에는 예약이 없습니다.</Text>
          )}
        </Group>
      </Stack>
    </Paper>
  );
}