// FILE: src/features/reservation/components/CalendarControlHeader.tsx

'use client';

import { useMemo } from 'react';
import { format, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, LocateFixed, Calendar, Users } from 'lucide-react';
import {
  Group, Button, Text, Badge, useMantineTheme, Paper, Stack,
  ThemeIcon, Title, useMantineColorScheme
} from '@mantine/core';

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
  const { colorScheme } = useMantineColorScheme();

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
    <Paper
      shadow="sm"
      p={{ base: 'sm', sm: 'md' }}
      radius="md"
      style={{
        border: colorScheme === 'dark' ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid #e5e7eb'
      }}
    >
      <Stack gap="sm">
        {/* 모바일 최적화 네비게이션 */}
        <Group justify="space-between" align="center">
          <Group align="center" gap="xs">
            <ThemeIcon variant="light" color="blue" size="sm" display={{ base: 'none', sm: 'flex' }}>
              <Calendar size={16} />
            </ThemeIcon>
            <Stack gap={1}>
              <Text size="xs" c="dimmed" fw={500} display={{ base: 'none', sm: 'block' }}>주간 일정</Text>
              <Group gap="xs" align="center">
                <Text fw={500} size="xs" c="dimmed">{format(weekRange.start, 'yyyy년')}</Text>
                <Text fw={600} size="sm" c={colorScheme === 'dark' ? 'white' : 'dark'}>{weekDisplay}</Text>
              </Group>
            </Stack>
          </Group>

          <Group gap="xs">
            <Button
              variant="light"
              color="gray"
              size="xs"
              radius="lg"
              onClick={handlePreviousWeek}
              px="xs"
            >
              <ChevronLeft size={14} />
            </Button>
            <Button
              variant="filled"
              color="blue"
              size="xs"
              radius="lg"
              onClick={handleGoToToday}
              px="sm"
            >
              이번주
            </Button>
            <Button
              variant="light"
              color="gray"
              size="xs"
              radius="lg"
              onClick={handleNextWeek}
              px="xs"
            >
              <ChevronRight size={14} />
            </Button>
          </Group>
        </Group>

        {/* 컴팩트 부서 범례 */}
        {allDepartments.length > 0 && (
          <Group gap="xs" align="center">
            <ThemeIcon variant="light" color="orange" size="xs" display={{ base: 'none', sm: 'flex' }}>
              <Users size={12} />
            </ThemeIcon>
            <Text fw={500} size="xs" c="dimmed" display={{ base: 'none', sm: 'block' }}>부서:</Text>
            <Group gap="xs" style={{ flex: 1 }}>
              {allDepartments.map(dept => {
                const color = departmentColorMap.get(dept) || 'gray';
                return (
                  <Badge
                    key={dept}
                    color={color}
                    variant="light"
                    size="xs"
                    radius="sm"
                  >
                    {dept}
                  </Badge>
                );
              })}
            </Group>
          </Group>
        )}
      </Stack>
    </Paper>
  );
}