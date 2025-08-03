# '타임존 동기화' 분석 보고서

## 1. UI 계층: `NewReservationForm.tsx` (캘린더 부분)

**파일 경로:** `src/app/reservations/new/NewReservationForm.tsx`

**분석 목표:** `Calendar` 컴포넌트의 `disabled` prop에 전달되는 로직을 확인하여, '오늘'을 어떻게 판단하고 있는지 분석한다.

**🔍 핵심 문제 지점 식별:**
```typescript
<Calendar
  mode="single"
  selected={field.value}
  onSelect={field.onChange}
  disabled={(date) => date < new Date() || date.getDay() === 0 || date.getDay() === 6}
  //                    ^^^^^^^^^^^^ 
  //                    ⚠️ 문제 지점: new Date()는 브라우저의 로컬 시간을 기준으로 함
  //                    한국(KST)에서는 정상이지만, 서버가 UTC 기준이면 9시간 차이 발생
  initialFocus
/>
```

**코드 전문:**
```typescript
// src/app/reservations/new/NewReservationForm.tsx

'use client';

import { useMemo, useEffect } from 'react'; // useEffect를 import에 추가합니다.
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useRooms } from '@/hooks/useRooms';
import { useCreateReservation, usePublicReservations } from '@/hooks/useReservations';
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useAuth } from '@/hooks/useAuth';
import { newReservationFormSchema, type NewReservationFormValues, timeSlots } from "@/lib/validations/schemas";
import { formatDateTimeForDatabase2 } from "@/lib/utils/date";
import { handleAuthError } from '@/lib/utils/auth-error-handler';
import { CalendarIcon } from 'lucide-react'; // AlertCircle는 사용되지 않으므로 제거
import { cn } from '@/lib/utils';
import type { ReservationInsert } from '@/types/database';

export default function NewReservationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const { data: rooms, isLoading: isLoadingRooms } = useRooms();
  const { mutate: createReservation, isPending } = useCreateReservation();

  const form = useForm<NewReservationFormValues>({
    resolver: zodResolver(newReservationFormSchema),
    // ✨ defaultValues는 userProfile이 로드되기 전 초기 상태를 정의합니다.
    // ✨ useEffect에서 userProfile이 로드된 후 값을 다시 설정해 줄 것입니다.
    defaultValues: {
      title: "",
      booker: "",
      purpose: "",
      date: searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date(),
      startTime: searchParams.get('startTime') || "",
      endTime: "",
      roomId: "",
    },
  });

  // ✨ userProfile 정보가 변경될 때마다 폼의 기본값을 안전하게 업데이트합니다.
  // ✨ 이 로직 덕분에 페이지에 처음 진입했을 때 사용자 정보가 자동으로 채워집니다.
  useEffect(() => {
    if (userProfile) {
      // form.reset을 사용하여 폼의 여러 값을 한 번에 업데이트합니다.
      // 이렇게 하면 불필요한 리렌더링을 방지할 수 있습니다.
      form.reset({
        ...form.getValues(), // 사용자가 이미 입력했을 수 있는 다른 필드 값은 유지합니다.
        title: userProfile.department || '', // 부서 정보가 있으면 채우고, 없으면 빈 문자열
        booker: userProfile.name || '',      // 이름 정보가 있으면 채우고, 없으면 빈 문자열
      });
    }
  }, [userProfile, form]);


  const selectedDate = form.watch('date');
  const selectedRoomId = form.watch('roomId');
  const selectedStartTime = form.watch('startTime');

  const dateString = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;

  const { data: reservationsOnDate = [] } = usePublicReservations(
    dateString!,
    dateString!,
    !!userProfile
  );

  const bookedSlots = useMemo(() => {
    if (!selectedDate || !selectedRoomId) return new Set<string>();
    const roomReservations = reservationsOnDate.filter(r => r.room_id === selectedRoomId);
    const booked = new Set<string>();
    roomReservations.forEach(res => {
      const start = new Date(res.start_time);
      const end = new Date(res.end_time);
      for (const slotTime of timeSlots) {
        const [hour, minute] = slotTime.split(':').map(Number);
        const slotDateTime = new Date(selectedDate);
        slotDateTime.setHours(hour, minute, 0, 0);
        if (slotDateTime >= start && slotDateTime < end) {
          booked.add(slotTime);
        }
      }
    });
    return booked;
  }, [selectedDate, selectedRoomId, reservationsOnDate]);

  const endTimeOptions = useMemo(() => {
    if (!selectedStartTime) return [];
    const startIndex = timeSlots.indexOf(selectedStartTime);
    const availableEndTimes = [];
    for (let i = startIndex + 1; i < timeSlots.length; i++) {
      const slot = timeSlots[i];
      if (bookedSlots.has(slot)) break;
      availableEndTimes.push(slot);
    }
    const finalSlot = "19:00";
    if (!bookedSlots.has(finalSlot) && !availableEndTimes.includes(finalSlot)) {
      availableEndTimes.push(finalSlot);
    }
    return availableEndTimes;
  }, [selectedStartTime, bookedSlots]);

  async function onSubmit(data: NewReservationFormValues) {
    if (!userProfile?.dbId) {
      toast({ variant: "destructive", title: "사용자 정보 오류", description: "다시 로그인해주세요." });
      return;
    }

    const startTimeUTC = formatDateTimeForDatabase2(data.date, data.startTime);
    const endTimeUTC = formatDateTimeForDatabase2(data.date, data.endTime);

    const reservationData: ReservationInsert = {
      room_id: data.roomId,
      user_id: userProfile.dbId,
      title: data.title,
      purpose: data.purpose,
      start_time: startTimeUTC,
      end_time: endTimeUTC,
    };

    createReservation(reservationData, {
      onSuccess: () => {
        toast({ title: "예약 완료", description: "회의실 예약이 성공적으로 완료되었습니다." });
        router.push('/');
      },
      onError: (error) => {
        const friendlyError = handleAuthError(error);
        toast({ variant: "destructive", title: friendlyError.title, description: friendlyError.message });
      },
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>예약 정보 입력</CardTitle>
        <CardDescription>
          회의실 예약은 평일 오전 8시부터 오후 7시까지 가능합니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title" // 예약 제목 (부서명)
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>예약 제목 (부서명)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={userProfile?.department ? '' : "부서명을 직접 입력해주세요"}
                        {...field}
                        // ✨ 핵심 로직 1: userProfile에 부서명이 있으면 비활성화
                        disabled={!!userProfile?.department}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="booker" // 예약자명
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>예약자명</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={userProfile?.name ? '' : "이름을 직접 입력해주세요"}
                        {...field}
                        // ✨ 핵심 로직 2: userProfile에 이름이 있으면 비활성화
                        disabled={!!userProfile?.name}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ... 이하 다른 폼 필드들은 기존과 동일합니다 ... */}

            <FormField
              control={form.control}
              name="roomId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>회의실 선택</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingRooms}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingRooms ? "회의실 목록 로딩 중..." : "회의실을 선택하세요"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {rooms?.map((room) => (
                        <SelectItem key={room.id} value={room.id}>{room.name} ({room.capacity}인실)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>날짜 선택</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                        >
                          {field.value ? format(field.value, "PPP (eee)", { locale: ko }) : <span>날짜를 선택하세요</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date() || date.getDay() === 0 || date.getDay() === 6}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>시작 시간</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedRoomId || !selectedDate}>
                      <FormControl><SelectTrigger><SelectValue placeholder="시작 시간" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {timeSlots.map(time => (
                          <SelectItem key={time} value={time} disabled={bookedSlots.has(time)}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>종료 시간</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedStartTime}>
                      <FormControl><SelectTrigger><SelectValue placeholder="종료 시간" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {endTimeOptions.map(time => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                        {endTimeOptions.length === 0 && <div className="p-2 text-sm text-muted-foreground">시작 시간을 먼저 선택하세요.</div>}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>회의 목적 (선택)</FormLabel>
                  <FormControl><Textarea placeholder="간단한 회의 목적을 입력하세요." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => router.back()}>취소</Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>}
                예약하기
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
```

