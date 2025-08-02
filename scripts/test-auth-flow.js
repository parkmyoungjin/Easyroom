#!/usr/bin/env node

/**
 * 인증 플로우 테스트 스크립트
 * 수정된 타입과 API가 올바르게 동작하는지 확인
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// 로컬 개발 환경에서는 로컬 Supabase 사용
const supabaseUrl = process.env.NODE_ENV === 'test' 
  ? 'http://127.0.0.1:54321' 
  : process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.NODE_ENV === 'test'
  ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
  : process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testDatabaseConnection() {
  console.log('🔍 데이터베이스 연결 테스트...');
  
  try {
    // users 테이블 스키마 확인
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ users 테이블 조회 실패:', error.message);
      return false;
    }
    
    console.log('✅ users 테이블 연결 성공');
    
    // rooms 테이블 확인
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('*')
      .limit(1);
    
    if (roomsError) {
      console.error('❌ rooms 테이블 조회 실패:', roomsError.message);
      return false;
    }
    
    console.log('✅ rooms 테이블 연결 성공');
    
    // reservations 테이블 확인
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('*')
      .limit(1);
    
    if (reservationsError) {
      console.error('❌ reservations 테이블 조회 실패:', reservationsError.message);
      return false;
    }
    
    console.log('✅ reservations 테이블 연결 성공');
    return true;
    
  } catch (error) {
    console.error('❌ 데이터베이스 연결 실패:', error.message);
    return false;
  }
}

async function testRPCFunction() {
  console.log('🔍 RPC 함수 테스트...');
  
  try {
    // TIMESTAMPTZ 형식으로 파라미터 전달
    const startDate = new Date('2025-01-16T00:00:00.000Z');
    const endDate = new Date('2025-01-16T23:59:59.999Z');
    
    console.log('📅 테스트 날짜:', { startDate, endDate });
    
    const { data, error } = await supabase.rpc('get_public_reservations', {
      start_date: startDate,
      end_date: endDate
    });
    
    if (error) {
      console.error('❌ RPC 함수 실행 실패:', error.message);
      console.error('🔍 에러 상세:', error);
      
      // 함수 목록 조회 시도
      try {
        const { data: functions, error: funcError } = await supabase
          .from('pg_proc')
          .select('proname, proargtypes')
          .like('proname', '%get_public_reservations%');
        
        if (!funcError && functions) {
          console.log('🔍 발견된 함수들:', functions);
        }
      } catch (funcListError) {
        console.log('🔍 함수 목록 조회 실패');
      }
      
      return false;
    }
    
    console.log('✅ get_public_reservations RPC 함수 동작 확인');
    console.log(`📊 조회된 예약 수: ${data?.length || 0}개`);
    return true;
    
  } catch (error) {
    console.error('❌ RPC 함수 테스트 실패:', error.message);
    return false;
  }
}

async function testUserSchema() {
  console.log('🔍 사용자 스키마 테스트...');
  
  try {
    // users 테이블의 컬럼 정보 확인
    const { data, error } = await supabase
      .from('users')
      .select('id, auth_id, employee_id, name, email, department, role')
      .limit(1);
    
    if (error) {
      console.error('❌ 사용자 스키마 확인 실패:', error.message);
      
      if (error.message.includes('auth_id')) {
        console.log('💡 auth_id 컬럼이 없을 수 있습니다. 스키마를 확인하세요.');
      }
      
      return false;
    }
    
    console.log('✅ 사용자 스키마 확인 완료');
    
    if (data && data.length > 0) {
      const user = data[0];
      console.log('📋 사용자 테이블 구조:');
      console.log('  - id:', typeof user.id);
      console.log('  - auth_id:', typeof user.auth_id);
      console.log('  - employee_id:', typeof user.employee_id);
      console.log('  - name:', typeof user.name);
      console.log('  - email:', typeof user.email);
      console.log('  - department:', typeof user.department);
      console.log('  - role:', typeof user.role);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ 사용자 스키마 테스트 실패:', error.message);
    return false;
  }
}

async function testAPIEndpoints() {
  console.log('🔍 API 엔드포인트 테스트...');
  
  try {
    // 공개 예약 API 테스트
    const response = await fetch('http://localhost:3000/api/reservations/public?startDate=2025-01-16&endDate=2025-01-16');
    
    if (!response.ok) {
      console.error('❌ 공개 예약 API 실패:', response.status, response.statusText);
      return false;
    }
    
    const data = await response.json();
    console.log('✅ 공개 예약 API 동작 확인');
    console.log(`📊 조회된 예약 수: ${data.data?.length || 0}개`);
    
    return true;
    
  } catch (error) {
    console.error('❌ API 엔드포인트 테스트 실패:', error.message);
    console.log('💡 개발 서버가 실행 중인지 확인하세요: npm run dev');
    return false;
  }
}

async function main() {
  console.log('🚀 인증 플로우 및 타입 일관성 테스트 시작\n');
  
  const tests = [
    { name: '데이터베이스 연결', fn: testDatabaseConnection },
    { name: '사용자 스키마', fn: testUserSchema },
    { name: 'RPC 함수', fn: testRPCFunction },
    { name: 'API 엔드포인트', fn: testAPIEndpoints },
  ];
  
  let passedTests = 0;
  
  for (const test of tests) {
    console.log(`\n--- ${test.name} 테스트 ---`);
    const result = await test.fn();
    if (result) {
      passedTests++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`📊 테스트 결과: ${passedTests}/${tests.length} 통과`);
  
  if (passedTests === tests.length) {
    console.log('🎉 모든 테스트 통과! 앱이 정상적으로 동작할 것입니다.');
  } else {
    console.log('⚠️  일부 테스트 실패. 위의 오류 메시지를 확인하세요.');
  }
  
  console.log('\n💡 다음 단계:');
  console.log('1. npm run dev - 개발 서버 실행');
  console.log('2. http://localhost:3000/login - 로그인 테스트');
  console.log('3. 회원가입 → 로그인 → 예약 생성 플로우 테스트');
}

main().catch(console.error);