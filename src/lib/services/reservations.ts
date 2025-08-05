// src/lib/services/reservations.ts

'use client';

import { logger } from '@/lib/utils/logger';
import type {
  Reservation,
  ReservationInsert,
  ReservationUpdate,
  PublicReservation,
  ReservationWithDetails
} from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const reservationService = {
  /**
   * ✅ Phase 1: 내 예약 조회 - 서비스 계층으로 완전 이전
   * 모든 RPC 호출, 데이터 변환, 에러 처리를 서비스 계층에서 담당
   */
  async getMyReservations(supabase: SupabaseClient<Database>, userId: string): Promise<ReservationWithDetails[]> {
    if (!userId) {
      logger.warn('사용자 ID가 없어 내 예약을 조회할 수 없습니다');
      return [];
    }

    try {
      // ✅ get_user_reservations_detailed RPC 함수 사용 (제공된 최신 버전)
      const { data, error } = await supabase.rpc('get_user_reservations_detailed', {
        p_user_id: userId
      });

      if (error) {
        logger.error('get_user_reservations_detailed RPC failed', error);
        throw new Error(`내 예약 조회 실패: ${error.message}`);
      }

      // ✅ JSONB 응답을 ReservationWithDetails[] 배열로 파싱
      const reservations = Array.isArray(data) ? data : [];
      
      logger.debug('내 예약 조회 완료', { 
        userId,
        reservationCount: reservations.length 
      });

      return reservations as ReservationWithDetails[];
    } catch (error) {
      logger.error('내 예약 목록 조회 실패', { error, userId });
      throw new Error('내 예약 목록을 불러오는데 실패했습니다.');
    }
  },

  async createReservation(supabase: SupabaseClient<Database>, data: ReservationInsert): Promise<Reservation> {
    try {
      // RPC 함수 호출로 변경
      const { data: result, error } = await supabase.rpc('create_reservation', {
        p_room_id: data.room_id,
        p_title: data.title,
        p_purpose: data.purpose || null,
        p_start_time: data.start_time,
        p_end_time: data.end_time
      });

      if (error) throw error;
      if (!result || result.length === 0) throw new Error('예약을 생성하고 데이터를 가져오는 데 실패했습니다.');
      
      // RPC 함수는 TABLE을 반환하므로 첫 번째 요소를 가져옴
      return result[0] as Reservation;
    } catch (error) {
      logger.error('예약 생성 실패', { error });
      throw new Error('예약 생성에 실패했습니다.');
    }
  },

  async getReservations(supabase: SupabaseClient<Database>, startDate?: string, endDate?: string): Promise<PublicReservation[]> {
    try {
      // RPC 함수 호출로 변경
      const { data, error } = await supabase.rpc('get_reservations_for_period', {
        start_date: startDate ? new Date(startDate).toISOString() : null,
        end_date: endDate ? new Date(endDate).toISOString() : null
      });

      if (error) throw error;

      // RPC 함수가 이미 가공된 데이터를 반환하므로 그대로 사용
      return (data || []) as PublicReservation[];
    } catch (error) {
      logger.error('예약 목록 조회 실패', { error });
      throw new Error('예약 목록을 불러오는데 실패했습니다.');
    }
  },

  async getReservationsWithDetails(supabase: SupabaseClient<Database>, startDate?: string, endDate?: string): Promise<Reservation[]> {
    try {
      // RPC 함수 호출로 변경
      const { data, error } = await supabase.rpc('get_reservations_for_period', {
        start_date: startDate ? new Date(startDate).toISOString() : null,
        end_date: endDate ? new Date(endDate).toISOString() : null
      });

      if (error) throw error;

      // RPC 함수가 이미 가공된 데이터를 반환하므로 그대로 사용
      return (data || []) as Reservation[];
    } catch (error) {
      logger.error('상세 예약 목록 조회 실패', { error });
      throw new Error('상세 예약 목록을 불러오는데 실패했습니다.');
    }
  },

  async getAllReservations(supabase: SupabaseClient<Database>): Promise<Reservation[]> {
    try {
      // 전체 예약 조회를 위해 날짜 범위를 넓게 설정
      const { data, error } = await supabase.rpc('get_reservations_for_period', {
        start_date: null, // null이면 모든 예약 조회
        end_date: null
      });

      if (error) throw error;

      // RPC 함수가 이미 가공된 데이터를 반환하므로 그대로 사용
      return (data || []) as Reservation[];
    } catch (error) {
      logger.error('전체 예약 목록 조회 실패', { error });
      throw new Error('전체 예약 목록을 불러오는데 실패했습니다.');
    }
  },

  /**
   * ✅ Phase 2: 예약 수정 - Date 객체 변환 로직을 서비스 계층으로 이전
   * 훅에서 수행하던 데이터 변환 책임을 서비스 계층에서 담당
   */
  async updateReservation(supabase: SupabaseClient<Database>, id: string, data: any): Promise<Reservation> {
    try {
      // ✅ Date 객체를 ISO 문자열로 변환하는 로직을 서비스 계층에서 처리
      const updateData: Partial<ReservationUpdate> = {};
      
      if (data.title) {
        updateData.title = data.title;
      }
      if (data.purpose) {
        updateData.purpose = data.purpose;
      }
      if (data.start_time) {
        // ✅ Date 객체인 경우 ISO 문자열로 변환
        updateData.start_time = data.start_time instanceof Date 
          ? data.start_time.toISOString() 
          : data.start_time;
      }
      if (data.end_time) {
        // ✅ Date 객체인 경우 ISO 문자열로 변환
        updateData.end_time = data.end_time instanceof Date 
          ? data.end_time.toISOString() 
          : data.end_time;
      }

      // RPC 함수 호출로 변경 - 시간 변경만 지원하는 함수 사용
      const { data: result, error } = await supabase.rpc('update_reservation', {
        p_reservation_id: id,
        p_new_start_time: updateData.start_time || null,
        p_new_end_time: updateData.end_time || null
      });

      if (error) throw error;
      if (!result || result.length === 0) throw new Error('예약을 수정하고 데이터를 가져오는 데 실패했습니다.');

      // RPC 함수는 TABLE을 반환하므로 첫 번째 요소를 가져옴
      return result[0] as Reservation;
    } catch (error) {
      logger.error('예약 수정 실패', { error });
      // RPC 함수가 던지는 명확한 에러 메시지를 그대로 전달
      throw error;
    }
  },

  async cancelReservation(supabase: SupabaseClient<Database>, id: string, reason?: string): Promise<void> {
    try {
      // RPC 함수 호출로 변경
      const { data: result, error } = await supabase.rpc('cancel_reservation', {
        p_reservation_id: id,
        p_reason: reason || null
      });

      if (error) throw error;
      if (!result || result.length === 0) {
        logger.warn('취소할 예약을 찾지 못했습니다.', { id });
      }
    } catch (error) {
      logger.error('예약 취소 실패', { error });
      // RPC 함수가 던지는 명확한 에러 메시지를 그대로 전달
      throw error;
    }
  },

  // ... (delete, checkConflict 등 나머지 함수는 이전과 동일)

  async getReservationById(supabase: SupabaseClient<Database>, id: string): Promise<Reservation | null> {
    try {
      // 단일 예약 조회를 위해 RPC 함수 사용 (필터링으로 특정 ID만 조회)
      const { data, error } = await supabase.rpc('get_reservations_for_period', {
        start_date: null,
        end_date: null
      });

      if (error) {
        logger.warn('ID로 예약 조회 실패 (결과 없음 가능)', { id, error });
        return null;
      }

      // 결과에서 해당 ID의 예약만 필터링
      const reservation = (data || []).find((r: any) => r.id === id);
      return reservation ? (reservation as Reservation) : null;
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
   * 통합 RPC 함수를 사용하여 클라이언트 사이드에서 필터링합니다.
   */
  async getMyReservationsOptimized(supabase: SupabaseClient<Database>, userId: string): Promise<ReservationWithDetails[]> {
    if (!userId) {
      logger.warn('사용자 ID가 없어 최적화된 예약 조회를 할 수 없습니다');
      return [];
    }

    try {
      // ✅ [레거시 RPC 함수 대체] get_reservations_for_period 통합 함수 사용
      const { data, error } = await supabase.rpc('get_reservations_for_period', {
        start_date: null, // 전체 기간 조회
        end_date: null
      });

      if (error) {
        logger.error('get_reservations_for_period RPC failed', error);
        throw new Error(`내 예약 조회 실패: ${error.message}`);
      }

      // ✅ [클라이언트 사이드 필터링] is_mine === true인 예약들만 필터링
      const myReservations = (data || []).filter((reservation: any) => reservation.is_mine === true);
      
      logger.info('Successfully fetched my reservations via unified RPC', {
        totalReservations: data?.length || 0,
        myReservations: myReservations.length
      });

      return myReservations as ReservationWithDetails[];
    } catch (error) {
      logger.error('내 예약 목록 조회 실패', { error });
      throw new Error('내 예약 목록을 불러오는데 실패했습니다.');
    }
  },


};