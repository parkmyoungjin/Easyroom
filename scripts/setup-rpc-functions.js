#!/usr/bin/env node

/**
 * RPC 함수 설정 스크립트
 * get_public_reservations 함수를 데이터베이스에 생성
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createRPCFunction() {
  console.log('🔧 RPC 함수 생성 중...');
  
  try {
    // SQL 파일 읽기
    const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', 'create_get_public_reservations_function.sql');
    
    if (!fs.existsSync(sqlPath)) {
      console.error('❌ SQL 파일을 찾을 수 없습니다:', sqlPath);
      return false;
    }
    
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // SQL 실행
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });
    
    if (error) {
      console.error('❌ RPC 함수 생성 실패:', error.message);
      
      // 직접 SQL 실행 시도
      console.log('💡 직접 SQL 실행을 시도합니다...');
      console.log('다음 SQL을 Supabase 대시보드의 SQL Editor에서 실행하세요:');
      console.log('\n' + '='.repeat(50));
      console.log(sqlContent);
      console.log('='.repeat(50) + '\n');
      
      return false;
    }
    
    console.log('✅ RPC 함수 생성 완료');
    return true;
    
  } catch (error) {
    console.error('❌ RPC 함수 생성 중 오류:', error.message);
    
    // SQL 내용 출력
    try {
      const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', 'create_get_public_reservations_function.sql');
      const sqlContent = fs.readFileSync(sqlPath, 'utf8');
      
      console.log('\n💡 다음 SQL을 Supabase 대시보드에서 수동으로 실행하세요:');
      console.log('\n' + '='.repeat(50));
      console.log(sqlContent);
      console.log('='.repeat(50) + '\n');
    } catch (readError) {
      console.error('SQL 파일 읽기 실패:', readError.message);
    }
    
    return false;
  }
}

async function testRPCFunction() {
  console.log('🔍 RPC 함수 테스트...');
  
  try {
    const { data, error } = await supabase.rpc('get_public_reservations', {
      start_date: '2025-01-16T00:00:00.000Z',
      end_date: '2025-01-16T23:59:59.999Z'
    });
    
    if (error) {
      console.error('❌ RPC 함수 테스트 실패:', error.message);
      return false;
    }
    
    console.log('✅ RPC 함수 정상 동작 확인');
    console.log(`📊 테스트 결과: ${data?.length || 0}개 예약 조회`);
    return true;
    
  } catch (error) {
    console.error('❌ RPC 함수 테스트 중 오류:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 RPC 함수 설정 시작\n');
  
  // 1. RPC 함수 생성 시도
  const created = await createRPCFunction();
  
  if (!created) {
    console.log('\n⚠️  RPC 함수 자동 생성에 실패했습니다.');
    console.log('💡 Supabase 대시보드에서 수동으로 SQL을 실행해주세요.');
    return;
  }
  
  // 2. RPC 함수 테스트
  await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
  const tested = await testRPCFunction();
  
  if (tested) {
    console.log('\n🎉 RPC 함수 설정 완료!');
    console.log('이제 앱에서 공개 예약 조회가 정상적으로 동작합니다.');
  } else {
    console.log('\n⚠️  RPC 함수 테스트에 실패했습니다.');
    console.log('Supabase 대시보드에서 함수가 올바르게 생성되었는지 확인해주세요.');
  }
}

main().catch(console.error);