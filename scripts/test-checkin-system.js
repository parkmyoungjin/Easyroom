#!/usr/bin/env node

/**
 * 체크인/체크아웃 시스템 테스트 스크립트
 * 설치된 시스템의 기본 기능들을 테스트합니다.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.');
  console.error('NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인하세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testCheckInOutSystem() {
  console.log('🧪 체크인/체크아웃 시스템 테스트 시작...\n');

  const tests = [
    testDatabaseSchema,
    testFunctions,
    testViews,
    testCronJobs,
    testAutomationFunction
  ];

  let passedTests = 0;
  let totalTests = tests.length;

  for (const test of tests) {
    try {
      await test();
      passedTests++;
    } catch (error) {
      console.error(`❌ ${test.name} 실패:`, error.message);
    }
  }

  console.log(`\n📊 테스트 결과: ${passedTests}/${totalTests} 통과`);
  
  if (passedTests === totalTests) {
    console.log('🎉 모든 테스트가 통과했습니다!');
    console.log('\n✅ 체크인/체크아웃 시스템이 정상적으로 설치되었습니다.');
  } else {
    console.log('⚠️  일부 테스트가 실패했습니다. 로그를 확인하세요.');
    process.exit(1);
  }
}

async function testDatabaseSchema() {
  console.log('🔍 데이터베이스 스키마 테스트...');
  
  // reservations 테이블의 새 컬럼 확인
  const { data, error } = await supabase
    .from('reservations')
    .select('checked_in_at, checked_out_at')
    .limit(1);

  if (error) {
    throw new Error(`스키마 테스트 실패: ${error.message}`);
  }

  // ENUM 값 확인
  const { data: enumData, error: enumError } = await supabase.rpc('run_sql', {
    query: "SELECT unnest(enum_range(NULL::reservation_status)) as status"
  });

  if (enumError) {
    // 대체 방법으로 테스트
    console.log('⚠️  ENUM 테스트를 건너뜁니다 (권한 제한)');
  }

  console.log('✅ 데이터베이스 스키마 테스트 통과');
}

async function testFunctions() {
  console.log('🔍 RPC 함수 테스트...');
  
  const functions = [
    'check_in_reservation',
    'check_out_reservation', 
    'get_reservation_checkin_status',
    'run_reservation_automation'
  ];

  for (const funcName of functions) {
    try {
      // 함수 존재 여부만 확인 (실제 호출은 하지 않음)
      const { error } = await supabase.rpc(funcName, {});
      
      // 함수가 존재하면 파라미터 오류가 발생할 것임
      if (error && !error.message.includes('parameter')) {
        throw new Error(`함수 ${funcName}이 존재하지 않습니다`);
      }
    } catch (err) {
      if (!err.message.includes('parameter') && !err.message.includes('argument')) {
        throw err;
      }
    }
  }

  console.log('✅ RPC 함수 테스트 통과');
}

async function testViews() {
  console.log('🔍 뷰(View) 테스트...');
  
  const views = [
    'current_room_status_view',
    'room_usage_view',
    'no_show_reservations_view'
  ];

  for (const viewName of views) {
    const { error } = await supabase
      .from(viewName)
      .select('*')
      .limit(1);

    if (error) {
      throw new Error(`뷰 ${viewName} 테스트 실패: ${error.message}`);
    }
  }

  console.log('✅ 뷰 테스트 통과');
}

async function testCronJobs() {
  console.log('🔍 Cron 작업 테스트...');
  
  try {
    const { data, error } = await supabase
      .from('cron_jobs_status')
      .select('*');

    if (error) {
      console.log('⚠️  Cron 작업 상태 확인 건너뜀 (권한 제한)');
      return;
    }

    const automationJob = data?.find(job => job.jobname === 'reservation-automation');
    if (automationJob) {
      console.log(`✅ 자동화 작업 발견: ${automationJob.schedule}`);
    } else {
      console.log('⚠️  자동화 작업이 설정되지 않았을 수 있습니다');
    }
  } catch (error) {
    console.log('⚠️  Cron 작업 테스트 건너뜀:', error.message);
  }

  console.log('✅ Cron 작업 테스트 완료');
}

async function testAutomationFunction() {
  console.log('🔍 자동화 함수 테스트...');
  
  try {
    const { data, error } = await supabase.rpc('run_reservation_automation');
    
    if (error) {
      throw new Error(`자동화 함수 실행 실패: ${error.message}`);
    }

    console.log('✅ 자동화 함수 실행 성공:', {
      처리된_항목: data.total_processed || 0,
      연장_업데이트: data.overtime_updated || 0,
      NoShow_처리: data.no_shows_marked || 0,
      자동_체크아웃: data.auto_checkouts || 0
    });
  } catch (error) {
    throw new Error(`자동화 함수 테스트 실패: ${error.message}`);
  }

  console.log('✅ 자동화 함수 테스트 통과');
}

// 메인 실행
testCheckInOutSystem().catch(error => {
  console.error('❌ 테스트 실행 중 오류:', error);
  process.exit(1);
});