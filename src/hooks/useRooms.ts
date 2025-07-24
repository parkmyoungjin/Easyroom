"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomService } from '@/lib/services/rooms';
import { RoomFormData } from '@/lib/validations/schemas';
import { useToast } from '@/hooks/use-toast';
import { useUIStore } from '@/lib/store/ui';
import { RoomAmenities } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { 
  createQueryKeyFactory, 
  buildQueryOptions, 
  createStandardFetch 
} from '@/lib/utils/query-optimization';

// Optimized query keys using factory pattern
const roomKeyFactory = createQueryKeyFactory<{
  query?: string;
  minCapacity?: number;
  roomId?: string;
  startDate?: string;
  endDate?: string;
}>('rooms');

export const roomKeys = {
  ...roomKeyFactory,
  active: () => roomKeyFactory.custom('active'),
  inactive: () => roomKeyFactory.custom('inactive'),
  search: (query: string) => roomKeyFactory.custom('search', query),
  capacity: (minCapacity: number) => roomKeyFactory.custom('capacity', minCapacity),
  availability: (roomId: string, startDate: string, endDate: string) => 
    roomKeyFactory.custom('availability', roomId, startDate, endDate),
  advancedSearch: (params: any) => roomKeyFactory.custom('advancedSearch', params),
};

// Get all active rooms - Optimized
export function useRooms() {
  return useQuery(buildQueryOptions({
    queryKey: roomKeys.active(),
    queryFn: createStandardFetch(
      () => roomService.getActiveRooms(),
      {
        operation: 'fetch active rooms',
        params: {}
      }
    ),
    dataType: 'static'
  }));
}

// Get all rooms including inactive (admin only) - Optimized
export function useAllRooms() {
  return useQuery(buildQueryOptions({
    queryKey: roomKeyFactory.custom('admin', 'all'),
    queryFn: createStandardFetch(
      () => roomService.getAllRoomsIncludingInactive(),
      {
        operation: 'fetch all rooms (admin)',
        params: {}
      }
    ),
    dataType: 'static',
    cacheConfig: {
      customStaleTime: 10 * 60 * 1000,
      customGcTime: 30 * 60 * 1000
    }
  }));
}

// Get room by ID - Optimized
export function useRoom(id: string) {
  return useQuery(buildQueryOptions({
    queryKey: roomKeys.detail(id),
    queryFn: createStandardFetch(
      () => roomService.getRoomById(id),
      {
        operation: 'fetch room by ID',
        params: { id }
      }
    ),
    enabled: !!id,
    dataType: 'static'
  }));
}

// Search rooms - Optimized
export function useSearchRooms(query: string) {
  return useQuery(buildQueryOptions({
    queryKey: roomKeys.search(query),
    queryFn: createStandardFetch(
      () => roomService.searchRooms(query),
      {
        operation: 'search rooms',
        params: { query }
      }
    ),
    enabled: !!query && query.length > 0,
    dataType: 'static',
    cacheConfig: {
      customStaleTime: 5 * 60 * 1000,
      customGcTime: 10 * 60 * 1000
    }
  }));
}

// Get rooms by capacity - Optimized
export function useRoomsByCapacity(minCapacity: number) {
  return useQuery(buildQueryOptions({
    queryKey: roomKeys.capacity(minCapacity),
    queryFn: createStandardFetch(
      () => roomService.getRoomsByCapacity(minCapacity),
      {
        operation: 'fetch rooms by capacity',
        params: { minCapacity }
      }
    ),
    enabled: minCapacity > 0,
    dataType: 'static',
    cacheConfig: {
      customStaleTime: 10 * 60 * 1000,
      customGcTime: 30 * 60 * 1000
    }
  }));
}

// Get room availability - Optimized with RPC function
export function useRoomAvailability(roomId: string, startDate: string, endDate: string) {
  return useQuery(buildQueryOptions({
    queryKey: roomKeys.availability(roomId, startDate, endDate),
    queryFn: createStandardFetch(
      async () => {
        // Use optimized RPC function for detailed availability check
        const supabase = await createClient();
        const { data, error } = await supabase
          .rpc('get_room_availability_detailed', {
            room_id: roomId,
            start_time: new Date(startDate).toISOString(),
            end_time: new Date(endDate).toISOString()
          });

        if (error) {
          // Fallback to original service method
          return await roomService.getRoomAvailability(roomId, startDate, endDate);
        }

        return data;
      },
      {
        operation: 'check room availability',
        params: { roomId, startDate, endDate }
      }
    ),
    enabled: !!roomId && !!startDate && !!endDate,
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
  
  return useQuery(buildQueryOptions({
    queryKey: roomKeys.advancedSearch(params),
    queryFn: createStandardFetch(
      async () => {
        const supabase = await createClient();
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
    enabled: !!(query || minCapacity > 0 || requiredAmenities.length > 0 || (availableFrom && availableTo)),
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

  return useMutation({
    mutationFn: (data: RoomFormData) => roomService.createRoom(data),
    onMutate: () => {
      setSubmitting(true);
    },
    onSuccess: () => {
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

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RoomFormData> }) =>
      roomService.updateRoom(id, data),
    onMutate: () => {
      setSubmitting(true);
    },
    onSuccess: () => {
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

  return useMutation({
    mutationFn: (id: string) => roomService.deactivateRoom(id),
    onSuccess: () => {
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

  return useMutation({
    mutationFn: (id: string) => roomService.activateRoom(id),
    onSuccess: () => {
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

  return useMutation({
    mutationFn: (id: string) => roomService.deleteRoom(id),
    onSuccess: () => {
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

  return useMutation({
    mutationFn: ({ id, amenities }: { id: string; amenities: RoomAmenities }) =>
      roomService.updateRoomAmenities(id, amenities),
    onSuccess: () => {
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