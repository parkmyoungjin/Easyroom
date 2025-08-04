# Supabase Realtime 도입을 위한 데이터 흐름 및 아키텍처 분석 보고서

## 개요
'전체 예약 현황' 페이지에서 다른 사용자의 예약 변경사항이 실시간으로 자동 업데이트되는 기능을 구현하기 위해, 현재 데이터 조회 및 수정 아키텍처를 정밀 분석했습니다.

---

## 1. 데이터 조회 (Query)의 핵심: `usePublicReservations`

### 1-1. `usePublicReservations` 훅 전체 구조
**파일 경로:** `src/hooks/useReservations.ts` (라인 40-58)

```typescript
// 공개 예약을 가져오는 훅 (API 사용, 수정 필요 없음)
export function usePublicReservations(startDate: string, endDate: string, isAuthenticated?: boolean) {
  const dateOptimization = optimizeForDateRange(startDate, endDate);
  return useQuery(buildQueryOptions({
    queryKey: reservationKeys.public(startDate, endDate, isAuthenticated),
    queryFn: createStandardFetch(
      () => reservationService.getPublicReservations(startDate, endDate, isAuthenticated),
      { operation: 'fetch public reservations', params: { startDate, endDate, isAuthenticated } }
    ),
    enabled: !!startDate && !!endDate,
    dataType: 'dynamic',
    cacheConfig: {
      customStaleTime: dateOptimization.staleTime,
      customGcTime: dateOptimization.gcTime
    },
    retryConfig: {
      maxRetries: 2,
      baseDelay: 1000
    }
  }));
}
```

**핵심 정보:**
- **QueryKey**: `reservationKeys.public(startDate, endDate, isAuthenticated)`
  - 실제 값: `['reservations', 'public', '2025-01-06', '2025-01-12', 'auth', true]`
- **QueryFn**: `reservationService.getPublicReservations()` (API 호출)
- **캐시 설정**: `staleTime: 2-15분`, `gcTime: 10-30분`
- **반환 타입**: `PublicReservation[]`

---

## 2. 데이터 수정 (Mutation)의 모든 경우의 수

### 2-1. 예약 생성 (`Create`)
**파일 경로:** `src/hooks/useReservations.ts` (라인 158-175)

```typescript
// 예약을 생성하는 뮤테이션 훅
export function useCreateReservation() {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient();

  return useMutation({
    mutationFn: async (data: ReservationInsert) => {
      if (!supabase) throw new Error("인증 컨텍스트를 사용할 수 없습니다.");
      return reservationService.createReservation(supabase, data);
    },
    onSuccess: () => {
      toast.success('예약 완료', { description: '예약이 성공적으로 완료되었습니다.' });
      // ✅ [핵심] 모든 예약 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
    onError: (error: Error) => {
      logger.error('예약 생성 실패', error);
      toast.error('예약 실패', { description: error.message });
    },
  });
}
```

### 2-2. 예약 수정 (`Update`)
**파일 경로:** `src/hooks/useReservations.ts` (라인 177-194)

```typescript
// 예약을 수정하는 뮤테이션 훅
export function useUpdateReservation() {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ReservationFormData> }) => {
      if (!supabase) throw new Error("인증 컨텍스트를 사용할 수 없습니다.");
      const updateData: ReservationUpdate = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined)
      );
      return reservationService.updateReservation(supabase, id, updateData);
    },
    onSuccess: (updatedReservation) => {
      toast.success('예약 변경 완료', { description: '예약 정보가 성공적으로 변경되었습니다.' });
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
      queryClient.invalidateQueries({ queryKey: reservationKeys.detail(updatedReservation.id) });
    },
    onError: (error: Error) => {
      logger.error('예약 수정 실패', error);
      toast.error('변경 실패', { description: error.message });
    },
  });
}
```

### 2-3. 예약 취소 (`Delete`)
**파일 경로 1:** `src/hooks/useReservations.ts` (라인 196-213)

```typescript
// 예약을 취소하는 뮤테이션 훅
export function useCancelReservation() {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => {
      if (!supabase) throw new Error("인증 컨텍스트를 사용할 수 없습니다.");
      return reservationService.cancelReservation(supabase, id, reason);
    },
    onSuccess: () => {
      toast.success('예약이 취소되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
    onError: (error: Error) => {
      toast.error('예약 취소 실패', { description: error.message });
    },
  });
}
```

**파일 경로 2:** `src/hooks/useCancelReservation.ts` (전체 파일)

```typescript
export function useCancelReservation() {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient();

  return useMutation({
    mutationFn: async ({ id, reason }: CancelReservationInput) => {
      if (!supabase) {
        throw new Error('인증 컨텍스트를 사용할 수 없어 예약을 취소할 수 없습니다.');
      }
      return reservationService.cancelReservation(supabase, id, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: reservationKeys.all,
        exact: false
      });
      toast.success('예약이 취소되었습니다.');
    },
    onError: (error) => {
      toast.error('예약 취소 실패', {
        description: error instanceof Error ? error.message : '예약 취소 중 오류가 발생했습니다.',
      });
    },
  });
}
```

**🚨 중요 발견:** 예약 취소 훅이 2개 파일에 중복 존재!

---

## 3. Supabase 클라이언트 및 타입 정의

### 3-1. Supabase 클라이언트 타입
**파일 경로:** `src/contexts/SupabaseProvider.tsx`

```typescript
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Context 타입 정의
const SupabaseContext = createContext<SupabaseClient<Database> | null>(null);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  // 클라이언트 인스턴스 생성
  const supabase = useMemo(() =>
    createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );

  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  );
}

// 클라이언트 접근 훅
export function useSupabaseClient() {
  const context = useContext(SupabaseContext);
  
  if (context === undefined) {
    throw new Error('useSupabaseClient must be used within a SupabaseProvider');
  }
  
  return context;
}
```

