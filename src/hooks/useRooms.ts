"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomService, RoomService } from '@/lib/services/rooms';
import { RoomFormData } from '@/lib/validations/schemas';
import { toast } from 'sonner';
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

// ✅ Phase 2: 회의실 가용성 조회 훅 - RPC 호출과 폴백 로직 서비스 계층 이전 (침범도: 60% → 0%)
export function useRoomAvailability(roomId: string, startDate: string, endDate: string) {
  const supabase = useSupabaseClient();
  const { authStatus } = useAuthContext();

  return useQuery(buildQueryOptions({
    queryKey: roomKeys.availability(roomId, startDate, endDate),
    queryFn: createStandardFetch(
      () => {
        // ✅ 가드 조건만 유지, 모든 비즈니스 로직은 서비스 계층으로 이전
        if (authStatus !== 'authenticated' || !supabase) {
          return Promise.resolve([]);
        }

        // ✅ 서비스 계층 완전 위임 - RPC 호출과 폴백 로직 모두 서비스에서 처리
        return RoomService.getInstance().getRoomAvailability(supabase, roomId, startDate, endDate);
      },
      {
        operation: 'check room availability (service layer)',
        params: { roomId, startDate, endDate }
      }
    ),
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
      toast.success('회의실 생성 완료', {
        description: '새 회의실이 성공적으로 생성되었습니다.',
      });
    },
    onError: (error: Error) => {
      toast.error('회의실 생성 실패', {
        description: error.message,
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
      toast.success('회의실 수정 완료', {
        description: '회의실 정보가 성공적으로 수정되었습니다.',
      });
    },
    onError: (error: Error) => {
      toast.error('회의실 수정 실패', {
        description: error.message,
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
  const supabase = useSupabaseClient();

  return useMutation({
    mutationFn: (id: string) => {
      if (!supabase) throw new Error('Supabase client not available');
      return roomService.deactivateRoom(supabase, id);
    },
    onSuccess: () => {
      // Phase 3: 표준화된 캐시 무효화
      queryClient.invalidateQueries({ queryKey: roomKeys.all });
      toast.success('회의실 비활성화 완료', {
        description: '회의실이 성공적으로 비활성화되었습니다.',
      });
    },
    onError: (error: Error) => {
      toast.error('회의실 비활성화 실패', {
        description: error.message,
      });
    },
  });
}

// Activate room mutation (admin only)
export function useActivateRoom() {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient();

  return useMutation({
    mutationFn: (id: string) => {
      if (!supabase) throw new Error('Supabase client not available');
      return roomService.activateRoom(supabase, id);
    },
    onSuccess: () => {
      // Phase 3: 표준화된 캐시 무효화
      queryClient.invalidateQueries({ queryKey: roomKeys.all });
      toast.success('회의실 활성화 완료', {
        description: '회의실이 성공적으로 활성화되었습니다.',
      });
    },
    onError: (error: Error) => {
      toast.error('회의실 활성화 실패', {
        description: error.message,
      });
    },
  });
}

// Delete room mutation (admin only)
export function useDeleteRoom() {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient();

  return useMutation({
    mutationFn: (id: string) => {
      if (!supabase) throw new Error('Supabase client not available');
      return roomService.deleteRoom(supabase, id);
    },
    onSuccess: () => {
      // Phase 3: 표준화된 캐시 무효화
      queryClient.invalidateQueries({ queryKey: roomKeys.all });
      toast.success('회의실 삭제 완료', {
        description: '회의실이 성공적으로 삭제되었습니다.',
      });
    },
    onError: (error: Error) => {
      toast.error('회의실 삭제 실패', {
        description: error.message,
      });
    },
  });
}

// Update room amenities mutation (admin only)
export function useUpdateRoomAmenities() {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient();

  return useMutation({
    mutationFn: ({ id, amenities }: { id: string; amenities: RoomAmenities }) => {
      if (!supabase) throw new Error('Supabase client not available');
      return roomService.updateRoomAmenities(supabase, id, amenities);
    },
    onSuccess: () => {
      // Phase 3: 표준화된 캐시 무효화
      queryClient.invalidateQueries({ queryKey: roomKeys.all });
      toast.success('편의시설 수정 완료', {
        description: '회의실 편의시설이 성공적으로 수정되었습니다.',
      });
    },
    onError: (error: Error) => {
      toast.error('편의시설 수정 실패', {
        description: error.message,
      });
    },
  });
}

// ✅ Phase 1: 예약된 시간 슬롯을 가져오는 훅 - 완전 순수화 완료 (침범도: 0%)
export function useBookedSlots(roomId: string | null, date: Date | null) {
  const supabase = useSupabaseClient();
  const { authStatus } = useAuthContext();
  const dateKey = date ? format(date, 'yyyy-MM-dd') : '';

  return useQuery({
    queryKey: roomKeys.bookedSlots(roomId || '', dateKey),
    queryFn: () => {
      // ✅ 가드 조건만 유지, 모든 비즈니스 로직은 서비스 계층으로 이전
      if (authStatus !== 'authenticated' || !roomId || !date || !supabase) {
        return Promise.resolve([]);
      }

      // ✅ 서비스 계층 완전 위임 - 단 한 줄로 순수화
      return RoomService.getInstance().getBookedSlots(supabase, roomId, date);
    },
    // ✅ [전략 2-2] enabled 조건 단순화 - authStatus는 queryFn에서 이미 검증됨
    enabled: !!roomId && !!date && !!supabase,
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