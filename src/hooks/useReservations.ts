// src/hooks/useReservations.ts

"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { reservationService } from '@/lib/services/reservations';
import { ReservationFormData } from '@/lib/validations/schemas';
import { toast } from 'sonner';
import type { ReservationInsert, ReservationUpdate, ReservationWithDetails, PublicReservation } from "@/types/database";
import { logger } from '@/lib/utils/logger';
import { optimizeForDateRange } from '@/lib/utils/query-optimization';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
import { useAuthContext } from '@/contexts/AuthContext';
import { reservationKeys } from '@/lib/queryKeys'; // Phase 3: 중앙화된 쿼리 키 import
import { realtimeManager } from '@/lib/subscriptions/realtimeManager'; // Phase 2: 실시간 구독 매니저 import

// Phase 3: 중앙화된 쿼리 키 사용 - 로컬 정의 제거


// 공개 예약을 가져오는 훅 (실시간 동기화 포함) - Phase 2: DI 패턴 적용
export function usePublicReservations(startDate: string, endDate: string, isAuthenticated?: boolean, currentUserId?: string) {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();
  const { authStatus } = useAuthContext();
  
  const queryKey = reservationKeys.public(startDate, endDate, isAuthenticated);
  const dateOptimization = optimizeForDateRange(startDate, endDate);
  
  const queryResult = useQuery({
    queryKey,
    queryFn: () => {
      return reservationService.getPublicReservations(startDate, endDate, isAuthenticated);
    },
    enabled: !!startDate && !!endDate,
    staleTime: 0,
    gcTime: dateOptimization.gcTime,
    retry: 2,
    retryDelay: 1000
  });

  // ✅ Phase 2: 실시간 구독 설정 - 별도 매니저로 단순화
  useEffect(() => {
    if (!supabase || !startDate || !endDate) return;

    // ✅ 복잡한 실시간 구독 로직을 별도 매니저에 위임
    const unsubscribe = realtimeManager.subscribeToPublicReservations(
      supabase,
      queryClient,
      queryKey,
      startDate,
      endDate,
      currentUserId
    );

    // ✅ 클린업 함수 반환
    return unsubscribe;
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
  
  return useQuery({
    queryKey: reservationKeys.withDetails(startDate, endDate),
    queryFn: () => {
      if (authStatus !== 'authenticated' || !supabase) {
        return Promise.resolve([]);
      }
      return reservationService.getReservationsWithDetails(supabase, startDate, endDate);
    },
    enabled: !!startDate && !!endDate && authStatus === 'authenticated' && !!supabase,
    staleTime: dateOptimization.staleTime,
    gcTime: dateOptimization.gcTime
  });
}

// ✅ Phase 1: 내 예약을 가져오는 훅 - 완전 순수화 완료 (침범도: 0%)
export function useMyReservations(userId: string | undefined): { data: ReservationWithDetails[] | undefined; isLoading: boolean; isError: boolean; error: any } {
  const { authStatus } = useAuthContext();
  const supabase = useSupabaseClient();

  return useQuery({
    queryKey: reservationKeys.my(userId),
    queryFn: () => {
      if (authStatus !== 'authenticated' || !userId || !supabase) {
        return Promise.resolve([]);
      }
      return reservationService.getMyReservations(supabase, userId);
    },
    enabled: authStatus === 'authenticated' && !!userId && !!supabase,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

// ID로 예약을 가져오는 훅
export function useReservation(id: string) {
  const supabase = useSupabaseClient();
  const { authStatus } = useAuthContext();
  
  return useQuery({
    queryKey: reservationKeys.detail(id),
    queryFn: () => {
      if (authStatus !== 'authenticated' || !supabase) {
        return Promise.resolve(null);
      }
      return reservationService.getReservationById(supabase, id);
    },
    enabled: !!id && authStatus === 'authenticated' && !!supabase,
  });
}

// 모든 예약을 가져오는 훅 (관리자용)
export function useAllReservations() {
  const supabase = useSupabaseClient();
  const { authStatus } = useAuthContext();
  
  return useQuery({
    queryKey: reservationKeys.all,
    queryFn: () => {
      if (authStatus !== 'authenticated' || !supabase) {
        return Promise.resolve([]);
      }
      return reservationService.getAllReservations(supabase);
    },
    enabled: authStatus === 'authenticated' && !!supabase,
  });
}

// 통계를 가져오는 훅
export function useReservationStatistics(startDate: string, endDate: string) {
  const supabase = useSupabaseClient();
  const { authStatus } = useAuthContext();

  return useQuery({
    queryKey: reservationKeys.statistics(startDate, endDate),
    queryFn: async () => {
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
    enabled: !!startDate && !!endDate && authStatus === 'authenticated' && !!supabase,
  });
}

// ✅ Phase 2: 예약을 생성하는 뮤테이션 훅 - UI 피드백 로직 제거 (침범도: 40% → 0%)
export function useCreateReservation() {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient();

  return useMutation({
    mutationFn: async (data: ReservationInsert) => {
      if (!supabase) throw new Error("인증 컨텍스트를 사용할 수 없습니다.");
      return reservationService.createReservation(supabase, data);
    },
    onSuccess: () => {
      // ✅ 캐시 무효화만 유지 (상태 관리 책임)
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
      // ✅ UI 피드백은 컴포넌트 레벨에서 처리하도록 제거
    },
    onError: (error: Error) => {
      // ✅ 에러 로깅은 서비스 계층에서 이미 처리됨, 여기서는 에러만 전파
      throw error;
    },
  });
}

// ✅ Phase 2: 예약을 수정하는 뮤테이션 훅 - 데이터 변환 로직 서비스 계층 이전 (침범도: 20% → 0%)
export function useUpdateReservation() {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ReservationFormData> }) => {
      if (!supabase) {
        throw new Error('인증 컨텍스트를 사용할 수 없어 예약을 수정할 수 없습니다.');
      }
      
      // ✅ 데이터 변환 로직을 서비스 계층으로 완전 위임
      return reservationService.updateReservation(supabase, id, data);
    },
    onSuccess: (updatedReservation) => {
      // ✅ 캐시 무효화만 유지 (상태 관리 책임)
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
      // ✅ UI 피드백은 컴포넌트 레벨에서 처리하도록 제거 예정
    },
    onError: (error) => {
      // ✅ 에러 로깅은 서비스 계층에서 이미 처리됨, 여기서는 에러만 전파
      throw error;
    },
  });
}

// ✅ Phase 2: 예약을 취소하는 뮤테이션 훅 - UI 피드백 로직 제거 (침범도: 50% → 0%)
export function useCancelReservation() {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => {
      if (!supabase) throw new Error("인증 컨텍스트를 사용할 수 없습니다.");
      return reservationService.cancelReservation(supabase, id, reason);
    },
    onSuccess: () => {
      // ✅ 캐시 무효화만 유지 (상태 관리 책임)
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
      // ✅ UI 피드백은 컴포넌트 레벨에서 처리하도록 제거
    },
    onError: (error: Error) => {
      // ✅ 에러 로깅은 서비스 계층에서 이미 처리됨, 여기서는 에러만 전파
      throw error;
    },
  });
}