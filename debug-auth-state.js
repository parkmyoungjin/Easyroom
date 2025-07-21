// 현재 사용자 인증 상태와 예약 권한을 확인하는 디버깅 스크립트
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bwbdrcsgyumpzvdcwbga.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3YmRyY3NneXVtcHp2ZGN3YmdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMzcyOTIsImV4cCI6MjA2ODYxMzI5Mn0.j6Y93MF30tPiIKGmkwh4lliw11kwLpswQtwQyvlCM90';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugAuthState() {
  console.log('=== 인증 상태 디버깅 ===');
  
  try {
    // 1. 현재 세션 확인
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('1. 세션 상태:', {
      hasSession: !!session,
      userId: session?.user?.id,
      email: session?.user?.email,
      sessionError: sessionError?.message
    });

    if (!session) {
      console.log('❌ 세션이 없습니다. 로그인이 필요합니다.');
      return;
    }

    // 2. 현재 사용자 정보 확인
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('2. 사용자 정보:', {
      userId: user?.id,
      email: user?.email,
      emailConfirmed: user?.email_confirmed_at,
      userError: userError?.message
    });

    // 3. users 테이블에서 사용자 정보 확인
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('id, auth_id, email, name, department, role')
      .eq('auth_id', user.id)
      .single();

    console.log('3. 데이터베이스 사용자 정보:', {
      dbUserId: userData?.id,
      authId: userData?.auth_id,
      email: userData?.email,
      name: userData?.name,
      department: userData?.department,
      role: userData?.role,
      userDataError: userDataError?.message
    });

    // 4. 특정 예약 정보 확인
    const reservationId = 'fe419c2d-0704-4123-b6d3-d317b5a196e9';
    const { data: reservationData, error: reservationError } = await supabase
      .from('reservations')
      .select('id, user_id, title, status, start_time, end_time')
      .eq('id', reservationId)
      .single();

    console.log('4. 예약 정보:', {
      reservationId: reservationData?.id,
      reservationUserId: reservationData?.user_id,
      title: reservationData?.title,
      status: reservationData?.status,
      startTime: reservationData?.start_time,
      endTime: reservationData?.end_time,
      reservationError: reservationError?.message
    });

    // 5. 권한 매칭 확인
    if (userData && reservationData) {
      const isOwner = userData.id === reservationData.user_id;
      console.log('5. 권한 매칭:', {
        currentUserDbId: userData.id,
        reservationUserId: reservationData.user_id,
        isOwner: isOwner,
        canCancel: isOwner && reservationData.status === 'confirmed'
      });
    }

    // 6. RLS 정책 테스트 - 예약 업데이트 시도
    console.log('6. RLS 정책 테스트 시작...');
    const { data: updateTest, error: updateError } = await supabase
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', reservationId)
      .select('id');

    console.log('6. RLS 정책 테스트 결과:', {
      updateSuccess: !!updateTest,
      updatedCount: updateTest?.length || 0,
      updateError: updateError?.message,
      errorCode: updateError?.code,
      errorDetails: updateError?.details
    });

  } catch (error) {
    console.error('디버깅 중 오류 발생:', error);
  }
}

debugAuthState();