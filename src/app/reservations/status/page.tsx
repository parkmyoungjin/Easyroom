// src/app/reservations/status/page.tsx

'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import GoogleCalendarView from '@/features/reservation/components/GoogleCalendarView';
import CalendarControlHeader from '@/features/reservation/components/CalendarControlHeader';
import AppLayout from '@/components/layout/AppLayout';
import {
  Container, Stack, Paper, Group, ThemeIcon, Title, Text,
  Skeleton, useMantineTheme
} from '@mantine/core';
import { Activity, XCircle } from 'lucide-react';
import { addDays, startOfWeek, endOfWeek, format } from 'date-fns';
import { usePublicReservationsV2 as usePublicReservations } from '@/hooks/usePublicReservationsV2';
import type { PublicReservation } from "@/types/database";

// 🎯 중앙화된 색상 시스템
const MANTINE_COLORS = ['blue', 'grape', 'green', 'orange', 'red', 'teal', 'pink'];
const departmentColorMap = new Map<string, string>();
let colorIndex = 0;

function getDepartmentColor(department: string): string {
  if (!departmentColorMap.has(department)) {
    departmentColorMap.set(department, MANTINE_COLORS[colorIndex % MANTINE_COLORS.length]);
    colorIndex++;
  }
  return departmentColorMap.get(department) || 'gray';
}

// ✅ 스켈레톤 로딩 컴포넌트 제거 - AuthGatekeeper가 모든 로딩 처리

export default function ReservationStatusPage() {
  const { isAuthenticated, userProfile } = useAuth();
  const theme = useMantineTheme();
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekRange = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(start, { weekStartsOn: 1 });
    return { start, end };
  }, [currentDate]);

  const startDateStr = format(weekRange.start, 'yyyy-MM-dd');
  const endDateStr = format(weekRange.end, 'yyyy-MM-dd');

  const { data: reservations, isLoading, isError } = usePublicReservations(
    startDateStr,
    endDateStr,
    isAuthenticated(),
    userProfile?.dbId
  );

  // 부서별 색상 맵 생성
  const { departmentColors, allDepartments } = useMemo(() => {
    if (!reservations) return { departmentColors: new Map<string, string>(), allDepartments: [] };

    const departments: string[] = Array.from(new Set(reservations.map((r: PublicReservation) => r.department)));
    const colorMap = new Map<string, string>();

    departments.forEach((dept: string) => {
      colorMap.set(dept, getDepartmentColor(dept));
    });

    return { departmentColors: colorMap, allDepartments: departments };
  }, [reservations]);

  const handleDateChange = (newDate: Date) => {
    setCurrentDate(newDate);
  };

  return (
    <AppLayout headerTitle="전체 예약 현황">
      <Stack gap="sm" style={{ minHeight: '100vh' }}>
        {/* 모바일 최적화 컴팩트 헤더 */}
        <Paper
          p={{ base: 'sm', sm: 'md' }}
          radius="md"
          style={{
            background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
            color: 'white',
            margin: '8px'
          }}
        >
          <Group align="center" gap="sm">
            <ThemeIcon size="md" radius="lg" color="white" variant="light" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <Activity size={18} />
            </ThemeIcon>
            <Stack gap={2}>
              <Title order={4} c="white">
                전체 예약 현황
              </Title>
              <Text c="rgba(255,255,255,0.8)" size="xs" display={{ base: 'none', sm: 'block' }}>
                실시간 회의실 예약 현황
              </Text>
            </Stack>
          </Group>
        </Paper>

        {/* 컴팩트 컨트롤 헤더 */}
        <div style={{ padding: '0 8px' }}>
          <CalendarControlHeader
            currentDate={currentDate}
            onDateChange={handleDateChange}
            allDepartments={allDepartments}
            departmentColorMap={departmentColors}
          />
        </div>

        {/* 풀스크린 캘린더 영역 */}
        <div style={{ flex: 1, padding: '0' }}>
          {isLoading ? (
            <Stack gap="sm" p="sm">
              <Skeleton height={40} radius="md" />
              <Skeleton height={300} radius="md" />
            </Stack>
          ) : isError ? (
            <Paper
              p="md"
              radius="md"
              m="sm"
              style={{
                border: '2px solid #dc2626'
              }}
            >
              <Stack align="center" gap="sm">
                <ThemeIcon size="lg" radius="xl" color="red" variant="light">
                  <XCircle size={24} />
                </ThemeIcon>
                <Title order={4} c="red">데이터 로딩 실패</Title>
                <Text c="dimmed" ta="center" size="sm">예약 정보를 불러오는 데 실패했습니다.</Text>
              </Stack>
            </Paper>
          ) : (
            <GoogleCalendarView
              reservations={reservations || []}
              weekStartDate={weekRange.start}
              isAuthenticated={isAuthenticated()}
              departmentColors={departmentColors}
            />
          )}
        </div>
      </Stack>
    </AppLayout>
  );
}