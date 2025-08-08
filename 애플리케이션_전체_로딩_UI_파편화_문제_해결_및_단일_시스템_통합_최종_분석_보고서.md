# 애플리케이션 전체 로딩 UI 파편화 문제 해결 및 단일 시스템 통합 최종 분석 보고서

**TO:** 대표님  
**RE:** 애플리케이션 전체 로딩 UI의 파편화 문제 해결 및 단일 시스템으로의 통합을 위한 최종 분석 보고서  
**작성일:** 2025년 2월 8일  

---

## 📋 목표

현재 각 페이지마다 제각각으로 표시되는 로딩 UI를, **`AuthGatekeeper`가 모든 '초기' 로딩(인증 + 데이터)을 중앙에서 통제**하는 단일하고 일관된 시스템으로 통합합니다. 이를 통해 어떤 페이지에 접속하더라도 사용자에게 항상 동일한 'Loading...' 로딩 경험을 제공합니다.

---

## 🔍 1. '게릴라 부대' 식별: 각 페이지의 자체 로딩 로직

### 📊 **파편화 현황 분석**

각 페이지에서 발견된 독자적인 로딩 UI 렌더링 로직들:

#### **🚨 심각도 HIGH: 완전히 독립적인 로딩 시스템**

##### **1. `/reservations/status/page.tsx` - 다중 로딩 UI 시스템**
```tsx
// 🚨 문제 1: 독자적인 스켈레톤 로딩 컴포넌트
const CalendarSkeleton = () => (
  <div className="border rounded-lg p-4 bg-card">
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded mb-4"></div>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-200 rounded"></div>
        ))}
      </div>
    </div>
  </div>
);

// 🚨 문제 2: useQuery의 isLoading을 직접 사용한 조건부 렌더링
const { data: reservations, isLoading, isError } = usePublicReservations(/*...*/);

// 🚨 문제 3: 페이지 레벨에서 직접 로딩 상태 처리
{isLoading ? (
  <div className="mb-6">
    <Skeleton height={120} radius="md" />
  </div>
) : (
  <CalendarControlHeader /*...*/ />
)}

{isLoading && <CalendarSkeleton />}
```

**분석:** 이 페이지는 완전히 독립적인 로딩 생태계를 구축하고 있습니다. `CalendarSkeleton`, `Skeleton` 컴포넌트, 그리고 조건부 렌더링까지 모든 것이 중앙 시스템과 분리되어 있습니다.

##### **2. `/reservations/my/page.tsx` - Mantine LoadingOverlay 시스템**
```tsx
// 🚨 문제: Mantine의 LoadingOverlay를 페이지 레벨에서 직접 사용
const { data: reservations, isLoading, isError } = useMyReservations(userProfile?.dbId);

return (
  <Box style={{ position: 'relative', minHeight: '100vh' }}>
    <LoadingOverlay
      visible={isLoading}
      zIndex={1000}
      overlayProps={{ radius: 'sm', blur: 2 }}
      loaderProps={{ children: '예약 정보를 불러오는 중...' }}
    />
    {/* ... */}
  </Box>
);
```

**분석:** 이 페이지는 Mantine의 `LoadingOverlay`를 사용하여 완전히 다른 스타일의 로딩 UI를 표시합니다. "예약 정보를 불러오는 중..."이라는 메시지도 중앙 시스템의 "Loading..."과 다릅니다.

##### **3. `/kiosk/room-display/page.tsx` - 커스텀 로딩 시스템**
```tsx
// 🚨 문제 1: 인증 로딩과 데이터 로딩을 별도로 처리
const { userProfile, loading } = useAuth();
const { data: todayReservations, isLoading, isError } = usePublicReservations(/*...*/);

// 🚨 문제 2: 인증 로딩을 위한 독자적인 로딩 UI
if (loading) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader size="lg" />
        <Text size="lg" fw={600} mt="md">살아있는 현황판 로딩 중</Text>
        <Text size="sm" c="dimmed" mt="xs">실시간 데이터를 불러오고 있습니다...</Text>
      </div>
    </div>
  );
}

// 🚨 문제 3: 데이터 로딩을 위한 또 다른 로딩 UI
{isLoading && (
  <div className="flex items-center justify-center py-12">
    <div className="text-center">
      <Loader size="lg" />
      <Text size="md" mt="md">실시간 데이터 동기화 중...</Text>
    </div>
  </div>
)}
```