**핵심 정보:**
- **클라이언트 타입**: `SupabaseClient<Database>`
- **생성 방식**: `createBrowserClient<Database>()`
- **접근 방법**: `useSupabaseClient()` 훅 사용

### 3-2. `PublicReservation` 타입 정의
**파일 경로:** `src/types/database.ts` (라인 150-160)

```typescript
// ✅ PublicReservation 타입 명확한 정의 (get_public_reservations 함수 반환값과 일치)
export type PublicReservation = {
  id: string
  room_id: string
  user_id: string
  title: string
  purpose: string | null
  department: string
  user_name: string // 예약자 이름 추가
  start_time: string
  end_time: string
  is_mine: boolean
}
```

**핵심 정보:**
- **시간 필드**: `start_time`, `end_time` (string 타입, ISO 8601 형식)
- **사용자 정보**: `user_id`, `user_name`, `department`
- **예약 정보**: `id`, `room_id`, `title`, `purpose`
- **권한 정보**: `is_mine` (현재 사용자의 예약 여부)

---

## 4. Database 스키마 구조

### 4-1. `reservations` 테이블 구조
**파일 경로:** `src/types/database.ts` (라인 50-75)

```typescript
reservations: {
  Row: {
    id: string
    room_id: string
    user_id: string
    title: string
    purpose?: string
    start_time: string
    end_time: string
    status: 'confirmed' | 'cancelled'
    cancellation_reason?: string
    created_at: string
    updated_at: string
  }
  Insert: {
    room_id: string
    user_id: string
    title: string
    purpose?: string
    start_time: string
    end_time: string
    status?: 'confirmed' | 'cancelled'
    cancellation_reason?: string
  }
  Update: {
    room_id?: string
    user_id?: string
    title?: string
    purpose?: string
    start_time?: string
    end_time?: string
    status?: 'confirmed' | 'cancelled'
    cancellation_reason?: string
  }
}
```

---

## 5. 실시간 구독 구현을 위한 핵심 분석

### 5-1. 현재 데이터 흐름
```
1. 사용자 액션 (예약 생성/수정/취소)
   ↓
2. Mutation 실행 (useCreateReservation, useUpdateReservation, useCancelReservation)
   ↓
3. 데이터베이스 변경 (INSERT/UPDATE/DELETE)
   ↓
4. onSuccess 콜백에서 캐시 무효화 (queryClient.invalidateQueries)
   ↓
5. 관련 쿼리 재실행 (usePublicReservations)
   ↓
6. UI 업데이트
```

### 5-2. 실시간 구독 도입 후 데이터 흐름
```
1. 사용자 액션 (예약 생성/수정/취소)
   ↓
2. Mutation 실행
   ↓
3. 데이터베이스 변경 (INSERT/UPDATE/DELETE)
   ↓
4. Supabase Realtime 이벤트 발생 (postgres_changes)
   ↓
5. 실시간 구독 리스너에서 이벤트 수신
   ↓
6. React Query 캐시 수동 업데이트 (queryClient.setQueryData)
   ↓
7. 즉시 UI 업데이트 (모든 사용자에게 동시 반영)
```

### 5-3. 구현해야 할 핵심 요소들

#### A. Realtime 구독 설정
- **테이블**: `reservations`
- **이벤트**: `INSERT`, `UPDATE`, `DELETE`
- **필터**: 날짜 범위 기반 (`start_time`, `end_time`)

#### B. 캐시 업데이트 로직
- **INSERT**: 새 예약을 기존 배열에 추가
- **UPDATE**: 기존 예약 데이터 수정
- **DELETE**: 기존 예약을 배열에서 제거

#### C. 타입 변환 로직
- **Database Row** → **PublicReservation** 변환
- **시간대 처리**: UTC ↔ KST 변환
- **권한 처리**: `is_mine` 필드 계산

---

## 6. 구현 시 고려사항

### 6-1. 성능 최적화
- **구독 범위 제한**: 현재 보고 있는 주간 데이터만 구독
- **메모리 관리**: 컴포넌트 언마운트 시 구독 해제
- **중복 방지**: Mutation과 Realtime 이벤트 중복 처리 방지

### 6-2. 에러 처리
- **연결 실패**: Realtime 연결 실패 시 폴백 로직
- **권한 오류**: 인증되지 않은 사용자 처리
- **데이터 불일치**: 캐시와 실제 데이터 간 불일치 해결

### 6-3. 사용자 경험
- **로딩 상태**: 실시간 업데이트 중 로딩 표시
- **충돌 해결**: 동시 편집 시 충돌 처리
- **알림**: 다른 사용자의 변경사항 알림

---

## 7. 권장 구현 전략

### 7-1. 단계별 구현 계획
1. **1단계**: `usePublicReservations` 훅에 Realtime 구독 추가
2. **2단계**: 캐시 수동 업데이트 로직 구현
3. **3단계**: 타입 변환 및 데이터 정규화 로직 추가
4. **4단계**: 에러 처리 및 폴백 로직 구현
5. **5단계**: 성능 최적화 및 테스트

### 7-2. 핵심 구현 포인트
- **구독 생명주기**: `useEffect`를 사용한 구독 설정/해제
- **캐시 업데이트**: `queryClient.setQueryData`를 사용한 수동 업데이트
- **이벤트 필터링**: 현재 날짜 범위에 해당하는 이벤트만 처리
- **타입 안전성**: TypeScript를 활용한 타입 안전한 구현

이 분석을 바탕으로 실시간 예약 동기화 기능의 구체적인 구현 코드를 제시할 수 있습니다.