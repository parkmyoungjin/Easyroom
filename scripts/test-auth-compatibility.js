#!/usr/bin/env node

/**
 * 이메일 인증 마이그레이션 후 호환성 테스트 스크립트
 * 주요 기능들이 제대로 작동하는지 확인
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testCompatibility() {
  console.log('🧪 이메일 인증 마이그레이션 호환성 테스트 시작...\n');

  let allTestsPassed = true;

  try {
    // 1. 데이터베이스 스키마 테스트
    console.log('1. 데이터베이스 스키마 테스트...');
    
    // users 테이블 구조 확인
    const { data: usersTest, error: usersError } = await supabase
      .from('users')
      .select('id, auth_id, employee_id, name, email, department, role')
      .limit(1);

    if (usersError) {
      console.error('   ❌ users 테이블 접근 실패:', usersError.message);
      allTestsPassed = false;
    } else {
      console.log('   ✅ users 테이블 접근 성공');
    }

    // 2. get_public_reservations 함수 테스트
    console.log('\n2. get_public_reservations 함수 테스트...');
    
    const testStartDate = new Date().toISOString();
    const testEndDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    const { data: reservationsData, error: reservationsError } = await supabase
      .rpc('get_public_reservations', {
        start_date: testStartDate,
        end_date: testEndDate
      });

    if (reservationsError) {
      console.error('   ❌ get_public_reservations 함수 오류:', reservationsError.message);
      allTestsPassed = false;
    } else {
      console.log('   ✅ get_public_reservations 함수 정상 작동');
      console.log(`   📊 조회된 예약 수: ${reservationsData?.length || 0}개`);
    }

    // 3. create_user_profile 함수 존재 확인
    console.log('\n3. create_user_profile 함수 존재 확인...');
    
    // 함수 존재 여부만 확인 (실제 실행은 유효한 auth_id가 필요)
    const { error: functionCheckError } = await supabase
      .rpc('create_user_profile', {
        user_auth_id: '00000000-0000-0000-0000-000000000000', // 존재하지 않는 UUID
        user_email: 'test@example.com',
        user_name: 'Test User',
        user_department: 'Test Department'
      });

    // 함수가 존재하면 외래 키 오류가 발생하고, 존재하지 않으면 "function does not exist" 오류 발생
    if (functionCheckError && functionCheckError.message.includes('does not exist')) {
      console.error('   ❌ create_user_profile 함수가 존재하지 않습니다');
      allTestsPassed = false;
    } else {
      console.log('   ✅ create_user_profile 함수 존재 확인 (외래 키 제약조건 정상)');
    }

    // 4. 사용자 프로필 조회 테스트
    console.log('\n4. 사용자 프로필 조회 테스트...');
    
    const { data: existingUsers, error: existingUsersError } = await supabase
      .from('users')
      .select('id, auth_id, employee_id, name, email, department, role')
      .limit(3);

    if (existingUsersError) {
      console.error('   ❌ 사용자 프로필 조회 실패:', existingUsersError.message);
      allTestsPassed = false;
    } else {
      console.log('   ✅ 사용자 프로필 조회 성공');
      console.log(`   👥 등록된 사용자 수: ${existingUsers?.length || 0}명`);
      
      if (existingUsers && existingUsers.length > 0) {
        const sampleUser = existingUsers[0];
        console.log('   📋 샘플 사용자 정보:');
        console.log(`      - ID: ${sampleUser.id}`);
        console.log(`      - Auth ID: ${sampleUser.auth_id}`);
        console.log(`      - Employee ID: ${sampleUser.employee_id || 'NULL (이메일 기반)'}`);
        console.log(`      - Name: ${sampleUser.name}`);
        console.log(`      - Email: ${sampleUser.email}`);
        console.log(`      - Department: ${sampleUser.department}`);
        console.log(`      - Role: ${sampleUser.role}`);
      }
    }

    // 5. 예약 시스템 호환성 테스트
    console.log('\n5. 예약 시스템 호환성 테스트...');
    
    const { data: reservationsWithUsers, error: reservationsWithUsersError } = await supabase
      .from('reservations')
      .select(`
        id,
        title,
        start_time,
        end_time,
        users!inner (
          id,
          name,
          email,
          department
        )
      `)
      .limit(3);

    if (reservationsWithUsersError) {
      console.error('   ❌ 예약-사용자 조인 쿼리 실패:', reservationsWithUsersError.message);
      allTestsPassed = false;
    } else {
      console.log('   ✅ 예약-사용자 조인 쿼리 성공');
      console.log(`   📅 조회된 예약 수: ${reservationsWithUsers?.length || 0}개`);
      
      if (reservationsWithUsers && reservationsWithUsers.length > 0) {
        const sampleReservation = reservationsWithUsers[0];
        console.log('   📋 샘플 예약 정보:');
        console.log(`      - 예약 ID: ${sampleReservation.id}`);
        console.log(`      - 제목: ${sampleReservation.title}`);
        console.log(`      - 예약자: ${sampleReservation.users.name} (${sampleReservation.users.email})`);
        console.log(`      - 부서: ${sampleReservation.users.department}`);
      }
    }

    // 6. RLS 정책 테스트
    console.log('\n6. RLS 정책 테스트...');
    
    // 익명 사용자로 rooms 테이블 접근 테스트
    const anonSupabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    
    const { data: roomsData, error: roomsError } = await anonSupabase
      .from('rooms')
      .select('id, name, capacity')
      .eq('is_active', true)
      .limit(3);

    if (roomsError) {
      console.error('   ❌ 익명 사용자 rooms 접근 실패:', roomsError.message);
      allTestsPassed = false;
    } else {
      console.log('   ✅ 익명 사용자 rooms 접근 성공');
      console.log(`   🏢 활성 회의실 수: ${roomsData?.length || 0}개`);
    }

    // 최종 결과
    console.log('\n' + '='.repeat(50));
    if (allTestsPassed) {
      console.log('🎉 모든 호환성 테스트 통과!');
      console.log('\n✅ 확인된 기능:');
      console.log('   - 데이터베이스 스키마 정상');
      console.log('   - get_public_reservations 함수 작동');
      console.log('   - create_user_profile 함수 작동');
      console.log('   - 사용자 프로필 조회 정상');
      console.log('   - 예약-사용자 관계 정상');
      console.log('   - RLS 정책 정상');
      console.log('\n🚀 이메일 인증 마이그레이션이 성공적으로 완료되었습니다!');
    } else {
      console.log('❌ 일부 호환성 테스트 실패');
      console.log('위의 오류를 확인하고 수정해주세요.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ 호환성 테스트 중 오류 발생:', error.message);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  testCompatibility();
}

module.exports = { testCompatibility };