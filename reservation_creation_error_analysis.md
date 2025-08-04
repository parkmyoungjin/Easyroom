# '새 예약 생성' 오류 근본 원인 분석 자료

---

## 1. 데이터 규칙: `src/lib/validations/schemas.ts`

```ts
import { z } from 'zod';
import { format, startOfToday, isWeekend } from "date-fns";
import { isDateTimeInFutureKST } from "@/lib/utils/date";

// Base schemas for enums
export const userRoleSchema = z.enum(['employee', 'admin']);
export const reservationStatusSchema = z.enum(['confirmed', 'cancelled']);

// 이메일 기반 인증을 위한 스키마
const emailSchema = z.string()
  .email('올바른 이메일 형식이 아닙니다')
  .max(255, '이메일이 너무 깁니다');

// 비밀번호 검증 스키마
const passwordSchema = z.string()
  .min(8, '비밀번호는 최소 8자 이상이어야 합니다')
  .max(128, '비밀번호가 너무 깁니다')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, '비밀번호는 대문자, 소문자, 숫자를 포함해야 합니다');

// User schemas (Magic Link 이메일 인증)
export const userSchema = z.object({
  id: z.string().uuid(),
  employee_id: z.string().nullable().optional(), // Magic Link 기반에서는 사용하지 않음
  name: z.string().min(1, '이름을 입력해주세요').max(100),
  email: emailSchema,
  department: z.string().min(1, '부서를 입력해주세요').max(100),
  role: userRoleSchema.default('employee'),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const userInsertSchema = userSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  role: true,
  is_active: true,
});

export const userUpdateSchema = userSchema.partial();

// Room schemas
// ... (이하 Room, Reservation 스키마는 기존과 동일) ...
export const roomAmenitiesSchema = z.record(z.string(), z.boolean()).default({});

export const roomSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, '회의실 이름을 입력해주세요').max(100),
  description: z.string().nullable(),
  capacity: z.number().int().min(1, '최소 1명 이상이어야 합니다').default(1),
  location: z.string().nullable(),
  amenities: roomAmenitiesSchema,
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const roomInsertSchema = roomSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  description: true,
  capacity: true,
  location: true,
  amenities: true,
  is_active: true,
});

export const roomUpdateSchema = roomSchema.partial();

// Reservation schemas
const baseReservationSchema = z.object({
  id: z.string().uuid(),
  room_id: z.string().uuid('회의실을 선택해주세요'),
  user_id: z.string().uuid(),
  title: z.string().min(1, '예약 제목을 입력해주세요').max(255),
  purpose: z.string().nullable(),
  start_time: z.string().datetime('시작 시간을 선택해주세요'),
  end_time: z.string().datetime('종료 시간을 선택해주세요'),
  status: reservationStatusSchema.default('confirmed'),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const reservationSchema = z.object({
  room_id: z.string().uuid('올바른 회의실을 선택해주세요'),
  title: z.string().min(1, '예약 제목을 입력해주세요'),
  purpose: z.string().optional(),
  start_time: z.date(),
  end_time: z.date(),
}).refine((data) => data.end_time > data.start_time, {
  message: '종료 시간은 시작 시간보다 늦어야 합니다',
  path: ['end_time'],
});

export const reservationInsertSchema = baseReservationSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  purpose: true,
  status: true,
}).refine(
  (data) => new Date(data.end_time) > new Date(data.start_time),
  {
    message: '종료 시간이 시작 시간보다 늦어야 합니다',
    path: ['end_time'],
  }
);

export const reservationUpdateSchema = baseReservationSchema.partial().refine(
  (data) => {
    if (data.start_time && data.end_time) {
      return new Date(data.end_time) > new Date(data.start_time);
    }
    return true;
  },
  {
    message: '종료 시간이 시작 시간보다 늦어야 합니다',
    path: ['end_time'],
  }
);


// Form schemas for UI (이메일 기반 인증)
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});

// ==================================================================
// ✅ Magic Link 로그인을 위한 스키마 추가
// ==================================================================
export const magicLinkLoginSchema = z.object({
  email: emailSchema,
});

// ==================================================================
// ✅ OTP 인증을 위한 스키마 추가
// ==================================================================
export const otpVerificationSchema = z.object({
  email: emailSchema,
  otp: z.string()
    .length(6, 'OTP 코드는 6자리여야 합니다')
    .regex(/^\d{6}$/, 'OTP 코드는 숫자만 입력 가능합니다'),
});

// OTP 요청을 위한 스키마 (이메일만 필요)
export const otpRequestSchema = z.object({
  email: emailSchema,
});

// 회원가입 후 OTP 로그인 전환을 위한 통합 스키마
export const signupToOtpTransitionSchema = z.object({
  email: emailSchema,
  signupCompleted: z.boolean().default(true),
  transitionMessage: z.string().optional(),
});


export const reservationFormSchema = z.object({
  room_id: z.string().uuid('회의실을 선택해주세요'),
  title: z.string().min(1, '예약 제목을 입력해주세요').max(255),
  purpose: z.string().optional(),
  start_time: z.string().datetime('시작 시간을 선택해주세요'),
  end_time: z.string().datetime('종료 시간을 선택해주세요'),
}).refine(
  (data) => new Date(data.end_time) > new Date(data.start_time),
  {
    message: '종료 시간이 시작 시간보다 늦어야 합니다',
    path: ['end_time'],
  }
);

export const roomFormSchema = z.object({
  name: z.string().min(1, '회의실 이름을 입력해주세요').max(100),
  description: z.string().optional(),
  capacity: z.number().int().min(1, '최소 1명 이상이어야 합니다').default(1),
  location: z.string().optional(),
  amenities: z.record(z.string(), z.boolean()).default({}),
});

// API parameter schemas
// ... (이하 기존과 동일) ...
export const getPublicReservationsSchema = z.object({
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
});

export const dateRangeSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
}).refine(
  (data) => new Date(data.end) > new Date(data.start),
  {
    message: '종료 날짜가 시작 날짜보다 늦어야 합니다',
    path: ['end'],
  }
);


// Type exports
export type LoginFormData = z.infer<typeof loginSchema>;

// ==================================================================
// ✅ Magic Link 스키마에 대한 타입 추가
// ==================================================================
export type MagicLinkLoginFormData = z.infer<typeof magicLinkLoginSchema>;

// ==================================================================
// ✅ OTP 스키마에 대한 타입 추가
// ==================================================================
export type OTPVerificationFormData = z.infer<typeof otpVerificationSchema>;
export type OTPRequestFormData = z.infer<typeof otpRequestSchema>;
export type SignupToOtpTransitionData = z.infer<typeof signupToOtpTransitionSchema>;

export type ReservationFormData = z.infer<typeof reservationSchema>;
export type RoomFormData = z.infer<typeof roomFormSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;

// 회원가입 스키마 (Magic Link 기반 - 비밀번호 불필요)
export const signupSchema = z.object({
  email: emailSchema,
  name: z.string().min(1, '이름을 입력해주세요').max(100, '이름이 너무 깁니다'),
  department: z.string().min(1, '부서를 입력해주세요').max(100, '부서명이 너무 깁니다'),
});

export type SignupFormData = z.infer<typeof signupSchema>;

// UI용 예약 폼 스키마 (new/page에서 사용)
// ... (이하 기존과 동일) ...
export const newReservationFormSchema = z.object({
  title: z.string().min(1, "부서명을 입력해주세요"),
  booker: z.string().min(1, "예약자를 입력해주세요"),
  date: z.date({
    required_error: "날짜를 선택해주세요",
  }).refine(
    (date) => !isWeekend(date),
    "주말에는 예약할 수 없습니다"
  ).refine(
    (date) => date >= startOfToday(),
    "오늘 이전 날짜는 선택할 수 없습니다"
  ),
  startTime: z.string({
    required_error: "시작 시간을 선택해주세요",
  }),
  endTime: z.string({
    required_error: "종료 시간을 선택해주세요",
  }),
  roomId: z.string({
    required_error: "회의실을 선택해주세요",
  }),
  purpose: z.string().optional(),
}).refine((data) => {
  const start = new Date(`${format(data.date, "yyyy-MM-dd")}T${data.startTime}`);
  const end = new Date(`${format(data.date, "yyyy-MM-dd")}T${data.endTime}`);
  return end > start;
}, {
  message: "종료 시간은 시작 시간보다 늦어야 합니다",
  path: ["endTime"],
}).refine((data) => {
  const startHour = parseInt(data.startTime.split(":")[0], 10);
  const endHour = parseInt(data.endTime.split(":")[0], 10);
  return startHour >= 8 && endHour <= 19;
}, {
  message: "예약은 오전 8시부터 오후 7시까지만 가능합니다",
  path: ["startTime"],
}).refine((data) => {
  // ✅ 중앙화된 시간 검증 함수 사용
  return isDateTimeInFutureKST(data.date, data.startTime);
}, {
  message: "현재 시간 이후로만 예약할 수 있습니다",
  path: ["startTime"],
});

export type NewReservationFormValues = z.infer<typeof newReservationFormSchema>;

// 시간 슬롯 상수도 추가
export const timeSlots = Array.from({ length: 23 }, (_, i) => {
  const hour = 8 + Math.floor(i / 2);
  const minute = i % 2 === 0 ? "00" : "30";
  return `${hour.toString().padStart(2, "0")}:${minute}`;
}); 

// ============================================================================
// PAGINATION SCHEMAS
// ============================================================================

// Pagination request schema
export const paginationRequestSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  search: z.string().optional(),
});

// Pagination metadata schema
export const paginationMetadataSchema = z.object({
  limit: z.number().int(),
  offset: z.number().int(),
  total_count: z.number().int(),
  has_more: z.boolean(),
  current_page: z.number().int(),
  total_pages: z.number().int(),
  current_count: z.number().int(),
});

// Generic paginated response schema factory
export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: z.array(dataSchema),
    pagination: paginationMetadataSchema,
    message: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  });
}

// Specific paginated response schemas
export const paginatedReservationsSchema = createPaginatedResponseSchema(
  z.object({
    id: z.string().uuid(),
    room_id: z.string().uuid(),
    user_id: z.string().uuid(),
    title: z.string(),
    purpose: z.string().nullable(),
    start_time: z.string().datetime(),
    end_time: z.string().datetime(),
    department: z.string(),
    user_name: z.string(),
    is_mine: z.boolean(),
  })
);

export const paginatedRoomsSchema = createPaginatedResponseSchema(roomSchema);

export const paginatedUsersSchema = createPaginatedResponseSchema(userSchema);

// Type exports for pagination
export type PaginationRequestData = z.infer<typeof paginationRequestSchema>;
export type PaginationMetadata = z.infer<typeof paginationMetadataSchema>;
export type PaginatedReservationsResponse = z.infer<typeof paginatedReservationsSchema>;
export type PaginatedRoomsResponse = z.infer<typeof paginatedRoomsSchema>;
export type PaginatedUsersResponse = z.infer<typeof paginatedUsersSchema>;
```

