"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomService } from '@/lib/services/rooms';
import { RoomFormData } from '@/lib/validations/schemas';
import { useToast } from '@/hooks/use-toast';
import { useUIStore } from '@/lib/store/ui';
import { RoomAmenities } from '@/types/database';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
import { useAuthContext } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import {
  buildQueryOptions,
  createStandardFetch
} from '@/lib/utils/query-optimization';
// Phase 2: useAuth import 제거 (더 이상 직접 사용하지 않음)
import { logger } from '@/lib/utils/logger';
import { roomKeys } from '@/lib/queryKeys'; // Phase 3: 중앙화된 쿼리 키 import

// Phase 3: 중앙화된 쿼리 키 사용 - 로컬 정의 제거

// Get all active rooms - Optimized
export function useRooms() {
  const supabase = useSupabaseClient();
  const { authStatus } = useAuthContext();

  return useQuery(buildQueryOptions({
    queryKey: roomKeys.active(),
    queryFn: createStandardFetch(
      () => {
        // ✅ [2단계] queryFn 내부에서 최종 방어
        if (authStatus !== 'authenticated' || !supabase) {
          // 인증되지 않았다면, 네트워크 요청 없이 즉시 빈 배열을 반환
          return Promise.resolve([]);
        }
        return roomService.getActiveRooms(supabase);
      },
      {
        operation: 'fetch active rooms',
        params: {}
      }
    ),
    // ✅ [Phase 1] authStatus 기반 안정화
    enabled: authStatus === 'authenticated' && !!supabase,
    dataType: 'static'
  }));
}

// Get all rooms including inactive (admin only) - Optimized
export function useAllRooms() {
  const supabase = useSupabaseClient();
  const { authStatus } = useAuthContext();

  return useQuery(buildQueryOptions({
    queryKey: [...roomKeys.all, 'admin', 'all'],
    queryFn: createStandardFetch(
      () => {
        // ✅ [2단계] queryFn 내부에서 최종 방어
        if (authStatus !== 'authenticated' || !supabase) {
          return Promise.resolve([]);
        }
        return roomService.getAllRoomsIncludingInactive(supabase);
      },
      {
        operation: 'fetch all rooms (admin)',
        params: {}
      }
    ),
    // ✅ [Phase 1] authStatus 기반 안정화
    enabled: authStatus === 'authenticated' && !!supabase,
    dataType: 'static',
    cacheConfig: {
      customStaleTime: 10 * 60 * 1000,
      customGcTime: 30 * 60 * 1000
    }
  }));
}

// Get room by ID - Optimized
export function useRoom(id: string) {
  const supabase = useSupabaseClient();
  const { authStatus } = useAuthContext();

  return useQuery(buildQueryOptions({
    queryKey: roomKeys.detail(id),
    queryFn: createStandardFetch(
      () => {
        // ✅ [2단계] queryFn 내부에서 최종 방어
        if (authStatus !== 'authenticated' || !supabase) {
          return Promise.resolve(null);
        }
        return roomService.getRoomById(supabase, id);
      },
      {
        operation: 'fetch room by ID',
        params: { id }
      }
    ),
    // ✅ [Phase 1] authStatus 기반 안정화
    enabled: !!id && authStatus === 'authenticated' && !!supabase,
    dataType: 'static'
  }));
}

// Search rooms - Optimized
export function useSearchRooms(query: string) {
  const supabase = useSupabaseClient();
  const { authStatus } = useAuthContext();

  return useQuery(buildQueryOptions({
    queryKey: roomKeys.search(query),
    queryFn: createStandardFetch(
      () => {
        // ✅ [2단계] queryFn 내부에서 최종 방어
        if (authStatus !== 'authenticated' || !supabase) {
          return Promise.resolve([]);
        }
        return roomService.searchRooms(supabase, query);
      },
      {
        operation: 'search rooms',
        params: { query }
      }
    ),
    // ✅ [Phase 1] authStatus 기반 안정화
    enabled: !!query && query.length > 0 && authStatus === 'authenticated' && !!supabase,
    dataType: 'static',
    cacheConfig: {
      customStaleTime: 5 * 60 * 1000,
      customGcTime: 10 * 60 * 1000
    }
  }));
}

