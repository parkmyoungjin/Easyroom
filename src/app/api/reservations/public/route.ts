'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { normalizeDateForQuery } from '@/lib/utils/date';
import type { PublicReservation } from '@/types/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    console.log('공개 예약 API 호출:', { startDate, endDate });

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate와 endDate가 필요합니다' },
        { status: 400 }
      );
    }

    // ✅ 선택적 인증: 인증된 사용자와 비인증 사용자 모두 지원
    // 공개 API이므로 관리자 클라이언트 사용 (RLS 우회)
    const supabase = await createAdminClient();
    
    // 인증 상태 확인을 위한 일반 클라이언트도 생성
    const userSupabase = await createClient();
    
    // 사용자 인증 상태 확인 (실패해도 계속 진행)
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    
    // 인증 실패는 로그만 남기고 계속 진행 (공개 API이므로)
    if (authError) {
      console.log('인증되지 않은 사용자의 공개 예약 조회:', authError.message);
    }
    
    const isAuthenticated = !authError && !!user;
    console.log('사용자 인증 상태:', { 
      isAuthenticated, 
      userId: user?.id || 'anonymous' 
    });

    // 날짜 범위 정규화
    let normalizedStartDate: string;
    let normalizedEndDate: string;

    try {
      normalizedStartDate = normalizeDateForQuery(startDate, false);
      normalizedEndDate = normalizeDateForQuery(endDate, true);
      console.log('정규화된 날짜:', { normalizedStartDate, normalizedEndDate });
    } catch (error) {
      console.error('날짜 정규화 실패:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : '날짜 형식이 올바르지 않습니다' },
        { status: 400 }
      );
    }
    
    // ✅ RPC 함수 사용 (데이터베이스에 이미 구현되어 있음)
    try {
      const { data, error } = await supabase.rpc(
        'get_public_reservations',
        {
          start_date: normalizedStartDate,
          end_date: normalizedEndDate
        }
      );
      
      if (error) {
        console.error('RPC 함수 호출 실패:', error);
        throw error;
      }

      console.log('RPC로 조회된 예약 데이터:', { count: data?.length || 0 });

      // RPC 함수에서 이미 is_mine이 설정되어 반환됨
      return NextResponse.json({ 
        data: data || [],
        message: `${data?.length || 0}개의 예약을 조회했습니다.`
      });

    } catch (rpcError) {
      console.warn('RPC 함수를 사용할 수 없습니다. 직접 쿼리를 시도합니다:', rpcError);
      
      // ✅ RPC 함수가 없다면 직접 쿼리 실행 (fallback)
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id,
          room_id,
          user_id,
          title,
          purpose,
          start_time,
          end_time,
          user:users!inner(department, name),
          room:rooms!inner(name)
        `)
        .eq('status', 'confirmed')
        .gte('start_time', normalizedStartDate)
        .lte('end_time', normalizedEndDate)
        .order('start_time', { ascending: true });

      if (error) {
        console.error('직접 쿼리 실패:', error);
        return NextResponse.json(
          { error: '예약 현황을 불러오는데 실패했습니다' },
          { status: 500 }
        );
      }

      console.log('직접 쿼리로 조회된 예약 데이터:', { count: data?.length || 0 });

      // ✅ 현재 사용자의 데이터베이스 ID를 찾기 위해 users 테이블 조회 (인증된 경우만)
      let currentUser = null;
      if (isAuthenticated && user) {
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', user.id) // 스키마에 맞게 auth_id 사용
          .single();
        currentUser = userData;
      }
      
      // PublicReservation 형태로 변환 (인증 상태에 따라 정보 마스킹)
      const publicReservations: PublicReservation[] = (data || []).map((reservation: any) => ({
        id: reservation.id,
        room_id: reservation.room_id,
        user_id: reservation.user_id,
        title: isAuthenticated && currentUser && reservation.user_id === currentUser.id 
          ? reservation.title 
          : 'Booked', // 비인증 사용자나 다른 사용자의 예약은 마스킹
        purpose: isAuthenticated && currentUser && reservation.user_id === currentUser.id 
          ? reservation.purpose 
          : null, // 자신의 예약만 목적 표시
        start_time: reservation.start_time,
        end_time: reservation.end_time,
        department: reservation.user?.department || '',
        user_name: reservation.user?.name || '',
        is_mine: currentUser ? reservation.user_id === currentUser.id : false
      }));

      return NextResponse.json({ 
        data: publicReservations,
        message: `${publicReservations.length}개의 예약을 조회했습니다.`
      });
    }

  } catch (error) {
    console.error('공개 예약 목록 조회 중 치명적 오류:', error);
    return NextResponse.json(
      { 
        error: '서버 오류가 발생했습니다',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}