# PWA 세션 복구 시 데이터 조회 실패 현상 분석 보고서

## 개요
모바일 PWA 환경에서 앱을 재실행했을 때, 로그인은 유지되지만 데이터(회의실 목록, 내 예약 등)를 불러오지 못하는 문제를 분석합니다. 이는 Supabase 인증 세션과 데이터베이스의 RLS(Row Level Security) 정책 간의 동기화 문제로 추정됩니다.

---

## 1. 인증 상태 관리의 시작점: `AuthProvider`

### 1-1. `AuthProvider.tsx` 전체 코드 분석

**파일 경로:** `src/contexts/AuthContext.tsx`

```typescript
'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { SupabaseClient, User, Session } from '@supabase/supabase-js';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
import { UserProfile } from '@/types/auth';
import { ProfileRpcResult, convertRpcResultToUserProfile } from '@/lib/auth/profile-utils';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  authStatus: AuthStatus;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
  children: React.ReactNode;
  initialSession?: Session | null;
  initialProfile?: UserProfile | null;
}

async function getOrCreateProfile(supabase: SupabaseClient): Promise<UserProfile> {
  const { data, error } = await supabase.rpc('get_or_create_user_profile').single();
  const typedData = data as ProfileRpcResult | null;

  if (error) {
    console.error("CRITICAL: get_or_create_user_profile RPC failed.", error);
    throw error;
  }

  if (!typedData) {
    throw new Error("CRITICAL: get_or_create_user_profile RPC returned no data despite success status.");
  }

  return convertRpcResultToUserProfile(typedData);
}

export const AuthProvider = ({ 
  children, 
  initialSession = null, 
  initialProfile = null 
}: AuthProviderProps) => {
  const supabase = useSupabaseClient();
  
  // ✅ [핵심] 서버에서 받은 초기 데이터로 상태 초기화
  const [user, setUser] = useState<User | null>(initialSession?.user ?? null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(initialProfile ?? null);
  
  // ✅ [핵심] authStatus 초기값도 props에 따라 결정
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() => {
    if (initialSession && initialProfile) {
      console.log('[AuthProvider] Initialized with server data: authenticated');
      return 'authenticated';
    }
    console.log('[AuthProvider] No initial data: loading');
    return 'loading'; // 초기 데이터가 없으면 클라이언트에서 확인해야 하므로 'loading'
  });

  const isProcessing = useRef(false);

  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;
    console.log('[AuthProvider] Lifecycle: useEffect mounted. Subscribing. isMounted=true');

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) {
        console.log(`[AuthProvider] Handler Entry: Unmounted. Ignoring event '${event}'.`);
        return;
      }

      if (isProcessing.current) {
        console.log(`[AuthProvider] Lock Engaged: Ignoring concurrent event '${event}'.`);
        return;
      }

      isProcessing.current = true;
      console.log(`[AuthProvider] Lock Engaged for event '${event}'.`);

      try {
        if (session?.user) {
          const profile = await getOrCreateProfile(supabase);

          if (!isMounted) {
            console.log(`[AuthProvider] Post-Await Check: Unmounted during profile fetch for '${event}'. Halting state update.`);
            return;
          }

          setUser(session.user);
          setUserProfile(profile);
          setAuthStatus('authenticated');
          console.log(`[AuthProvider] Processed '${event}': State set to 'authenticated'.`);
        } else {
          if (!isMounted) {
            console.log(`[AuthProvider] Post-Await Check: Unmounted during logout for '${event}'. Halting state update.`);
            return;
          }

          setUser(null);
          setUserProfile(null);
          setAuthStatus('unauthenticated');
          console.log(`[AuthProvider] Processed '${event}': State set to 'unauthenticated'.`);
        }
      } catch (error) {
        console.error(`[AuthProvider] Exception caught during event '${event}'. Transitioning to unauthenticated.`, error);
        if (isMounted) {
          setUser(null);
          setUserProfile(null);
          setAuthStatus('unauthenticated');
        }
      } finally {
        isProcessing.current = false;
        console.log(`[AuthProvider] Lock Released for event '${event}'.`);
      }
    });

    return () => {
      console.log('[AuthProvider] Lifecycle: useEffect unmounted. Unsubscribing. Setting isMounted=false');
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const value = { user, userProfile, authStatus };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
```