// Get rooms by capacity - Optimized
export function useRoomsByCapacity(minCapacity: number) {
  const supabase = useSupabaseClient();
  const { authStatus } = useAuthContext();

  return useQuery(buildQueryOptions({
    queryKey: roomKeys.capacity(minCapacity),
    queryFn: createStandardFetch(
      () => {
        // ✅ [2단계] queryFn 내부에서 최종 방어
        if (authStatus !== 'authenticated' || !supabase) {
          return Promise.resolve([]);
        }
        return roomService.getRoomsByCapacity(supabase, minCapacity);
      },
      {
        operation: 'fetch rooms by capacity',
        params: { minCapacity }
      }
    ),
    // ✅ [Phase 1] authStatus 기반 안정화
    enabled: minCapacity > 0 && authStatus === 'authenticated' && !!supabase,
    dataType: 'static',
    cacheConfig: {
      customStaleTime: 10 * 60 * 1000,
      customGcTime: 30 * 60 * 1000
    }
  }));
}

// Get room availability - Optimized with RPC function
export function useRoomAvailability(roomId: string, startDate: string, endDate: string) {
  const supabase = useSupabaseClient();
  const { authStatus } = useAuthContext();

  return useQuery(buildQueryOptions({
    queryKey: roomKeys.availability(roomId, startDate, endDate),
    queryFn: createStandardFetch(
      async () => {
        // ✅ [2단계] queryFn 내부에서 최종 방어
        if (authStatus !== 'authenticated' || !supabase) {
          return Promise.resolve([]);
        }

        // Use optimized RPC function for detailed availability check
        const { data, error } = await supabase
          .rpc('get_room_availability_detailed', {
            room_id: roomId,
            start_time: new Date(startDate).toISOString(),
            end_time: new Date(endDate).toISOString()
          });

        if (error) {
          // Fallback to original service method
          return await roomService.getRoomAvailability(supabase, roomId, startDate, endDate);
        }

        return data;
      },
      {
        operation: 'check room availability',
        params: { roomId, startDate, endDate }
      }
    ),
    // ✅ [Phase 1] authStatus 기반 안정화
    enabled: !!roomId && !!startDate && !!endDate && authStatus === 'authenticated' && !!supabase,
    dataType: 'real-time',
    cacheConfig: {
      customStaleTime: 1 * 60 * 1000, // 1 minute
      customGcTime: 5 * 60 * 1000 // 5 minutes
    }
  }));
}

// Advanced room search with RPC function
export function useAdvancedRoomSearch(params: {
  query?: string;
  minCapacity?: number;
  requiredAmenities?: string[];
  availableFrom?: string;
  availableTo?: string;
}) {
  const { query = '', minCapacity = 0, requiredAmenities = [], availableFrom, availableTo } = params;
  const supabase = useSupabaseClient();
  const { authStatus } = useAuthContext();

  return useQuery(buildQueryOptions({
    queryKey: roomKeys.advancedSearch(params),
    queryFn: createStandardFetch(
      async () => {
        // ✅ [2단계] queryFn 내부에서 최종 방어
        if (authStatus !== 'authenticated' || !supabase) {
          return Promise.resolve([]);
        }

        const { data, error } = await supabase
          .rpc('search_rooms_advanced', {
            search_query: query,
            min_capacity: minCapacity,
            required_amenities: requiredAmenities,
            available_from: availableFrom ? new Date(availableFrom).toISOString() : null,
            available_to: availableTo ? new Date(availableTo).toISOString() : null
          });

        if (error) {
          throw new Error(`Advanced room search failed: ${error.message}`);
        }

        return data;
      },
      {
        operation: 'advanced room search',
        params
      }
    ),
    // ✅ [Phase 1] authStatus 기반 안정화
    enabled: !!(query || minCapacity > 0 || requiredAmenities.length > 0 || (availableFrom && availableTo)) && authStatus === 'authenticated' && !!supabase,
    dataType: 'dynamic',
    cacheConfig: {
      customStaleTime: 2 * 60 * 1000, // 2 minutes
      customGcTime: 10 * 60 * 1000 // 10 minutes
    }
  }));
}

