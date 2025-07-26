"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationService } from '@/lib/services/reservations';
import { ReservationFormData } from '@/lib/validations/schemas';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from "@/lib/supabase/client";
import type { ReservationInsert, ReservationUpdate, ReservationWithDetails } from "@/types/database";
import { format } from 'date-fns';
import { logger } from '@/lib/utils/logger';
import { 
  createQueryKeyFactory, 
  buildQueryOptions, 
  createStandardFetch,
  optimizeForDateRange 
} from '@/lib/utils/query-optimization';


// Optimized query keys using factory pattern
const reservationKeyFactory = createQueryKeyFactory<{
  startDate?: string;
  endDate?: string;
  isAuthenticated?: boolean;
  userId?: string;
}>('reservations');

export const reservationKeys = {
  ...reservationKeyFactory,
  public: (startDate: string, endDate: string, isAuthenticated?: boolean) =>
    reservationKeyFactory.custom('public', startDate, endDate, 'auth', isAuthenticated),
  my: (userId?: string) => reservationKeyFactory.custom('my', userId),
  withDetails: (startDate: string, endDate: string) =>
    reservationKeyFactory.custom('withDetails', startDate, endDate),
  statistics: (startDate: string, endDate: string) =>
    reservationKeyFactory.custom('statistics', startDate, endDate),
};

