// src/hooks/useReservations.ts

"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { reservationService } from '@/lib/services/reservations';
import { ReservationFormData } from '@/lib/validations/schemas';
import { toast } from 'sonner';
import type { ReservationInsert, ReservationUpdate, ReservationWithDetails, PublicReservation } from "@/types/database";
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


// 공개 예약을 가져오는 훅 (실시간 동기화 포함)
export function usePublicReservations(startDate: string, endDate: string, isAuthenticated?: boolean) {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();
  const { userProfile, authStatus } = useAuthContext();
  
  const queryKey = reservationKeys.public(startDate, endDate, isAuthenticated);
  const dateOptimization = optimizeForDateRange(startDate, endDate);
  
  // 기본 쿼리 설정 (staleTime을 0으로 설정하여 Realtime 실패 시 안전장치 제공)
  const queryResult = useQuery(buildQueryOptions({
    queryKey,
    queryFn: createStandardFetch(
      () => {
        // ✅ [2단계] queryFn 내부에서 최종 방어
        if (authStatus !== 'authenticated') {
          return Promise.resolve([]);
        }
        return reservationService.getPublicReservations(startDate, endDate, isAuthenticated);
      },
      { operation: 'fetch public reservations', params: { startDate, endDate, isAuthenticated } }
    ),
    // ✅ [최종 강화] 상태 업데이트 지연을 고려한 enabled 조건
    enabled: !!startDate && !!endDate && (authStatus === 'authenticated' || !!userProfile),
    dataType: 'dynamic',
    cacheConfig: {
      customStaleTime: 0, // Realtime 연결 실패 시 안전장치
      customGcTime: dateOptimization.gcTime
    },
    retryConfig: {
      maxRetries: 2,
      baseDelay: 1000
    }
  }));

  // 실시간 구독 설정
  useEffect(() => {
    if (!supabase || !startDate || !endDate) return;

    // 동적 채널명으로 쿼리 키와 동기화
    const channelName = `public-reservations-${startDate}-${endDate}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          // 서버사이드 필터: 현재 조회 중인 날짜 범위만 수신
          filter: `start_time.gte.${startDate}T00:00:00Z,start_time.lt.${endDate}T23:59:59Z`
        },
        async (payload) => {
          logger.info('Realtime event received', { event: payload.eventType, table: payload.table });
          
          // 현재 캐시 데이터 가져오기
          const currentData = queryClient.getQueryData<PublicReservation[]>(queryKey);
          if (!currentData) return;

          // 이벤트 타입별 캐시 업데이트
          let updatedData: PublicReservation[] = [...currentData];

          switch (payload.eventType) {
            case 'INSERT': {
              if (payload.new) {
                // Database Row를 PublicReservation 형식으로 변환
                const newReservation = await transformToPublicReservation(
                  payload.new, 
                  userProfile?.dbId, 
                  supabase
                );
                if (newReservation && isWithinDateRange(newReservation, startDate, endDate)) {
                  updatedData.push(newReservation);
                }
              }
              break;
            }
            case 'UPDATE': {
              if (payload.new) {
                const updatedReservation = await transformToPublicReservation(
                  payload.new, 
                  userProfile?.dbId, 
                  supabase
                );
                if (updatedReservation && isWithinDateRange(updatedReservation, startDate, endDate)) {
                  const index = updatedData.findIndex(item => item.id === updatedReservation.id);
                  if (index !== -1) {
                    updatedData[index] = updatedReservation;
                  } else {
                    // 업데이트로 인해 날짜 범위에 새로 포함된 경우
                    updatedData.push(updatedReservation);
                  }
                } else {
                  // 업데이트로 인해 날짜 범위를 벗어난 경우 제거
                  updatedData = updatedData.filter(item => item.id !== payload.new.id);
                }
              }
              break;
            }
            case 'DELETE': {
              if (payload.old) {
                updatedData = updatedData.filter(item => item.id !== payload.old.id);
              }
              break;
            }
          }

          // 캐시 수동 업데이트
          queryClient.setQueryData(queryKey, updatedData);
        }
      )
      .subscribe();

    // 클린업 함수: 구독 해제
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient, queryKey, startDate, endDate, userProfile?.dbId]);

  return queryResult;
}

// Database Row를 PublicReservation으로 변환하는 헬퍼 함수
// RPC 함수가 이미 가공된 데이터를 반환하므로 단순화
async function transformToPublicReservation(
  dbRow: any, 
  currentUserId?: string, 
  supabase?: any
): Promise<PublicReservation | null> {
  if (!dbRow || dbRow.status === 'cancelled') return null;

  // RPC 함수가 이미 모든 데이터 가공을 완료했으므로 그대로 반환
  return dbRow as PublicReservation;
}

// 예약이 지정된 날짜 범위 내에 있는지 확인하는 헬퍼 함수
function isWithinDateRange(reservation: PublicReservation, startDate: string, endDate: string): boolean {
  const reservationStart = new Date(reservation.start_time);
  const rangeStart = new Date(startDate);
  const rangeEnd = new Date(endDate + 'T23:59:59Z');
  
  return reservationStart >= rangeStart && reservationStart <= rangeEnd;
}

// 상세 정보를 포함한 예약을 가져오는 훅
export function useReservationsWithDetails(startDate: string, endDate: string) {
  const supabase = useSupabaseClient();
  const { authStatus, userProfile } = useAuthContext();
  const dateOptimization = optimizeForDateRange(startDate, endDate);
  
  return useQuery(buildQueryOptions({
    queryKey: reservationKeys.withDetails(startDate, endDate),
    queryFn: createStandardFetch(
      () => {
        // ✅ [2단계] queryFn 내부에서 최종 방어
        if (authStatus !== 'authenticated' || !supabase) {
          return Promise.resolve([]);
        }
        return reservationService.getReservationsWithDetails(supabase, startDate, endDate);
      },
      { operation: 'fetch detailed reservations', params: { startDate, endDate } }
    ),
    // ✅ [최종 강화] 상태 업데이트 지연을 고려한 enabled 조건
    enabled: !!startDate && !!endDate && (authStatus === 'authenticated' || !!userProfile) && !!supabase,
    dataType: 'dynamic',
    cacheConfig: {
      customStaleTime: dateOptimization.staleTime,
      customGcTime: dateOptimization.gcTime
    }
  }));
}

// 내 예약을 가져오는 훅 (최종 수정 버전)
export function useMyReservations(): { data: ReservationWithDetails[] | undefined; isLoading: boolean; isError: boolean; error: any } {
  const { userProfile, authStatus } = useAuthContext();
  const supabase = useSupabaseClient();

  const queryOptions = buildQueryOptions({
    queryKey: reservationKeys.my(userProfile?.dbId),
    queryFn: createStandardFetch(
      async () => {
        if (authStatus !== 'authenticated' || !userProfile?.dbId || !supabase) {
          return Promise.resolve([]);
        }
        
        // ✅ [레거시 RPC 함수 대체] get_reservations_for_period 통합 함수 사용
        const { data, error } = await supabase.rpc('get_reservations_for_period', {
          start_date: null, // 전체 기간 조회
          end_date: null
        });

        if (error) {
          logger.error('get_reservations_for_period RPC failed', error);
          throw new Error(`내 예약 조회 실패: ${error.message}`);
        }

        // ✅ [클라이언트 사이드 필터링] is_mine === true인 예약들만 필터링
        const myReservations = (data || []).filter((reservation: any) => reservation.is_mine === true);
        
        logger.debug('내 예약 조회 완료', { 
          totalReservations: data?.length || 0,
          myReservations: myReservations.length 
        });

        return myReservations as ReservationWithDetails[];
      },
      { operation: 'fetch my reservations (unified RPC)', params: { userProfileId: userProfile?.dbId } }
    ),
    // ✅ [최종 강화] userProfile.dbId가 필수적인 훅의 경우
    enabled: (authStatus === 'authenticated' || !!userProfile) && !!userProfile?.dbId && !!supabase,
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

// ID로 예약을 가져오는 훅
export function useReservation(id: string) {
  const supabase = useSupabaseClient();
  const { authStatus, userProfile } = useAuthContext();
  
  return useQuery(buildQueryOptions({
    queryKey: reservationKeys.detail(id),
    queryFn: createStandardFetch(
      () => {
        // ✅ [2단계] queryFn 내부에서 최종 방어
        if (authStatus !== 'authenticated' || !supabase) {
          return Promise.resolve(null);
        }
        return reservationService.getReservationById(supabase, id);
      },
      { operation: 'fetch reservation by ID', params: { id } }
    ),
    // ✅ [최종 강화] 상태 업데이트 지연을 고려한 enabled 조건
    enabled: !!id && (authStatus === 'authenticated' || !!userProfile) && !!supabase,
    dataType: 'semi-static'
  }));
}

// 모든 예약을 가져오는 훅 (관리자용)
export function useAllReservations() {
  const supabase = useSupabaseClient();
  const { authStatus, userProfile } = useAuthContext();
  
  return useQuery(buildQueryOptions({
    queryKey: reservationKeys.all, // .custom('admin', 'all') 대신 .all 사용
    queryFn: createStandardFetch(
      () => {
        // ✅ [2단계] queryFn 내부에서 최종 방어
        if (authStatus !== 'authenticated' || !supabase) {
          return Promise.resolve([]);
        }
        return reservationService.getAllReservations(supabase);
      },
      { operation: 'fetch all reservations (admin)', params: {} }
    ),
    // ✅ [최종 강화] 상태 업데이트 지연을 고려한 enabled 조건
    enabled: (authStatus === 'authenticated' || !!userProfile) && !!supabase,
    dataType: 'dynamic',
  }));
}

// 통계를 가져오는 훅
export function useReservationStatistics(startDate: string, endDate: string) {
  const supabase = useSupabaseClient();
  const { authStatus, userProfile } = useAuthContext();

  return useQuery(buildQueryOptions({
    queryKey: reservationKeys.statistics(startDate, endDate),
    queryFn: createStandardFetch(
      async () => {
        // ✅ [2단계] queryFn 내부에서 최종 방어
        if (authStatus !== 'authenticated' || !supabase) {
          return Promise.resolve(null);
        }
        
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
    // ✅ [최종 강화] 상태 업데이트 지연을 고려한 enabled 조건
    enabled: !!startDate && !!endDate && (authStatus === 'authenticated' || !!userProfile) && !!supabase,
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
      // RPC 함수가 던지는 명확한 에러 메시지를 표시
      const errorMessage = error instanceof Error ? error.message : '예약 수정 중 오류가 발생했습니다.';
      logger.error('예약 수정 실패', { error: errorMessage });
      toast.error('예약 수정 실패', {
        description: errorMessage,
      });
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
      // RPC 함수가 던지는 명확한 에러 메시지를 표시
      const errorMessage = error.message || '예약 취소 중 오류가 발생했습니다.';
      logger.error('예약 취소 실패', { error: errorMessage });
      toast.error('예약 취소 실패', { description: errorMessage });
    },
  });
}