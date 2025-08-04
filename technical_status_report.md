# 타임라인 예약 시스템 도입을 위한 기술 현황 보고서

## 개요
현재 '새 예약' 페이지의 아키텍처 및 데이터 흐름을 분석하여, 타임라인 기반 예약 시스템을 구현하기 위한 기술적 기반을 파악했습니다.

---

## 1. 프론트엔드: '새 예약' 페이지 UI 컴포넌트 구조

### 1-1. 페이지 진입점 컴포넌트
**파일 경로:** `src/app/reservations/new/page.tsx`

```typescript
export default function NewReservationPage() {
  return (
    <div className="min-h-screen bg-background">
      <MobileHeader 
        title="새 예약 만들기" 
        subtitle="원하는 시간과 회의실을 선택하세요."
      />
      
      <main className="container mx-auto py-8">
        <div className="max-w-2xl mx-auto">
          <Suspense fallback={<FormSkeleton />}>
            <NewReservationForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
```

**핵심 특징:**
- Suspense를 활용한 로딩 상태 관리
- 모바일 친화적 헤더 구조
- 중앙 정렬된 폼 레이아웃

### 1-2. 핵심 폼(Form) 컴포넌트
**파일 경로:** `src/app/reservations/new/NewReservationForm.tsx`

**주요 상태 관리:**
```typescript
const form = useForm<NewReservationFormValues>({
  resolver: zodResolver(newReservationFormSchema),
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

const selectedDate = form.watch('date');
const selectedRoomId = form.watch('roomId');
const selectedStartTime = form.watch('startTime');
```

**현재 시간 선택 로직:**
```typescript
// 예약 가능 시간 조회
const { data: availableTimeSlots, isLoading: isLoadingSlots } = useAvailableTimeSlots(
  selectedRoomId, 
  selectedDate
);

// 종료 시간 옵션 계산
const endTimeOptions = useMemo(() => {
  if (!selectedStartTime || !availableTimeSlots) return [];
  
  const startIndex = timeSlots.indexOf(selectedStartTime);
  if (startIndex === -1) return [];
  
  const options = [];
  
  for (let i = startIndex + 1; i < timeSlots.length; i++) {
    const currentTime = timeSlots[i];
    
    if (!availableTimeSlots.includes(currentTime)) {
      break;
    }
    
    options.push(currentTime);
  }
  
  return options;
}, [selectedStartTime, availableTimeSlots]);
```

**현재 문제점:**
- 드롭다운 기반 시간 선택으로 사용자 경험이 제한적
- 시각적으로 예약 현황을 파악하기 어려움
- 연속된 시간 블록 선택이 직관적이지 않음

---

## 2. 데이터 흐름 및 상태 관리

### 2-1. 상태 관리
**React Hook Form 기반 상태 관리:**
- `selectedDate`: 선택된 날짜 (Date 객체)
- `selectedRoomId`: 선택된 회의실 ID (string)
- `selectedStartTime`: 선택된 시작 시간 (string)
- `selectedEndTime`: 선택된 종료 시간 (string)

**상태 변화 흐름:**
1. 회의실 선택 → `selectedRoomId` 업데이트
2. 날짜 선택 → `selectedDate` 업데이트
3. 회의실 + 날짜 변경 시 → `useAvailableTimeSlots` 훅 자동 실행
4. 시작 시간 선택 → 종료 시간 옵션 재계산

### 2-2. 데이터 페칭 훅
**파일 경로:** `src/hooks/useRooms.ts`

```typescript
export function useAvailableTimeSlots(roomId: string, date: Date | null) {
  const supabase = useSupabaseClient();
  
  const dateKey = date ? format(date, 'yyyy-MM-dd') : '';
  
  return useQuery(buildQueryOptions({
    queryKey: roomKeys.availableSlots(roomId, dateKey),
    queryFn: createStandardFetch(
      () => {
        if (!roomId || !date || !supabase) {
          return Promise.resolve([]);
        }
        
        return roomService.getAvailableTimeSlots(supabase, roomId, date);
      },
      {
        operation: 'fetch available time slots',
        params: { roomId, dateKey }
      }
    ),
    enabled: !!roomId && !!date && !!supabase,
    dataType: 'dynamic',
    cacheConfig: {
      customStaleTime: 1 * 60 * 1000, // 1분
      customGcTime: 5 * 60 * 1000 // 5분
    }
  }));
}
```

**데이터 페칭 특징:**
- React Query 기반 캐싱 및 상태 관리
- 1분 stale time으로 실시간성 보장
- 방어적 프로그래밍으로 안정성 확보

---

## 3. 백엔드 연동: 서비스 및 API 호출 로직

