# `dnd-kit`을 활용한 실시간 예약 변경 기능 구현을 위한 아키텍처 분석 보고서

**작성일**: 2025-08-04  
**목적**: '전체 예약 현황' 페이지(`GoogleCalendarView`)에서 드래그 앤 드롭을 통한 직관적 예약 시간 변경 기능 구현

---

## 1. 드래그 앤 드롭의 '무대': `GoogleCalendarView` 컴포넌트

### 1-1. 현재 구조 분석

**파일 경로**: `src/features/reservation/components/GoogleCalendarView.tsx`

#### 핵심 구조 요소:

1. **그리드 시스템**:
   - `grid-cols-[60px_repeat(5,1fr)]`: 시간 라벨(60px) + 5개 요일 컬럼
   - `totalSlots = (END_HOUR - START_HOUR) * 2`: 8시~19시, 30분 단위 = 22개 슬롯
   - `SLOT_HEIGHT = 40`: 30분당 40px

2. **예약 블록 렌더링 로직**:
```typescript
{reservations.filter(res => getDay(utcToKst(res.start_time)) - 1 === dayIndex).map(res => {
  const start = utcToKst(res.start_time);
  const end = utcToKst(res.end_time);
  const startMinutes = (getHours(start) * 60 + getMinutes(start)) - (START_HOUR * 60);
  const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
  const top = (startMinutes / 30) * SLOT_HEIGHT;
  const height = (durationMinutes / 30) * SLOT_HEIGHT;
  
  return (
    <div
      key={res.id}
      className="absolute w-[calc(100%_-_4px)] ml-[2px] p-1 rounded-md border cursor-pointer"
      style={{ top: `${top}px`, height: `${height - 2}px` }}
      onClick={(e) => { e.stopPropagation(); setSelectedReservation(res); }}
    >
      <div className="overflow-hidden text-xs font-semibold truncate">{res.title}</div>
    </div>
  );
})}
```

3. **좌표 계산 공식**:
   - **Y축 (시간)**: `top = (startMinutes / 30) * SLOT_HEIGHT`
   - **높이**: `height = (durationMinutes / 30) * SLOT_HEIGHT`
   - **X축 (요일)**: `dayIndex` (0=월요일, 4=금요일)

4. **현재 이벤트 처리**:
   - 빈 슬롯 클릭: 새 예약 생성 페이지로 이동
   - 예약 블록 클릭: 상세 정보 다이얼로그 표시

#### DnD 적용 시 고려사항:

- **드래그 가능 요소**: 현재 예약 블록 `div`
- **드롭 영역**: 각 요일 컬럼의 시간 슬롯들
- **좌표 변환**: 드롭 위치 → 실제 날짜/시간 변환 로직 필요

---

## 2. 드래그 앤 드롭의 '행동': 데이터 수정 로직 (Mutation)

### 2-1. `useUpdateReservation` 훅 분석

**파일 경로**: `src/hooks/useReservations.ts`

#### 현재 구현:

