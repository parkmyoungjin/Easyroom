#!/usr/bin/env node

/**
 * 테스트 예약 데이터 정리 스크립트
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupTestReservations() {
  console.log('🧹 테스트 예약 데이터 정리 중...\n');

  try {
    // 테스트 관련 키워드가 포함된 예약들 조회
    const { data: testReservations, error: selectError } = await supabase
      .from('reservations')
      .select('id, title, start_time, end_time')
      .or('title.ilike.%테스트%,title.ilike.%test%,title.ilike.%즉시%,title.ilike.%오후 11시%');

    if (selectError) {
      console.error('❌ 테스트 예약 조회 실패:', selectError.message);
      return;
    }

    if (!testReservations || testReservations.length === 0) {
      console.log('✅ 삭제할 테스트 예약이 없습니다.');
      return;
    }

    console.log(`📋 발견된 테스트 예약: ${testReservations.length}개`);
    testReservations.forEach((reservation, index) => {
      console.log(`${index + 1}. ${reservation.title} (${new Date(reservation.start_time).toLocaleString('ko-KR')})`);
    });

    console.log('\n🗑️  테스트 예약 삭제 중...');

    // 테스트 예약들 삭제
    const { data: deletedReservations, error: deleteError } = await supabase
      .from('reservations')
      .delete()
      .or('title.ilike.%테스트%,title.ilike.%test%,title.ilike.%즉시%,title.ilike.%오후 11시%')
      .select('id, title');

    if (deleteError) {
      console.error('❌ 테스트 예약 삭제 실패:', deleteError.message);
      return;
    }

    console.log(`✅ ${deletedReservations?.length || 0}개의 테스트 예약이 삭제되었습니다.`);
    
    if (deletedReservations && deletedReservations.length > 0) {
      console.log('\n삭제된 예약:');
      deletedReservations.forEach((reservation, index) => {
        console.log(`${index + 1}. ${reservation.title}`);
      });
    }

  } catch (error) {
    console.error('❌ 정리 작업 중 오류:', error);
  }
}

// 특정 날짜 이전의 모든 예약 삭제 (선택사항)
async function cleanupOldReservations(daysBefore = 7) {
  console.log(`🧹 ${daysBefore}일 이전 예약 정리 중...\n`);

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBefore);

    const { data: oldReservations, error: deleteError } = await supabase
      .from('reservations')
      .delete()
      .lt('end_time', cutoffDate.toISOString())
      .select('id, title, end_time');

    if (deleteError) {
      console.error('❌ 오래된 예약 삭제 실패:', deleteError.message);
      return;
    }

    console.log(`✅ ${oldReservations?.length || 0}개의 오래된 예약이 삭제되었습니다.`);

  } catch (error) {
    console.error('❌ 정리 작업 중 오류:', error);
  }
}

// 메인 실행
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--old')) {
    const days = parseInt(args.find(arg => arg.startsWith('--days='))?.split('=')[1]) || 7;
    await cleanupOldReservations(days);
  } else {
    await cleanupTestReservations();
  }
}

main().catch(error => {
  console.error('❌ 스크립트 실행 중 오류:', error);
  process.exit(1);
});