'use client';

import { createClient } from '@/lib/supabase/client';
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

export const reservationService = {
  async createReservation(data: ReservationInsert): Promise<Reservation> {
    try {
      // Validate and sanitize reservation data with strict user ID validation
      const validatedData = await UserIdGuards.validateReservationData(data);
      
      logger.debug('Creating reservation with validated data', {
        originalUserId: data.user_id,
        validatedUserId: validatedData.user_id,
        title: validatedData.title
      });

      const supabase = await createClient();
      const { data: result, error } = await supabase
        .from('reservations')
        .insert(validatedData)
        .select(`
          *,
          room:rooms!inner(*)
        `);

      if (error) {
        logger.error('예약 생성 실패', error);
        throw new Error('예약 생성에 실패했습니다.');
      }

      // 첫 번째 결과 반환 (ID로 조회했으므로 하나만 있어야 함)
      if (!result || result.length === 0) {
        throw new Error('예약을 찾을 수 없습니다.');
      }

      logger.info('Reservation created successfully with validated user_id', {
        reservationId: result[0].id,
        userId: validatedData.user_id
      });
      return result[0] as Reservation;
    } catch (error) {
      logger.error('예약 생성 중 오류 발생', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  },

  async getReservations(startDate?: string, endDate?: string): Promise<PublicReservation[]> {
    try {
      const supabase = await createClient();
      let query = supabase
        .from('reservations')
        .select(`
          id,
          room_id,
          user_id,
          title,
          purpose,
          start_time,
          end_time,
          status,
          user:users!inner(department, name),
          room:rooms!inner(name)
        `)
        .eq('status', 'confirmed')
        .order('start_time', { ascending: true });

      if (startDate && endDate) {
        // 날짜 범위 정규화를 통한 정확한 쿼리
        const normalizedStartDate = normalizeDateForQuery(startDate, false);
        const normalizedEndDate = normalizeDateForQuery(endDate, true);
        
        query = query
          .gte('start_time', normalizedStartDate)  // 예약 시작시간이 범위 시작 이후
          .lte('end_time', normalizedEndDate);     // 예약 종료시간이 범위 끝 이전
      }

      const { data, error } = await query;

      if (error) {
        logger.error('예약 목록 조회 실패', error);
        throw new Error('예약 목록을 불러오는데 실패했습니다.');
      }

      // PublicReservation 형태로 변환
      const publicReservations: PublicReservation[] = (data || []).map((reservation: any) => ({
        id: reservation.id,
        room_id: reservation.room_id,
        user_id: reservation.user_id,
        title: reservation.title,
        purpose: reservation.purpose,
        start_time: reservation.start_time,
        end_time: reservation.end_time,
        department: reservation.user?.department || '',
        user_name: reservation.user?.name || '', // 예약자 이름 추가
        is_mine: false // 클라이언트에서 설정됨
      }));

      return publicReservations;
    } catch (error) {
      logger.error('예약 목록 조회 중 오류 발생', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  },

  // ✅ 추가: 상세 정보가 포함된 예약 목록 (관리자용)
  async getReservationsWithDetails(startDate?: string, endDate?: string): Promise<Reservation[]> {
    try {
      const supabase = await createClient();
      let query = supabase
        .from('reservations')
        .select(`
          *,
          user:users!inner(*),
          room:rooms!inner(*)
        `)
        .order('start_time', { ascending: true });

      if (startDate && endDate) {
        // 날짜 범위 정규화를 통한 정확한 쿼리
        const normalizedStartDate = normalizeDateForQuery(startDate, false);
        const normalizedEndDate = normalizeDateForQuery(endDate, true);
        
        query = query
          .gte('start_time', normalizedStartDate)  // 예약 시작시간이 범위 시작 이후
          .lte('end_time', normalizedEndDate);     // 예약 종료시간이 범위 끝 이전
      }

      const { data, error } = await query;

      if (error) {
        logger.error('상세 예약 목록 조회 실패', error);
        throw new Error('예약 목록을 불러오는데 실패했습니다.');
      }

      return data as Reservation[];
    } catch (error) {
      logger.error('상세 예약 목록 조회 중 오류 발생', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  },

  // ✅ 추가: 모든 예약 조회 (관리자용)
  async getAllReservations(): Promise<Reservation[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          user:users!inner(*),
          room:rooms!inner(*)
        `)
        .order('start_time', { ascending: false });

      if (error) {
        logger.error('전체 예약 목록 조회 실패', error);
        throw new Error('전체 예약 목록을 불러오는데 실패했습니다.');
      }

      return data as Reservation[];
    } catch (error) {
      logger.error('전체 예약 목록 조회 중 오류 발생', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  },

  async updateReservation(id: string, data: ReservationUpdate): Promise<Reservation> {
    try {
      logger.debug('예약 수정 API 호출 시작', { reservationId: id, updateData: data });

      // Validate and sanitize update data with strict user ID validation
      const validatedData = await UserIdGuards.validateReservationUpdateData(data);
      
      logger.debug('Updating reservation with validated data', {
        reservationId: id,
        originalData: data,
        validatedData
      });

      const supabase = await createClient();
      const { data: reservation, error } = await supabase
        .from('reservations')
        .update(validatedData)
        .eq('id', id)
        .select(`
          *,
          room:rooms!inner(*)
        `)
        .single();

      if (error) {
        logger.error('예약 수정 실패', {
          reservationId: id,
          error: {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
          }
        });

        // 구체적인 오류 메시지 제공
        if (error.code === 'PGRST116') {
          throw new Error('예약을 찾을 수 없습니다.');
        } else if (error.code === '42501' || error.message.includes('permission')) {
          throw new Error('예약을 수정할 권한이 없습니다.');
        } else if (error.message.includes('unique') || error.message.includes('conflict')) {
          throw new Error('선택한 시간에 다른 예약이 있습니다.');
        } else if (error.message.includes('network') || error.message.includes('connection')) {
          throw new Error('네트워크 연결을 확인하고 다시 시도해주세요.');
        } else {
          throw new Error(`예약 수정에 실패했습니다: ${error.message}`);
        }
      }

      logger.debug('예약 수정 성공', { reservationId: id });
      logger.info('Reservation updated successfully');
      return reservation as Reservation;
    } catch (error) {
      logger.error('예약 수정 중 오류 발생', {
        reservationId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  },

  async cancelReservation(id: string, reason?: string): Promise<void> {
    try {
      logger.debug('예약 취소 시작', { reservationId: id, reason });

      const supabase = await createClient();
      const { error, count } = await supabase
        .from('reservations')
        .update({ 
          status: 'cancelled',
          cancellation_reason: reason 
        })
        .eq('id', id)
        .select('id');

      if (error) {
        logger.error('예약 취소 실패', {
          reservationId: id,
          error: {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
          }
        });

        // 구체적인 오류 메시지 제공
        if (error.code === 'PGRST116') {
          throw new Error('예약을 찾을 수 없습니다.');
        } else if (error.code === '42501' || error.message.includes('permission')) {
          throw new Error('예약을 취소할 권한이 없습니다.');
        } else if (error.message.includes('network') || error.message.includes('connection')) {
          throw new Error('네트워크 연결을 확인하고 다시 시도해주세요.');
        } else {
          throw new Error(`예약 취소에 실패했습니다: ${error.message}`);
        }
      }

      if (count === 0) {
        logger.warn('예약 취소 - 업데이트된 행 없음', { reservationId: id });
        throw new Error('예약을 찾을 수 없거나 이미 취소된 예약입니다.');
      }

      logger.debug('예약 취소 성공', { reservationId: id, updatedCount: count });
      logger.info('Reservation cancelled successfully');
    } catch (error) {
      logger.error('예약 취소 중 오류 발생', {
        reservationId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  },

  async deleteReservation(id: string): Promise<void> {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', id);

      if (error) {
        logger.error('예약 삭제 실패', error);
        throw new Error('예약 삭제에 실패했습니다.');
      }

      logger.info('Reservation deleted successfully');
    } catch (error) {
      logger.error('예약 삭제 중 오류 발생', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  },

  async checkConflict(roomId: string, startTime: string, endTime: string, excludeId?: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      let query = supabase
        .from('reservations')
        .select('id')
        .eq('room_id', roomId)
        .eq('status', 'confirmed')
        .or(`start_time.lt.${endTime},end_time.gt.${startTime}`);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('예약 충돌 검사 실패', error);
        return false; // 안전하게 충돌 없음으로 처리
      }

      return data && data.length > 0;
    } catch (error) {
      logger.error('예약 충돌 검사 중 오류 발생', error instanceof Error ? error : new Error(String(error)));
      return false; // 안전하게 충돌 없음으로 처리
    }
  },

  async getReservationById(id: string): Promise<Reservation | null> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          room:rooms!inner(*),
          user:users!inner(*)
        `)
        .eq('id', id)
        .single();

      if (error) {
        logger.error('예약 상세 조회 실패', error);
        return null;
      }

      return data as Reservation;
    } catch (error) {
      logger.error('예약 상세 조회 중 오류 발생', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  },

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

      return responseData.data || [];
    } catch (error) {
      logger.error('공개 예약 목록 조회 중 오류 발생', {
        error: error instanceof Error ? error.message : 'Unknown error',
        startDate,
        endDate,
        isAuthenticated
      });
      
      // 사용자에게 더 친화적인 오류 메시지 제공
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('예약 현황을 불러오는 중 알 수 없는 오류가 발생했습니다.');
      }
    }
  },

  async getMyReservations(userId?: string): Promise<ReservationWithDetails[]> {
    // ✅ 타입 안전성 개선: userId가 없으면 빈 배열 반환
    if (!userId) {
      logger.warn('사용자 ID가 없어 내 예약을 조회할 수 없습니다');
      return [];
    }

    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          room:rooms!inner(*)
        `)
        .eq('user_id', userId)
        .order('start_time', { ascending: true });

      if (error) {
        logger.error('내 예약 목록 조회 실패', error);
        throw new Error('내 예약 목록을 불러오는데 실패했습니다.');
      }

      return data as ReservationWithDetails[];
    } catch (error) {
      logger.error('내 예약 목록 조회 중 오류 발생', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}; 