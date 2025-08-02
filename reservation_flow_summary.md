# '새 예약' 기능 코드 흐름 요약 보고서

## 1. UI 계층: 예약 버튼 컴포넌트

**파일 경로:** `src/app/reservations/new/NewReservationForm.tsx`

**핵심 코드:** (예약 생성 핸들러 함수와 관련된 전체 코드 블록)

```typescript
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

  // ... 기타 로직 ...

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

  // ... 폼 렌더링 부분 ...

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
            {/* ... 폼 필드들 ... */}
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

## 2. 로직 계층: 예약 생성 커스텀 훅

**파일 경로:** `src/hooks/useCreateReservation.ts`

**핵심 코드:** (파일 전체 내용)

```typescript
// src/hooks/useCreateReservation.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationService } from '@/lib/services/reservations';
// Using console for now instead of sonner
const toast = {
  success: (title: string, options?: { description?: string }) => console.log(`✅ ${title}`, options?.description || ''),
  error: (title: string, options?: { description?: string }) => console.error(`❌ ${title}`, options?.description || '')
};
import { reservationKeys } from '@/hooks/useReservations';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
import type { ReservationInsert } from '@/types/database';
import { logger } from '@/lib/utils/logger';

export function useCreateReservation() {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient();

  return useMutation({
    // ✅ [수정] mutationFn이 예약 데이터(data)만 받도록 합니다.
    mutationFn: async (data: ReservationInsert) => {
      // ✅ [추가] supabase 클라이언트가 있는지 확인하는 방어 코드를 넣습니다.
      if (!supabase) {
        throw new Error('인증 컨텍스트를 사용할 수 없어 예약을 생성할 수 없습니다.');
      }
      
      logger.debug('Creating reservation');

      // ✅ [수정] 서비스 함수에 supabase 클라이언트를 첫 번째 인자로 전달합니다.
      const result = await reservationService.createReservation(supabase, data); 
      
      logger.info('Reservation created successfully');
      return result;
    },
    onSuccess: () => {
      toast.success('예약 완료', {
        description: '회의실 예약이 성공적으로 완료되었습니다.',
      });
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
    },
    onError: (error: Error) => {
      logger.error('예약 생성 실패', error);
      toast.error('예약 실패', {
        description: error.message,
      });
    },
  });
}
```

## 3. 서비스 계층: 예약 생성 서비스 함수

**파일 경로:** `src/lib/services/reservations.ts`

**핵심 코드:** (예약 생성 관련 함수 부분)

```typescript
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

  // ... 기타 서비스 함수들 ...
};
```

## 분석 결과 및 문제점 식별

### 🔍 조용한 실패(Silent Failure)의 원인 분석

1. **인증 컨텍스트 의존성 문제**
   - `useCreateReservation` 훅에서 `useSupabaseClient()`를 통해 Supabase 클라이언트를 가져옴
   - 만약 `SupabaseProvider` 컨텍스트가 제대로 초기화되지 않았거나 인증 정보가 없는 경우, `supabase` 객체가 `null`이거나 인증되지 않은 상태일 수 있음

2. **에러 처리의 한계**
   - 훅에서 `if (!supabase)` 체크를 하지만, 이 에러가 UI에서 적절히 처리되지 않을 수 있음
   - `mutationFn`에서 발생한 에러가 `onError` 콜백으로 전달되지만, 로딩 상태가 계속 유지될 가능성

3. **서비스 계층의 의존성**
   - `reservationService.createReservation`이 `UserIdGuards.validateReservationData`를 호출하여 추가 검증을 수행
   - 이 과정에서 인증 관련 문제가 발생할 수 있음

### 🎯 권장 해결 방안

1. **인증 상태 확인 강화**: UI 계층에서 `userProfile`과 Supabase 클라이언트 상태를 모두 확인
2. **에러 로깅 개선**: 각 단계별로 상세한 로그를 추가하여 실패 지점 추적
3. **방어적 프로그래밍**: 모든 의존성에 대한 null 체크와 fallback 로직 추가
4. **사용자 피드백 개선**: 로딩 상태와 에러 상태에 대한 명확한 UI 피드백 제공