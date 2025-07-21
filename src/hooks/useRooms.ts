"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomService } from '@/lib/services/rooms';
import { RoomFormData } from '@/lib/validations/schemas';
import { useToast } from '@/hooks/use-toast';
import { useUIStore } from '@/lib/store/ui';
import { RoomAmenities } from '@/types/database';

// Query keys
export const roomKeys = {
  all: ['rooms'] as const,
  lists: () => [...roomKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...roomKeys.lists(), filters] as const,
  details: () => [...roomKeys.all, 'detail'] as const,
  detail: (id: string) => [...roomKeys.details(), id] as const,
  active: () => [...roomKeys.all, 'active'] as const,
  inactive: () => [...roomKeys.all, 'inactive'] as const,
  search: (query: string) => [...roomKeys.all, 'search', query] as const,
  capacity: (minCapacity: number) => [...roomKeys.all, 'capacity', minCapacity] as const,
  availability: (roomId: string, startDate: string, endDate: string) => 
    [...roomKeys.all, 'availability', roomId, startDate, endDate] as const,
};

// Get all active rooms
export function useRooms() {
  return useQuery({
    queryKey: ["rooms"],
    queryFn: () => roomService.getActiveRooms(),
  });
}

// Get all rooms including inactive (admin only)
export function useAllRooms() {
  return useQuery({
    queryKey: [...roomKeys.all, 'admin'],
    queryFn: () => roomService.getAllRoomsIncludingInactive(),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

// Get room by ID
export function useRoom(id: string) {
  return useQuery({
    queryKey: roomKeys.detail(id),
    queryFn: () => roomService.getRoomById(id),
    enabled: !!id,
  });
}

// Search rooms
export function useSearchRooms(query: string) {
  return useQuery({
    queryKey: roomKeys.search(query),
    queryFn: () => roomService.searchRooms(query),
    enabled: !!query && query.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Get rooms by capacity
export function useRoomsByCapacity(minCapacity: number) {
  return useQuery({
    queryKey: roomKeys.capacity(minCapacity),
    queryFn: () => roomService.getRoomsByCapacity(minCapacity),
    enabled: minCapacity > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

// Get room availability
export function useRoomAvailability(roomId: string, startDate: string, endDate: string) {
  return useQuery({
    queryKey: roomKeys.availability(roomId, startDate, endDate),
    queryFn: () => roomService.getRoomAvailability(roomId, startDate, endDate),
    enabled: !!roomId && !!startDate && !!endDate,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
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