# 예약 생성 후 데이터 동기화(캐시 무효화) 현황 보고서

## 개요
새로운 예약 생성 후 전체 예약 현황 페이지(`GoogleCalendarView`)에서만 데이터 반영이 지연되는 문제를 해결하기 위해, `react-query`의 캐시 무효화 로직을 분석했습니다.

---

## 1. 예약 생성 로직 (Mutation)

### 1-1. `useCreateReservation` 훅 (주요 파일)
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
      // ✅ [핵심 수정] "reservations"라는 최상위 키를 사용하여,
      // 관련된 모든 쿼리를 정밀하게 타겟팅하여 무효화한다.
      // 이 한 줄은 react-query에게 "['reservations']로 시작하는 키를 가진
      // 모든 활성 쿼리를 즉시 다시 가져오라"고 지시하는, 가장 강력하고 명확한 명령이다.
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
    onError: (error: Error) => {
      logger.error('예약 생성 실패', error);
      toast.error('예약 실패', { description: error.message });
    },
  });
}
```

### 1-2. 중복된 `useCreateReservation` 훅 (보조 파일)
**파일 경로:** `src/hooks/useCreateReservation.ts` (라인 11-42)

```typescript
export function useCreateReservation() {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient();

  return useMutation({
    mutationFn: async (data: ReservationInsert) => {
      if (!supabase) {
        logger.error('Supabase 클라이언트를 사용할 수 없습니다');
        throw new Error('Supabase 클라이언트를 사용할 수 없습니다. 페이지를 새로고침해주세요.');
      }
      
      const result = await reservationService.createReservation(supabase, data); 
      return result;
    },
    onSuccess: () => {
      toast.success('예약 완료', {
        description: '회의실 예약이 성공적으로 완료되었습니다.',
      });
      // ⚠️ [문제점] 여기서는 reservationKeys.all을 사용
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
    },
    onError: (error: Error) => {
      logger.error('예약 생성 실패', error);
      toast.error('예약 실패', { description: error.message });
    },
  });
}
```

**🚨 중요한 발견:** 동일한 이름의 훅이 2개 파일에 존재하며, 캐시 무효화 방식이 다릅니다!

---

## 2. 데이터 조회 로직 (Query)

### 2-1. (문제가 발생하는) 전체 예약 현황 조회 훅
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

**실제 사용 방식 (예약 현황 페이지):**
**파일 경로:** `src/app/reservations/status/page.tsx` (라인 60-64)

```typescript
const { data: reservations, isLoading, isError } = usePublicReservations(
  startDateStr,
  endDateStr,
  isAuthenticated()
);
```

### 2-2. (정상 동작하는) '내 예약' 조회 훅
**파일 경로:** `src/hooks/useReservations.ts` (라인 82-118)

```typescript
// 내 예약을 가져오는 훅
export function useMyReservations(): { data: ReservationWithDetails[] | undefined; isLoading: boolean; isError: boolean; error: any } {
  const { userProfile } = useAuthContext();
  const supabase = useSupabaseClient();

  const queryOptions = buildQueryOptions({
    queryKey: reservationKeys.my(userProfile?.dbId), // authId 대신 dbId 사용
    queryFn: createStandardFetch(
      () => {
        if (!userProfile?.dbId || !supabase) {
          logger.warn('사용자 DB ID 또는 Supabase 클라이언트가 없어 내 예약을 조회할 수 없습니다');
          return Promise.resolve([]);
        }

        return reservationService.getMyReservationsOptimized(supabase, userProfile.dbId);
      },
      { operation: 'fetch my reservations (optimized)', params: { userProfileId: userProfile?.dbId } }
    ),
    enabled: !!userProfile?.dbId && !!supabase,
    dataType: 'semi-static',
    cacheConfig: {
      customStaleTime: 0, // 데이터는 받자마자 '낡은 것'으로 간주
      customGcTime: 5 * 60 * 1000,
    }
  });

  return useQuery({
    ...queryOptions,
    refetchOnMount: 'always',      // 컴포넌트가 마운트될 때마다 항상 데이터를 다시 가져옵니다.
    refetchOnWindowFocus: true,    // 사용자가 다른 탭을 봤다가 돌아오면 데이터를 다시 가져옵니다.
    refetchOnReconnect: true,      // 인터넷 연결이 끊겼다가 다시 연결되면 데이터를 다시 가져옵니다.
  });
}
```

---

## 3. 쿼리 키(Query Key) 관리 구조

### 3-1. 쿼리 키 팩토리 정의
**파일 경로:** `src/hooks/useReservations.ts` (라인 18-35)

```typescript
// 쿼리 키를 생성하는 팩토리 함수
const reservationKeyFactory = createQueryKeyFactory<{
  startDate?: string;
  endDate?: string;
  isAuthenticated?: boolean;
  userId?: string;
}>('reservations');