**분석:** 이 페이지는 가장 복잡한 로딩 시스템을 가지고 있습니다. 인증 로딩과 데이터 로딩을 각각 다른 UI로 처리하며, 메시지도 "살아있는 현황판 로딩 중", "실시간 데이터 동기화 중..." 등으로 완전히 다릅니다.

#### **🟡 심각도 MEDIUM: 부분적 독립성**

##### **4. `/reservations/new/page.tsx` - 상대적으로 깔끔**
```tsx
// ✅ 양호: 페이지 레벨에서 직접적인 로딩 처리 없음
export default function NewReservationPage() {
  return (
    <AppLayout headerTitle="새 예약">
      <ReservationForm
        mode="create"
        onSuccess={() => window.history.back()}
        onCancel={() => window.history.back()}
      />
    </AppLayout>
  );
}
```

**분석:** 이 페이지는 상대적으로 깔끔합니다. 하지만 `ReservationForm` 내부에서 독자적인 로딩 처리가 있을 가능성이 높습니다.

---

## 🏛️ 2. '중앙 관제탑'의 현재 상태: `AuthGatekeeper`

### **현재 AuthGatekeeper의 역할과 한계**

```tsx
/**
 * 인증 상태의 문지기 - AuthGatekeeper
 * 인증 상태에 따른 라우팅 제어만 담당하는 순수한 교통 경찰
 */
export default function AuthGatekeeper({ children }: AuthGatekeeperProps) {
    const { user, userProfile, authStatus } = useAuthContext();
    
    // 🟢 현재 역할: 인증 상태에 따른 라우팅 제어
    useEffect(() => {
        if (authStatus === 'loading') return; // 로딩 중에는 라우팅 결정을 하지 않음
        // ... 라우팅 로직
    }, [authStatus, user, userProfile, pathname, router]);

    // 🟢 현재 기능: 리디렉션 중 로딩 표시
    if (shouldRedirect) {
        return <SimplePageLoader />;
    }

    return <>{children}</>;
}
```

### **SimplePageLoader - 통일된 로딩 UI**

```tsx
const SimplePageLoader = () => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
            <motion.div className="text-center">
                {/* 회전하는 스피너 */}
                <motion.div
                    className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"
                    animate={{ rotate: 360 }}
                />
                
                {/* Loading... 텍스트 (펄싱 애니메이션) */}
                <motion.p className="text-lg text-gray-600">
                    Loading...
                </motion.p>
            </motion.div>
        </div>
    );
};
```

**분석:** `AuthGatekeeper`는 이미 완벽한 통일된 로딩 UI(`SimplePageLoader`)를 가지고 있습니다. 하지만 현재는 **리디렉션 중**에만 사용되고, 각 페이지의 데이터 로딩과는 연결되어 있지 않습니다.

---

## 🎯 3. 파편화 문제의 핵심 원인

### **원인 1: 책임 분산**
- **AuthGatekeeper**: 인증 로딩만 담당
- **각 페이지**: 데이터 로딩을 독자적으로 처리
- **결과**: 사용자가 페이지마다 다른 로딩 경험을 겪음

### **원인 2: useQuery의 직접 사용**
- 각 페이지에서 `useQuery`의 `isLoading` 상태를 직접 사용
- 중앙 시스템과의 연결고리 부재
- 일관성 없는 로딩 메시지와 UI

### **원인 3: 로딩 상태의 이원화**
- **인증 로딩**: `authStatus === 'loading'`
- **데이터 로딩**: `useQuery`의 `isLoading`
- 두 상태가 독립적으로 작동하여 사용자 혼란 야기

---

## 💡 4. 최종 통합 계획: "모든 로딩 권한을 Gatekeeper에게 위임"

### **Phase 1: 각 페이지의 '게릴라 부대' 해산**