### 🚨 **핵심 문제점 분석**

1. **초기 상태 설정의 모호성**: 
   - `initialSession`과 `initialProfile`이 없으면 `authStatus`가 `'loading'`으로 시작
   - PWA 재실행 시 서버 렌더링이 없으므로 항상 `'loading'` 상태로 시작

2. **비동기 프로필 생성의 지연**:
   - `getOrCreateProfile` RPC 호출이 완료되기 전까지 `authStatus`가 `'loading'` 상태 유지
   - 이 시간 동안 데이터 조회 훅들이 `enabled: false` 상태가 될 수 있음

3. **세션 복구와 프로필 동기화 타이밍 이슈**:
   - `onAuthStateChange` 이벤트가 발생해도 프로필 생성이 완료되기 전까지는 인증 상태가 불완전

---

## 2. 데이터 조회 로직 (문제가 발생하는 Query)

### 2-1. `useRooms` 훅 전체 코드

**파일 경로:** `src/hooks/useRooms.ts`

```typescript
export function useRooms() {
  const supabase = useSupabaseClient();
  
  return useQuery(buildQueryOptions({
    queryKey: roomKeys.active(),
    queryFn: createStandardFetch(
      () => {
        if (!supabase) throw new Error('Supabase client not available');
        return roomService.getActiveRooms(supabase);
      },
      {
        operation: 'fetch active rooms',
        params: {}
      }
    ),
    enabled: !!supabase, // ✅ [문제점] 인증 상태와 무관하게 supabase 클라이언트만 확인
    dataType: 'static'
  }));
}
```

### 🚨 **핵심 문제점**
- **인증 상태 무시**: `enabled` 조건이 `!!supabase`만 확인하고 인증 상태(`authStatus`)를 고려하지 않음
- **RLS 정책과의 불일치**: 인증이 완전히 완료되기 전에 API 호출이 시작될 수 있음

### 2-2. `useMyReservations` 훅 전체 코드

**파일 경로:** `src/hooks/useReservations.ts`

```typescript
export function useMyReservations(): { data: ReservationWithDetails[] | undefined; isLoading: boolean; isError: boolean; error: any } {
  const { userProfile } = useAuthContext();
  const supabase = useSupabaseClient();

  const queryOptions = buildQueryOptions({
    queryKey: reservationKeys.my(userProfile?.dbId),
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
    enabled: !!userProfile?.dbId && !!supabase, // ✅ [문제점] authStatus 확인 없음
    dataType: 'semi-static',
    cacheConfig: {
      customStaleTime: 0,
      customGcTime: 5 * 60 * 1000,
    }
  });

  return useQuery({
    ...queryOptions,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}
```

### 🚨 **핵심 문제점**
- **부분적 인증 상태 확인**: `userProfile?.dbId`만 확인하고 `authStatus`는 무시
- **타이밍 이슈**: `userProfile`이 있어도 인증 토큰이 완전히 복구되지 않은 상태일 수 있음

---

## 3. Supabase API 호출의 최종 관문: 서비스 계층

### 3-1. `roomService.getActiveRooms` 함수

**파일 경로:** `src/lib/services/rooms.ts`

```typescript
async getActiveRooms(supabase: TypedSupabaseClient): Promise<Room[]> {
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) {
    throw error;
  }

  return data;
}
```

### 3-2. `reservationService.getMyReservationsOptimized` 함수

**파일 경로:** `src/lib/services/reservations.ts`

