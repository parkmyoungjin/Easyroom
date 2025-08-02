import { z } from 'zod';
import { format, startOfToday, isWeekend } from "date-fns";

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
  const now = new Date();
  const selectedDateTime = new Date(`${format(data.date, "yyyy-MM-dd")}T${data.startTime}`);
  return selectedDateTime > now;
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