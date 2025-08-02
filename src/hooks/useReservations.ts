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
      customStaleTime: 0,
      customGcTime: 5 * 60 * 1000
    }
  }));
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