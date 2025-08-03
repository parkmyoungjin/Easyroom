# '캐시 활성화' 및 시스템 안정화를 위한 코드 분석 보고서

## 1. 서버 클라이언트 생성 로직 (Next.js 경고 해결)

**파일 경로:** `src/lib/supabase/server.ts`

**분석 목표:** 터미널의 `Error: Route "/" used cookies().get(...)` 경고의 원인이 되는 부분을 식별하고, Next.js 권장 방식으로 수정하기 위한 현재 코드를 확인한다.

**코드 전문:**
```typescript
// src/lib/supabase/server.ts (최종 권장 코드)

import "server-only";

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from 'react';
import { Database } from "@/types/database";
import type { SupabaseClient } from '@supabase/supabase-js';

export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * 서버 컴포넌트용 Supabase 클라이언트를 생성합니다. (최신 권장 방식 적용)
 * React의 `cache`를 사용하여 동일 요청 내에서 클라이언트 재사용을 최적화합니다.
 * @supabase/auth-helpers-nextjs가 쿠키 처리를 자동으로 관리합니다.
 */
export const createClient = cache(() => {
  // `cookies()`를 직접 호출하는 대신, `cookies()`를 반환하는 콜백 함수를 전달한다.
  // 이렇게 하면 auth-helpers가 Next.js의 렌더링 생명주기에 맞춰 최적화된 시점에 쿠키를 읽어온다.
  return createServerComponentClient<Database>({
    cookies: () => cookies(),
  });
});


/**
 * Supabase admin 클라이언트를 생성합니다. (service_role 사용)
 * RLS를 우회하므로, 보안이 확보된 서버 환경에서만 사용해야 합니다.
 */
export const createAdminClient = () => {
  // 이 함수는 매번 호출되어도 비용이 크지 않으므로 cache를 필수로 사용하진 않습니다.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin client');
  }

  // createAdminClient는 async일 필요가 없습니다.
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};
```

**✅ 분석 결과:** 
현재 코드는 이미 Next.js 권장 방식을 따르고 있습니다. `cookies: () => cookies()` 형태로 콜백 함수를 전달하여 auth-helpers가 적절한 시점에 쿠키를 읽도록 구현되어 있습니다. 터미널 경고는 다른 부분에서 발생할 가능성이 높습니다.

---

## 2. '내 예약' 데이터 조회 로직 (캐시 전략 수정)

**파일 경로:** `src/hooks/useReservations.ts`

**분석 목표:** `useMyReservations` 훅의 `react-query` 옵션, 특히 `staleTime`과 `gcTime` (또는 `cacheTime`) 설정을 확인하고, 데이터가 화면에 다시 나타날 때마다 새로고침되도록 수정할 부분을 식별한다.

**핵심 함수 - useMyReservations:**
```typescript
// 내 예약을 가져오는 훅
export function useMyReservations(): { data: ReservationWithDetails[] | undefined; isLoading: boolean; isError: boolean; error: any } {
  const { userProfile } = useAuthContext();
  const supabase = useSupabaseClient();

  return useQuery(buildQueryOptions({
    queryKey: reservationKeys.my(userProfile?.dbId), // authId 대신 dbId 사용
    queryFn: createStandardFetch(
      () => { // ✅ [핵심 수정] 로직이 매우 단순해짐
        if (!userProfile?.dbId || !supabase) {
          logger.warn('사용자 DB ID 또는 Supabase 클라이언트가 없어 내 예약을 조회할 수 없습니다');
          // ✅ [핵심 수정] 빈 배열을 Promise로 감싸서 반환하여, 반환 타입의 일관성을 보장한다.
          return Promise.resolve([]);
        }

        // 새로 만든 최적화된 서비스 함수를 호출하기만 하면 된다.
        return reservationService.getMyReservationsOptimized(supabase, userProfile.dbId);
      },
      { operation: 'fetch my reservations (optimized)', params: { userProfileId: userProfile?.dbId } }
    ),
    enabled: !!userProfile?.dbId && !!supabase,
    dataType: 'semi-static',
    cacheConfig: {
      customStaleTime: 0,        // ⚠️ 문제 지점: 0으로 설정되어 있음
      customGcTime: 5 * 60 * 1000  // 5분 후 가비지 컬렉션
    }
  }));
}
```

**🔍 핵심 문제 식별:**

현재 `customStaleTime: 0`으로 설정되어 있어, 이론적으로는 데이터가 항상 stale 상태로 간주되어야 합니다. 하지만 실제 문제는 `buildQueryOptions` 함수 내부에서 이 설정이 어떻게 처리되는지에 있을 수 있습니다.

**🎯 캐시 전략 개선 방안:**