// Create room mutation (admin only)
export function useCreateRoom() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { setSubmitting, setRoomModalOpen } = useUIStore();
  const supabase = useSupabaseClient();

  return useMutation({
    mutationFn: (data: RoomFormData) => {
      if (!supabase) throw new Error('Supabase client not available');
      return roomService.createRoom(supabase, data);
    },
    onMutate: () => {
      setSubmitting(true);
    },
    onSuccess: () => {
      // Phase 3: 표준화된 캐시 무효화
      queryClient.invalidateQueries({ queryKey: roomKeys.all });
      setRoomModalOpen(false);
      toast({
        title: '회의실 생성 완료',
        description: '새 회의실이 성공적으로 생성되었습니다.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '회의실 생성 실패',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setSubmitting(false);
    },
  });
}

// Update room mutation (admin only)
export function useUpdateRoom() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { setSubmitting } = useUIStore();
  const supabase = useSupabaseClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RoomFormData> }) => {
      if (!supabase) throw new Error('Supabase client not available');
      return roomService.updateRoom(supabase, id, data);
    },
    onMutate: () => {
      setSubmitting(true);
    },
    onSuccess: () => {
      // Phase 3: 표준화된 캐시 무효화
      queryClient.invalidateQueries({ queryKey: roomKeys.all });
      toast({
        title: '회의실 수정 완료',
        description: '회의실 정보가 성공적으로 수정되었습니다.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '회의실 수정 실패',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setSubmitting(false);
    },
  });
}

