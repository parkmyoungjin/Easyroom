import { 
  format, 
  parseISO, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
  isSameDay,
  isToday,
  isTomorrow,
  isYesterday,
  differenceInMinutes,
  differenceInHours,
  isAfter,
  isBefore,
  isWithinInterval,
  setHours,
  setMinutes,
  getHours,
  getMinutes,
} from 'date-fns';
import { ko } from 'date-fns/locale';

// 한국 시간대 상수 (UTC+9)
const KST_OFFSET = 9 * 60 * 60 * 1000; // 9시간을 밀리초로 변환

// UTC 시간을 한국 시간으로 변환 
export const utcToKst = (date: Date | string): Date => {
  if (typeof date === 'string') {
    // 문자열인 경우 UTC 시간으로 직접 파싱하고 9시간 더하기
    const utcTime = new Date(date);
    const hours = utcTime.getUTCHours() + 9;
    const minutes = utcTime.getUTCMinutes();
    const year = utcTime.getUTCFullYear();
    const month = utcTime.getUTCMonth();
    const day = utcTime.getUTCDate();
    
    // 시간이 24시를 넘어가면 다음날로 조정
    if (hours >= 24) {
      return new Date(year, month, day + 1, hours - 24, minutes);
    } else {
      return new Date(year, month, day, hours, minutes);
    }
  } else {
    // Date 객체인 경우
    const hours = date.getUTCHours() + 9;
    const minutes = date.getUTCMinutes();
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    
    if (hours >= 24) {
      return new Date(year, month, day + 1, hours - 24, minutes);
    } else {
      return new Date(year, month, day, hours, minutes);
    }
  }
};

// 한국 시간을 UTC로 변환
export const kstToUtc = (date: Date): Date => {
  return new Date(date.getTime() - KST_OFFSET);
};

// 날짜 포맷팅 (UTC → KST 변환하여 표시)
export const formatDate = (date: Date | string, formatStr = 'yyyy-MM-dd') => {
  const kstTime = utcToKst(date);
  return format(kstTime, formatStr, { locale: ko });
};

export const formatTime = (date: Date | string, formatStr = 'HH:mm') => {
  const kstTime = utcToKst(date);
  return format(kstTime, formatStr, { locale: ko });
};

export const formatDateTime = (date: Date | string, formatStr = 'yyyy-MM-dd HH:mm') => {
  const kstTime = utcToKst(date);
  return format(kstTime, formatStr, { locale: ko });
};

export const formatDateTimeKorean = (date: Date | string) => {
  const kstTime = utcToKst(date);
  return format(kstTime, 'M월 d일 (E) HH:mm', { locale: ko });
};

export const formatDateKorean = (date: Date | string) => {
  const kstTime = utcToKst(date);
  return format(kstTime, 'M월 d일 (E)', { locale: ko });
};

// 날짜 범위 생성 (한국 시간 기준)
export const getDateRange = (view: 'day' | 'week' | 'month', baseDate: Date) => {
  // baseDate가 UTC인 경우 한국 시간으로 변환
  const kstDate = utcToKst(baseDate);
  
  switch (view) {
    case 'day':
      return {
        start: startOfDay(kstDate),
        end: endOfDay(kstDate),
      };
    case 'week':
      return {
        start: startOfWeek(kstDate, { weekStartsOn: 1 }), // 월요일 시작
        end: endOfWeek(kstDate, { weekStartsOn: 1 }),
      };
    case 'month':
      return {
        start: startOfMonth(kstDate),
        end: endOfMonth(kstDate),
      };
    default:
      throw new Error('Invalid view type');
  }
};

// 날짜 네비게이션 (한국 시간 기준)
export const navigateDate = (
  currentDate: Date, 
  direction: 'prev' | 'next', 
  view: 'day' | 'week' | 'month'
) => {
  // currentDate가 UTC인 경우 한국 시간으로 변환
  const kstDate = utcToKst(currentDate);
  const modifier = direction === 'next' ? 1 : -1;
  
  switch (view) {
    case 'day':
      return addDays(kstDate, modifier);
    case 'week':
      return addWeeks(kstDate, modifier);
    case 'month':
      return addMonths(kstDate, modifier);
    default:
      return kstDate;
  }
};

// 날짜 상태 체크 (한국 시간 기준)
export const getDateStatus = (date: Date | string) => {
  const kstTime = utcToKst(date);
  const kstNow = utcToKst(new Date());
  
  if (isSameDay(kstTime, kstNow)) return 'today';
  if (isSameDay(kstTime, addDays(kstNow, 1))) return 'tomorrow';
  if (isSameDay(kstTime, subDays(kstNow, 1))) return 'yesterday';
  return 'other';
};

