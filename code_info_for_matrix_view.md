# 동적 매트릭스 캘린더 구현을 위한 코드 정보

---

## 1-1. `src/app/reservations/status/page.tsx`

```tsx
// src/app/reservations/status/page.tsx

'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import ReservationCalendarView from '@/features/reservation/components/ReservationCalendarView';
import MobileHeader from '@/components/ui/mobile-header'; // ✅ MobileHeader import
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { addDays, startOfWeek, endOfWeek, format, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, LocateFixed } from 'lucide-react';
import { usePublicReservations, reservationKeys } from '@/hooks/useReservations';
import { useQueryClient } from '@tanstack/react-query';

// 스켈레톤 로딩 컴포넌트
const CalendarSkeleton = () => (
  <div className="border rounded-lg p-4 bg-card">
    <div className="flex justify-between items-center mb-4">
      <Skeleton className="h-10 w-10" />
      <div className="flex flex-col items-center gap-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-32" />
      </div>
      <Skeleton className="h-10 w-10" />
    </div>
    <div className="grid grid-cols-5 gap-2 mb-4">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
    <Skeleton className="h-[600px] w-full" />
  </div>
);


export default function ReservationStatusPage() {
  const { isAuthenticated, user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekRange = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(start, { weekStartsOn: 1 });
    return { start, end };
  }, [currentDate]);

  const startDateStr = format(weekRange.start, 'yyyy-MM-dd');
  const endDateStr = format(weekRange.end, 'yyyy-MM-dd');

  const { data: reservations, isLoading, isError } = usePublicReservations(
    startDateStr,
    endDateStr,
    isAuthenticated()
  );

  const handlePreviousWeek = () => setCurrentDate(addDays(currentDate, -7));
  const handleNextWeek = () => setCurrentDate(addDays(currentDate, 7));
  const handleGoToToday = () => setCurrentDate(new Date());

  const weekDisplay = `${format(weekRange.start, 'M월 d일')} ~ ${format(addDays(weekRange.start, 4), 'd일')}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ✅✅✅ MobileHeader 적용 ✅✅✅ */}
      <MobileHeader 
        title="전체 예약 현황"
        showBackButton={true} // 메인 페이지로 돌아갈 수 있도록 뒤로가기 버튼 표시
        // showHomeButton={true} // 또는 홈 버튼을 표시할 수도 있습니다.
      />
      
      {/* ✅ main 태그로 실제 콘텐츠 영역을 감싸줍니다. */}
      <main className="container mx-auto p-4 sm:p-6 lg:p-8 pt-0"> {/* pt-0으로 헤더와의 간격 조절 */}
        
        {/* 주간 네비게이션 */}
        <div className="flex justify-between items-center my-4 p-2 sm:p-4 border rounded-lg bg-card">
          <Button variant="outline" size="icon" onClick={handlePreviousWeek} aria-label="이전 주">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <p className="font-semibold text-sm sm:text-base">{format(weekRange.start, 'yyyy년')}</p>
            <p className="text-base sm:text-lg">{weekDisplay}</p>
          </div>
          <Button variant="outline" size="icon" onClick={handleNextWeek} aria-label="다음 주">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex justify-start mb-4">
          <Button variant="ghost" onClick={handleGoToToday} className="text-sm">
            <LocateFixed className="mr-2 h-4 w-4" />
            오늘 날짜로 이동
          </Button>
        </div>

        {isLoading && <CalendarSkeleton />}
        {isError && <p className="text-destructive text-center p-8">예약 정보를 불러오는 데 실패했습니다.</p>}
        
        {!isLoading && !isError && (
          <ReservationCalendarView 
            reservations={reservations || []}
            weekStartDate={weekRange.start}
            isAuthenticated={isAuthenticated()}
            currentUserId={user?.id}
          />
        )}
      </main>
    </div>
  );
}
```

---

## 1-2. `src/features/reservation/components/ReservationCalendarView.tsx`

```tsx
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from '@/components/ui/card';
import { addDays, format, getDay, getHours, getMinutes, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { utcToKst } from "@/lib/utils/date";
import type { PublicReservation } from "@/types/database";
import { ReservationDetailDialog } from "@/features/reservation/components/ReservationDetailDialog";
import { useQueryClient } from '@tanstack/react-query'; // ✅ QueryClient 훅 import
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { reservationKeys } from '@/hooks/useReservations';

// 상수 정의
const DAYS = ['월', '화', '수', '목', '금'];
const START_HOUR = 8;
const END_HOUR = 19;
const SLOT_HEIGHT_PX = 40;

// 데이터를 요일별로 그룹화하는 헬퍼 함수
function groupReservationsByDay(reservations: PublicReservation[], weekStartDate: Date) {
  const grouped: Record<string, PublicReservation[]> = {};
  for (let i = 0; i < 5; i++) {
    const dayKey = format(addDays(weekStartDate, i), 'yyyy-MM-dd');
    grouped[dayKey] = [];
  }

  reservations.forEach(res => {
    const dayKey = format(utcToKst(res.start_time), 'yyyy-MM-dd');
    if (grouped[dayKey]) {
      grouped[dayKey].push(res);
    }
  });

  Object.values(grouped).forEach(dayReservations => {
    dayReservations.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  });

  return grouped;
}

// 하루치 타임라인을 렌더링하는 컴포넌트
function DayTimeline({ reservations, date, isAuthenticated, currentUserId, onReservationClick }: { 
  reservations: PublicReservation[], 
  date: Date, 
  isAuthenticated: boolean, 
  currentUserId?: string,
  onReservationClick: (reservation: PublicReservation) => void 
}) {
  const router = useRouter();

  const handleSlotClick = (hour: number, minute: number) => {
    if (!isAuthenticated) return;
    const dateString = format(date, 'yyyy-MM-dd');
    const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    router.push(`/reservations/new?date=${dateString}&startTime=${timeString}`);
  };

  return (
    <div className="relative h-[calc((19-8)*2*40px)] ml-12">
      {/* 시간 눈금 및 클릭 가능한 슬롯 */}
      {Array.from({ length: (END_HOUR - START_HOUR) * 2 }).map((_, i) => {
        const hour = START_HOUR + Math.floor(i / 2);
        const minute = (i % 2) * 30;
        return (
          <div
            key={i}
            className={`absolute left-0 right-0 border-t border-dashed ${isAuthenticated ? 'cursor-pointer hover:bg-muted/50' : ''}`}
            style={{ top: `${i * SLOT_HEIGHT_PX}px` }}
            onClick={() => handleSlotClick(hour, minute)}
          >
            {minute === 0 && (
              <span className="absolute -left-12 top-[-0.7em] text-xs text-muted-foreground text-right w-10">
                {hour}:00
              </span>
            )}
          </div>
        );
      })}
      
      {/* 예약 블록 */}
      {reservations.map(res => {
        const start = utcToKst(res.start_time);
        const end = utcToKst(res.end_time);
        const startOffset = ((getHours(start) - START_HOUR) * 60 + getMinutes(start));
        const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
        
        const top = (startOffset / 30) * SLOT_HEIGHT_PX;
        const height = (durationMinutes / 30) * SLOT_HEIGHT_PX;

        const isMine = res.user_id === currentUserId;

        return (
          <div
            key={res.id}
            className={`absolute left-1 right-1 rounded-md p-2 text-xs overflow-hidden cursor-pointer transition-shadow hover:shadow-md ${isMine ? 'bg-primary/80 text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
            style={{ top: `${top}px`, height: `${height - 2}px` }}
            onClick={() => onReservationClick(res)}
          >
            <p className="font-bold truncate">{res.title}</p>
            <p className="opacity-90 truncate">{res.department}</p>
            {isAuthenticated && <p className="opacity-90 truncate">{isMine ? '내 예약' : res.user_name}</p>}
          </div>
        );
      })}
    </div>
  );
}

// 메인 캘린더 뷰 컴포넌트
export default function ReservationCalendarView({ reservations, weekStartDate, isAuthenticated, currentUserId }: { 
  reservations: PublicReservation[], 
  weekStartDate: Date,
  isAuthenticated: boolean,
  currentUserId?: string
}) {
  // ✅✅✅ 이 라인을 추가하여 queryClient 인스턴스를 가져옵니다. ✅✅✅
  const queryClient = useQueryClient();
  const [selectedReservation, setSelectedReservation] = useState<PublicReservation | null>(null);
  
  const reservationsByDay = useMemo(() => {
    return groupReservationsByDay(reservations, weekStartDate);
  }, [reservations, weekStartDate]);
  
  // 실시간 구독 로직 (이제 정상적으로 작동합니다)
  useRealtimeSubscription();

  const todayIndex = getDay(new Date());
  const defaultTabValue = (todayIndex >= 1 && todayIndex <= 5) ? DAYS[todayIndex - 1] : '월';

  return (
    <>
      <Tabs defaultValue={defaultTabValue} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          {DAYS.map((day, index) => {
            const date = addDays(weekStartDate, index);
            return (
              <TabsTrigger key={day} value={day} className={`flex-col h-auto ${isToday(date) ? 'data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent' : ''}`}>
                <span className="font-semibold">{day}</span>
                <span className="text-xs text-muted-foreground">{format(date, 'd')}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {DAYS.map((day, index) => {
          const date = addDays(weekStartDate, index);
          const dayKey = format(date, 'yyyy-MM-dd');
          return (
            <TabsContent key={day} value={day}>
              <Card>
                <CardContent className="p-2 sm:p-4 pt-4">
                  <DayTimeline 
                    reservations={reservationsByDay[dayKey] || []}
                    date={date}
                    isAuthenticated={isAuthenticated}
                    currentUserId={currentUserId}
                    onReservationClick={setSelectedReservation}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
      
      {/* 예약 상세 정보 모달 */}
      <ReservationDetailDialog
        reservation={selectedReservation}
        isOpen={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
      />
    </>
  );
}
```

---

## 2-1. `src/hooks/useReservations.ts`

```ts
// src/hooks/useReservations.ts

"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationService } from '@/lib/services/reservations';
import { ReservationFormData } from '@/lib/validations/schemas';
// Using console for now instead of sonner
const toast = {
  success: (title: string, options?: { description?: string }) => console.log(`✅ ${title}`, options?.description || ''),
  error: (title: string, options?: { description?: string }) => console.error(`❌ ${title}`, options?.description || '')
};
import type { ReservationInsert, ReservationUpdate, ReservationWithDetails } from "@/types/database";
import { logger } from '@/lib/utils/logger';
import { 
  createQueryKeyFactory, 
  buildQueryOptions, 
  createStandardFetch,
  optimizeForDateRange 
} from '@/lib/utils/query-optimization';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
import { useAuthContext } from '@/contexts/AuthContext';

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

// 상세 정보를 포함한 예약을 가져오는 훅
export function useReservationsWithDetails(startDate: string, endDate: string) {
  const supabase = useSupabaseClient();
  const dateOptimization = optimizeForDateRange(startDate, endDate);
  
  return useQuery(buildQueryOptions({
    queryKey: reservationKeys.withDetails(startDate, endDate),
    queryFn: createStandardFetch(
      () => {
        if (!supabase) {
          throw new Error('Supabase client is not available');
        }
        return reservationService.getReservationsWithDetails(supabase, startDate, endDate);
      },
      { operation: 'fetch detailed reservations', params: { startDate, endDate } }
    ),
    enabled: !!startDate && !!endDate && !!supabase,
    dataType: 'dynamic',
    cacheConfig: {
      customStaleTime: dateOptimization.staleTime,
      customGcTime: dateOptimization.gcTime
    }
  }));
}

// 내 예약을 가져오는 훅
export function useMyReservations(): { data: ReservationWithDetails[] | undefined; isLoading: boolean; isError: boolean; error: any } {
  const { userProfile } = useAuthContext();
  const supabase = useSupabaseClient();

  // ✅ [핵심 수정] buildQueryOptions를 통해 기본 옵션을 생성한 후,
  // 동적 데이터 동기화를 위한 refetch 정책을 명시적으로 추가합니다.
  const queryOptions = buildQueryOptions({
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
      customStaleTime: 0, // 데이터는 받자마자 '낡은 것'으로 간주
      customGcTime: 5 * 60 * 1000,
    }
  });

  return useQuery({
    ...queryOptions,
    // ✅ [핵심 강화] 이 데이터가 '언제' 다시 최신화되어야 하는지를 명확하게 선언합니다.
    refetchOnMount: 'always',      // 컴포넌트가 마운트될 때마다 항상 데이터를 다시 가져옵니다.
    refetchOnWindowFocus: true,    // 사용자가 다른 탭을 봤다가 돌아오면 데이터를 다시 가져옵니다.
    refetchOnReconnect: true,      // 인터넷 연결이 끊겼다가 다시 연결되면 데이터를 다시 가져옵니다.
  });
}

// ID로 예약을 가져오는 훅
export function useReservation(id: string) {
  const supabase = useSupabaseClient();
  
  return useQuery(buildQueryOptions({
    queryKey: reservationKeys.detail(id),
    queryFn: createStandardFetch(
      () => {
        if (!supabase) {
          throw new Error('Supabase client is not available');
        }
        return reservationService.getReservationById(supabase, id);
      },
      { operation: 'fetch reservation by ID', params: { id } }
    ),
    enabled: !!id && !!supabase,
    dataType: 'semi-static'
  }));
}

// 모든 예약을 가져오는 훅 (관리자용)
export function useAllReservations() {
  const supabase = useSupabaseClient();
  
  return useQuery(buildQueryOptions({
    queryKey: reservationKeys.all, // .custom('admin', 'all') 대신 .all 사용
    queryFn: createStandardFetch(
      () => {
        if (!supabase) {
          throw new Error('Supabase client is not available');
        }
        return reservationService.getAllReservations(supabase);
      },
      { operation: 'fetch all reservations (admin)', params: {} }
    ),
    enabled: !!supabase,
    dataType: 'dynamic',
  }));
}

// 통계를 가져오는 훅
export function useReservationStatistics(startDate: string, endDate: string) {
  const supabase = useSupabaseClient();

  return useQuery(buildQueryOptions({
    queryKey: reservationKeys.statistics(startDate, endDate),
    queryFn: createStandardFetch(
      async () => {
        if (!supabase) throw new Error('Supabase client is not available');
        const { data, error } = await supabase
          .rpc('get_reservation_statistics', {
            start_date: startDate,
            end_date: endDate
          });
        if (error) {
          logger.error('Statistics RPC failed', error);
          throw new Error(`통계 조회 실패: ${error.message}`);
        }
        return data;
      },
      { operation: 'fetch reservation statistics', params: { startDate, endDate } }
    ),
    enabled: !!startDate && !!endDate && !!supabase,
  }));
}

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

// 예약을 수정하는 뮤테이션 훅
export function useUpdateReservation() {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ReservationFormData> }) => {
      if (!supabase) throw new Error("인증 컨텍스트를 사용할 수 없습니다.");
      // Note: This mapping logic might need adjustment based on ReservationUpdate type
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
      // `exact: false` is often default, but being explicit can be clearer
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
    onError: (error: Error) => {
      toast.error('예약 취소 실패', { description: error.message });
    },
  });
}
```

---

## 3-1. `src/types/database.ts`

```ts
import type { AuthId, DatabaseUserId } from './enhanced-types';

// Database Types for Meeting Room Booking System
// Generated from Supabase schema
// Enhanced with branded types for type safety


export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          auth_id: string
          employee_id: string | null
          name: string
          email: string
          department: string
          role: 'employee' | 'admin'
          created_at: string
          updated_at: string
        }
        Insert: {
          auth_id: string
          employee_id?: string | null
          name: string
          email: string
          department: string
          role?: 'employee' | 'admin'
        }
        Update: {
          auth_id?: string
          employee_id?: string | null
          name?: string
          email?: string
          department?: string
          role?: 'employee' | 'admin'
          updated_at?: string
        }
      }
      rooms: {
        Row: {
          id: string
          name: string
          description?: string
          capacity: number
          location?: string
          amenities: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          name: string
          description?: string
          capacity: number
          location?: string
          amenities?: Json
          is_active?: boolean
        }
        Update: {
          name?: string
          description?: string
          capacity?: number
          location?: string
          amenities?: Json
          is_active?: boolean
        }
      }
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_email_exists: {
        Args: {
          p_email: string;
        };
        Returns: boolean;
      };

      get_current_user_info: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          auth_id: string;
          email: string;
          name: string;
          department: string;
          role: string;
        }[];
      };
      get_public_reservations: {
        Args: {
          start_date: string;
          end_date: string;
          page_limit?: number;
          page_offset?: number;
        };
        Returns: PublicReservation[];
      };
      get_public_reservations_paginated: {
        Args: {
          start_date: string;
          end_date: string;
          page_limit: number;
          page_offset: number;
        };
        Returns: PublicReservationPaginated[];
      };
      get_public_reservations_anonymous: {
        Args: {
          start_date: string;
          end_date: string;
          page_limit?: number;
          page_offset?: number;
        };
        Returns: PublicReservationAnonymous[];
      };
      get_public_reservations_anonymous_paginated: {
        Args: {
          start_date: string;
          end_date: string;
          page_limit: number;
          page_offset: number;
        };
        Returns: PublicReservationAnonymousPaginated[];
      };
    }
    Enums: {
      user_role: 'employee' | 'admin'
      reservation_status: 'confirmed' | 'cancelled'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Insertable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Updatable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

export type User = Tables<'users'>
export type Room = Tables<'rooms'>
export type Reservation = Tables<'reservations'>

// Application Types
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type UserUpdate = Database['public']['Tables']['users']['Update']

export type RoomInsert = Database['public']['Tables']['rooms']['Insert']
export type RoomUpdate = Database['public']['Tables']['rooms']['Update']

export type ReservationInsert = Database['public']['Tables']['reservations']['Insert']
export type ReservationUpdate = Database['public']['Tables']['reservations']['Update']

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

// Paginated version with metadata
export type PublicReservationPaginated = PublicReservation & {
  total_count: number
  has_more: boolean
}

// Anonymous public reservation type
export type PublicReservationAnonymous = {
  id: string
  room_id: string
  title: string
  start_time: string
  end_time: string
  room_name: string
  is_mine: boolean
}

// Anonymous paginated version with metadata
export type PublicReservationAnonymousPaginated = PublicReservationAnonymous & {
  total_count: number
  has_more: boolean
}

// Pagination metadata type
export type PaginationMetadata = {
  limit: number
  offset: number
  total_count: number
  has_more: boolean
  current_page: number
  total_pages: number
}

// Enums
export type UserRole = Database['public']['Enums']['user_role']
export type ReservationStatus = Database['public']['Enums']['reservation_status']

// Extended types with relations
export type ReservationWithDetails = Reservation & {
  room: Room
  user: User
}

export type RoomAmenities = {
  projector?: boolean
  whiteboard?: boolean
  wifi?: boolean
  tv?: boolean
  microphone?: boolean
  speakers?: boolean
  [key: string]: boolean | undefined
}

// ============================================================================
// ENHANCED TYPES WITH BRANDED TYPE SAFETY
// ============================================================================

/**
 * Enhanced User type with branded IDs for type safety
 */
export interface EnhancedUser {
  id: DatabaseUserId
  auth_id: AuthId
  employee_id: string | null
  name: string
  email: string
  department: string
  role: 'employee' | 'admin'
  created_at: Date
  updated_at: Date
}

/**
 * Enhanced Reservation type with branded user_id for type safety
 */
export interface EnhancedReservation {
  id: string
  room_id: string
  user_id: DatabaseUserId
  title: string
  purpose?: string
  start_time: Date
  end_time: Date
  status: 'confirmed' | 'cancelled'
  cancellation_reason?: string
  created_at: Date
  updated_at: Date
}

/**
 * Enhanced PublicReservation with branded types
 */
export interface EnhancedPublicReservation {
  id: string
  room_id: string
  user_id: DatabaseUserId
  title: string
  purpose: string | null
  department: string
  user_name: string
  start_time: Date
  end_time: Date
  is_mine: boolean
}

/**
 * Enhanced reservation insert type with branded user_id
 */
export interface EnhancedReservationInsert {
  room_id: string
  user_id: DatabaseUserId
  title: string
  purpose?: string
  start_time: string
  end_time: string
  status?: 'confirmed' | 'cancelled'
  cancellation_reason?: string
}

/**
 * Enhanced reservation update type with branded user_id
 */
export interface EnhancedReservationUpdate {
  room_id?: string
  user_id?: DatabaseUserId
  title?: string
  purpose?: string
  start_time?: string
  end_time?: string
  status?: 'confirmed' | 'cancelled'
  cancellation_reason?: string
}

/**
 * Type conversion utilities for database operations
 */
export interface DatabaseTypeConverters {
  // Convert enhanced types to database-compatible types
  reservationToInsert: (reservation: EnhancedReservationInsert) => ReservationInsert
  reservationToUpdate: (reservation: EnhancedReservationUpdate) => ReservationUpdate
  
  // Convert database types to enhanced types
  userFromDatabase: (user: User) => EnhancedUser
  reservationFromDatabase: (reservation: Reservation) => EnhancedReservation
  publicReservationFromDatabase: (reservation: PublicReservation) => EnhancedPublicReservation
}
/**
 * Validated reservation data with enhanced type safety
 * Used for reservation creation and validation
 */
export interface ValidatedReservationData {
  room_id: string;
  user_id: string;
  title: string;
  purpose?: string;
  start_time: string;
  end_time: string;
  status?: 'confirmed' | 'cancelled';
}
```

---

## 4-1. `src/components/ui/dialog.tsx`

```tsx
"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 grid gap-4 border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
        // 모바일: 화면 상단에서 약간 떨어진 위치에 모달 
        "left-[50%] top-[50%] w-[calc(100%-2rem)] max-w-sm translate-x-[-50%] translate-y-[-50%] p-4 rounded-lg",
        // 데스크톱: 중앙 정렬된 모달
        "sm:max-w-lg sm:p-6",
        // 최대 높이 제한
        "max-h-[90vh] overflow-y-auto",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground z-10">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
```

---

**위 정보를 전달해 주시면, 제가 바로 분석하여 '동적 매트릭스 캘린더' 구현을 위한 구체적인 코드 수정안과 신규 컴포넌트 코드를 제안 드리겠습니다.**

협업에 감사드립니다.