// ✅ [수정] 애플리케이션 전체에서 사용할 쿼리 키 정의
export const reservationKeys = {
  ...reservationKeyFactory, // 👈 [핵심] .all, .detail() 등을 포함한 기본 키들을 여기에 펼칩니다.
  
  // 커스텀 키 정의
  public: (startDate: string, endDate: string, isAuthenticated?: boolean) =>
    reservationKeyFactory.custom('public', startDate, endDate, 'auth', isAuthenticated),
  
  my: (userId?: string) => reservationKeyFactory.custom('my', userId),

  withDetails: (startDate: string, endDate: string) =>
    reservationKeyFactory.custom('withDetails', startDate, endDate),

  statistics: (startDate: string, endDate: string) =>
    reservationKeyFactory.custom('statistics', startDate, endDate),
};
```

### 3-2. 쿼리 키 팩토리 구조 (유틸리티)
**파일 경로:** `src/lib/utils/query-optimization.ts` (라인 108-119)

```typescript
// Query key factory generator
export const createQueryKeyFactory = <T extends Record<string, any>>(
  baseKey: string
) => {
  return {
    all: [baseKey] as const,
    lists: () => [baseKey, 'list'] as const,
    list: (filters: T) => [baseKey, 'list', filters] as const,
    details: () => [baseKey, 'detail'] as const,
    detail: (id: string) => [baseKey, 'detail', id] as const,
    custom: (type: string, ...params: any[]) => [baseKey, type, ...params] as const
  };
};
```

---

## 4. 문제점 분석

### 🚨 **핵심 문제점들:**

#### 4-1. 중복된 `useCreateReservation` 훅
- **파일 1**: `src/hooks/useReservations.ts` → `queryClient.invalidateQueries({ queryKey: ['reservations'] })`
- **파일 2**: `src/hooks/useCreateReservation.ts` → `queryClient.invalidateQueries({ queryKey: reservationKeys.all })`

**실제 `reservationKeys.all` 값:**
```typescript
reservationKeys.all = ['reservations']  // createQueryKeyFactory에서 생성
```

#### 4-2. 쿼리 키 불일치 문제
**전체 예약 현황 페이지의 실제 쿼리 키:**
```typescript
// usePublicReservations에서 생성되는 실제 키
reservationKeys.public(startDate, endDate, isAuthenticated)
// 실제 값: ['reservations', 'public', '2025-01-06', '2025-01-12', 'auth', true]
```

**캐시 무효화에서 사용하는 키:**
```typescript
['reservations']  // 최상위 키만 지정
```

#### 4-3. 캐시 설정 차이
**전체 예약 현황 (문제 발생):**
- `dataType: 'dynamic'`
- `customStaleTime: dateOptimization.staleTime` (2-15분)
- `customGcTime: dateOptimization.gcTime` (10-30분)

**내 예약 (정상 동작):**
- `dataType: 'semi-static'`
- `customStaleTime: 0` (즉시 stale 처리)
- `refetchOnMount: 'always'`

---

## 5. 근본 원인 진단

### 🎯 **주요 원인:**

1. **중복 훅 존재**: 어떤 컴포넌트가 어떤 훅을 사용하는지 불명확
2. **캐시 무효화 범위**: `['reservations']`로 무효화하면 모든 하위 쿼리가 무효화되어야 하지만, 실제로는 캐시 설정에 따라 즉시 refetch되지 않을 수 있음
3. **Stale Time 차이**: 전체 예약 현황은 2-15분의 stale time을 가져 무효화되어도 즉시 refetch되지 않음
4. **Refetch 정책 차이**: 내 예약은 `refetchOnMount: 'always'`이지만, 전체 예약 현황은 기본 설정 사용

### 🔧 **해결 방향:**

1. **중복 훅 제거**: 하나의 `useCreateReservation` 훅만 유지
2. **강제 Refetch**: 캐시 무효화 후 즉시 refetch 실행
3. **캐시 설정 통일**: 예약 관련 데이터의 stale time을 0으로 설정
4. **명시적 쿼리 키 무효화**: 특정 쿼리 키 패턴을 명시적으로 무효화

---

## 6. 권장 해결책

### 6-1. 즉시 적용 가능한 해결책
```typescript
// useCreateReservation의 onSuccess에서
onSuccess: () => {
  toast.success('예약 완료', { description: '예약이 성공적으로 완료되었습니다.' });
  
  // 1. 모든 예약 관련 쿼리 무효화
  queryClient.invalidateQueries({ queryKey: ['reservations'] });
  
  // 2. 전체 예약 현황 쿼리 강제 refetch
  queryClient.refetchQueries({ 
    queryKey: ['reservations', 'public'],
    type: 'active' 
  });
}
```

### 6-2. 근본적 해결책
1. **중복 훅 제거**: `src/hooks/useCreateReservation.ts` 파일 삭제
2. **캐시 설정 개선**: 예약 데이터의 stale time을 0으로 설정
3. **무효화 전략 개선**: 더 정밀한 쿼리 키 패턴 매칭 사용

이 분석을 바탕으로 구체적인 코드 수정안을 제시해드릴 수 있습니다.