// src/lib/subscriptions/realtimeManager.ts
// ✅ Phase 2: 실시간 구독 로직을 별도 모듈로 분리

'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { QueryClient } from '@tanstack/react-query';
import type { PublicReservation } from '@/types/database';
import { logger } from '@/lib/utils/logger';

export class RealtimeSubscriptionManager {
  private static instance: RealtimeSubscriptionManager;
  private activeChannels: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): RealtimeSubscriptionManager {
    if (!RealtimeSubscriptionManager.instance) {
      RealtimeSubscriptionManager.instance = new RealtimeSubscriptionManager();
    }
    return RealtimeSubscriptionManager.instance;
  }

  /**
   * ✅ Phase 2: 공개 예약 실시간 구독 설정
   * 훅에서 분리된 복잡한 실시간 구독 로직을 관리
   */
  subscribeToPublicReservations(
    supabase: SupabaseClient,
    queryClient: QueryClient,
    queryKey: readonly unknown[],
    startDate: string,
    endDate: string,
    currentUserId?: string
  ): () => void {
    const channelName = `public-reservations-${startDate}-${endDate}`;
    
    // 이미 구독 중인 채널이 있다면 제거
    if (this.activeChannels.has(channelName)) {
      this.unsubscribe(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          // 서버사이드 필터: 현재 조회 중인 날짜 범위만 수신
          filter: `start_time.gte.${startDate}T00:00:00Z,start_time.lt.${endDate}T23:59:59Z`
        },
        async (payload) => {
          logger.info('Realtime event received', { 
            event: payload.eventType, 
            table: payload.table,
            channelName 
          });
          
          // 현재 캐시 데이터 가져오기
          const currentData = queryClient.getQueryData<PublicReservation[]>(queryKey);
          if (!currentData) return;

          // 이벤트 타입별 캐시 업데이트
          let updatedData: PublicReservation[] = [...currentData];

          switch (payload.eventType) {
            case 'INSERT': {
              if (payload.new) {
                const newReservation = await this.transformToPublicReservation(
                  payload.new, 
                  currentUserId, 
                  supabase
                );
                if (newReservation && this.isWithinDateRange(newReservation, startDate, endDate)) {
                  updatedData.push(newReservation);
                }
              }
              break;
            }
            case 'UPDATE': {
              if (payload.new) {
                const updatedReservation = await this.transformToPublicReservation(
                  payload.new, 
                  currentUserId, 
                  supabase
                );
                if (updatedReservation && this.isWithinDateRange(updatedReservation, startDate, endDate)) {
                  const index = updatedData.findIndex(item => item.id === updatedReservation.id);
                  if (index !== -1) {
                    updatedData[index] = updatedReservation;
                  } else {
                    // 업데이트로 인해 날짜 범위에 새로 포함된 경우
                    updatedData.push(updatedReservation);
                  }
                } else {
                  // 업데이트로 인해 날짜 범위를 벗어난 경우 제거
                  updatedData = updatedData.filter(item => item.id !== payload.new.id);
                }
              }
              break;
            }
            case 'DELETE': {
              if (payload.old) {
                updatedData = updatedData.filter(item => item.id !== payload.old.id);
              }
              break;
            }
          }

          // 캐시 수동 업데이트
          queryClient.setQueryData(queryKey, updatedData);
        }
      )
      .subscribe();

    // 활성 채널 맵에 저장
    this.activeChannels.set(channelName, channel);

    // 클린업 함수 반환
    return () => {
      this.unsubscribe(channelName);
    };
  }

  /**
   * 특정 채널 구독 해제
   */
  private unsubscribe(channelName: string): void {
    const channel = this.activeChannels.get(channelName);
    if (channel) {
      channel.unsubscribe();
      this.activeChannels.delete(channelName);
      logger.debug('Realtime channel unsubscribed', { channelName });
    }
  }

  /**
   * 모든 활성 채널 구독 해제
   */
  unsubscribeAll(): void {
    for (const [channelName] of this.activeChannels) {
      this.unsubscribe(channelName);
    }
  }

  /**
   * Database Row를 PublicReservation으로 변환하는 헬퍼 함수
   */
  private async transformToPublicReservation(
    dbRow: any, 
    currentUserId?: string, 
    supabase?: any
  ): Promise<PublicReservation | null> {
    if (!dbRow || dbRow.status === 'cancelled') return null;

    // ✅ room_name이 없는 경우 rooms 테이블에서 조회
    let roomName = dbRow.room_name;
    if (!roomName && supabase && dbRow.room_id) {
      try {
        const { data: roomData } = await supabase
          .from('rooms')
          .select('name')
          .eq('id', dbRow.room_id)
          .single();
        roomName = roomData?.name || 'Unknown Room';
      } catch (error) {
        logger.warn('Room name 조회 실패', { roomId: dbRow.room_id, error });
        roomName = 'Unknown Room';
      }
    }

    // 데이터 마스킹 적용
    const isOwner = currentUserId === dbRow.user_id;
    
    return {
      id: dbRow.id,
      room_id: dbRow.room_id,
      user_id: dbRow.user_id,
      title: isOwner ? dbRow.title : (dbRow.department || 'Booked'),
      purpose: isOwner ? dbRow.purpose : null,
      start_time: dbRow.start_time,
      end_time: dbRow.end_time,
      department: dbRow.department || '미지정',
      user_name: isOwner ? (dbRow.user_name || '알 수 없음') : 'Anonymous',
      room_name: roomName || 'Unknown Room',
      is_mine: isOwner
    };
  }

  /**
   * 예약이 지정된 날짜 범위 내에 있는지 확인하는 헬퍼 함수
   */
  private isWithinDateRange(reservation: PublicReservation, startDate: string, endDate: string): boolean {
    const reservationStart = new Date(reservation.start_time);
    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate + 'T23:59:59Z');
    
    return reservationStart >= rangeStart && reservationStart <= rangeEnd;
  }
}

export const realtimeManager = RealtimeSubscriptionManager.getInstance();