// 예약 시간 관련
export const getDurationInMinutes = (startTime: Date | string, endTime: Date | string) => {
  const start = typeof startTime === 'string' ? parseISO(startTime) : startTime;
  const end = typeof endTime === 'string' ? parseISO(endTime) : endTime;
  return differenceInMinutes(end, start);
};

export const getDurationInHours = (startTime: Date | string, endTime: Date | string) => {
  const start = typeof startTime === 'string' ? parseISO(startTime) : startTime;
  const end = typeof endTime === 'string' ? parseISO(endTime) : endTime;
  return differenceInHours(end, start);
};

export const formatDuration = (startTime: Date | string, endTime: Date | string) => {
  const minutes = getDurationInMinutes(startTime, endTime);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours === 0) {
    return `${remainingMinutes}분`;
  } else if (remainingMinutes === 0) {
    return `${hours}시간`;
  } else {
    return `${hours}시간 ${remainingMinutes}분`;
  }
};

// 시간 충돌 검사
export const isTimeConflict = (
  start1: Date | string,
  end1: Date | string,
  start2: Date | string,
  end2: Date | string
) => {
  const s1 = typeof start1 === 'string' ? parseISO(start1) : start1;
  const e1 = typeof end1 === 'string' ? parseISO(end1) : end1;
  const s2 = typeof start2 === 'string' ? parseISO(start2) : start2;
  const e2 = typeof end2 === 'string' ? parseISO(end2) : end2;
  
  return isBefore(s1, e2) && isAfter(e1, s2);
};

// 시간이 범위 내에 있는지 확인
export const isTimeWithinRange = (
  time: Date | string,
  startTime: Date | string,
  endTime: Date | string
) => {
  const t = typeof time === 'string' ? parseISO(time) : time;
  const start = typeof startTime === 'string' ? parseISO(startTime) : startTime;
  const end = typeof endTime === 'string' ? parseISO(endTime) : endTime;
  
  return isWithinInterval(t, { start, end });
};

// 시간 선택을 위한 옵션 생성 (30분 단위)
export const generateTimeOptions = (
  startHour = 9,
  endHour = 18,
  interval = 30
) => {
  const options: { value: string; label: string }[] = [];
  
  for (let hour = startHour; hour <= endHour; hour++) {
    for (let minute = 0; minute < 60; minute += interval) {
      if (hour === endHour && minute > 0) break;
      
      const time = setMinutes(setHours(new Date(), hour), minute);
      const value = format(time, 'HH:mm');
      const label = format(time, 'HH:mm');
      
      options.push({ value, label });
    }
  }
  
  return options;
};

// 날짜와 시간을 합쳐서 ISO 문자열 생성 (한국 시간 기준 입력을 UTC로 변환)
export const combineDateAndTime = (date: Date | string, time: string) => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const [hours, minutes] = time.split(':').map(Number);
  
  // 한국 시간 기준으로 ISO 문자열 직접 생성
  const dateStr = format(dateObj, 'yyyy-MM-dd');
  const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
  
  // 한국 시간 ISO 문자열 생성 (KST +09:00)
  const kstISOString = `${dateStr}T${timeStr}+09:00`;
  
  // 한국 시간을 UTC로 변환
  const utcTime = new Date(kstISOString);
  
  return utcTime.toISOString();
};

// ISO 문자열에서 날짜와 시간 분리 (UTC를 한국 시간으로 변환)
export const separateDateAndTime = (isoString: string) => {
  const kstTime = utcToKst(isoString);
  return {
    date: format(kstTime, 'yyyy-MM-dd'),
    time: format(kstTime, 'HH:mm'),
  };
};

// 현재 시간 기준으로 가장 가까운 30분 단위 시간 반환 (한국 시간 기준)
export const getNextAvailableTime = (baseDate?: Date) => {
  const kstNow = baseDate ? utcToKst(baseDate) : utcToKst(new Date());
  const minutes = getMinutes(kstNow);
  const roundedMinutes = Math.ceil(minutes / 30) * 30;
  
  if (roundedMinutes >= 60) {
    return setMinutes(setHours(addDays(kstNow, getHours(kstNow) === 23 ? 1 : 0), (getHours(kstNow) + 1) % 24), 0);
  }
  
  return setMinutes(kstNow, roundedMinutes);
};

// 업무 시간 확인 (평일 9-18시, 한국 시간 기준)
export const isBusinessHours = (date: Date | string) => {
  const kstTime = utcToKst(date);
  const day = kstTime.getDay(); // 0 = 일요일, 6 = 토요일
  const hour = getHours(kstTime);
  
  // 평일(월-금)이고 9시-18시 사이
  return day >= 1 && day <= 5 && hour >= 9 && hour < 18;
};