#### **4.1. `/reservations/status/page.tsx` 수정**
```tsx
// ❌ 제거할 코드들
const CalendarSkeleton = () => { /* ... */ };
{isLoading ? <Skeleton /> : <CalendarControlHeader />}
{isLoading && <CalendarSkeleton />}

// ✅ 수정 후
// 모든 로딩 처리를 AuthGatekeeper에 위임
// 페이지는 순수하게 데이터만 렌더링
```

#### **4.2. `/reservations/my/page.tsx` 수정**
```tsx
// ❌ 제거할 코드
<LoadingOverlay
  visible={isLoading}
  loaderProps={{ children: '예약 정보를 불러오는 중...' }}
/>

// ✅ 수정 후
// LoadingOverlay 완전 제거, AuthGatekeeper가 모든 로딩 처리
```

#### **4.3. `/kiosk/room-display/page.tsx` 수정**
```tsx
// ❌ 제거할 코드들
if (loading) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Text>살아있는 현황판 로딩 중</Text>
    </div>
  );
}

{isLoading && (
  <div className="text-center">
    <Text>실시간 데이터 동기화 중...</Text>
  </div>
)}

// ✅ 수정 후
// 모든 로딩 UI 제거, AuthGatekeeper가 통합 처리
```

### **Phase 2: AuthGatekeeper 역할 확장**

#### **4.4. 전역 로딩 상태 관리 시스템 구축**
```tsx
// 새로운 전역 로딩 상태 관리
interface GlobalLoadingState {
  isAuthLoading: boolean;
  isDataLoading: boolean;
  loadingMessage?: string;
}

// AuthGatekeeper 확장
export default function AuthGatekeeper({ children }: AuthGatekeeperProps) {
    const { authStatus } = useAuthContext();
    const globalLoading = useGlobalLoading(); // 새로운 훅
    
    // 통합 로딩 조건
    const isLoading = authStatus === 'loading' || globalLoading.isDataLoading;
    
    if (isLoading) {
        return <SimplePageLoader />;
    }
    
    return <>{children}</>;
}
```

#### **4.5. useQuery 래퍼 훅 생성**
```tsx
// 모든 데이터 조회를 중앙 시스템과 연결하는 래퍼 훅
export function useUnifiedQuery<T>(queryFn: () => UseQueryResult<T>) {
    const result = queryFn();
    const { setGlobalLoading } = useGlobalLoading();
    
    useEffect(() => {
        setGlobalLoading(result.isLoading);
    }, [result.isLoading]);
    
    return result;
}
```

---

## 🎯 5. 최종 결과물 예상

### **통합 후 사용자 경험**
1. **앱 최초 시작**: `EasyRoom` 브랜딩 스플래시 (AppInitializer)
2. **모든 페이지 로딩**: 통일된 `Loading...` + 스피너 (AuthGatekeeper)
3. **일관된 경험**: 어떤 페이지든 동일한 로딩 UI

### **개발자 경험**
1. **단순화된 페이지 코드**: 로딩 처리 로직 완전 제거
2. **중앙화된 관리**: 모든 로딩 상태를 한 곳에서 제어
3. **유지보수성 향상**: 로딩 UI 변경 시 한 곳만 수정

---

## 🚀 6. 실행 우선순위

### **High Priority (즉시 실행)**
1. `/kiosk/room-display/page.tsx` - 가장 복잡한 로딩 시스템 정리
2. `/reservations/my/page.tsx` - LoadingOverlay 제거
3. `/reservations/status/page.tsx` - 다중 스켈레톤 시스템 정리

### **Medium Priority (후속 작업)**
1. 전역 로딩 상태 관리 시스템 구축
2. useQuery 래퍼 훅 개발
3. AuthGatekeeper 역할 확장

---

## 📝 결론

현재 애플리케이션의 로딩 UI 파편화 문제는 **각 페이지가 독자적인 '게릴라 부대'를 운영**하고 있기 때문입니다. 이를 해결하기 위해서는 **모든 로딩 권한을 AuthGatekeeper라는 단일 지휘관에게 위임**하는 근본적인 아키텍처 개편이 필요합니다.

이 통합 작업을 통해 사용자는 일관된 로딩 경험을 얻고, 개발자는 단순화된 코드베이스를 유지할 수 있게 됩니다.

**다음 단계:** 위 분석을 바탕으로 한 구체적인 코드 수정 작업을 단계별로 진행하겠습니다.