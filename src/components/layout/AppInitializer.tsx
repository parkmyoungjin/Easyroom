'use client';

import { useState, useEffect } from 'react';
import { SplashScreen } from './SplashScreen';

interface AppInitializerProps {
  children: React.ReactNode;
}

/**
 * 순수한 타이머 - AppInitializer
 * 오직 브랜딩 스플래시의 시간 제어만 책임진다.
 * 
 * 책임:
 * 1. 앱 최초 시작 시에만 브랜딩 스플래시 표시 (최소 5.4초 보장)
 * 2. 이후 페이지 이동 시에는 즉시 콘텐츠 렌더링
 */
export function AppInitializer({ children }: AppInitializerProps) {
  const [isMinTimePassed, setIsMinTimePassed] = useState(false);
  const [hasAppInitialized, setHasAppInitialized] = useState(false);

  // 앱 초기화 상태 확인 (sessionStorage 사용 - SSR 안전)
  useEffect(() => {
    // SSR 환경에서는 sessionStorage 접근 불가
    if (typeof window === 'undefined') return;

    const isAlreadyInitialized = sessionStorage.getItem('app_initialized') === 'true';
    setHasAppInitialized(isAlreadyInitialized);

    if (isAlreadyInitialized) {
      // 이미 초기화된 경우 즉시 완료 상태로 설정
      setIsMinTimePassed(true);
    }
  }, []);

  // 최소 시간 보장 로직 (앱이 처음 시작될 때만)
  useEffect(() => {
    if (hasAppInitialized) return; // 이미 초기화된 경우 타이머 실행하지 않음

    const timer = setTimeout(() => {
      setIsMinTimePassed(true);
      // 앱 초기화 완료를 sessionStorage에 기록 (SSR 안전)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('app_initialized', 'true');
      }
    }, 5400); // 모션 완료(3.4초) + 유지 시간(2초) = 5.4초

    return () => clearTimeout(timer);
  }, [hasAppInitialized]);

  // 최종 로딩 상태 결정 - 오직 최소 시간 경과 여부만 확인
  const isLoading = !isMinTimePassed;

  // 로딩 중이면 브랜딩 스플래시 표시, 완료되면 실제 앱 콘텐츠 렌더링
  if (isLoading) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}