```typescript
export function useUpdateReservation() {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ReservationFormData> }) => {
      if (!supabase) {
        throw new Error('인증 컨텍스트를 사용할 수 없어 예약을 수정할 수 없습니다.');
      }
      
      // Transform Date objects to ISO strings for database
      const updateData: Partial<ReservationUpdate> = {};
      if (data.title) {
        updateData.title = data.title;
      }
      if (data.purpose) {
        updateData.purpose = data.purpose;
      }
      if (data.start_time) {
        updateData.start_time = data.start_time.toISOString();
      }
      if (data.end_time) {
        updateData.end_time = data.end_time.toISOString();
      }
      
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

#### DnD 적용을 위한 핵심 정보:

1. **입력 타입**: `{ id: string; data: Partial<ReservationFormData> }`
2. **시간 필드**: `start_time`, `end_time` (Date 객체 → ISO 문자열 변환)
3. **성공 시**: 자동 캐시 무효화 및 토스트 알림
4. **에러 처리**: 사용자 친화적 에러 메시지

#### DnD에서 필요한 데이터 형태:
```typescript
// 드래그 완료 시 호출할 데이터
const dndUpdateData = {
  id: reservation.id,
  data: {
    start_time: new Date(newStartTime),
    end_time: new Date(newEndTime)
  }
};
```

---

## 3. 드래그 앤 드롭의 '규칙': 예약 유효성 검사

### 3-1. `useBookedSlots` 훅 분석

**파일 경로**: `src/hooks/useRooms.ts`

#### 현재 구현:

```typescript
export function useBookedSlots(roomId: string | null, date: Date | null) {
  const supabase = useSupabaseClient();
  const { authStatus } = useAuth();
  const dateKey = date ? format(date, 'yyyy-MM-dd') : '';
  
  return useQuery({
    queryKey: ['rooms', roomId, 'booked-slots', dateKey],
    queryFn: async () => {
      if (!roomId || !date || !supabase) {
        return Promise.resolve([]);
      }
      return roomService.getBookedSlotsForTimeline(supabase, roomId, date);
    },
    enabled: !!roomId && !!date && !!supabase && authStatus === 'authenticated',
    staleTime: 1 * 60 * 1000, // 1분
    gcTime: 5 * 60 * 1000, // 5분
  });
}
```

#### DnD 유효성 검사를 위한 활용 방안:

1. **충돌 검사**: 드래그된 시간대에 다른 예약이 있는지 확인
2. **실시간 데이터**: 1분 staleTime으로 최신 예약 상태 반영
3. **날짜별 조회**: 드래그 대상 날짜의 모든 예약 슬롯 확인

#### DnD에서 필요한 충돌 검사 로직:
```typescript
const validateDragDrop = (
  draggedReservation: PublicReservation,
  newStartTime: Date,
  newEndTime: Date,
  bookedSlots: BookedSlot[]
) => {
  // 자기 자신 제외하고 충돌 검사
  const conflictingSlots = bookedSlots.filter(slot => 
    slot.reservation_id !== draggedReservation.id &&
    ((newStartTime >= slot.start_time && newStartTime < slot.end_time) ||
     (newEndTime > slot.start_time && newEndTime <= slot.end_time) ||
     (newStartTime <= slot.start_time && newEndTime >= slot.end_time))
  );
  
  return conflictingSlots.length === 0;
};
```

---

## 4. 실시간 동기화 시스템

### 4-1. 현재 실시간 구독 상태

**활성화된 훅**: `useReservationsRealtime(startDate, endDate, isAuthenticated)`

#### 실시간 동기화 장점:
- 드래그 앤 드롭으로 변경된 예약이 다른 사용자 화면에 즉시 반영
- 충돌 방지: 다른 사용자가 동시에 예약을 변경하는 경우 실시간 감지

#### DnD와의 연동:
- 드래그 완료 → `useUpdateReservation` 호출 → 실시간 구독으로 UI 자동 업데이트
- 낙관적 업데이트 vs 실시간 업데이트 조화 필요

---

## 5. DnD 구현을 위한 기술적 요구사항

### 5-1. 필요한 라이브러리
```bash
npm install @dnd-kit/core @dnd-kit/utilities @dnd-kit/modifiers
```

### 5-2. 핵심 구현 포인트

1. **DndContext 설정**: `GoogleCalendarView` 최상위에 래핑
2. **Draggable 컴포넌트**: 기존 예약 블록을 드래그 가능하게 변환
3. **Droppable 영역**: 각 요일 컬럼의 시간 슬롯들
4. **좌표 변환 로직**: 드롭 위치 → 실제 날짜/시간 계산
5. **충돌 검사**: 드래그 전 유효성 검증
6. **시각적 피드백**: 드래그 중 반투명, 드롭 가능 영역 하이라이트

### 5-3. 예상 구현 흐름

```typescript
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  
  if (!over) return; // 드롭 영역 밖으로 드래그한 경우
  
  // 1. 드롭 위치를 실제 날짜/시간으로 변환
  const newDateTime = convertDropPositionToDateTime(over.id, over.rect);
  
  // 2. 충돌 검사
  const isValid = validateTimeSlot(active.data.current, newDateTime);
  if (!isValid) {
    toast.error('해당 시간에는 다른 예약이 있습니다.');
    return;
  }
  
  // 3. 예약 업데이트 실행
  updateReservation.mutate({
    id: active.id,
    data: {
      start_time: newDateTime.start,
      end_time: newDateTime.end
    }
  });
};
```

---

## 6. 결론 및 구현 준비도

### 6-1. 구현 가능성 평가: ✅ 높음

- **기존 아키텍처 호환성**: 현재 구조와 잘 맞음
- **데이터 수정 로직**: `useUpdateReservation` 훅 완비
- **유효성 검사**: `useBookedSlots` 활용 가능
- **실시간 동기화**: 이미 구축된 시스템과 자연스럽게 연동

### 6-2. 주요 구현 과제

1. **정밀한 좌표 계산**: 픽셀 위치 → 정확한 시간 변환
2. **UX 최적화**: 드래그 중 시각적 피드백
3. **에러 처리**: 충돌 시 사용자 친화적 안내
4. **성능 최적화**: 드래그 중 불필요한 리렌더링 방지

### 6-3. 구현 우선순위

1. **Phase 1**: 기본 드래그 앤 드롭 기능
2. **Phase 2**: 충돌 검사 및 유효성 검증
3. **Phase 3**: 시각적 피드백 및 UX 개선
4. **Phase 4**: 성능 최적화 및 에러 처리 강화

---

**보고서 작성 완료**  
이 분석을 바탕으로 `dnd-kit` 라이브러리를 활용한 완전한 드래그 앤 드롭 예약 변경 기능 구현이 가능합니다.