// src/lib/services/reservations.ts

'use client';

import { logger } from '@/lib/utils/logger';
import { normalizeDateForQuery } from '@/lib/utils/date';
import { UserIdGuards } from '@/lib/security/user-id-guards';
import type {
  Reservation,
  ReservationInsert,
  ReservationUpdate,
  PublicReservation,
  ReservationWithDetails
} from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// ✅ [추가] getReservations 함수의 반환 데이터 타입을 명시적으로 정의합니다.
// 이렇게 하면 Supabase의 타입 추론에 대한 의존도를 줄일 수 있습니다.
type ReservationWithUserAndRoom = Pick<
  Reservation,
  'id' | 'room_id' | 'user_id' | 'title' | 'purpose' | 'start_time' | 'end_time'
> & {
  user: {
    department: string | null;
    name: string | null;
  } | null; // !inner 조인을 사용하지만, 만약을 위해 null 가능성을 열어둡니다.
  room: {
    name: string | null;
  } | null;
};

export const reservationService = {
  async createReservation(supabase: SupabaseClient<Database>, data: ReservationInsert): Promise<Reservation> {
    try {
      const validatedData = await UserIdGuards.validateReservationData(supabase, data);
      const { data: result, error } = await supabase
        .from('reservations')
        .insert(validatedData)
        .select(`*, room:rooms!inner(*)`) // ✅ 관계형 조회 구문 통일
        .single(); // ✅ .single()을 사용하여 단일 객체 반환 보장

      if (error) throw error;
      if (!result) throw new Error('예약을 생성하고 데이터를 가져오는 데 실패했습니다.');
      
      return result as Reservation;
    } catch (error) {
      logger.error('예약 생성 실패', { error });
      throw new Error('예약 생성에 실패했습니다.');
    }
  },

  async getReservations(supabase: SupabaseClient<Database>, startDate?: string, endDate?: string): Promise<PublicReservation[]> {
    try {
      let query = supabase
        .from('reservations')
        .select(`
          id, room_id, user_id, title, purpose, start_time, end_time,
          user:users!inner ( department, name ), 
          room:rooms!inner ( name )
        `) // ✅ !inner 조인을 사용하여 user와 room이 항상 단일 객체임을 명시
        .eq('status', 'confirmed')
        .order('start_time', { ascending: true });

      if (startDate && endDate) {
        const normalizedStartDate = normalizeDateForQuery(startDate, false);
        const normalizedEndDate = normalizeDateForQuery(endDate, true);
        query = query.gte('start_time', normalizedStartDate).lte('end_time', normalizedEndDate);
      }
      
      // ✅ [수정] Supabase 쿼리 결과의 타입을 명시적으로 지정합니다.
      const { data, error } = await query as { data: ReservationWithUserAndRoom[] | null, error: any };

      if (error) throw error;

      // ✅ [수정] map 함수 내부에서 타입을 명시적으로 맞춰줍니다.
      const publicReservations: PublicReservation[] = (data || []).map((reservation) => ({
        id: reservation.id,
        room_id: reservation.room_id,
        user_id: reservation.user_id,
        title: reservation.title,
        // ✅ [핵심 수정] reservation.purpose가 undefined이면 null을 할당합니다.
        purpose: reservation.purpose ?? null, 
        start_time: reservation.start_time,
        end_time: reservation.end_time,
        department: reservation.user?.department || '',
        user_name: reservation.user?.name || '',
        is_mine: false
      }));
      
      return publicReservations;
    } catch (error) {
      logger.error('예약 목록 조회 실패', { error });
      throw new Error('예약 목록을 불러오는데 실패했습니다.');
    }
  },

  async getReservationsWithDetails(supabase: SupabaseClient<Database>, startDate?: string, endDate?: string): Promise<Reservation[]> {
    try {
      let query = supabase
        .from('reservations')
        .select(`*, user:users!inner(*), room:rooms!inner(*)`) // ✅ 명시적 inner join
        .order('start_time', { ascending: true });
      
      if (startDate && endDate) {
        // ... 날짜 범위 쿼리 ...
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Reservation[];
    } catch (error) {
      logger.error('상세 예약 목록 조회 실패', { error });
      throw new Error('상세 예약 목록을 불러오는데 실패했습니다.');
    }
  },

  async getAllReservations(supabase: SupabaseClient<Database>): Promise<Reservation[]> {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`*, user:users!inner(*), room:rooms!inner(*)`) // ✅ 명시적 inner join
        .order('start_time', { ascending: false });
      if (error) throw error;
      return data as Reservation[];
    } catch (error) {
      logger.error('전체 예약 목록 조회 실패', { error });
      throw new Error('전체 예약 목록을 불러오는데 실패했습니다.');
    }
  },

  async updateReservation(supabase: SupabaseClient<Database>, id: string, data: ReservationUpdate): Promise<Reservation> {
    try {
      const validatedData = await UserIdGuards.validateReservationUpdateData(supabase, data);
      const { data: reservation, error } = await supabase
        .from('reservations')
        .update(validatedData)
        .eq('id', id)
        .select(`*, room:rooms!inner(*)`) // ✅ 관계형 조회 구문 통일
        .single(); // ✅ .single()로 단일 객체 반환 보장

      if (error) throw error;
      if (!reservation) throw new Error('예약을 수정하고 데이터를 가져오는 데 실패했습니다.');

      return reservation as Reservation;
    } catch (error) {
      logger.error('예약 수정 실패', { error });
      throw new Error('예약을 수정하는데 실패했습니다.');
    }
  },

  async cancelReservation(supabase: SupabaseClient<Database>, id: string, reason?: string): Promise<void> {
    try {
      const { error, count } = await supabase
        .from('reservations')
        .update({ status: 'cancelled', cancellation_reason: reason })
        .eq('id', id);
      if (error) throw error;
      if (count === 0) logger.warn('취소할 예약을 찾지 못했습니다.', { id });
    } catch (error) {
      logger.error('예약 취소 실패', { error });
      throw new Error('예약 취소에 실패했습니다.');
    }
  },

  // ... (delete, checkConflict 등 나머지 함수는 이전과 동일)

  async getReservationById(supabase: SupabaseClient<Database>, id: string): Promise<Reservation | null> {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`*, user:users!inner(*), room:rooms!inner(*)`) // ✅ 명시적 inner join
        .eq('id', id)
        .single();
      if (error) {
        logger.warn('ID로 예약 조회 실패 (결과 없음 가능)', { id, error });
        return null;
      }
      return data as Reservation;
    } catch (error) {
      logger.error('ID로 예약 조회 중 오류 발생', { error });
      return null;
    }
  },

  // API 라우트 호출 함수 (수정 필요 없음)
  async getPublicReservations(startDate: string, endDate: string, isAuthenticated?: boolean): Promise<PublicReservation[]> {
    try {
      logger.debug('공개 예약 조회 시작', { startDate, endDate, isAuthenticated });
      
      // 보안 강화: 인증 상태에 따라 적절한 엔드포인트 선택
      const endpoint = isAuthenticated 
        ? '/api/reservations/public-authenticated'
        : '/api/reservations/public-anonymous';
      
      const url = `${endpoint}?startDate=${startDate}&endDate=${endDate}`;
      logger.debug('보안 API 호출 URL', { url, endpoint });
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // 캐시 비활성화로 최신 데이터 보장
        credentials: isAuthenticated ? 'include' : 'omit', // 인증 상태에 따른 쿠키 처리
      });
      
      logger.debug('보안 API 응답 상태:', { 
        status: response.status, 
        statusText: response.statusText,
        endpoint 
      });
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          logger.error('응답 파싱 실패', parseError instanceof Error ? parseError : new Error(String(parseError)));
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        logger.error('공개 예약 목록 조회 실패', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          endpoint
        });
        
        throw new Error(errorData.error || `서버 오류 (${response.status}): 예약 현황을 불러오는데 실패했습니다.`);
      }

      const responseData = await response.json();
      logger.debug('조회된 공개 예약 응답:', {
        hasData: !!responseData.data,
        count: responseData.data?.length || 0,
        message: responseData.message,
        authenticated: responseData.authenticated,
        endpoint
      });

      // ✅ [핵심] 성공적으로 조회된 데이터를 반환합니다.
      return responseData.data || [];
    } catch (error) {
      logger.error('공개 예약 목록 조회 중 오류 발생', {
        error: error instanceof Error ? error.message : 'Unknown error',
        startDate,
        endDate,
        isAuthenticated
      });
      
      // ✅ [핵심] 에러 발생 시 사용자에게 친화적인 오류를 던집니다.
      // 이 경우 함수는 값을 반환하지 않고 종료되지만, throw는 유효한 코드 경로입니다.
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('예약 현황을 불러오는 중 알 수 없는 오류가 발생했습니다.');
      }
    }
  },

  /**
   * '내 예약' 목록을 최적화된 방식으로 조회합니다.
   * RPC 호출을 우선 시도하고, 실패 시 일반 쿼리로 안전하게 대체합니다.
   */
  async getMyReservationsOptimized(supabase: SupabaseClient<Database>, userId: string): Promise<ReservationWithDetails[]> {
    if (!userId) {
      logger.warn('사용자 ID가 없어 최적화된 예약 조회를 할 수 없습니다');
      return [];
    }

    // 1. RPC 함수 (빠른 길) 시도
    try {
      const { data, error } = await supabase.rpc('get_user_reservations_detailed', {
        p_user_id: userId, // SQL 파일의 인자 이름과 일치
        p_limit_count: 50,
        p_offset_count: 0
      });

      if (error) throw new Error(`RPC failed: ${error.message}`);

      logger.info('Successfully fetched reservations via RPC.');
      // SQL 함수는 { data: [...] } 형태로 반환하므로, data.data를 사용
      return (data as any)?.data || [];
    } catch (rpcError) {
      logger.warn('RPC function get_user_reservations_detailed failed, falling back to standard query.', { 
        error: rpcError instanceof Error ? rpcError.message : String(rpcError) 
      });
      
      // 2. 대체 경로 (안전한 길): 기존 getMyReservations 함수 호출
      return this.getMyReservations(supabase, userId);
    }
  },

  async getMyReservations(supabase: SupabaseClient<Database>, userId?: string): Promise<ReservationWithDetails[]> {
    if (!userId) {
      logger.warn('사용자 ID가 없어 내 예약을 조회할 수 없습니다');
      return [];
    }
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`*, room:rooms!inner(*)`)
        .eq('user_id', userId)
        .order('start_time', { ascending: true });
      if (error) throw error;
      return data as ReservationWithDetails[];
    } catch (error) {
      logger.error('내 예약 목록 조회 실패', { error });
      throw new Error('내 예약 목록을 불러오는데 실패했습니다.');
    }
  }
};