```typescript
async getMyReservationsOptimized(supabase: SupabaseClient<Database>, userId: string): Promise<ReservationWithDetails[]> {
  if (!userId) {
    logger.warn('사용자 ID가 없어 최적화된 예약 조회를 할 수 없습니다');
    return [];
  }

  // 1. RPC 함수 (빠른 길) 시도
  try {
    const { data, error } = await supabase.rpc('get_user_reservations_detailed', {
      p_user_id: userId,
      p_limit_count: 50,
      p_offset_count: 0
    });

    if (error) throw new Error(`RPC failed: ${error.message}`);

    logger.info('Successfully fetched reservations via RPC.');
    return (data as any)?.data || [];
  } catch (rpcError) {
    logger.warn('RPC function get_user_reservations_detailed failed, falling back to standard query.', { 
      error: rpcError instanceof Error ? rpcError.message : String(rpcError) 
    });
    
    // 2. 대체 경로: 기존 getMyReservations 함수 호출
    return this.getMyReservations(supabase, userId);
  }
}

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
```

---

## 4. 데이터베이스 보안 정책 (RLS) - 문제의 핵심

### 4-1. `rooms` 테이블 RLS 정책

```sql
-- 활성화된 회의실은 모든 사용자가 조회 가능
CREATE POLICY "rooms_select_active" ON "public"."rooms" 
FOR SELECT USING (("is_active" = true));

-- 관리자는 모든 회의실에 대한 전체 권한
CREATE POLICY "rooms_admin_full_access" ON "public"."rooms" 
USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"public"."user_role")))));
```

### 🚨 **핵심 문제점**
- **`rooms_select_active` 정책**: `is_active = true` 조건만 확인하므로 인증 상태와 무관
- **하지만**: `rooms_admin_full_access` 정책에서 `auth.uid()` 함수 사용
- **타이밍 이슈**: PWA 재실행 시 `auth.uid()`가 `null`을 반환할 수 있는 시점에 쿼리 실행

### 4-2. `reservations` 테이블 RLS 정책

```sql
-- 공개 예약 또는 본인 예약만 조회 가능
CREATE POLICY "reservations_select_public_or_own" ON "public"."reservations" 
FOR SELECT USING ((("status" = 'confirmed'::"public"."reservation_status") 
OR ("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())))));

-- 본인 예약만 수정 가능
CREATE POLICY "reservations_update_own" ON "public"."reservations" 
FOR UPDATE USING (("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));

-- 본인 예약만 삭제 가능
CREATE POLICY "reservations_delete_own" ON "public"."reservations" 
FOR DELETE USING (("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));

-- 본인 예약만 생성 가능
CREATE POLICY "reservations_insert_own" ON "public"."reservations" 
FOR INSERT WITH CHECK ((("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))) 
AND ("status" = 'confirmed'::"public"."reservation_status")));
```

### 🚨 **핵심 문제점**
- **모든 정책이 `auth.uid()` 의존**: 인증 토큰이 완전히 복구되지 않으면 `auth.uid()`가 `null` 반환
- **서브쿼리 복잡성**: `users` 테이블과의 조인이 필요한 복잡한 정책 구조
- **타이밍 크리티컬**: PWA 재실행 시 세션 복구 완료 전에 쿼리가 실행되면 권한 없음 오류 발생

---

## 5. 문제 시나리오 분석

### PWA 재실행 시 데이터 로딩 실패 시나리오

```
1. 사용자가 PWA 앱을 재실행
   ↓
2. AuthProvider 초기화: authStatus = 'loading'
   ↓
3. useRooms, useMyReservations 훅 실행
   - enabled: !!supabase (true) → 쿼리 즉시 실행
   ↓
4. Supabase 클라이언트의 세션 복구 진행 중
   - auth.uid() = null (아직 복구 안됨)
   ↓
5. RLS 정책 평가
   - rooms: is_active = true (통과 가능)
   - reservations: auth.uid() = null → 권한 없음
   ↓
6. 쿼리 실패 또는 빈 결과 반환
   ↓
7. onAuthStateChange 이벤트 발생 (늦음)
   - authStatus = 'authenticated'로 변경
   - 하지만 이미 실패한 쿼리는 재실행되지 않음
```

