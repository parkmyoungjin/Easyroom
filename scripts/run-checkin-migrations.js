#!/usr/bin/env node

/**
 * 체크인/체크아웃 시스템 마이그레이션 실행 스크립트
 * Phase 1 마이그레이션을 순차적으로 실행합니다.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MIGRATION_FILES = [
  '20250810000001_add_checkin_checkout_system.sql',
  '20250810000002_checkin_checkout_functions.sql',
  '20250810000003_automation_cron_jobs.sql'
];

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

console.log('🚀 체크인/체크아웃 시스템 마이그레이션 시작...\n');

// 마이그레이션 파일 존재 확인
console.log('📋 마이그레이션 파일 확인 중...');
for (const file of MIGRATION_FILES) {
  const filePath = path.join(MIGRATIONS_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 마이그레이션 파일을 찾을 수 없습니다: ${file}`);
    process.exit(1);
  }
  console.log(`✅ ${file}`);
}

console.log('\n🔧 Supabase 연결 상태 확인 중...');
try {
  execSync('supabase status', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Supabase가 실행되지 않았습니다. 다음 명령어로 시작하세요:');
  console.error('   supabase start');
  process.exit(1);
}

console.log('\n📦 마이그레이션 실행 중...');
try {
  // 모든 마이그레이션을 한 번에 실행
  execSync('supabase db push', { stdio: 'inherit' });
  console.log('\n✅ 모든 마이그레이션이 성공적으로 완료되었습니다!');
} catch (error) {
  console.error('\n❌ 마이그레이션 실행 중 오류가 발생했습니다.');
  console.error('다음 명령어로 수동으로 실행해보세요:');
  console.error('   supabase db push');
  process.exit(1);
}

console.log('\n🎉 체크인/체크아웃 시스템 설치 완료!');
console.log('\n📝 다음 단계:');
console.log('1. 개발 서버 재시작: npm run dev');
console.log('2. 브라우저에서 체크인/체크아웃 기능 테스트');
console.log('3. 관리자 계정으로 로그인하여 통계 대시보드 확인');

console.log('\n🔍 확인 사항:');
console.log('- 예약 목록에서 "내 예약"에 체크인/체크아웃 버튼이 표시되는지 확인');
console.log('- 실시간 회의실 상태가 정상적으로 업데이트되는지 확인');
console.log('- 자동화 작업이 5분마다 실행되는지 확인 (로그 모니터링)');

console.log('\n📚 추가 정보:');
console.log('- 체크인: 예약 시작 30분 전부터 시작 후 30분까지 가능');
console.log('- 자동 No-Show 처리: 예약 시작 후 30분 경과 시');
console.log('- 자동 체크아웃: 예약 종료 시간 경과 시');
console.log('- 관리자 통계: /admin 또는 대시보드에서 확인 가능');