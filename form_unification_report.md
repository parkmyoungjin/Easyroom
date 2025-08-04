# 예약 폼 통합을 위한 아키텍처 분석 보고서

## 개요
'새 예약'과 '예약 수정' 기능을 **"디자인은 수정 폼, 로직은 새 예약 폼"**이라는 원칙 하에, 재사용 가능한 단일 폼 컴포넌트로 통합하기 위한 정밀 분석 보고서입니다.

---

## 1. UI/UX의 기준: '예약 수정' 폼

### 1-1. '예약 수정' 페이지 전체 코드 분석

**파일 경로:** `src/app/reservations/edit/[id]/page.tsx`

#### **🎨 채택할 UI 구조 요소들:**

1. **전체 레이아웃 구조:**
```typescript
<div className="min-h-screen bg-gray-50">
  <MobileHeader title="예약 수정" showBackButton />
  <div className="max-w-2xl mx-auto px-4 py-8">
    <Card>
      <CardHeader>
        <CardTitle>예약 수정</CardTitle>
        <CardDescription>예약 정보를 수정하세요</CardDescription>
      </CardHeader>
      <CardContent>
        {/* 폼 내용 */}
      </CardContent>
    </Card>
  </div>
</div>
```

2. **폼 필드 배치 패턴:**
```typescript
// 2열 그리드 레이아웃
<div className="grid grid-cols-2 gap-4">
  <FormField name="title" />      // 부서명
  <FormField name="booker" />     // 예약자
</div>

// 단일 필드
<FormField name="roomId" />       // 회의실 선택
<FormField name="date" />         // 날짜 (Calendar 컴포넌트)

// 시간 선택 2열 그리드
<div className="grid grid-cols-2 gap-4">
  <FormField name="startTime" />  // 시작 시간
  <FormField name="endTime" />    // 종료 시간
</div>

// 목적 필드
<FormField name="purpose" />      // 목적 (Textarea)

// 버튼 영역
<div className="flex gap-4">
  <Button variant="outline" />    // 취소
  <Button type="submit" />        // 완료
</div>
```

3. **스타일링 특징:**
- `bg-gray-50` 배경색
- `max-w-2xl mx-auto` 중앙 정렬 컨테이너
- `Card` 컴포넌트 기반 폼 래핑
- `grid grid-cols-2 gap-4` 반응형 그리드 레이아웃
- `flex gap-4` 버튼 배치

#### **🚨 수정 폼의 문제점들:**

1. **복잡한 데이터 로딩 로직:** 내 예약에서 찾기 → 권한 검증 → 폼 설정
2. **중복된 시간 충돌 계산:** 새 예약 폼과 유사하지만 현재 예약 제외 로직 추가
3. **복잡한 권한 검증:** `canEditReservation`, 디버깅 로직 등
4. **하드코딩된 timeSlots:** 새 예약 폼과 다른 시간 슬롯 정의

---

## 2. 기능 아키텍처의 기준: '새 예약' 폼

### 2-1. '새 예약' 폼 컴포넌트 전체 코드 분석

**파일 경로:** `src/app/reservations/new/NewReservationForm.tsx`

#### **🏗️ 채택할 로직 구조 요소들:**

1. **시간 슬롯 정의 (컴포넌트 외부):**
```typescript
// 시작 시간: 08:00부터 18:30까지
const START_TIME_SLOTS = Array.from({ length: (18.5 - 8) * 2 + 1 }, (_, i) => {
    const hours = 8 + Math.floor(i / 2);
    const minutes = (i % 2) * 30;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
});

// 종료 시간: 08:30부터 19:00까지
const END_TIME_SLOTS = Array.from({ length: (19 - 8.5) * 2 + 1 }, (_, i) => {
    const hours = 8 + Math.floor((i + 1) / 2);
    const minutes = ((i + 1) % 2) * 30;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
});
```

