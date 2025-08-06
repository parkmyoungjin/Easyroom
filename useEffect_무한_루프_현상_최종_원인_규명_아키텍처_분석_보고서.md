# `useEffect` 무한 루프 현상 최종 원인 규명을 위한 아키텍처 분석 보고서

**TO:** 대표님  
**RE:** `useReservationsRealtime` 훅의 `useEffect` 무한 실행 현상에 대한 근본 원인 규명을 위한 최종 아키텍처 분석 보고서  
**작성일:** 2025년 8월 6일  

---

## 🎯 목표

'전체 예약 현황' 페이지에서 발생하는 실시간 구독의 '초기화 -> 해지' 무한 반복 현상의 근본 원인을 찾기 위해, 해당 `useEffect`의 **의존성 배열(dependency array)에 포함된 모든 변수**들이 어떻게 생성되고 전달되는지, 그 **'전체 생명주기'**를 추적하고 분석합니다.

---

## 🔍 핵심 발견: 무한 루프의 진짜 범인을 찾았습니다!

### 🚨 **범인: `user` 객체의 불안정한 참조**

`useReservationsRealtime` 훅의 의존성 배열에서 **`user` 객체가 매 렌더링마다 새로운 참조로 재생성**되고 있어 무한 루프를 발생시키고 있습니다.

---

## 1. 무한 루프의 진원지: `useReservationsRealtime` 훅 분석

### 1-1. 의존성 배열 분석

```typescript
// src/hooks/useReservationsRealtime.ts (라인 174)
useEffect(() => {
  // ... 실시간 구독 로직
}, [queryClient, supabase, startDate, endDate, isAuthenticated, user]);
//                                                                ^^^^
//                                                          🚨 범인 발견!
```

**의존성 배열의 구성요소들:**
- ✅ `queryClient`: 안정적 (React Query 클라이언트)
- ✅ `supabase`: 안정적 (SupabaseProvider의 useMemo로 생성)
- ✅ `startDate`: 안정적 (문자열)
- ✅ `endDate`: 안정적 (문자열)
- ✅ `isAuthenticated`: 안정적 (boolean)
- 🚨 **`user`: 불안정적 (매 렌더링마다 새로운 객체 참조)**

### 1-2. `user` 객체의 출처

```typescript
// src/hooks/useReservationsRealtime.ts (라인 28)
const { user } = useAuth();
```

이 `user` 객체는 `AuthContext`에서 제공되는데, 여기서 문제가 발생합니다.

---

## 2. 범인의 생성지: `AuthContext` 분석

### 2-1. `AuthProvider`의 상태 관리

```typescript
// src/contexts/AuthContext.tsx (라인 50-52)
const [user, setUser] = useState<User | null>(initialSession?.user ?? null);
const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
const [isLoading, setIsLoading] = useState(true);
```

### 2-2. 🚨 **핵심 문제: `onAuthStateChange` 콜백에서의 불필요한 `setUser` 호출**

```typescript
// src/contexts/AuthContext.tsx (라인 85-95)
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  (_, session) => {
    if (isMounted) {
      if (session) {
        fetchProfile();
        setUser(session.user); // 🚨 문제: 매번 새로운 User 객체로 설정
      } else {
        setUser(null);
        setUserProfile(null);
      }
    }
  }
);
```

**문제 분석:**
1. **Supabase의 `onAuthStateChange`는 세션이 갱신될 때마다 호출됩니다**
2. **매번 `session.user`는 새로운 객체 참조를 가집니다** (내용은 같아도 `===` 비교에서 false)
3. **`setUser(session.user)`가 호출되면서 `user` 상태가 업데이트됩니다**
4. **`user` 상태 변경으로 인해 `useReservationsRealtime`의 `useEffect`가 재실행됩니다**
5. **실시간 구독이 해지되고 다시 초기화됩니다**
6. **1번으로 돌아가서 무한 반복**

---

## 3. 호출 지점 분석: `GoogleCalendarView` 컴포넌트

### 3-1. 훅 호출 부분

```typescript
// src/features/reservation/components/GoogleCalendarView.tsx (라인 160-162)
const startDateStr = format(weekStartDate, 'yyyy-MM-dd');
const endDateStr = format(addDays(weekStartDate, 5), 'yyyy-MM-dd');
useReservationsRealtime(startDateStr, endDateStr, isAuthenticated);
```

**분석 결과:**
- ✅ `startDateStr`, `endDateStr`: 안정적 (문자열)
- ✅ `isAuthenticated`: 안정적 (boolean)
- 컴포넌트 자체에서는 불안정한 참조를 생성하지 않음

---

## 🔧 해결 방안

### 방안 1: `user` 의존성 제거 (권장)

`useReservationsRealtime` 훅에서 `user` 객체를 의존성에서 제거하고, 필요한 경우에만 내부에서 참조:

```typescript
// 수정 전
useEffect(() => {
  // ...
}, [queryClient, supabase, startDate, endDate, isAuthenticated, user]);

// 수정 후
useEffect(() => {
  // user가 필요한 경우 내부에서 참조
  const currentUser = user; // 클로저로 캡처
  // ...
}, [queryClient, supabase, startDate, endDate, isAuthenticated]);
```

### 방안 2: `user.id`만 의존성으로 사용

사용자 식별이 필요한 경우 객체 전체가 아닌 ID만 사용:

```typescript
useEffect(() => {
  // ...
}, [queryClient, supabase, startDate, endDate, isAuthenticated, user?.id]);
```

### 방안 3: `AuthContext`에서 `useMemo`로 `user` 안정화

```typescript
// AuthContext.tsx에서
const stableUser = useMemo(() => user, [user?.id, user?.email]);
```

---

## 📊 무한 루프 발생 시나리오

```
1. 컴포넌트 렌더링
   ↓
2. useReservationsRealtime 훅 실행
   ↓
3. useEffect 실행 (실시간 구독 시작)
   ↓
4. Supabase onAuthStateChange 이벤트 발생
   ↓
5. setUser(session.user) 호출 (새로운 객체 참조)
   ↓
6. user 상태 변경으로 컴포넌트 리렌더링
   ↓
7. useEffect 의존성 배열에서 user 참조 변경 감지
   ↓
8. useEffect 재실행 (이전 구독 해지 + 새 구독 시작)
   ↓
9. 1번으로 돌아가서 무한 반복
```

---

## 🎯 최종 결론

### ✅ 근본 원인 확정
**`useReservationsRealtime` 훅의 의존성 배열에 포함된 `user` 객체가 Supabase의 `onAuthStateChange` 이벤트로 인해 매번 새로운 참조로 재생성되면서 무한 루프를 발생시키고 있습니다.**

### 🚀 권장 해결책
1. **즉시 적용**: `user` 의존성을 제거하거나 `user?.id`로 변경
2. **장기적 개선**: `AuthContext`에서 `user` 객체 안정화

### 📈 예상 효과
- ✅ 무한 루프 완전 해결
- ✅ 불필요한 실시간 구독 재연결 방지
- ✅ 성능 향상 및 네트워크 트래픽 감소
- ✅ 사용자 경험 개선

이 수정을 통해 실시간 구독이 안정적으로 유지되고, 불필요한 재연결 없이 효율적으로 작동할 것입니다.

---

**보고서 작성:** Kiro AI Assistant  
**분석 완료:** 2025년 8월 6일