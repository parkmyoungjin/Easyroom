"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomService } from '@/lib/services/rooms';
import { RoomFormData } from '@/lib/validations/schemas';
import { useToast } from '@/hooks/use-toast';
import { useUIStore } from '@/lib/store/ui';
import { RoomAmenities } from '@/types/database';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
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
  const supabase = useSupabaseClient();
  
  return useQuery(buildQueryOptions({
    queryKey: roomKeys.active(),
    queryFn: createStandardFetch(
      () => {
        if (!supabase) throw new Error('Supabase client not available');
        return roomService.getActiveRooms(supabase);
      },
      {
        operation: 'fetch active rooms',
        params: {}
      }
    ),
    enabled: !!supabase,
    dataType: 'static'
  }));
}

// Get all rooms including inactive (admin only) - Optimized
export function useAllRooms() {
  const supabase = useSupabaseClient();
  
  return useQuery(buildQueryOptions({
    queryKey: roomKeyFactory.custom('admin', 'all'),
    queryFn: createStandardFetch(
      () => {
        if (!supabase) throw new Error('Supabase client not available');
        return roomService.getAllRoomsIncludingInactive(supabase);
      },
      {
        operation: 'fetch all rooms (admin)',
        params: {}
      }
    ),
    enabled: !!supabase,
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
  
  return useQuery(buildQueryOptions({
    queryKey: roomKeys.detail(id),
    queryFn: createStandardFetch(
      () => {
        if (!supabase) throw new Error('Supabase client not available');
        return roomService.getRoomById(supabase, id);
      },
      {
        operation: 'fetch room by ID',
        params: { id }
      }
    ),
    enabled: !!id && !!supabase,
    dataType: 'static'
  }));
}

// Search rooms - Optimized
export function useSearchRooms(query: string) {
  const supabase = useSupabaseClient();
  
  return useQuery(buildQueryOptions({
    queryKey: roomKeys.search(query),
    queryFn: createStandardFetch(
      () => {
        if (!supabase) throw new Error('Supabase client not available');
        return roomService.searchRooms(supabase, query);
      },
      {
        operation: 'search rooms',
        params: { query }
      }
    ),
    enabled: !!query && query.length > 0 && !!supabase,
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
  
  return useQuery(buildQueryOptions({
    queryKey: roomKeys.capacity(minCapacity),
    queryFn: createStandardFetch(
      () => {
        if (!supabase) throw new Error('Supabase client not available');
        return roomService.getRoomsByCapacity(supabase, minCapacity);
      },
      {
        operation: 'fetch rooms by capacity',
        params: { minCapacity }
      }
    ),
    enabled: minCapacity > 0 && !!supabase,
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
  
  return useQuery(buildQueryOptions({
    queryKey: roomKeys.availability(roomId, startDate, endDate),
    queryFn: createStandardFetch(
      async () => {
        if (!supabase) throw new Error('Supabase client not available');
        
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
    enabled: !!roomId && !!startDate && !!endDate && !!supabase,
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
  
  return useQuery(buildQueryOptions({
    queryKey: roomKeys.advancedSearch(params),
    queryFn: createStandardFetch(
      async () => {
        if (!supabase) throw new Error('Supabase client not available');
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
    enabled: !!(query || minCapacity > 0 || requiredAmenities.length > 0 || (availableFrom && availableTo)) && !!supabase,
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