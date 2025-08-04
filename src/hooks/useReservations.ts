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
  buildQueryOptions, 
  createStandardFetch,
  optimizeForDateRange 
} from '@/lib/utils/query-optimization';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
import { useAuthContext } from '@/contexts/AuthContext';
import { reservationKeys } from '@/lib/queryKeys'; // Phase 3: 중앙화된 쿼리 키 import

// Phase 3: 중앙화된 쿼리 키 사용 - 로컬 정의 제거


// 공개 예약을 가져오는 훅 (실시간 동기화 포함) - Phase 2: DI 패턴 적용
export function usePublicReservations(startDate: string, endDate: string, isAuthenticated?: boolean, currentUserId?: string) {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();
  const { authStatus } = useAuthContext();
  
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
    // ✅ [Phase 1] authStatus 기반 안정화
    enabled: !!startDate && !!endDate && authStatus === 'authenticated',
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
                  currentUserId, 
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
                  currentUserId, 
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
  }, [supabase, queryClient, queryKey, startDate, endDate, currentUserId]);

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
  const { authStatus } = useAuthContext();
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
    // ✅ [Phase 1] authStatus 기반 안정화
    enabled: !!startDate && !!endDate && authStatus === 'authenticated' && !!supabase,
    dataType: 'dynamic',
    cacheConfig: {
      customStaleTime: dateOptimization.staleTime,
      customGcTime: dateOptimization.gcTime
    }
  }));
}

// 내 예약을 가져오는 훅 (Phase 2: DI 패턴 적용)
export function useMyReservations(userId: string | undefined): { data: ReservationWithDetails[] | undefined; isLoading: boolean; isError: boolean; error: any } {
  const { authStatus } = useAuthContext();
  const supabase = useSupabaseClient();

  const queryOptions = buildQueryOptions({
    queryKey: reservationKeys.my(userId),
    queryFn: createStandardFetch(
      async () => {
        if (authStatus !== 'authenticated' || !userId || !supabase) {
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
      { operation: 'fetch my reservations (unified RPC)', params: { userId } }
    ),
    // ✅ [Phase 2] DI 패턴 적용 - userId 인자 의존성
    enabled: authStatus === 'authenticated' && !!userId && !!supabase,
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
  const { authStatus } = useAuthContext();
  
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
    // ✅ [Phase 1] authStatus 기반 안정화
    enabled: !!id && authStatus === 'authenticated' && !!supabase,
    dataType: 'semi-static'
  }));
}

// 모든 예약을 가져오는 훅 (관리자용)
export function useAllReservations() {
  const supabase = useSupabaseClient();
  const { authStatus } = useAuthContext();
  
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
    // ✅ [Phase 1] authStatus 기반 안정화
    enabled: authStatus === 'authenticated' && !!supabase,
    dataType: 'dynamic',
  }));
}

// 통계를 가져오는 훅
export function useReservationStatistics(startDate: string, endDate: string) {
  const supabase = useSupabaseClient();
  const { authStatus } = useAuthContext();

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
    // ✅ [Phase 1] authStatus 기반 안정화
    enabled: !!startDate && !!endDate && authStatus === 'authenticated' && !!supabase,
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
      // Phase 3: 표준화된 캐시 무효화 - 중앙화된 키 사용
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
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
      // Phase 3: 표준화된 캐시 무효화
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
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
      // Phase 3: 표준화된 캐시 무효화 - 중앙화된 키 사용
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
    },
    onError: (error: Error) => {
      // RPC 함수가 던지는 명확한 에러 메시지를 표시
      const errorMessage = error.message || '예약 취소 중 오류가 발생했습니다.';
      logger.error('예약 취소 실패', { error: errorMessage });
      toast.error('예약 취소 실패', { description: errorMessage });
    },
  });
}