---

## 2. 데이터 가공: `src/lib/utils/date.ts`

```ts
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
  isSaturday,
  isSunday,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';

// 한국 시간대 상수 (UTC+9)
const KST_OFFSET = 9 * 60 * 60 * 1000; // 9시간을 밀리초로 변환
const KOREA_TIME_ZONE = 'Asia/Seoul';

// ✅ 중앙화된 시간 관리 - 애플리케이션의 "현재"를 정의
export const getCurrentKSTTime = (): Date => {
  return toZonedTime(new Date(), KOREA_TIME_ZONE);
};

export const getTodayKST = (): Date => {
  return startOfDay(getCurrentKSTTime());
};

// ✅ 중앙화된 날짜 검증 함수들
export const isDateInPastKST = (date: Date): boolean => {
  return date < getTodayKST();
};

export const isDateWeekendKST = (date: Date): boolean => {
  return isSaturday(date) || isSunday(date);
};

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
  const kstNow = getCurrentKSTTime(); // ✅ 중앙화된 함수 사용
  
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
  const kstNow = baseDate ? utcToKst(baseDate) : getCurrentKSTTime(); // ✅ 중앙화된 함수 사용
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
  const kstNow = getCurrentKSTTime(); // ✅ 중앙화된 함수 사용
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
  const kstNow = getCurrentKSTTime(); // ✅ 중앙화된 함수 사용
  return isBusinessHours(kstNow);
};

// 한국 시간 기준으로 다음 가능한 예약 시간 반환
export const getNextAvailableKSTTime = (baseDate?: Date): Date => {
  const kstNow = utcToKst(baseDate || getCurrentKSTTime()); // ✅ 중앙화된 함수 사용
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

// Schema validation function - for use in environments where React hooks cannot be used
export const isDateTimeInFutureKST = (date: Date, timeString: string): boolean => {
  const kstNow = getCurrentKSTTime();
  const selectedDateTime = new Date(`${format(date, "yyyy-MM-dd")}T${timeString}`);
  return selectedDateTime > kstNow;
};
```