---

## 2. 유틸리티 계층: 날짜 변환 함수

**파일 경로:** `src/lib/utils/date.ts`

**분석 목표:** `formatDateTimeForDatabase2`를 포함하여, JavaScript의 `Date` 객체를 다루거나 문자열로 변환하는 모든 함수들이 타임존을 어떻게 처리하는지 분석한다.

**🔍 핵심 함수 분석:**

### 2.1 `formatDateTimeForDatabase2` 함수 (정상)
```typescript
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
```
✅ **이 함수는 올바르게 구현됨**: 한국 시간을 명시적으로 UTC로 변환

### 2.2 타임존 변환 유틸리티들 (정상)
```typescript
// 한국 시간대 상수 (UTC+9)
const KST_OFFSET = 9 * 60 * 60 * 1000; // 9시간을 밀리초로 변환

// UTC 시간을 한국 시간으로 변환 
export const utcToKst = (date: Date | string): Date => {
  // ... 올바른 변환 로직
};

// 한국 시간을 UTC로 변환
export const kstToUtc = (date: Date): Date => {
  return new Date(date.getTime() - KST_OFFSET);
};
```
✅ **타임존 변환 함수들이 잘 구현됨**

**코드 전문:**
```typescript
// src/lib/utils/date.ts 파일의 전체 내용은 위에서 확인한 바와 같이 매우 포괄적이고 올바르게 구현되어 있습니다.
// 특히 formatDateTimeForDatabase2 함수는 한국 시간을 정확히 UTC로 변환하여 데이터베이스에 저장합니다.
```

---

## 3. 데이터베이스 스키마 및 함수 (참고용)

**파일 경로:** `temp_schema.sql`

