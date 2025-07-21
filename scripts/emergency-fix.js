// 긴급 수정 및 테스트 스크립트
// 사용법: node scripts/emergency-fix.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function emergencyFix() {
  console.log('🚨 예약 시스템 긴급 진단 및 수정 시작...');
  console.log('📍 Supabase URL:', supabaseUrl);
  
  try {
    // 1. 연결 테스트
    console.log('\n1️⃣ 데이터베이스 연결 테스트...');
    const { data: connTest, error: connError } = await supabase
      .from('rooms')
      .select('count(*)')
      .limit(1);
    
    if (connError) {
      console.error('❌ 데이터베이스 연결 실패:', connError.message);
      return;
    }
    console.log('✅ 데이터베이스 연결 성공');
    
    // 2. 테이블 존재 확인
    console.log('\n2️⃣ 필수 테이블 확인...');
    const tables = ['rooms', 'users', 'reservations'];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table).select('count(*)').limit(1);
        if (error) {
          console.error(`❌ ${table} 테이블 접근 실패:`, error.message);
        } else {
          console.log(`✅ ${table} 테이블 접근 성공`);
        }
      } catch (err) {
        console.error(`❌ ${table} 테이블 오류:`, err.message);
      }
    }
    
    // 3. 기본 데이터 확인
    console.log('\n3️⃣ 기본 데이터 확인...');
    
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('*');
    
    console.log(`📋 회의실 수: ${rooms?.length || 0}`);
    if (roomsError) {
      console.error('❌ 회의실 조회 오류:', roomsError.message);
    }
    
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*');
    
    console.log(`👥 사용자 수: ${users?.length || 0}`);
    if (usersError) {
      console.error('❌ 사용자 조회 오류:', usersError.message);
    }
    
    // 4. 예약 데이터 확인 (공개 예약 API와 동일한 쿼리)
    console.log('\n4️⃣ 예약 데이터 확인 (API와 동일한 쿼리)...');
    
    const today = new Date().toISOString().split('T')[0];
    const startDate = `${today}T00:00:00.000Z`;
    const endDate = `${today}T23:59:59.999Z`;
    
    console.log('📅 조회 날짜 범위:', { startDate, endDate });
    
    const { data: reservations, error: reservationsError } = await supabase
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
      .gte('start_time', startDate)
      .lte('end_time', endDate)
      .order('start_time', { ascending: true });
    
    if (reservationsError) {
      console.error('❌ 예약 조회 실패:', reservationsError.message);
      console.error('상세 오류:', reservationsError);
    } else {
      console.log(`📊 오늘 예약 수: ${reservations?.length || 0}`);
      if (reservations && reservations.length > 0) {
        console.log('📝 첫 번째 예약 예시:');
        console.log(JSON.stringify(reservations[0], null, 2));
      }
    }
    
    // 5. 테스트 데이터 생성 (데이터가 없는 경우)
    if ((!reservations || reservations.length === 0) && 
        users && users.length > 0 && 
        rooms && rooms.length > 0) {
      
      console.log('\n5️⃣ 테스트 예약 생성...');
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      
      const endTime = new Date(tomorrow);
      endTime.setHours(11, 0, 0, 0);
      
      const { data: newReservation, error: insertError } = await supabase
        .from('reservations')
        .insert({
          room_id: rooms[0].id,
          user_id: users[0].id,
          title: '테스트 회의',
          purpose: 'API 테스트용 더미 데이터',
          start_time: tomorrow.toISOString(),
          end_time: endTime.toISOString(),
          status: 'confirmed'
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('❌ 테스트 예약 생성 실패:', insertError.message);
      } else {
        console.log('✅ 테스트 예약 생성 성공');
        console.log('📝 생성된 예약:', newReservation);
      }
    }
    
    console.log('\n🎉 진단 완료!');
    console.log('\n📋 다음 단계:');
    console.log('1. npm run dev로 개발 서버 시작');
    console.log('2. 브라우저에서 /reservations/status 페이지 접속');
    console.log('3. 개발자 도구에서 Network 탭 확인');
    console.log('4. 문제가 지속되면 오류 메시지와 함께 문의');
    
  } catch (error) {
    console.error('💥 긴급 수정 중 치명적 오류:', error);
  }
}

if (require.main === module) {
  emergencyFix();
}

module.exports = { emergencyFix };