---

## 3. 데이터 전송: `src/lib/services/reservations.ts`

```ts
// src/lib/services/reservations.ts

'use client';

import { logger } from '@/lib/utils/logger';
import { normalizeDateForQuery } from '@/lib/utils/date';
import { UserIdGuards } from '@/lib/security/user-id-guards';
import type {
  Reservation,
  ReservationInsert,
  ReservationUpdate,
  PublicReservation,
  ReservationWithDetails
} from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// ✅ [추가] getReservations 함수의 반환 데이터 타입을 명시적으로 정의합니다.
// 이렇게 하면 Supabase의 타입 추론에 대한 의존도를 줄일 수 있습니다.
type ReservationWithUserAndRoom = Pick<
  Reservation,
  'id' | 'room_id' | 'user_id' | 'title' | 'purpose' | 'start_time' | 'end_time'
> & {
  user: {
    department: string | null;
    name: string | null;
  } | null; // !inner 조인을 사용하지만, 만약을 위해 null 가능성을 열어둡니다.
  room: {
    name: string | null;
  } | null;
};

export const reservationService = {
  async createReservation(supabase: SupabaseClient<Database>, data: ReservationInsert): Promise<Reservation> {
    try {
      const validatedData = await UserIdGuards.validateReservationData(supabase, data);
      const { data: result, error } = await supabase
        .from('reservations')
        .insert(validatedData)
        .select(`*, room:rooms!inner(*)`) // ✅ 관계형 조회 구문 통일
        .single(); // ✅ .single()을 사용하여 단일 객체 반환 보장

      if (error) throw error;
      if (!result) throw new Error('예약을 생성하고 데이터를 가져오는 데 실패했습니다.');
      
      return result as Reservation;
    } catch (error) {
      logger.error('예약 생성 실패', { error });
      throw new Error('예약 생성에 실패했습니다.');
    }
  },

  async getReservations(supabase: SupabaseClient<Database>, startDate?: string, endDate?: string): Promise<PublicReservation[]> {
    try {
      let query = supabase
        .from('reservations')
        .select(`
          id, room_id, user_id, title, purpose, start_time, end_time,
          user:users!inner ( department, name ), 
          room:rooms!inner ( name )
        `) // ✅ !inner 조인을 사용하여 user와 room이 항상 단일 객체임을 명시
        .eq('status', 'confirmed')
        .order('start_time', { ascending: true });

      if (startDate && endDate) {
        const normalizedStartDate = normalizeDateForQuery(startDate, false);
        const normalizedEndDate = normalizeDateForQuery(endDate, true);
        query = query.gte('start_time', normalizedStartDate).lte('end_time', normalizedEndDate);
      }
      
      // ✅ [수정] Supabase 쿼리 결과의 타입을 명시적으로 지정합니다.
      const { data, error } = await query as { data: ReservationWithUserAndRoom[] | null, error: any };

      if (error) throw error;

      // ✅ [수정] map 함수 내부에서 타입을 명시적으로 맞춰줍니다.
      const publicReservations: PublicReservation[] = (data || []).map((reservation) => ({
        id: reservation.id,
        room_id: reservation.room_id,
        user_id: reservation.user_id,
        title: reservation.title,
        // ✅ [핵심 수정] reservation.purpose가 undefined이면 null을 할당합니다.
        purpose: reservation.purpose ?? null, 
        start_time: reservation.start_time,
        end_time: reservation.end_time,
        department: reservation.user?.department || '',
        user_name: reservation.user?.name || '',
        is_mine: false
      }));
      
      return publicReservations;
    } catch (error) {
      logger.error('예약 목록 조회 실패', { error });
      throw new Error('예약 목록을 불러오는데 실패했습니다.');
    }
  },

  async getReservationsWithDetails(supabase: SupabaseClient<Database>, startDate?: string, endDate?: string): Promise<Reservation[]> {
    try {
      let query = supabase
        .from('reservations')
        .select(`*, user:users!inner(*), room:rooms!inner(*)`) // ✅ 명시적 inner join
        .order('start_time', { ascending: true });
      
      if (startDate && endDate) {
        // ... 날짜 범위 쿼리 ...
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Reservation[];
    } catch (error) {
      logger.error('상세 예약 목록 조회 실패', { error });
      throw new Error('상세 예약 목록을 불러오는데 실패했습니다.');
    }
  },

  async getAllReservations(supabase: SupabaseClient<Database>): Promise<Reservation[]> {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`*, user:users!inner(*), room:rooms!inner(*)`) // ✅ 명시적 inner join
        .order('start_time', { ascending: false });
      if (error) throw error;
      return data as Reservation[];
    } catch (error) {
      logger.error('전체 예약 목록 조회 실패', { error });
      throw new Error('전체 예약 목록을 불러오는데 실패했습니다.');
    }
  },

  async updateReservation(supabase: SupabaseClient<Database>, id: string, data: ReservationUpdate): Promise<Reservation> {
    try {
      const validatedData = await UserIdGuards.validateReservationUpdateData(supabase, data);
      const { data: reservation, error } = await supabase
        .from('reservations')
        .update(validatedData)
        .eq('id', id)
        .select(`*, room:rooms!inner(*)`) // ✅ 관계형 조회 구문 통일
        .single(); // ✅ .single()로 단일 객체 반환 보장

      if (error) throw error;
      if (!reservation) throw new Error('예약을 수정하고 데이터를 가져오는 데 실패했습니다.');

      return reservation as Reservation;
    } catch (error) {
      logger.error('예약 수정 실패', { error });
      throw new Error('예약을 수정하는데 실패했습니다.');
    }
  },

  async cancelReservation(supabase: SupabaseClient<Database>, id: string, reason?: string): Promise<void> {
    try {
      const { error, count } = await supabase
        .from('reservations')
        .update({ status: 'cancelled', cancellation_reason: reason })
        .eq('id', id);
      if (error) throw error;
      if (count === 0) logger.warn('취소할 예약을 찾지 못했습니다.', { id });
    } catch (error) {
      logger.error('예약 취소 실패', { error });
      throw new Error('예약 취소에 실패했습니다.');
    }
  },

  // ... (delete, checkConflict 등 나머지 함수는 이전과 동일)

  async getReservationById(supabase: SupabaseClient<Database>, id: string): Promise<Reservation | null> {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`*, user:users!inner(*), room:rooms!inner(*)`) // ✅ 명시적 inner join
        .eq('id', id)
        .single();
      if (error) {
        logger.warn('ID로 예약 조회 실패 (결과 없음 가능)', { id, error });
        return null;
      }
      return data as Reservation;
    } catch (error) {
      logger.error('ID로 예약 조회 중 오류 발생', { error });
      return null;
    }
  },

  // API 라우트 호출 함수 (수정 필요 없음)
  async getPublicReservations(startDate: string, endDate: string, isAuthenticated?: boolean): Promise<PublicReservation[]> {
    try {
      logger.debug('공개 예약 조회 시작', { startDate, endDate, isAuthenticated });
      
      // 보안 강화: 인증 상태에 따라 적절한 엔드포인트 선택
      const endpoint = isAuthenticated 
        ? '/api/reservations/public-authenticated'
        : '/api/reservations/public-anonymous';
      
      const url = `${endpoint}?startDate=${startDate}&endDate=${endDate}`;
      logger.debug('보안 API 호출 URL', { url, endpoint });
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // 캐시 비활성화로 최신 데이터 보장
        credentials: isAuthenticated ? 'include' : 'omit', // 인증 상태에 따른 쿠키 처리
      });
      
      logger.debug('보안 API 응답 상태:', { 
        status: response.status, 
        statusText: response.statusText,
        endpoint 
      });
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          logger.error('응답 파싱 실패', parseError instanceof Error ? parseError : new Error(String(parseError)));
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        logger.error('공개 예약 목록 조회 실패', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          endpoint
        });
        
        throw new Error(errorData.error || `서버 오류 (${response.status}): 예약 현황을 불러오는데 실패했습니다.`);
      }

      const responseData = await response.json();
      logger.debug('조회된 공개 예약 응답:', {
        hasData: !!responseData.data,
        count: responseData.data?.length || 0,
        message: responseData.message,
        authenticated: responseData.authenticated,
        endpoint
      });

      // ✅ [핵심] 성공적으로 조회된 데이터를 반환합니다.
      return responseData.data || [];
    } catch (error) {
      logger.error('공개 예약 목록 조회 중 오류 발생', {
        error: error instanceof Error ? error.message : 'Unknown error',
        startDate,
        endDate,
        isAuthenticated
      });
      
      // ✅ [핵심] 에러 발생 시 사용자에게 친화적인 오류를 던집니다.
      // 이 경우 함수는 값을 반환하지 않고 종료되지만, throw는 유효한 코드 경로입니다.
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('예약 현황을 불러오는 중 알 수 없는 오류가 발생했습니다.');
      }
    }
  },

  /**
   * '내 예약' 목록을 최적화된 방식으로 조회합니다.
   * RPC 호출을 우선 시도하고, 실패 시 일반 쿼리로 안전하게 대체합니다.
   */
  async getMyReservationsOptimized(supabase: SupabaseClient<Database>, userId: string): Promise<ReservationWithDetails[]> {
    if (!userId) {
      logger.warn('사용자 ID가 없어 최적화된 예약 조회를 할 수 없습니다');
      return [];
    }

    // 1. RPC 함수 (빠른 길) 시도
    try {
      const { data, error } = await supabase.rpc('get_user_reservations_detailed', {
        p_user_id: userId, // SQL 파일의 인자 이름과 일치
        p_limit_count: 50,
        p_offset_count: 0
      });

      if (error) throw new Error(`RPC failed: ${error.message}`);

      logger.info('Successfully fetched reservations via RPC.');
      // SQL 함수는 { data: [...] } 형태로 반환하므로, data.data를 사용
      return (data as any)?.data || [];
    } catch (rpcError) {
      logger.warn('RPC function get_user_reservations_detailed failed, falling back to standard query.', { 
        error: rpcError instanceof Error ? rpcError.message : String(rpcError) 
      });
      
      // 2. 대체 경로 (안전한 길): 기존 getMyReservations 함수 호출
      return this.getMyReservations(supabase, userId);
    }
  },

  async getMyReservations(supabase: SupabaseClient<Database>, userId?: string): Promise<ReservationWithDetails[]> {
    if (!userId) {
      logger.warn('사용자 ID가 없어 내 예약을 조회할 수 없습니다');
      return [];
    }
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`*, room:rooms!inner(*)`)
        .eq('user_id', userId)
        .order('start_time', { ascending: true });
      if (error) throw error;
      return data as ReservationWithDetails[];
    } catch (error) {
      logger.error('내 예약 목록 조회 실패', { error });
      throw new Error('내 예약 목록을 불러오는데 실패했습니다.');
    }
  }
};
```

---

**위 정보가 모두 확보되는 즉시, 데이터 흐름 전체를 관통하는 종합 분석을 통해 문제의 근본 원인을 명확히 밝혀내고, 다시는 동일한 문제가 발생하지 않도록 견고하고 안정적인 해결책을 제시하겠습니다.**