// 상대적 시간 표시 (예: "2시간 후", "30분 전", 한국 시간 기준)
export const getRelativeTime = (date: Date | string) => {
  const kstTime = utcToKst(date);
  const kstNow = utcToKst(new Date());
  const diffInMinutes = differenceInMinutes(kstTime, kstNow);
  
  if (Math.abs(diffInMinutes) < 1) {
    return '지금';
  } else if (diffInMinutes > 0) {
    if (diffInMinutes < 60) {
      return `${diffInMinutes}분 후`;
    } else if (diffInMinutes < 1440) { // 24시간
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}시간 후`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days}일 후`;
    }
  } else {
    const absDiff = Math.abs(diffInMinutes);
    if (absDiff < 60) {
      return `${absDiff}분 전`;
    } else if (absDiff < 1440) {
      const hours = Math.floor(absDiff / 60);
      return `${hours}시간 전`;
    } else {
      const days = Math.floor(absDiff / 1440);
      return `${days}일 전`;
    }
  }
};

// 데이터베이스용 ISO 문자열 생성 (UTC 기준)
export const formatDateTimeForDatabase = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return dateObj.toISOString();
};

// 날짜와 시간을 조합해서 데이터베이스용 ISO 문자엱 생성 (한국 시간 기준 입력을 UTC로 변환)
export const formatDateTimeForDatabase2 = (date: Date, time: string): string => {
  const [hours, minutes] = time.split(':').map(Number);
  
  // 한국 시간 기준으로 ISO 문자열 직접 생성
  const dateStr = format(date, 'yyyy-MM-dd');
  const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
  
  // 한국 시간 ISO 문자열 생성 (KST +09:00)
  const kstISOString = `${dateStr}T${timeStr}+09:00`;
  
  // 한국 시간을 UTC로 변환
  const utcTime = new Date(kstISOString);
  
  return utcTime.toISOString();
};

export const formatDateTimeForDisplay = (date: Date | string): string => {
  const kstTime = utcToKst(date);
  return format(kstTime, 'yyyy-MM-dd HH:mm', { locale: ko });
};

// 한국 시간 기준으로 현재 시간이 업무 시간인지 확인
export const isCurrentTimeBusinessHours = (): boolean => {
  const kstNow = utcToKst(new Date());
  return isBusinessHours(kstNow);
};

// 한국 시간 기준으로 다음 가능한 예약 시간 반환
export const getNextAvailableKSTTime = (baseDate?: Date): Date => {
  const kstNow = utcToKst(baseDate || new Date());
  return setMinutes(setHours(addDays(kstNow, getHours(kstNow) === 23 ? 1 : 0), (getHours(kstNow) + 1) % 24), 0);
};

/**
 * 날짜 문자열을 정규화하여 정확한 범위 쿼리를 위한 ISO 문자열로 변환
 * 데이터베이스 쿼리에서 날짜 경계 문제를 해결하기 위한 유틸리티 함수
 * 
 * @param dateStr - YYYY-MM-DD 형태의 날짜 문자열
 * @param isEndDate - 종료 날짜인 경우 해당 날의 마지막 시간(23:59:59.999Z)을 반환
 * @returns ISO 형태의 날짜시간 문자열
 * 
 * @example
 * ```typescript
 * // 시작 날짜: 2025-01-10T00:00:00.000Z
 * normalizeDateForQuery('2025-01-10', false)
 * 
 * // 종료 날짜: 2025-01-10T23:59:59.999Z
 * normalizeDateForQuery('2025-01-10', true)
 * ```
 */
export const normalizeDateForQuery = (dateStr: string, isEndDate: boolean = false): string => {
  // 날짜 형식 검증 (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    throw new Error(`잘못된 날짜 형식입니다: ${dateStr}. YYYY-MM-DD 형식이어야 합니다.`);
  }

  if (isEndDate) {
    // 종료 날짜의 경우 해당 날의 마지막 시간까지 포함
    return `${dateStr}T23:59:59.999Z`;
  } else {
    // 시작 날짜의 경우 해당 날의 첫 시간부터 포함
    return `${dateStr}T00:00:00.000Z`;
  }
};

/**
 * 날짜 범위를 데이터베이스 쿼리에 적합한 형태로 정규화
 * 
 * @param startDate - 시작 날짜 (YYYY-MM-DD)
 * @param endDate - 종료 날짜 (YYYY-MM-DD)
 * @returns 정규화된 시작 및 종료 날짜시간
 */
export const normalizeDateRange = (startDate: string, endDate: string) => {
  return {
    start: normalizeDateForQuery(startDate, false),
    end: normalizeDateForQuery(endDate, true)
  };
}; 