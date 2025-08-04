# 실시간 대시보드 구축을 위한 아키텍처 분석 보고서

## 개요
회의실 입구 태블릿에 표시될 '대시보드' 페이지를, 예약 변경사항이 자동으로 즉시 반영되는 완전한 실시간 현황판으로 구축하기 위한 정밀 분석 보고서입니다. 현재 대시보드의 데이터 조회 및 UI 렌더링 방식을 분석하여 최적의 실시간 동기화 전략을 수립합니다.

---

## 1. 대시보드 페이지의 진입점 및 구조

### 1-1. 대시보드 페이지 컴포넌트 전체 코드 분석

**파일 경로:** `src/app/dashboard/page.tsx`

#### **🏗️ 현재 구조 분석:**

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import ReservationDashboard from '@/features/reservation/components/ReservationDashboard';
import MobileHeader from '@/components/ui/mobile-header';
import AuthPrompt from '@/components/ui/auth-prompt';
import { EnhancedLoadingState } from '@/components/ui/enhanced-loading-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { userProfile, loading } = useAuth();

  // 로딩 중인 경우
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <EnhancedLoadingState
          isLoading={true}
          title="대시보드 로딩 중"
          description="사용자 정보와 대시보드 데이터를 불러오고 있습니다..."
          showNetworkStatus={true}
          className="w-full max-w-md"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader title="예약 대시보드" onBack={handleGoBack} />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Authentication prompt for non-authenticated users */}
        {!userProfile && (
          <AuthPrompt
            title="더 자세한 정보를 확인하세요"
            description="로그인하시면 개인화된 대시보드, 내 예약 정보, 상세 통계 등을 확인할 수 있습니다."
            onLogin={navigateToLogin}
            onSignup={navigateToSignup}
            className="mb-6"
          />
        )}

        {/* Dashboard component - available for both authenticated and non-authenticated users */}
        <ReservationDashboard readOnly={!userProfile} />

        {/* Information section for non-authenticated users */}
        {!userProfile && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                대시보드 기능 안내
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* 기능 안내 내용 */}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
```

#### **📊 구조적 특징:**
- **핵심 컴포넌트**: `<ReservationDashboard readOnly={!userProfile} />`
- **인증 상태 기반 UI**: 로그인 여부에 따른 다른 경험 제공
- **태블릿 최적화**: `max-w-7xl` 큰 화면 레이아웃 지원
- **로딩 상태 관리**: `EnhancedLoadingState` 컴포넌트 사용

---

## 2. 핵심 데이터 조회 로직 (Query)

### 2-1. 대시보드 데이터 조회 훅 분석

**파일 경로:** `src/features/reservation/components/ReservationDashboard.tsx`

#### **🔍 현재 데이터 조회 방식:**

```typescript
export default function ReservationDashboard({ readOnly = false }: ReservationDashboardProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { user } = useAuth();

  // 오늘 날짜 범위 설정
  const today = format(new Date(), 'yyyy-MM-dd');
  const startDate = today;
  const endDate = today;

  // 핵심 데이터 조회 훅들
  const { data: reservations = [], isLoading: reservationsLoading, error: reservationsError } = usePublicReservations(startDate, endDate, !!user);
  const { data: rooms = [], isLoading: roomsLoading, error: roomsError } = useRooms();

  // 실시간 구독 (현재 구현)
  useRealtimeSubscription();

  // 현재 시간 업데이트 (1분마다)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // 데이터 처리 로직...
}
```

#### **🚨 현재 실시간 구독의 문제점:**

1. **범용적 구독**: `useRealtimeSubscription()`이 모든 예약 변경을 감지하지만 대시보드 특화되지 않음
2. **날짜 필터링 부재**: 오늘 날짜 외의 변경사항도 불필요하게 처리
3. **캐시 무효화만**: 전체 쿼리를 다시 실행하는 방식으로 효율성 부족
4. **폴링 백업**: 30초-2분 간격의 폴링으로 실시간성 저하

---

## 3. 핵심 UI 컴포넌트

### 3-1. 대시보드 UI 컴포넌트 전체 코드 분석

**파일 경로:** `src/features/reservation/components/ReservationDashboard.tsx`

#### **🎨 UI 구조 분석:**

```typescript
return (
  <Card className="w-full">
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          예약 대시보드
        </CardTitle>
        <p className="text-xl font-bold text-gray-900">
          {currentTime.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          })}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        {formatDate(new Date(), 'yyyy년 MM월 dd일 (E)')}
      </p>
    </CardHeader>
    <CardContent>
      {/* 반응형 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 현재 예약 상태 - 좌측 (3/5) */}
        <div className="lg:col-span-3 order-1 lg:order-1">
          <CurrentReservationCard
            reservation={currentReservation}
            reservations={todayReservations}
            rooms={rooms}
            getReservationColor={getReservationColor}
            readOnly={readOnly}
          />
        </div>

        {/* 오늘 일정 타임테이블 - 우측 (2/5) */}
        <div className="lg:col-span-2 order-2 lg:order-2">
          <TodayScheduleCard 
            timeSlots={timeSlots} 
            rooms={rooms} 
            currentTime={currentTime} 
            getReservationColor={getReservationColor} 
          />
        </div>
      </div>
    </CardContent>
  </Card>
);
```

#### **🔧 UI 컴포넌트 특징:**

1. **CurrentReservationCard**: 현재 진행 중인 회의 표시
   - 회의실 상태 (사용 중/사용 가능)
   - 현재 예약 정보 (제목, 시간, 부서)
   - 다음 예약 미리보기

2. **TodayScheduleCard**: 오늘 전체 일정 타임라인
   - 8시-20시 시간 그리드
   - 예약 블록 오버레이
   - 시간별 예약 현황 시각화

3. **실시간 업데이트 요소들**:
   - 현재 시간 (1분마다 업데이트)
   - 예약 상태 변경 (실시간 반영 필요)
   - 색상 코딩 시스템 (일관성 유지)

---

## 4. 현재 실시간 구독 시스템 분석

### 4-1. `useRealtimeSubscription` 훅 분석

**파일 경로:** `src/hooks/useRealtimeSubscription.ts`

#### **⚡ 현재 구현 방식:**

```typescript
export function useRealtimeSubscription() {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient();
  const isConnectedRef = useRef(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    const initializeSubscription = async () => {
      channel = supabase
        .channel("reservations_realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "reservations" },
          (payload) => {
            // 🚨 문제: 단순한 캐시 무효화만 수행
            queryClient.invalidateQueries({ queryKey: ["reservations"] });
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            isConnectedRef.current = true;
            reconnectAttemptsRef.current = 0;
            // 폴링 중단
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
          }
          if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            isConnectedRef.current = false;
            // 폴링 백업 시작
            startPollingFallback();
          }
        });
    };

    // 폴링 백업 로직
    const startPollingFallback = () => {
      const interval = Math.min(30000 + (reconnectAttemptsRef.current * 10000), 120000);
      pollingIntervalRef.current = setInterval(() => {
        if (!isConnectedRef.current) {
          queryClient.invalidateQueries({ queryKey: ["reservations"] });
          reconnectAttemptsRef.current++;
        }
      }, interval); // 30초 → 2분 점진적 증가
    };
  }, [queryClient, supabase]);
}
```

#### **🚨 현재 시스템의 한계점:**

1. **비효율적 캐시 무효화**: 모든 예약 쿼리를 다시 실행
2. **날짜 필터링 부재**: 오늘과 무관한 변경사항도 처리
3. **느린 폴링 백업**: 30초-2분 간격으로 실시간성 저하
4. **대시보드 특화 부족**: 범용적 구독으로 최적화 부족

---

## 5. 대시보드 실시간 최적화 전략

### 5-1. 문제점 종합 분석

#### **🎯 대시보드 특화 요구사항:**
1. **오늘 날짜만 관심**: 다른 날짜 변경사항은 불필요
2. **즉시 반영**: 예약 생성/수정/취소가 1-2초 내 반영
3. **무인 운영**: 장시간 켜두어도 안정적 동작
4. **메모리 효율성**: 불필요한 데이터 로딩 최소화

#### **🔧 현재 시스템의 개선 포인트:**
1. **대시보드 전용 실시간 훅 필요**
2. **날짜 기반 필터링 구독**
3. **수동 캐시 업데이트 로직**
4. **더 빠른 폴링 백업 (5-10초)**
5. **자동 새로고침 안전장치 (15분 간격)**

---

## 6. 제안하는 실시간 대시보드 아키텍처

### 6-1. 새로운 `useDashboardRealtime` 훅 설계

```typescript
// 대시보드 전용 실시간 훅 (제안)
export function useDashboardRealtime(date: string) {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient();
  
  useEffect(() => {
    const channel = supabase
      .channel(`dashboard-${date}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          // 🎯 핵심: 오늘 날짜만 필터링
          filter: `start_time.gte.${date}T00:00:00Z,start_time.lt.${date}T23:59:59Z`
        },
        async (payload) => {
          // 🚀 수동 캐시 업데이트 (전체 예약 현황 페이지와 동일한 로직)
          const queryKey = reservationKeys.public(date, date, true);
          const currentData = queryClient.getQueryData(queryKey);
          
          if (currentData) {
            // INSERT/UPDATE/DELETE 이벤트별 정확한 캐시 조작
            const updatedData = handleRealtimeUpdate(currentData, payload);
            queryClient.setQueryData(queryKey, updatedData);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [date, queryClient, supabase]);
}
```

### 6-2. 자동 새로고침 안전장치

```typescript
// 15분마다 전체 데이터 동기화 (제안)
useEffect(() => {
  const refreshInterval = setInterval(() => {
    queryClient.invalidateQueries({ 
      queryKey: reservationKeys.public(today, today, !!user) 
    });
    console.log('[Dashboard] Auto-refresh: 15분 주기 데이터 동기화');
  }, 15 * 60 * 1000); // 15분

  return () => clearInterval(refreshInterval);
}, [queryClient, today, user]);
```

### 6-3. 빠른 폴링 백업 시스템

```typescript
// 실시간 연결 실패 시 5초 간격 폴링 (제안)
const startFastPolling = () => {
  pollingRef.current = setInterval(() => {
    queryClient.invalidateQueries({ 
      queryKey: reservationKeys.public(today, today, !!user) 
    });
  }, 5000); // 5초 간격 (기존 30초보다 6배 빠름)
};
```

---

## 7. 구현 우선순위 및 실행 계획

### 🔥 **1단계: 대시보드 전용 실시간 훅 구현**
- `useDashboardRealtime` 훅 생성
- 날짜 기반 필터링 구독 설정
- 수동 캐시 업데이트 로직 구현

### ⚡ **2단계: 폴링 백업 시스템 강화**
- 5초 간격 빠른 폴링 구현
- 연결 상태 모니터링 개선
- 자동 재연결 로직 최적화

### 📋 **3단계: 안전장치 및 최적화**
- 15분 주기 자동 새로고침 추가
- 메모리 누수 방지 로직 강화
- 에러 복구 메커니즘 구현

### 🎯 **4단계: 태블릿 최적화**
- 화면 절전 방지 로직
- 터치 인터랙션 최적화
- 장시간 운영 안정성 테스트

---

## 8. 기대 효과

### ✅ **궁극의 실시간성 달성**
- 예약 변경사항이 1-2초 내 즉시 반영
- WebSocket 연결 실패 시에도 5초 내 업데이트

### ✅ **무인 자동 운전 보장**
- 15분 주기 자동 새로고침으로 데이터 정합성 유지
- 연결 끊김 시 자동 복구 메커니즘

### ✅ **태블릿 환경 최적화**
- 대화면 레이아웃에 최적화된 UI
- 장시간 운영에도 안정적인 메모리 관리

### ✅ **운영 효율성 극대화**
- 회의실 입구에서 실시간 현황 확인
- 예약 충돌 및 빈 시간 즉시 파악
- 사용자 경험 대폭 향상

이 아키텍처를 통해 대시보드는 진정한 '디지털 사이니지'로서 회의실 운영의 핵심 허브 역할을 수행하게 될 것입니다.