// Deactivate room mutation (admin only)
export function useDeactivateRoom() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const supabase = useSupabaseClient();

  return useMutation({
    mutationFn: (id: string) => {
      if (!supabase) throw new Error('Supabase client not available');
      return roomService.deactivateRoom(supabase, id);
    },
    onSuccess: () => {
      // Phase 3: 표준화된 캐시 무효화
      queryClient.invalidateQueries({ queryKey: roomKeys.all });
      toast({
        title: '회의실 비활성화 완료',
        description: '회의실이 성공적으로 비활성화되었습니다.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '회의실 비활성화 실패',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Activate room mutation (admin only)
export function useActivateRoom() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const supabase = useSupabaseClient();

  return useMutation({
    mutationFn: (id: string) => {
      if (!supabase) throw new Error('Supabase client not available');
      return roomService.activateRoom(supabase, id);
    },
    onSuccess: () => {
      // Phase 3: 표준화된 캐시 무효화
      queryClient.invalidateQueries({ queryKey: roomKeys.all });
      toast({
        title: '회의실 활성화 완료',
        description: '회의실이 성공적으로 활성화되었습니다.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '회의실 활성화 실패',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Delete room mutation (admin only)
export function useDeleteRoom() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const supabase = useSupabaseClient();

  return useMutation({
    mutationFn: (id: string) => {
      if (!supabase) throw new Error('Supabase client not available');
      return roomService.deleteRoom(supabase, id);
    },
    onSuccess: () => {
      // Phase 3: 표준화된 캐시 무효화
      queryClient.invalidateQueries({ queryKey: roomKeys.all });
      toast({
        title: '회의실 삭제 완료',
        description: '회의실이 성공적으로 삭제되었습니다.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '회의실 삭제 실패',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Update room amenities mutation (admin only)
export function useUpdateRoomAmenities() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const supabase = useSupabaseClient();

  return useMutation({
    mutationFn: ({ id, amenities }: { id: string; amenities: RoomAmenities }) => {
      if (!supabase) throw new Error('Supabase client not available');
      return roomService.updateRoomAmenities(supabase, id, amenities);
    },
    onSuccess: () => {
      // Phase 3: 표준화된 캐시 무효화
      queryClient.invalidateQueries({ queryKey: roomKeys.all });
      toast({
        title: '편의시설 수정 완료',
        description: '회의실 편의시설이 성공적으로 수정되었습니다.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '편의시설 수정 실패',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// 예약된 시간 슬롯을 가져오는 훅
export function useBookedSlots(roomId: string | null, date: Date | null) { // 👈 roomId가 null일 수도 있음을 허용
  const supabase = useSupabaseClient();
  const { authStatus } = useAuthContext();
  const dateKey = date ? format(date, 'yyyy-MM-dd') : '';

  // buildQueryOptions 래퍼를 사용하지 않고, React Query의 표준 옵션 객체를 직접 사용합니다.
  // 이것이 구조를 더 명확하게 만듭니다.
  return useQuery({
    queryKey: roomKeys.bookedSlots(roomId || '', dateKey), // Phase 3: 중앙화된 키 사용
    queryFn: async () => {
      // ✅ [2단계] queryFn 내부에서 최종 방어
      if (authStatus !== 'authenticated' || !roomId || !date || !supabase) {
        return Promise.resolve([]);
      }

      // ✅ [레거시 RPC 함수 대체] get_reservations_for_period 통합 함수 사용
      const startDate = format(date, 'yyyy-MM-dd') + 'T00:00:00Z';
      const endDate = format(date, 'yyyy-MM-dd') + 'T23:59:59Z';

      const { data, error } = await supabase.rpc('get_reservations_for_period', {
        start_date: startDate,
        end_date: endDate
      });

      if (error) {
        logger.error('get_reservations_for_period RPC failed for booked slots', error);
        return [];
      }

      // ✅ [클라이언트 사이드 필터링] 특정 회의실의 예약들만 필터링
      const roomReservations = (data || []).filter((reservation: any) =>
        reservation.room_id === roomId && reservation.status !== 'cancelled'
      );

      // BookedSlot 형식으로 변환
      const bookedSlots = roomReservations.map((reservation: any) => ({
        id: reservation.id,
        start_time: reservation.start_time,
        end_time: reservation.end_time,
        title: reservation.title,
        user_name: reservation.user_name || '알 수 없음',
        is_mine: reservation.is_mine || false
      }));

      logger.debug('예약된 시간 슬롯 조회 완료', {
        roomId,
        dateKey,
        totalReservations: data?.length || 0,
        roomReservations: bookedSlots.length
      });

      return bookedSlots;
    },
    // ✅ [Phase 1] authStatus 기반 안정화
    enabled: !!roomId && !!date && !!supabase && authStatus === 'authenticated',
    staleTime: 1 * 60 * 1000, // 1분
    gcTime: 5 * 60 * 1000, // 5분
  });
}

// ✅ 작업 2-2: 예약 가능 시간 슬롯 조회 커스텀 훅
export function useAvailableTimeSlots(roomId: string, date: Date | null) {
  const supabase = useSupabaseClient();
  const { authStatus } = useAuthContext();

  // Date 객체를 'yyyy-MM-dd' 형식으로 변환 (쿼리 키용)
  const dateKey = date ? format(date, 'yyyy-MM-dd') : '';

  return useQuery(buildQueryOptions({
    queryKey: roomKeys.availableSlots(roomId, dateKey),
    queryFn: createStandardFetch(
      () => {
        // ✅ [2단계] queryFn 내부에서 최종 방어
        if (authStatus !== 'authenticated' || !roomId || !date || !supabase) {
          return Promise.resolve([]);
        }

        // 서비스 함수 호출
        return roomService.getAvailableTimeSlots(supabase, roomId, date);
      },
      {
        operation: 'fetch available time slots',
        params: { roomId, dateKey }
      }
    ),
    // ✅ [Phase 1] authStatus 기반 안정화
    enabled: !!roomId && !!date && authStatus === 'authenticated' && !!supabase,
    dataType: 'dynamic',
    cacheConfig: {
      customStaleTime: 1 * 60 * 1000, // 1분
      customGcTime: 5 * 60 * 1000 // 5분
    }
  }));
} 