---

## 6. 근본적인 해결책 제시

### 6-1. 인증 상태 기반 쿼리 활성화

**문제**: 현재 훅들이 `authStatus`를 확인하지 않고 쿼리를 실행

**해결책**: 모든 데이터 조회 훅의 `enabled` 조건에 `authStatus === 'authenticated'` 추가

```typescript
// 수정 전
enabled: !!supabase

// 수정 후  
enabled: !!supabase && authStatus === 'authenticated'
```

### 6-2. AuthProvider 상태 전파 개선

**문제**: `authStatus`가 `'loading'`에서 `'authenticated'`로 변경되는 타이밍이 불명확

**해결책**: 
1. 세션 복구 완료를 명확히 감지하는 로직 추가
2. 초기 세션 확인 로직 강화

```typescript
useEffect(() => {
  if (!supabase) return;

  // 초기 세션 확인 추가
  const checkInitialSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      // 세션이 이미 있으면 즉시 프로필 로드
      const profile = await getOrCreateProfile(supabase);
      setUser(session.user);
      setUserProfile(profile);
      setAuthStatus('authenticated');
    } else {
      setAuthStatus('unauthenticated');
    }
  };

  checkInitialSession();

  // 기존 onAuthStateChange 로직...
}, [supabase]);
```

### 6-3. 쿼리 재시도 메커니즘 강화

**문제**: 인증 상태 변경 후 실패한 쿼리가 자동으로 재실행되지 않음

**해결책**: React Query의 `invalidateQueries`를 활용한 강제 재실행

```typescript
// AuthProvider에서 인증 상태 변경 시
useEffect(() => {
  if (authStatus === 'authenticated') {
    // 모든 쿼리 무효화하여 재실행 유도
    queryClient.invalidateQueries();
  }
}, [authStatus, queryClient]);
```

### 6-4. RLS 정책 최적화 (선택사항)

**문제**: 복잡한 서브쿼리로 인한 성능 저하 및 타이밍 이슈

**해결책**: 더 단순한 정책 구조로 변경 검토

```sql
-- 현재: 복잡한 서브쿼리
CREATE POLICY "reservations_select_public_or_own" ON "public"."reservations" 
FOR SELECT USING ((("status" = 'confirmed') 
OR ("user_id" IN ( SELECT "users"."id" FROM "public"."users" WHERE ("users"."auth_id" = "auth"."uid"())))));

-- 개선안: 더 직접적인 접근 (RPC 함수 활용)
-- 또는 클라이언트 측에서 필터링 로직 강화
```

---

## 7. 구현 우선순위

### 🔥 **긴급 (High Priority)**
1. **모든 데이터 조회 훅에 `authStatus` 확인 추가**
2. **AuthProvider 초기 세션 확인 로직 강화**

### ⚡ **중요 (Medium Priority)**  
3. **인증 상태 변경 시 쿼리 무효화 메커니즘 추가**
4. **에러 핸들링 및 재시도 로직 개선**

### 📋 **검토 (Low Priority)**
5. **RLS 정책 구조 최적화 검토**
6. **성능 모니터링 및 로깅 강화**

---

## 8. 결론

PWA 세션 복구 시 데이터 조회 실패 문제의 근본 원인은 **"인증 세션 복구와 데이터 조회 타이밍의 불일치"**입니다. 

핵심 해결책은:
1. **인증 상태 완료 후 데이터 조회 시작**
2. **초기 세션 확인 로직 강화**  
3. **상태 변경 시 자동 재시도 메커니즘**

이를 통해 PWA 환경에서도 안정적이고 일관된 사용자 경험을 제공할 수 있습니다.