// Get public reservations (for calendar view) - Optimized with standardized patterns
export function usePublicReservations(startDate: string, endDate: string, isAuthenticated?: boolean) {
  const dateOptimization = optimizeForDateRange(startDate, endDate);
  
  return useQuery(buildQueryOptions({
    queryKey: reservationKeys.public(startDate, endDate, isAuthenticated),
    queryFn: createStandardFetch(
      () => reservationService.getPublicReservations(startDate, endDate, isAuthenticated),
      {
        operation: 'fetch public reservations',
        params: { startDate, endDate, isAuthenticated, dateRangeSize: dateOptimization.dateRangeSize }
      }
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

// Get reservations with details (for admin view) - Optimized
export function useReservationsWithDetails(startDate: string, endDate: string) {
  const dateOptimization = optimizeForDateRange(startDate, endDate);
  
  return useQuery(buildQueryOptions({
    queryKey: reservationKeys.withDetails(startDate, endDate),
    queryFn: createStandardFetch(
      () => reservationService.getReservationsWithDetails(startDate, endDate),
      {
        operation: 'fetch detailed reservations',
        params: { startDate, endDate, dateRangeSize: dateOptimization.dateRangeSize }
      }
    ),
    enabled: !!startDate && !!endDate,
    dataType: 'dynamic',
    cacheConfig: {
      customStaleTime: Math.min(dateOptimization.staleTime, 2 * 60 * 1000), // Max 2 minutes for admin data
      customGcTime: dateOptimization.gcTime
    }
  }));
}

// Get my reservations - Optimized with RPC function
export function useMyReservations(): { data: ReservationWithDetails[] | undefined; isLoading: boolean; isError: boolean; error: any } {
  const { userProfile } = useAuth();

  return useQuery(buildQueryOptions({
    queryKey: reservationKeys.my(userProfile?.authId),
    queryFn: createStandardFetch(
      async () => {
        if (!userProfile?.authId) {
          logger.warn('사용자 ID가 없어 내 예약을 조회할 수 없습니다');
          return [];
        }

        // Auth ID로 users 테이블에서 실제 데이터베이스 ID 조회
        const supabase = await createClient();
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', userProfile.authId)
          .single();

        if (userError || !userData) {
          logger.error('사용자 정보 조회 실패:', {
            error: userError,
            userProfileAuthId: userProfile.authId,
            userProfileId: userProfile.authId
          });
          throw new Error('사용자 정보를 찾을 수 없습니다.');
        }

        // Use optimized RPC function for better performance
        const { data: result, error: rpcError } = await supabase
          .rpc('get_user_reservations_detailed', {
            user_id: userData.id,
            limit_count: 50,
            offset_count: 0
          });

        if (rpcError) {
          // Fallback to original service method
          logger.warn('RPC function failed, falling back to service method', rpcError);
          return await reservationService.getMyReservations(userData.id);
        }

        return result?.data || [];
      },
      {
        operation: 'fetch my reservations',
        params: { 
          userProfileId: userProfile?.authId,
          userProfileAuthId: userProfile?.authId 
        }
      }
    ),
    enabled: !!userProfile?.authId,
    dataType: 'semi-static',
    cacheConfig: {
      customStaleTime: 0, // 2 minutes
      customGcTime: 5 * 60 * 1000 // 5 minutes
    }
  }));
}

// Get reservation by ID - Optimized
export function useReservation(id: string) {
  return useQuery(buildQueryOptions({
    queryKey: reservationKeys.detail(id),
    queryFn: createStandardFetch(
      () => reservationService.getReservationById(id),
      {
        operation: 'fetch reservation by ID',
        params: { id }
      }
    ),
    enabled: !!id,
    dataType: 'semi-static'
  }));
}

// Get all reservations (admin only) - Optimized
export function useAllReservations() {
  return useQuery(buildQueryOptions({
    queryKey: reservationKeyFactory.custom('admin', 'all'),
    queryFn: createStandardFetch(
      () => reservationService.getAllReservations(),
      {
        operation: 'fetch all reservations (admin)',
        params: {}
      }
    ),
    dataType: 'dynamic',
    cacheConfig: {
      customStaleTime: 5 * 60 * 1000,
      customGcTime: 10 * 60 * 1000
    }
  }));
}

// Get reservation statistics using optimized RPC function
export function useReservationStatistics(startDate: string, endDate: string) {
  return useQuery(buildQueryOptions({
    queryKey: reservationKeys.statistics(startDate, endDate),
    queryFn: createStandardFetch(
      async () => {
        const supabase = await createClient();
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
      {
        operation: 'fetch reservation statistics',
        params: { startDate, endDate }
      }
    ),
    enabled: !!startDate && !!endDate,
    dataType: 'dynamic',
    cacheConfig: {
      customStaleTime: 10 * 60 * 1000, // 10 minutes for statistics
      customGcTime: 30 * 60 * 1000 // 30 minutes
    }
  }));
}

// Create reservation mutation
export function useCreateReservation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { userProfile } = useAuth(); // ✅ 'user' 대신 'userProfile'을 직접 사용

  return useMutation({
    mutationFn: async (data: ReservationInsert) => {
      // ✅ userProfile에 dbId가 있는지 확인합니다. (useAuth 훅이 dbId를 제공한다고 가정)

      return reservationService.createReservation(data);
    },
    // ✅✅✅ 핵심 수정 부분: onSuccess 콜백 ✅✅✅
    onSuccess: () => {
      toast({
        title: '예약 완료',
        description: '회의실 예약이 성공적으로 완료되었습니다.',
      });

      // ✅ 'reservations'로 시작하는 모든 쿼리를 무효화하여
      // '내 예약' 목록과 '공용 캘린더' 등 관련된 모든 화면을 최신 상태로 유지합니다.
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
    },
    onError: (error: Error) => {
      logger.error('예약 생성 실패', error);
      toast({
        title: '예약 실패',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Update reservation mutation
export function useUpdateReservation() {
  const queryClient = useQueryClient();
  const { toast } = useToast(); // ✅ 토스트 추가

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ReservationFormData> }) => {
      const updateData: ReservationUpdate = {
        ...(data.room_id && { room_id: data.room_id }),
        ...(data.title && { title: data.title }),
        ...(data.purpose !== undefined && { purpose: data.purpose }),
        ...(data.start_time && { start_time: data.start_time.toISOString() }),
        ...(data.end_time && { end_time: data.end_time.toISOString() }),
      };

      logger.debug('Updating reservation', { id, hasData: !!updateData });
      return reservationService.updateReservation(id, updateData);
    },
    // ✅✅✅ 핵심 수정 부분: onSuccess 콜백 ✅✅✅
    onSuccess: (updatedReservation) => {
      toast({
        title: '예약 변경 완료',
        description: '예약 정보가 성공적으로 변경되었습니다.',
      });
      
      // ✅ 관련된 모든 목록을 한번에 갱신합니다.
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });

      // ✅ (선택적) 상세 보기 페이지가 있다면 해당 페이지만 따로 갱신할 수도 있습니다.
      // queryClient.invalidateQueries({ queryKey: reservationKeys.detail(updatedReservation.id) });
    },
    onError: (error: Error) => {
      logger.error('예약 수정 실패', error);
      toast({
        title: '변경 실패',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Cancel reservation mutation
export function useCancelReservation() {
  const queryClient = useQueryClient();
  const { toast } = useToast(); // ✅ 토스트 추가

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      reservationService.cancelReservation(id, reason),
    // ✅✅✅ 핵심 수정 부분: onSuccess 콜백 ✅✅✅
    onSuccess: () => {
      toast({
          title: '예약 취소 완료',
          description: '예약이 성공적으로 취소되었습니다.',
      });

      // ✅ 관련된 모든 목록을 한번에 갱신합니다.
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
    },
    onError: (error: Error) => {
      logger.error('예약 취소 실패', error);
      toast({
        title: '취소 실패',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
