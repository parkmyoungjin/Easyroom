// src/hooks/usePublicReservationsV2.ts

"use client";

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { PublicReservation } from "@/types/database";
import { logger } from '@/lib/utils/logger';
import { optimizeForDateRange } from '@/lib/utils/query-optimization';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
import { useAuthContext } from '@/contexts/AuthContext';
import { reservationKeys } from '@/lib/queryKeys';
import { realtimeManager } from '@/lib/subscriptions/realtimeManager';

// ✅ Phase 1: RPC 직접 호출을 위한 새로운 공개 예약 훅 (병렬 구축)
export function usePublicReservationsV2(startDate: string, endDate: string, isAuthenticated?: boolean, currentUserId?: string) {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();
  const { authStatus } = useAuthContext();
  
  const queryKey = reservationKeys.public(startDate, endDate, isAuthenticated);
  const dateOptimization = optimizeForDateRange(startDate, endDate);
  
  const queryResult = useQuery({
    queryKey,
    queryFn: async ({ queryKey }) => {
      // ✅ Supabase RPC 직접 호출로 변경
      // queryKey에서 startDate와 endDate를 구조분해 할당하여 사용합니다.
      const [_key, _scope, startDate, endDate] = queryKey;
      
      if (!supabase) {
        throw new Error("Supabase client is not available.");
      }

      const { data, error } = await supabase.rpc('get_public_reservations_with_room', {
        start_date: startDate,
        end_date: endDate
      });

      if (error) {
        console.error('Error fetching public reservations via RPC:', error);
        throw new Error(error.message);
      }

      return data;
    },
    enabled: !!startDate && !!endDate,
    staleTime: 0,
    gcTime: dateOptimization.gcTime,
    retry: 2,
    retryDelay: 1000
  });

  // ✅ Phase 2: 실시간 구독 설정 - 별도 매니저로 단순화 (기존 로직 유지)
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