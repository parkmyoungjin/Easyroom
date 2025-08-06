// src/app/reservations/status/page.tsx

'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import GoogleCalendarView from '@/features/reservation/components/GoogleCalendarView';
import CalendarControlHeader from '@/features/reservation/components/CalendarControlHeader';
import AppLayout from '@/components/layout/AppLayout';
import { Skeleton, useMantineTheme } from '@mantine/core';
import { addDays, startOfWeek, endOfWeek, format } from 'date-fns';
import { usePublicReservations } from '@/hooks/useReservations';
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
  const { isAuthenticated } = useAuth();
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
    isAuthenticated()
  );

  // 부서별 색상 맵 생성
  const { departmentColors, allDepartments } = useMemo(() => {
    if (!reservations) return { departmentColors: new Map<string, string>(), allDepartments: [] };
    
    const departments = Array.from(new Set(reservations.map(r => r.department)));
    const colorMap = new Map<string, string>();
    
    departments.forEach(dept => {
      colorMap.set(dept, getDepartmentColor(dept));
    });
    
    return { departmentColors: colorMap, allDepartments: departments };
  }, [reservations]);

  const handleDateChange = (newDate: Date) => {
    setCurrentDate(newDate);
  };

  return (
    <AppLayout headerTitle="전체 예약 현황">
      <div className="min-h-screen bg-background text-foreground">
        <main className="container mx-auto p-4 sm:p-6 lg:p-8 pt-0">
          
          {/* 통합 컨트롤 헤더 - 로딩 처리는 AuthGatekeeper가 담당 */}
          <div className="mb-6">
            <CalendarControlHeader
              currentDate={currentDate}
              onDateChange={handleDateChange}
              allDepartments={allDepartments}
              departmentColorMap={departmentColors}
            />
          </div>

          {/* 캘린더 영역 - 자체 로딩 처리 */}
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton height={60} />
              <Skeleton height={400} />
            </div>
          ) : isError ? (
            <p className="text-red-500 text-center p-8">
              예약 정보를 불러오는 데 실패했습니다.
            </p>
          ) : (
            <GoogleCalendarView
              reservations={reservations || []}
              weekStartDate={weekRange.start}
              isAuthenticated={isAuthenticated()}
              departmentColors={departmentColors}
            />
          )}
        </main>
      </div>
    </AppLayout>
  );
}