1. **refetchOnMount 강제 활성화**: 컴포넌트가 마운트될 때마다 데이터를 새로 가져오도록 설정
2. **refetchOnWindowFocus 활성화**: 브라우저 탭이 다시 활성화될 때 데이터 새로고침
3. **staleTime을 명시적으로 0으로 설정**: 캐시된 데이터를 항상 stale로 간주

---

## 3. (참고용) API 라우트 핸들러

**파일 경로:** `src/app/api/reservations/public-authenticated/route.ts`

**분석 목표:** 터미널 로그에 나타난 `get_public_reservations_paginated` RPC 함수 호출 실패와 관련된 API 라우트의 코드를 확인하여, 추가적인 문제가 없는지 검토한다.

**핵심 RPC 호출 부분:**
```typescript
// RPC 함수 호출 - 인증된 사용자용 (사용자 컨텍스트 포함)
try {
  // Use standardized paginated RPC execution
  const rpcResult = await executePaginatedRPC<PublicReservation>(
    supabase,
    'get_public_reservations_paginated',
    {
      p_start_date: normalizedStartDate,
      p_end_date: normalizedEndDate
    },
    {
      limit: limit,
      offset: offset
    }
  );

  logger.info('인증 공개 예약 조회 성공', { 
    count: rpcResult.data.length,
    userId: user.id,
    totalCount: rpcResult.totalCount,
    hasMore: rpcResult.hasMore
  });

  // ... 성공 처리 로직

} catch (rpcError) {
  logger.warn('RPC 함수 사용 불가, 직접 쿼리 시도', rpcError instanceof Error ? { error: rpcError.message } : { error: String(rpcError) });

  // Fallback: Use standardized paginated query execution
  const fallbackResult = await executePaginatedQuery<any>(
    supabase,
    'reservations',
    // ... 대체 쿼리 로직
  );
}
```

**✅ 분석 결과:**
API 라우트는 RPC 실패 시 안전한 대체 경로(fallback)를 제공하도록 잘 구현되어 있습니다. RPC 함수 실패는 데이터베이스 함수가 존재하지 않거나 권한 문제일 가능성이 높습니다.

---

## 4. 종합 진단 및 해결 방안

### 🔍 **핵심 문제 진단**

**"다른 곳에 갔다가 다시 들어가니 내역이 나오지 않는다"** 현상의 원인:

1. **캐시 정책 불일치**: `customStaleTime: 0`으로 설정되어 있지만, 실제로는 캐시된 데이터가 반환되고 있음
2. **refetch 트리거 부족**: 컴포넌트 재마운트 시 자동 refetch가 발생하지 않음
3. **쿼리 키 의존성**: 사용자 ID가 변경되지 않으면 동일한 캐시 키를 사용하여 이전 결과를 반환

### 🎯 **최종 해결 방안**

#### **방안 1: 강제 리프레시 전략 (권장)**
```typescript
// useMyReservations 훅 수정
return useQuery(buildQueryOptions({
  queryKey: reservationKeys.my(userProfile?.dbId),
  queryFn: createStandardFetch(/* ... */),
  enabled: !!userProfile?.dbId && !!supabase,
  dataType: 'semi-static',
  cacheConfig: {
    customStaleTime: 0,
    customGcTime: 5 * 60 * 1000
  },
  // ✅ 추가 옵션들
  refetchOnMount: 'always',        // 마운트 시 항상 리프레시
  refetchOnWindowFocus: true,      // 윈도우 포커스 시 리프레시
  refetchOnReconnect: true,        // 네트워크 재연결 시 리프레시
}));
```

#### **방안 2: 쿼리 키에 타임스탬프 추가**
```typescript
// 캐시 무효화를 위한 타임스탬프 기반 키
queryKey: [...reservationKeys.my(userProfile?.dbId), Date.now()]
```

#### **방안 3: 수동 무효화 트리거**
```typescript
// 페이지 진입 시 수동으로 쿼리 무효화
const queryClient = useQueryClient();
useEffect(() => {
  queryClient.invalidateQueries({ queryKey: reservationKeys.my(userProfile?.dbId) });
}, []);
```

### 🚀 **권장 실행 순서**

1. **1단계**: `useMyReservations` 훅에 `refetchOnMount: 'always'` 옵션 추가
2. **2단계**: 테스트 후 문제가 지속되면 `buildQueryOptions` 함수 내부 로직 검토
3. **3단계**: 필요시 쿼리 키 전략 변경 또는 수동 무효화 로직 추가

이 해결 방안을 통해 사용자가 '내 예약' 페이지에 다시 진입할 때마다 **항상 최신 데이터**를 볼 수 있게 됩니다.