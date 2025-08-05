"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSupabaseClient } from "@/contexts/SupabaseProvider";
import { useAuth } from "@/hooks/useAuth";
import { reservationKeys } from "@/lib/queryKeys";
import type { PublicReservation } from "@/types/database";

/**
 * 통합 예약 실시간 구독 훅
 * 지정된 날짜 범위의 예약 변경사항을 실시간으로 감지하고 캐시를 정밀 업데이트합니다.
 * 
 * @param startDate - 시작 날짜 (yyyy-MM-dd)
 * @param endDate - 종료 날짜 (yyyy-MM-dd)
 * @param isAuthenticated - 인증 상태 (캐시 키 생성용)
 * 
 * @example
 * // 대시보드에서 오늘 하루만 구독
 * useReservationsRealtime(today, today, !!user);
 * 
 * // 주간 캘린더에서 일주일 구독
 * useReservationsRealtime(weekStart, weekEnd, !!user);
 */
export function useReservationsRealtime(startDate: string, endDate: string, isAuthenticated: boolean) {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const periodicSyncRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectedRef = useRef(false);

  useEffect(() => {
    if (!supabase || !startDate || !endDate) return;

    let channel: any;
    let mounted = true;

    const initializeRealtimeSubscription = async () => {
      try {
        console.log(`[ReservationsRealtime] Initializing subscription for range: ${startDate} ~ ${endDate}`);
        
        // 동적 채널명으로 날짜 범위별 구독
        const channelName = `reservations-${startDate}-${endDate}`;
        
        channel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'reservations',
              // 🎯 핵심: 서버사이드 필터링으로 지정된 날짜 범위만 수신
              filter: `start_time.gte.${startDate}T00:00:00Z,start_time.lt.${endDate}T23:59:59Z`
            },
            async (payload) => {
              if (!mounted) return;
              
              console.log(`[ReservationsRealtime] Event received:`, {
                event: payload.eventType,
                table: payload.table,
                dateRange: `${startDate} ~ ${endDate}`,
                timestamp: new Date().toISOString()
              });

              // 현재 캐시 데이터 가져오기
              const queryKey = reservationKeys.public(startDate, endDate, isAuthenticated);
              const currentData = queryClient.getQueryData<PublicReservation[]>(queryKey);
              
              if (!currentData) {
                console.log('[ReservationsRealtime] No cache data found, skipping manual update');
                return;
              }

              // 🚀 수동 캐시 업데이트 로직
              let updatedData = [...currentData];

              switch (payload.eventType) {
                case 'INSERT': {
                  if (payload.new) {
                    const newReservation = transformToPublicReservation(payload.new, user?.id);
                    if (newReservation && isWithinDateRange(newReservation, startDate, endDate)) {
                      updatedData.push(newReservation);
                      console.log('[ReservationsRealtime] Added new reservation to cache:', newReservation.id);
                    }
                  }
                  break;
                }
                case 'UPDATE': {
                  if (payload.new) {
                    const updatedReservation = transformToPublicReservation(payload.new, user?.id);
                    if (updatedReservation && isWithinDateRange(updatedReservation, startDate, endDate)) {
                      const index = updatedData.findIndex(item => item.id === updatedReservation.id);
                      if (index !== -1) {
                        updatedData[index] = updatedReservation;
                        console.log('[ReservationsRealtime] Updated reservation in cache:', updatedReservation.id);
                      } else {
                        // 업데이트로 인해 날짜 범위에 새로 포함된 경우
                        updatedData.push(updatedReservation);
                        console.log('[ReservationsRealtime] Added updated reservation to cache:', updatedReservation.id);
                      }
                    } else {
                      // 업데이트로 인해 날짜 범위를 벗어난 경우 제거
                      updatedData = updatedData.filter(item => item.id !== payload.new.id);
                      console.log('[ReservationsRealtime] Removed out-of-range reservation from cache:', payload.new.id);
                    }
                  }
                  break;
                }
                case 'DELETE': {
                  if (payload.old) {
                    updatedData = updatedData.filter(item => item.id !== payload.old.id);
                    console.log('[ReservationsRealtime] Removed deleted reservation from cache:', payload.old.id);
                  }
                  break;
                }
              }

              // 캐시 수동 업데이트
              queryClient.setQueryData(queryKey, updatedData);
            }
          )
          .subscribe((status, err) => {
            if (!mounted) return;

            console.log(`[ReservationsRealtime] Subscription status:`, { status, error: err });

            if (status === 'SUBSCRIBED') {
              isConnectedRef.current = true;
              console.log('[ReservationsRealtime] Connected successfully');
              
              // 실시간 연결 성공 시 폴링 중단
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
                console.log('[ReservationsRealtime] Stopped polling fallback');
              }
            }
            
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              isConnectedRef.current = false;
              console.warn('[ReservationsRealtime] Connection failed, starting polling fallback');
              startFastPolling();
            }
            
            if (status === 'CLOSED') {
              isConnectedRef.current = false;
              console.warn('[ReservationsRealtime] Connection closed, starting polling fallback');
              startFastPolling();
            }
          });

      } catch (error) {
        console.error('[ReservationsRealtime] Failed to initialize subscription:', error);
        startFastPolling();
      }
    };

    // 🔄 빠른 폴링 백업 시스템 (15초 간격)
    const startFastPolling = () => {
      if (pollingIntervalRef.current) return; // 이미 폴링 중
      
      console.log('[ReservationsRealtime] Starting fast polling fallback (15s interval)');
      pollingIntervalRef.current = setInterval(() => {
        if (!isConnectedRef.current && mounted) {
          const queryKey = reservationKeys.public(startDate, endDate, isAuthenticated);
          queryClient.invalidateQueries({ queryKey });
          console.log('[ReservationsRealtime] Polling fallback: invalidated queries');
        }
      }, 15000); // 15초 간격
    };

    // 🕐 주기적 동기화 안전장치 (15분 간격)
    const startPeriodicSync = () => {
      console.log('[ReservationsRealtime] Starting periodic sync (15min interval)');
      periodicSyncRef.current = setInterval(() => {
        if (mounted) {
          const queryKey = reservationKeys.public(startDate, endDate, isAuthenticated);
          queryClient.invalidateQueries({ queryKey });
          console.log('[ReservationsRealtime] Periodic sync: 15분 주기 데이터 동기화 실행');
        }
      }, 15 * 60 * 1000); // 15분
    };

    // 구독 및 안전장치 시작
    initializeRealtimeSubscription();
    startPeriodicSync();

    // 5초 후 연결되지 않으면 폴링 시작
    const fallbackTimer = setTimeout(() => {
      if (!isConnectedRef.current) {
        console.log('[ReservationsRealtime] Not connected after 5s, starting polling');
        startFastPolling();
      }
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(fallbackTimer);
      
      // 폴링 정리
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      // 주기적 동기화 정리
      if (periodicSyncRef.current) {
        clearInterval(periodicSyncRef.current);
        periodicSyncRef.current = null;
      }
      
      // 채널 정리
      if (channel && supabase) {
        supabase.removeChannel(channel);
        console.log('[ReservationsRealtime] Cleaned up subscription');
      }
      
      isConnectedRef.current = false;
    };
  }, [queryClient, supabase, startDate, endDate, isAuthenticated, user]);
}

