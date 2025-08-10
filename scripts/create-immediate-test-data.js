#!/usr/bin/env node

/**
 * 즉시 테스트 가능한 예약 데이터 생성
 * 현재 시간 기준으로 바로 체크인 가능한 예약 생성
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

async function createImmediateTestData() {
  console.log('🧪 즉시 테스트 가능한 예약 데이터 생성 중...\n');

  try {
    // 기존 데이터 조회
    const { data: users } = await supabase.from('users').select('id, name');
    const { data: rooms } = await supabase.from('rooms').select('id, name');

    if (!users || users.length === 0 || !rooms || rooms.length === 0) {
      console.error('❌ 사용자 또는 회의실이 없습니다.');
      return;
    }

    const now = new Date();
    const room = rooms[0];
    const user = users[0];

    console.log(`📋 사용자: ${user.name} (ID: ${user.id})`);
    console.log(`📋 회의실: ${room.name} (ID: ${room.id})`);
    console.log(`🕐 현재 시간: ${now.toLocaleString('ko-KR')}\n`);

    // 기존 테스트 데이터 삭제
    await supabase
      .from('reservations')
      .delete()
      .or('title.like.%즉시%,title.like.%오후 11시%');

    // 오늘 오후 11:00~12:00 예약
    const today = new Date();
    const startTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 0, 0); // 오후 11:00
    const endTime = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 0, 0, 0); // 자정 (다음날 00:00)

    const immediateReservation = {
      user_id: user.id,
      room_id: room.id,
      title: '오후 11시 테스트 회의',
      purpose: '오후 11:00~12:00 체크인/체크아웃 테스트용',
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      status: 'confirmed'
    };

    const { data, error } = await supabase
      .from('reservations')
      .insert(immediateReservation)
      .select('id, title, start_time, end_time')
      .single();

    if (error) {
      console.error('❌ 예약 생성 실패:', error.message);
      return;
    }

    console.log('✅ 예약 생성 완료!');
    console.log(`📝 제목: ${data.title}`);
    console.log(`🕐 시작: ${new Date(data.start_time).toLocaleString('ko-KR')}`);
    console.log(`🕐 종료: ${new Date(data.end_time).toLocaleString('ko-KR')}`);

    // 현재 시간과 예약 시간 비교
    const currentTime = new Date();
    const reservationStart = new Date(data.start_time);
    const checkinAvailableTime = new Date(reservationStart.getTime() - 30 * 60 * 1000); // 30분 전

    console.log(`\n⏰ 현재 시간: ${currentTime.toLocaleString('ko-KR')}`);
    console.log(`⏰ 체크인 가능 시간: ${checkinAvailableTime.toLocaleString('ko-KR')} (예약 시작 30분 전)`);

    if (currentTime >= checkinAvailableTime) {
      console.log('✅ 지금 바로 체크인 가능합니다!');
    } else {
      const waitMinutes = Math.ceil((checkinAvailableTime.getTime() - currentTime.getTime()) / (1000 * 60));
      console.log(`⏳ ${waitMinutes}분 후에 체크인 가능합니다.`);
    }

    console.log('\n🎯 테스트 방법:');
    console.log('1. 브라우저 새로고침');
    console.log('2. 예약 목록에서 "오후 11시 테스트 회의" 찾기');
    console.log('3. 체크인 가능 시간이 되면 파란색 "체크인" 버튼 클릭');
    console.log('4. 체크인 후 "체크아웃" 버튼으로 변경되는지 확인');

    console.log('\n💡 버튼 상태 설명:');
    console.log('- 파란색 "체크인": 체크인 가능');
    console.log('- 회색 "대기 중": 아직 체크인 시간 아님');
    console.log('- 초록색 "체크아웃": 체크아웃 가능');
    console.log('- 빨간색 "연장 중": 시간 초과, 체크아웃 필요');

  } catch (error) {
    console.error('❌ 테스트 데이터 생성 중 오류:', error);
  }
}

createImmediateTestData();