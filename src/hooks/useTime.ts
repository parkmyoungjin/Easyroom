// src/hooks/useTime.ts
import { useState } from 'react';
import { startOfDay, isSaturday, isSunday } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// ✅ 원칙 2: 명시성을 통한 안정성. "대한민국" 타임존을 상수로 정의.
const KOREA_TIME_ZONE = 'Asia/Seoul';

/**
 * 앱 전체에서 사용할 시간 관련 상태와 유틸리티를 제공하는 훅.
 * 모든 시간은 대한민국 표준시(KST)를 기준으로 합니다.
 */
export function useTime() {
  // ✅ 원칙 1 & 3: 중앙집권화와 캡슐화.
  // '현재'와 '오늘'의 정의는 오직 이 훅 안에서만 이루어진다.
  const [nowKST] = useState(toZonedTime(new Date(), KOREA_TIME_ZONE));
  const todayKST = startOfDay(nowKST);

  /**
   * 주어진 날짜가 '오늘'보다 과거인지 KST 기준으로 확인합니다.
   * @param date 비교할 Date 객체
   * @returns 과거이면 true
   */
  const isDateInPast = (date: Date): boolean => {
    return date < todayKST;
  };

  /**
   * 주어진 날짜가 주말(토/일)인지 확인합니다.
   * @param date 비교할 Date 객체
   * @returns 주말이면 true
   */
  const isDateWeekend = (date: Date): boolean => {
    return isSaturday(date) || isSunday(date);
  };

  return {
    nowKST,          // KST 기준 현재 시각 (컴포넌트 마운트 시점)
    todayKST,        // KST 기준 오늘의 시작 (00:00:00)
    isDateInPast,    // KST '오늘'을 기준으로 과거인지 판단하는 함수
    isDateWeekend,   // 주말인지 판단하는 함수
    KOREA_TIME_ZONE, // 다른 곳에서 필요할 경우를 대비해 타임존 문자열도 export
  };
}