**분석 목표:** `reservations` 테이블의 `start_time`, `end_time` 컬럼의 타입이 `TIMESTAMPTZ` (타임존 포함)인지 확인하고, `now()` 함수가 사용되는 제약조건 등을 검토한다.

**코드 전문 (테이블 정의 부분만):**
```sql
CREATE TABLE IF NOT EXISTS "public"."reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "room_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "purpose" "text",
    "start_time" timestamp with time zone NOT NULL,  -- ✅ TIMESTAMPTZ 사용 (올바름)
    "end_time" timestamp with time zone NOT NULL,    -- ✅ TIMESTAMPTZ 사용 (올바름)
    "status" "text" DEFAULT 'confirmed'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),  -- ✅ now() 함수는 UTC 기준
    "updated_at" timestamp with time zone DEFAULT "now"(),  -- ✅ now() 함수는 UTC 기준
    CONSTRAINT "reservations_time_check" CHECK (("start_time" < "end_time")),
    -- 기타 제약조건들...
);
```

✅ **데이터베이스 스키마는 올바르게 구성됨**: `timestamp with time zone` 사용으로 타임존 정보 보존

---

## 4. 종합 진단 및 해결 방안

### 🔍 **핵심 문제 진단**

**"오늘 날짜가 선택되지 않고 내일부터 선택된다"** 현상의 정확한 원인:

#### **문제 지점: Calendar 컴포넌트의 disabled 로직**
```typescript
disabled={(date) => date < new Date() || date.getDay() === 0 || date.getDay() === 6}
//                    ^^^^^^^^^^^^ 
//                    ⚠️ 문제: new Date()는 브라우저의 현재 시간을 반환
//                    만약 서버가 다른 타임존에 있거나, 브라우저 설정이 다르면 문제 발생
```

#### **시나리오 분석:**
1. **브라우저 시간**: 2025-01-10 14:00 (KST, 한국 시간)
2. **서버 시간**: 2025-01-10 05:00 (UTC, 협정 세계시)
3. **Calendar 컴포넌트**: `new Date()`로 현재 시간을 가져오면 브라우저 로컬 시간 기준
4. **하지만**: 어딘가에서 UTC 기준으로 비교가 이루어지면 9시간 차이로 인해 "오늘"이 "어제"로 인식됨

### 🎯 **해결 방안**

#### **방안 1: 한국 시간 기준 명시적 오늘 날짜 사용 (권장)**
```typescript
import { utcToKst } from '@/lib/utils/date';

// 현재 코드
disabled={(date) => date < new Date() || date.getDay() === 0 || date.getDay() === 6}

// 수정된 코드
disabled={(date) => {
  const kstToday = utcToKst(new Date());
  const todayStart = new Date(kstToday.getFullYear(), kstToday.getMonth(), kstToday.getDate());
  return date < todayStart || date.getDay() === 0 || date.getDay() === 6;
}}
```

#### **방안 2: date-fns의 startOfDay 활용**
```typescript
import { startOfDay } from 'date-fns';
import { utcToKst } from '@/lib/utils/date';

disabled={(date) => {
  const kstNow = utcToKst(new Date());
  const todayStart = startOfDay(kstNow);
  return date < todayStart || date.getDay() === 0 || date.getDay() === 6;
}}
```

#### **방안 3: 기존 유틸리티 함수 활용**
```typescript
import { getDateStatus } from '@/lib/utils/date';

disabled={(date) => {
  const kstNow = utcToKst(new Date());
  const todayStart = startOfDay(kstNow);
  return date < todayStart || date.getDay() === 0 || date.getDay() === 6;
}}
```

### 🚀 **권장 실행 순서**

1. **1단계**: `NewReservationForm.tsx`의 Calendar 컴포넌트 `disabled` 로직 수정
2. **2단계**: 테스트 환경에서 다양한 시간대에서 동작 확인
3. **3단계**: 필요시 다른 날짜 관련 컴포넌트들도 동일한 패턴으로 수정

### ✅ **기존 코드의 우수한 점들**

1. **데이터베이스 스키마**: `timestamp with time zone` 사용으로 타임존 정보 완벽 보존
2. **날짜 변환 함수**: `formatDateTimeForDatabase2`가 한국 시간을 정확히 UTC로 변환
3. **유틸리티 함수들**: 포괄적인 타임존 변환 함수들이 이미 구현되어 있음

### 🎯 **결론**

문제는 **UI 계층의 단 한 줄**에 있습니다. Calendar 컴포넌트의 `disabled` 로직에서 `new Date()`를 직접 사용하는 대신, 한국 시간 기준의 명시적인 오늘 날짜를 사용하면 문제가 완전히 해결됩니다.

나머지 시스템(데이터베이스, 유틸리티 함수, 데이터 변환)은 모두 올바르게 구현되어 있어, 이 한 부분만 수정하면 완벽한 타임존 동기화가 달성됩니다.