/**
 * Database Row를 PublicReservation으로 변환하는 헬퍼 함수
 * 데이터 정합성을 위해 마스킹 정책을 정확하게 적용합니다.
 */
function transformToPublicReservation(dbRow: any, currentUserId?: string): PublicReservation | null {
  if (!dbRow || dbRow.status === 'cancelled') return null;

  const isOwner = currentUserId === dbRow.user_id;
  
  return {
    id: dbRow.id,
    room_id: dbRow.room_id,
    user_id: dbRow.user_id,
    title: isOwner ? dbRow.title : (dbRow.department || '예약됨'),
    purpose: isOwner ? dbRow.purpose : null,
    department: dbRow.department || '미지정',
    user_name: dbRow.user_name || '알 수 없음',
    room_name: dbRow.room_name || 'Unknown Room', // ✅ room_name 추가
    start_time: dbRow.start_time,
    end_time: dbRow.end_time,
    is_mine: isOwner
  };
}

/**
 * 예약이 지정된 날짜 범위 내에 있는지 확인하는 헬퍼 함수
 */
function isWithinDateRange(reservation: PublicReservation, startDate: string, endDate: string): boolean {
  try {
    const reservationStart = new Date(reservation.start_time);
    const reservationDate = reservationStart.toISOString().split('T')[0];
    
    return reservationDate >= startDate && reservationDate <= endDate;
  } catch (error) {
    console.error('Error checking date range:', error);
    return false;
  }
}