2. **안정적인 시간 충돌 계산:**
```typescript
const timeSlotStatus = useMemo(() => {
    if (!selectedDate || isLoadingSlots) return {};
    const statusMap: { [time: string]: { isBooked: boolean; title: string } } = {};

    // UTC 타임스탬프 기반 정확한 비교
    const bookedIntervals = bookedSlots.map(slot => ({
        start: new Date(slot.start_time).getTime(),
        end: new Date(slot.end_time).getTime(),
        title: slot.is_mine ? `(내 예약: ${slot.title})` : '(예약됨)',
    }));

    START_TIME_SLOTS.forEach(slotTime => {
        const slotStart = new Date(`${format(selectedDate, 'yyyy-MM-dd')}T${slotTime}:00.000+09:00`).getTime();
        const slotEnd = slotStart + 30 * 60 * 1000;

        const conflictingReservation = bookedIntervals.find(interval =>
            slotStart < interval.end && slotEnd > interval.start
        );

        statusMap[slotTime] = {
            isBooked: !!conflictingReservation,
            title: conflictingReservation ? conflictingReservation.title : ''
        };
    });
    return statusMap;
}, [selectedDate, bookedSlots, isLoadingSlots]);
```

3. **종료 시간 옵션 계산:**
```typescript
const endTimeOptions = useMemo(() => {
    if (!selectedStartTime) return [];
    
    const options: string[] = [];
    const possibleEndTimes = END_TIME_SLOTS.filter(time => time > selectedStartTime);

    for (const currentTime of possibleEndTimes) {
        const prevTime = options.length > 0 ? options[options.length - 1] : selectedStartTime;
        
        if (timeSlotStatus[prevTime]?.isBooked) {
            break; // 이미 예약된 시간 이후는 선택 불가
        }
        options.push(currentTime);
    }
    return options;
}, [selectedStartTime, timeSlotStatus]);
```

4. **useBookedSlots 훅 활용:**
```typescript
const { data: bookedSlots = [], isLoading: isLoadingSlots } = useBookedSlots(
    selectedRoomId,
    selectedDate
);
```

5. **명시적인 상태 초기화:**
```typescript
// 회의실 변경 시
onValueChange={(value) => {
    field.onChange(value);
    form.setValue('startTime', '');
    form.setValue('endTime', '');
}}

// 날짜 변경 시
onSelect={(date) => {
    if(date) field.onChange(date);
    form.setValue('startTime', '');
    form.setValue('endTime', '');
    setIsCalendarOpen(false);
}}

// 시작 시간 변경 시
onValueChange={(value) => {
    field.onChange(value);
    form.setValue('endTime', '');
}}
```

#### **✅ 새 예약 폼의 장점들:**

1. **최적화된 성능:** 컴포넌트 외부 상수, useMemo 활용
2. **정확한 시간 계산:** UTC 타임스탬프 기반 비교
3. **명확한 상태 관리:** 의존성 변경 시 명시적 초기화
4. **안정적인 데이터 조회:** useBookedSlots 훅 활용
5. **사용자 친화적 UX:** 캘린더 자동 닫기, 로딩 상태 표시

---

## 3. 데이터 수정 로직 (Mutations)

### 3-1. `useUpdateReservation` 훅 전체 코드 분석

**파일 경로:** `src/hooks/useUpdateReservation.ts`

#### **🔧 수정 로직 구조:**

```typescript
export function useUpdateReservation() {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ReservationFormData> }) => {
      if (!supabase) {
        throw new Error('인증 컨텍스트를 사용할 수 없어 예약을 수정할 수 없습니다.');
      }
      
      // Date 객체를 ISO 문자열로 변환
      const updateData: Partial<ReservationUpdate> = {};
      if (data.title) updateData.title = data.title;
      if (data.purpose) updateData.purpose = data.purpose;
      if (data.start_time) updateData.start_time = data.start_time.toISOString();
      if (data.end_time) updateData.end_time = data.end_time.toISOString();
      
      return reservationService.updateReservation(supabase, id, updateData);
    },
    onSuccess: (updatedReservation) => {
      queryClient.invalidateQueries({ 
        queryKey: reservationKeys.all,
        exact: false
      });
      queryClient.invalidateQueries({
        queryKey: reservationKeys.detail(updatedReservation.id)
      });
      toast.success('예약이 수정되었습니다.');
    },
    onError: (error) => {
      toast.error('예약 수정 실패', {
        description: error instanceof Error ? error.message : '예약 수정 중 오류가 발생했습니다.',
      });
    },
  });
}
```