### 3-1. 서비스 로직
**파일 경로:** `src/lib/services/rooms.ts`

```typescript
async getAvailableTimeSlots(supabase: TypedSupabaseClient, roomId: string, date: Date): Promise<string[]> {
  try {
    if (!roomId || !date) {
      logger.warn('getAvailableTimeSlots: Invalid parameters', { roomId, date });
      return [];
    }

    const dateString = format(date, 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .rpc('get_available_time_slots', {
        p_room_id: roomId,
        p_date: dateString
      });

    if (error) {
      logger.error('RPC get_available_time_slots failed', { error, roomId, dateString });
      return [];
    }

    return data as string[];

  } catch (error) {
    logger.error('Error in getAvailableTimeSlots service', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      roomId, 
      date 
    });
    return [];
  }
}
```

### 3-2. 최종 예약 생성 로직
**파일 경로:** `src/hooks/useCreateReservation.ts`

```typescript
export function useCreateReservation() {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient();

  return useMutation({
    mutationFn: async (data: ReservationInsert) => {
      if (!supabase) {
        throw new Error('Supabase 클라이언트를 사용할 수 없습니다. 페이지를 새로고침해주세요.');
      }
      
      const result = await reservationService.createReservation(supabase, data); 
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

**예약 생성 데이터 구조:**
```typescript
const reservationData: ReservationInsert = {
  room_id: data.roomId,
  user_id: userProfile.dbId,
  title: data.title,
  purpose: data.purpose,
  start_time: startTimeUTC,
  end_time: endTimeUTC,
};
```

---

## 4. 데이터베이스 연동

### 4-1. 현재 RPC 함수
**파일 경로:** `supabase/migrations/20250803120000_create_get_available_time_slots_function.sql`

```sql
CREATE OR REPLACE FUNCTION "public"."get_available_time_slots"(
    "p_room_id" "uuid", 
    "p_date" "date"
) RETURNS "jsonb"
```

**함수 특징:**
- 08:00 ~ 18:30, 30분 간격 시간 슬롯 생성
- KST 기준 시간대 처리
- 기존 예약과의 충돌 검사
- JSON 배열 형태로 사용 가능한 시간 반환

**현재 반환 형태:**
```json
["08:00", "08:30", "09:00", "10:30", "11:00", ...]
```

---

## 5. 타임라인 시스템 도입을 위한 개선 방향

### 5-1. 필요한 새로운 RPC 함수
타임라인 표시를 위해서는 **예약된 시간 블록 정보**가 필요합니다:

```sql
-- 새로 필요한 함수: get_booked_slots_for_timeline
-- 반환 형태: 예약된 시간 블록들의 상세 정보
[
  {
    "start_time": "09:00",
    "end_time": "10:30",
    "title": "마케팅팀 회의",
    "booker": "김철수",
    "is_mine": false
  },
  ...
]
```

### 5-2. 새로운 React 컴포넌트 구조
```
NewReservationForm.tsx
├── RoomSelector (기존)
├── DatePicker (기존)
├── Timeline (새로 추가)
│   ├── TimeSlotGrid
│   ├── BookedSlotBlock
│   └── SelectableSlotBlock
└── ReservationSummary (기존 폼 필드들)
```

### 5-3. 상태 관리 개선
```typescript
// 기존 상태에 추가
const [selectedTimeRange, setSelectedTimeRange] = useState<{
  startTime: string;
  endTime: string;
} | null>(null);

const [timelineData, setTimelineData] = useState<BookedSlot[]>([]);
```

---

## 6. 기술적 고려사항

### 6-1. 성능 최적화
- 타임라인 데이터는 실시간성이 중요하므로 캐시 시간을 짧게 설정
- 드래그 앤 드롭 시 debounce 적용으로 불필요한 API 호출 방지

### 6-2. 사용자 경험
- 기존 드롭다운 방식과 타임라인 방식 간 전환 옵션 제공
- 모바일에서의 터치 인터랙션 최적화

### 6-3. 접근성
- 키보드 네비게이션 지원
- 스크린 리더 호환성
- 색상 대비 및 시각적 구분

---

## 7. 결론

현재 시스템은 견고한 아키텍처를 가지고 있으며, 타임라인 시스템 도입을 위한 기반이 잘 갖춰져 있습니다. 주요 개선점은:

1. **새로운 RPC 함수** 추가로 타임라인 표시용 데이터 제공
2. **Timeline 컴포넌트** 개발로 직관적인 시간 선택 UI 구현
3. **기존 상태 관리 로직** 확장으로 타임라인 상호작용 지원

이러한 개선을 통해 사용자는 더욱 직관적이고 효율적인 예약 경험을 얻을 수 있을 것입니다.