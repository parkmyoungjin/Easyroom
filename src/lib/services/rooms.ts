'use client';

import type { Database } from "@/types/database";
import { RoomInsert, RoomUpdate, RoomAmenities } from '@/types/database';
import { RoomFormData } from '@/lib/validations/schemas';
import type { SupabaseClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { logger } from '@/lib/utils/logger';

export type Room = Database["public"]["Tables"]["rooms"]["Row"];
type TypedSupabaseClient = SupabaseClient<Database>;

// ✅ 2단계: BookedSlot 인터페이스 정의
export interface BookedSlot {
  start_time: string;
  end_time: string;
  title: string;
  user_name: string;
  is_mine: boolean;
}

export class RoomService {
  private static instance: RoomService;

  private constructor() {}

  static getInstance(): RoomService {
    if (!RoomService.instance) {
      RoomService.instance = new RoomService();
    }
    return RoomService.instance;
  }

  async getActiveRooms(supabase: TypedSupabaseClient): Promise<Room[]> {
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) {
      throw error;
    }

    return data;
  }

  async createRoom(supabase: TypedSupabaseClient, data: RoomFormData): Promise<Room> {
    const roomData: RoomInsert = {
      name: data.name,
      description: data.description,
      capacity: data.capacity,
      location: data.location,
      amenities: data.amenities,
    };

    const { data: room, error } = await supabase
      .from('rooms')
      .insert(roomData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return room;
  }

  async updateRoom(supabase: TypedSupabaseClient, id: string, data: Partial<RoomFormData>): Promise<Room> {
    const updateData: RoomUpdate = {
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.capacity && { capacity: data.capacity }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.amenities && { amenities: data.amenities }),
    };

    const { data: room, error } = await supabase
      .from('rooms')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return room;
  }

  async deleteRoom(supabase: TypedSupabaseClient, id: string): Promise<void> {
    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  async getAllRoomsIncludingInactive(supabase: TypedSupabaseClient): Promise<Room[]> {
    // Admin only function - 권한 체크는 호출하는 쪽에서 처리
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('name');

    if (error) {
      throw new Error(`전체 회의실 목록 조회 실패: ${error.message}`);
    }

    return data;
  }

  async getRoomById(supabase: TypedSupabaseClient, id: string): Promise<Room | null> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Get room error:', error);
      return null;
    }

    return data;
  }

  async deactivateRoom(supabase: TypedSupabaseClient, id: string): Promise<Room> {
    // Admin only function - 권한 체크는 호출하는 쪽에서 처리
    try {
      const { data, error } = await supabase
        .from('rooms')
        .update({ is_active: false })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`회의실 비활성화 실패: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Deactivate room error:', error);
      throw error;
    }
  }

  async activateRoom(supabase: TypedSupabaseClient, id: string): Promise<Room> {
    // Admin only function - 권한 체크는 호출하는 쪽에서 처리
    try {
      const { data, error } = await supabase
        .from('rooms')
        .update({ is_active: true })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`회의실 활성화 실패: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Activate room error:', error);
      throw error;
    }
  }

  async getRoomAvailability(
    supabase: TypedSupabaseClient,
    roomId: string,
    startDate: string,
    endDate: string
  ): Promise<{ available: boolean; conflictingReservations: any[] }> {
    try {
      // RPC 함수를 통해 예약 데이터 조회
      const { data, error } = await supabase.rpc('get_reservations_for_period', {
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString()
      });

      if (error) {
        throw new Error(`회의실 가용성 확인 실패: ${error.message}`);
      }

      // 특정 방의 예약만 필터링
      const conflictingReservations = (data || []).filter((reservation: any) => 
        reservation.room_id === roomId
      );

      return {
        available: conflictingReservations.length === 0,
        conflictingReservations,
      };
    } catch (error) {
      throw new Error(`회의실 가용성 확인 실패: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get room amenities as a typed object
  getRoomAmenities(room: Room): RoomAmenities {
    return (room.amenities as RoomAmenities) || {};
  }

  // Update room amenities
  async updateRoomAmenities(supabase: TypedSupabaseClient, id: string, amenities: RoomAmenities): Promise<Room> {
    // Admin only function - 권한 체크는 호출하는 쪽에서 처리
    try {
      const { data, error } = await supabase
        .from('rooms')
        .update({ amenities })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`회의실 편의시설 수정 실패: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Update room amenities error:', error);
      throw error;
    }
  }

  // Search rooms by name or location
  async searchRooms(supabase: TypedSupabaseClient, query: string): Promise<Room[]> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('is_active', true)
      .or(`name.ilike.%${query}%,location.ilike.%${query}%`)
      .order('name');

    if (error) {
      throw new Error(`회의실 검색 실패: ${error.message}`);
    }

    return data;
  }

  // Get rooms by capacity
  async getRoomsByCapacity(supabase: TypedSupabaseClient, minCapacity: number): Promise<Room[]> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('is_active', true)
      .gte('capacity', minCapacity)
      .order('capacity');

    if (error) {
      throw new Error(`수용인원별 회의실 조회 실패: ${error.message}`);
    }

    return data;
  }

  // ✅ 2단계: 타임라인용 예약된 시간 블록 조회 서비스 함수 (통합 RPC 사용)
  async getBookedSlotsForTimeline(supabase: TypedSupabaseClient, roomId: string, date: Date): Promise<BookedSlot[]> {
    try {
      // 입력 검증
      if (!roomId || !date) {
        logger.warn('getBookedSlotsForTimeline: Invalid parameters', { roomId, date });
        return [];
      }

      // Date 객체를 ISO 형식으로 변환
      const startDate = format(date, 'yyyy-MM-dd') + 'T00:00:00Z';
      const endDate = format(date, 'yyyy-MM-dd') + 'T23:59:59Z';
      
      logger.debug('Fetching booked slots for timeline via unified RPC', { roomId, startDate, endDate });

      // ✅ [레거시 RPC 함수 대체] get_reservations_for_period 통합 함수 사용
      const { data, error } = await supabase.rpc('get_reservations_for_period', {
        start_date: startDate,
        end_date: endDate
      });

      if (error) {
        logger.error('get_reservations_for_period RPC failed for booked slots', { error, roomId, startDate, endDate });
        return [];
      }

      // 데이터 안전성 검사
      if (!data || !Array.isArray(data)) {
        logger.warn('Invalid data format from get_reservations_for_period', { data, roomId, startDate, endDate });
        return [];
      }

      // ✅ [클라이언트 사이드 필터링] 특정 회의실의 예약들만 필터링
      const roomReservations = data.filter((reservation: any) => 
        reservation.room_id === roomId && reservation.status !== 'cancelled'
      );

      // BookedSlot 형식으로 변환
      const bookedSlots: BookedSlot[] = roomReservations.map((reservation: any) => ({
        id: reservation.id,
        start_time: reservation.start_time,
        end_time: reservation.end_time,
        title: reservation.title,
        user_name: reservation.user_name || '알 수 없음',
        is_mine: reservation.is_mine || false
      }));

      logger.debug('Successfully fetched booked slots for timeline via unified RPC', { 
        roomId, 
        startDate,
        endDate,
        totalReservations: data.length,
        roomReservations: bookedSlots.length 
      });

      return bookedSlots;

    } catch (error) {
      logger.error('Error in getBookedSlotsForTimeline service', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        roomId, 
        date 
      });
      return [];
    }
  }

  // ✅ 작업 2-1: 예약 가능 시간 슬롯 조회 서비스 함수
  async getAvailableTimeSlots(supabase: TypedSupabaseClient, roomId: string, date: Date): Promise<string[]> {
    try {
      // 입력 검증
      if (!roomId || !date) {
        logger.warn('getAvailableTimeSlots: Invalid parameters', { roomId, date });
        return [];
      }

      // Date 객체를 'yyyy-MM-dd' 형식으로 변환
      const dateString = format(date, 'yyyy-MM-dd');
      
      logger.debug('Fetching available time slots', { roomId, dateString });

      // RPC 함수 호출
      const { data, error } = await supabase
        .rpc('get_available_time_slots', {
          p_room_id: roomId,
          p_date: dateString
        });

      if (error) {
        logger.error('RPC get_available_time_slots failed', { error, roomId, dateString });
        return [];
      }

      // 데이터 안전성 검사 및 반환
      if (!data || !Array.isArray(data)) {
        logger.warn('Invalid data format from get_available_time_slots', { data, roomId, dateString });
        return [];
      }

      logger.debug('Successfully fetched available time slots', { 
        roomId, 
        dateString, 
        slotsCount: data.length 
      });

      return data as string[];

    } catch (error) {
      logger.error('Error in getAvailableTimeSlots service', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        roomId, 
        date 
      });
      return [];
    }
  }

  // Realtime subscription for rooms
  subscribeToRooms(supabase: TypedSupabaseClient, callback: (payload: any) => void): () => void {
    let channel: any;
    
    channel = supabase
      .channel('rooms')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'rooms' },
        callback
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }
}

export const roomService = RoomService.getInstance(); 