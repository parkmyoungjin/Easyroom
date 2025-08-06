'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePublicReservations } from '@/hooks/useReservations';
import AppLayout from '@/components/layout/AppLayout';
import CurrentStatusPanel from '@/components/dashboard/CurrentStatusPanel';
import TimelinePanel from '@/components/dashboard/TimelinePanel';
import { Grid, Alert, Loader, Text, Container } from '@mantine/core';
import { format, startOfDay, endOfDay, isWithinInterval, isAfter } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { PublicReservation } from '@/types/database';

export default function RoomDisplayPage() {
  const { userProfile } = useAuth(); // ✅ loading 제거 - AuthGatekeeper가 처리
  
  // ✅ Phase 1: 실시간 시간 상태 - 1분마다 업데이트
  const [now, setNow] = useState(new Date());

  // ✅ Phase 1: 현재 시간 자동 업데이트 (1분마다)
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000); // 1분마다 업데이트

    return () => clearInterval(timer);
  }, []);

  // ✅ Phase 1: 오늘의 예약 데이터 조회 (실시간 구독 포함)
  const today = new Date();
  const startDateStr = format(startOfDay(today), 'yyyy-MM-dd');
  const endDateStr = format(endOfDay(today), 'yyyy-MM-dd');
  
  const { 
    data: todayReservations, 
    isError 
  } = usePublicReservations(
    startDateStr, 
    endDateStr, 
    !!userProfile,
    userProfile?.dbId
  );

  // ✅ Phase 1: 데이터 파생 - 현재 상태와 타임라인용 데이터 계산
  const derivedData = useMemo(() => {
    if (!todayReservations) {
      return {
        currentReservation: null,
        nextReservation: null,
        upcomingReservations: []
      };
    }

    // 현재 진행 중인 예약 찾기
    const currentReservation = todayReservations.find(reservation => {
      const startTime = new Date(reservation.start_time);
      const endTime = new Date(reservation.end_time);
      return isWithinInterval(now, { start: startTime, end: endTime });
    }) || null;

    // 다음 예약 찾기 (현재 시간 이후 시작하는 가장 가까운 예약)
    const futureReservations = todayReservations
      .filter(reservation => isAfter(new Date(reservation.start_time), now))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    
    const nextReservation = futureReservations[0] || null;

    // 타임라인용 예약 목록 (현재 시간 이후 종료되는 모든 예약)
    const upcomingReservations = todayReservations
      .filter(reservation => {
        const endTime = new Date(reservation.end_time);
        return isAfter(endTime, now) || isWithinInterval(now, { 
          start: new Date(reservation.start_time), 
          end: endTime 
        });
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    return {
      currentReservation,
      nextReservation,
      upcomingReservations
    };
  }, [todayReservations, now]);

  const handleGoBack = () => {
    // AuthGatekeeper가 모든 라우팅을 처리하므로 단순히 뒤로가기만 수행
    window.history.back();
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  const navigateToSignup = () => {
    window.location.href = '/signup';
  };

  // ✅ 로딩 상태 처리 제거 - AuthGatekeeper가 모든 로딩 처리

  return (
    <AppLayout 
      headerTitle="살아있는 현황판" 
      onBack={handleGoBack}
      variant="kiosk"
    >
      <div className="min-h-screen bg-gray-50">
        <Container size="xl" px="md" py="lg">
          {/* 인증되지 않은 사용자를 위한 안내 */}
          {!userProfile && (
            <Alert 
              color="blue" 
              title="실시간 현황판을 경험해보세요"
              mb="lg"
            >
              <Text size="sm" mb="md">
                로그인하시면 더 자세한 개인화된 정보와 예약 기능을 이용할 수 있습니다.
              </Text>
              <div className="flex gap-2">
                <button 
                  onClick={navigateToLogin}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                >
                  로그인
                </button>
                <button 
                  onClick={navigateToSignup}
                  className="px-4 py-2 border border-blue-600 text-blue-600 rounded-md text-sm hover:bg-blue-50"
                >
                  회원가입
                </button>
              </div>
            </Alert>
          )}

          {/* 헤더 섹션 */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {userProfile ? `안녕하세요, ${userProfile.name}님!` : '실시간 회의실 현황판'}
            </h1>
            <Text size="lg" c="dimmed">
              {format(now, 'yyyy년 MM월 dd일 (EEEE) HH:mm', { locale: ko })} 기준
            </Text>
          </div>

          {/* 에러 상태 */}
          {isError && (
            <Alert color="red" title="데이터 로딩 실패" mb="lg">
              실시간 데이터를 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.
            </Alert>
          )}

          {/* ✅ 로딩 상태 처리 제거 - AuthGatekeeper가 모든 로딩 처리 */}

          {/* ✅ Phase 2: 메인 대시보드 - 좌/우 2분할 레이아웃 */}
          {!isError && (
            <Grid gutter="lg">
              {/* 왼쪽 패널: 현재 상태 */}
              <Grid.Col span={{ base: 12, md: 5 }}>
                <CurrentStatusPanel
                  currentReservation={derivedData.currentReservation}
                  nextReservation={derivedData.nextReservation}
                  now={now}
                />
              </Grid.Col>

              {/* 오른쪽 패널: 타임라인 */}
              <Grid.Col span={{ base: 12, md: 7 }}>
                <TimelinePanel
                  upcomingReservations={derivedData.upcomingReservations}
                  now={now}
                />
              </Grid.Col>
            </Grid>
          )}

          {/* 기능 안내 (비인증 사용자용) */}
          {!userProfile && (
            <Alert color="gray" title="💡 살아있는 현황판의 특징" mt="xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div>
                  <Text fw={500} mb="xs">🔄 실시간 동기화</Text>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 새로고침 없이 자동 업데이트</li>
                    <li>• 예약 변경사항 즉시 반영</li>
                    <li>• 1분마다 시간 자동 갱신</li>
                  </ul>
                </div>
                <div>
                  <Text fw={500} mb="xs">📅 동적 타임라인</Text>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 현재 시간 기준 자동 스크롤</li>
                    <li>• 과거 예약 자동 필터링</li>
                    <li>• 진행 상황 실시간 표시</li>
                  </ul>
                </div>
              </div>
            </Alert>
          )}
        </Container>
      </div>
    </AppLayout>
  );
}