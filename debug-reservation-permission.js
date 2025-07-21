// 브라우저 콘솔에서 실행할 디버깅 코드
// 개발자 도구 콘솔에 붙여넣어서 실행하세요

async function debugReservationPermission() {
  console.log('=== 예약 권한 디버깅 ===');
  
  try {
    // Supabase 클라이언트 가져오기 (브라우저 환경)
    const { createClient } = await import('/node_modules/@supabase/supabase-js/dist/module/index.js');
    
    const supabase = createClient(
      'https://bwbdrcsgyumpzvdcwbga.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3YmRyY3NneXVtcHp2ZGN3YmdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMzcyOTIsImV4cCI6MjA2ODYxMzI5Mn0.j6Y93MF30tPiIKGmkwh4lliw11kwLpswQtwQyvlCM90'
    );

    // 1. 현재 세션 확인
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('1. 세션 상태:', {
      hasSession: !!session,
      userId: session?.user?.id,
      email: session?.user?.email,
      sessionError: sessionError?.message
    });

    if (!session?.user) {
      console.log('❌ 로그인되지 않았습니다.');
      return;
    }

    const currentUserId = session.user.id;
    console.log('현재 사용자 UUID:', currentUserId);

    // 2. users 테이블에서 현재 사용자 정보 확인
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('id, auth_id, email, name, department, role')
      .eq('auth_id', currentUserId)
      .single();

    console.log('2. 현재 사용자 DB 정보:', {
      dbId: currentUser?.id,
      authId: currentUser?.auth_id,
      email: currentUser?.email,
      name: currentUser?.name,
      userError: userError?.message
    });

    // 3. 문제의 예약 정보 확인
    const reservationId = 'fe419c2d-0704-4123-b6d3-d317b5a196e9';
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('id, user_id, title, status, start_time, end_time')
      .eq('id', reservationId)
      .single();

    console.log('3. 예약 정보:', {
      id: reservation?.id,
      userId: reservation?.user_id,
      title: reservation?.title,
      status: reservation?.status,
      reservationError: reservationError?.message
    });

    // 4. 예약 소유자 정보 확인
    if (reservation?.user_id) {
      const { data: reservationOwner, error: ownerError } = await supabase
        .from('users')
        .select('id, auth_id, email, name')
        .eq('id', reservation.user_id)
        .single();

      console.log('4. 예약 소유자 정보:', {
        dbId: reservationOwner?.id,
        authId: reservationOwner?.auth_id,
        email: reservationOwner?.email,
        name: reservationOwner?.name,
        ownerError: ownerError?.message
      });

      // 5. 권한 매칭 확인
      console.log('5. 권한 매칭 분석:', {
        currentUserAuthId: currentUserId,
        reservationOwnerAuthId: reservationOwner?.auth_id,
        currentUserDbId: currentUser?.id,
        reservationUserId: reservation.user_id,
        authIdMatch: currentUserId === reservationOwner?.auth_id,
        dbIdMatch: currentUser?.id === reservation.user_id,
        canUpdate: currentUserId === reservationOwner?.auth_id && currentUser?.id === reservation.user_id
      });
    }

    // 6. RLS 정책 직접 테스트
    console.log('6. RLS 정책 테스트...');
    
    // 먼저 SELECT 권한 테스트
    const { data: selectTest, error: selectError } = await supabase
      .from('reservations')
      .select('id, user_id, status')
      .eq('id', reservationId);

    console.log('6-1. SELECT 권한 테스트:', {
      canSelect: !!selectTest && selectTest.length > 0,
      selectError: selectError?.message
    });

    // UPDATE 권한 테스트 (실제로 변경하지 않고 테스트)
    const { data: updateTest, error: updateError } = await supabase
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', reservationId)
      .select('id');

    console.log('6-2. UPDATE 권한 테스트:', {
      canUpdate: !!updateTest && updateTest.length > 0,
      updateError: updateError?.message,
      errorCode: updateError?.code,
      errorDetails: updateError?.details,
      errorHint: updateError?.hint
    });

    // 7. auth.uid() 함수 직접 테스트
    const { data: authUidTest, error: authUidError } = await supabase
      .rpc('auth.uid');

    console.log('7. auth.uid() 테스트:', {
      authUid: authUidTest,
      authUidError: authUidError?.message
    });

  } catch (error) {
    console.error('디버깅 중 오류:', error);
  }
}

// 실행
debugReservationPermission();