#### **📝 수정 로직 특징:**

1. **데이터 변환:** Date 객체 → ISO 문자열
2. **선택적 업데이트:** 변경된 필드만 전송
3. **캐시 무효화:** 전체 목록 + 상세 정보 무효화
4. **에러 처리:** 사용자 친화적 메시지

---

## 4. 통합 전략 및 구현 계획

### 4-1. 통합 폼 컴포넌트 설계

#### **Props 인터페이스:**
```typescript
interface ReservationFormProps {
  mode: 'create' | 'edit';
  reservationId?: string; // edit 모드일 때만 필수
  onSuccess?: () => void;
  onCancel?: () => void;
}
```

#### **핵심 통합 로직:**

1. **모드별 초기화:**
   - `create`: 기본값 + URL 파라미터
   - `edit`: 기존 예약 데이터 로딩

2. **시간 충돌 계산 통합:**
   - `create`: 모든 예약과 충돌 검사
   - `edit`: 현재 예약 제외하고 충돌 검사

3. **제출 로직 분기:**
   - `create`: `useCreateReservation` 훅 사용
   - `edit`: `useUpdateReservation` 훅 사용

### 4-2. 페이지 컴포넌트 간소화

#### **새 예약 페이지:**
```typescript
// src/app/reservations/new/page.tsx
export default function NewReservationPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader title="새 예약" showBackButton />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <ReservationForm 
          mode="create" 
          onSuccess={() => router.push('/')}
          onCancel={() => router.back()}
        />
      </div>
    </div>
  );
}
```

#### **예약 수정 페이지:**
```typescript
// src/app/reservations/edit/[id]/page.tsx
export default function EditReservationPage() {
  const params = useParams();
  const reservationId = params.id as string;

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader title="예약 수정" showBackButton />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <ReservationForm 
          mode="edit" 
          reservationId={reservationId}
          onSuccess={() => router.push('/reservations/my')}
          onCancel={() => router.push('/reservations/my')}
        />
      </div>
    </div>
  );
}
```

### 4-3. 삭제 대상 파일

- `src/app/reservations/new/NewReservationForm.tsx` - 통합 폼으로 대체
- `src/hooks/useUpdateReservation.ts` - `useReservations.ts`에 이미 동일 훅 존재

---

## 5. 구현 우선순위

### 🔥 **1단계: 통합 폼 컴포넌트 생성**
- `src/components/reservations/ReservationForm.tsx` 생성
- 수정 폼의 UI + 새 예약 폼의 로직 결합
- 모드별 분기 로직 구현

### ⚡ **2단계: 페이지 컴포넌트 간소화**
- 새 예약 페이지 대폭 수정
- 예약 수정 페이지 대폭 수정

### 📋 **3단계: 정리 작업**
- 기존 NewReservationForm.tsx 삭제
- 중복 훅 정리
- 테스트 및 검증

---

## 6. 기대 효과

### ✅ **코드 품질 향상**
- 중복 코드 제거 (약 80% 코드 감소)
- 단일 책임 원칙 적용
- 유지보수성 대폭 향상

### ✅ **사용자 경험 통일**
- 일관된 UI/UX
- 동일한 검증 로직
- 통일된 에러 처리

### ✅ **개발 효율성 증대**
- 새로운 기능 추가 시 한 곳만 수정
- 버그 수정 시 단일 지점 관리
- 테스트 코드 간소화

이 보고서를 바탕으로 **최종 진화형 단일 폼 컴포넌트**를 구현하여, 프로젝트 아키텍처를 가장 이상적인 형태로 완성할 수 있습니다.