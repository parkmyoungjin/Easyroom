#!/usr/bin/env node

/**
 * 간단한 체크인/체크아웃 테스트 데이터 생성
 * 기존 사용자와 회의실을 활용
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

async function createSimpleTestData() {
  console.log('🧪 간단한 테스트 데이터 생성 중...\n');

  try {
    // 기존 데이터 조회
    const { data: users } = await supabase.from('users').select('id, name');
    const { data: rooms } = await supabase.from('rooms').select('id, name');

    if (!users || users.length === 0) {
      console.error('❌ 사용자가 없습니다.');
      return;
    }

    if (!rooms || rooms.length === 0) {
      console.error('❌ 회의실이 없습니다.');
      return;
    }

    console.log(`📋 사용자: ${users.map(u => u.name).join(', ')}`);
    console.log(`📋 회의실: ${rooms.map(r => r.name).join(', ')}\n`);

    const now = new Date();
    const room = rooms[0]; // 첫 번째 회의실 사용
    const user1 = users[0];
    const user2 = users.length > 1 ? users[1] : users[0];

    // 기존 테스트 데이터 삭제
    await supabase
      .from('reservations')
      .delete()
      .like('title', '%테스트%');

    const testReservations = [
      // 1. 체크인 가능한 예약 (10분 전 시작)
      {
        user_id: user1.id,
        room_id: room.id,
        title: '체크인 테스트 회의',
        purpose: '체크인 버튼 테스트용',
        start_time: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
        end_time: new Date(now.getTime() + 50 * 60 * 1000).toISOString(),
        status: 'confirmed'
      },

      // 2. 곧 시작할 예약 (1시간 후)
      {
        user_id: user2.id,
        room_id: room.id,
        title: '곧 시작할 테스트 회의',
        purpose: '나중에 시작할 예약',
        start_time: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        end_time: new Date(now.getTime() + 120 * 60 * 1000).toISOString(),
        status: 'confirmed'
      },

      // 3. 체크인된 예약 (30분 전 시작, 30분 후 종료)
      {
        user_id: user1.id,
        room_id: room.id,
        title: '진행중 테스트 회의',
        purpose: '체크아웃 버튼 테스트용',
        start_time: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
        end_time: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
        status: 'checked_in',
        checked_in_at: new Date(now.getTime() - 25 * 60 * 1000).toISOString()
      },

      // 4. No-Show 예약 (35분 전 시작, 미체크인)
      {
        user_id: user2.id,
        room_id: room.id,
        title: 'No-Show 테스트 회의',
        purpose: 'No-Show 자동 처리 테스트용',
        start_time: new Date(now.getTime() - 35 * 60 * 1000).toISOString(),
        end_time: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
        status: 'confirmed' // 자동화에 의해 no_show로 변경될 예정
      },

      // 5. 완료된 예약
      {
        user_id: user1.id,
        room_id: room.id,
        title: '완료된 테스트 회의',
        purpose: '정상 완료된 회의',
        start_time: new Date(now.getTime() - 120 * 60 * 1000).toISOString(),
        end_time: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
        status: 'completed',
        checked_in_at: new Date(now.getTime() - 118 * 60 * 1000).toISOString(),
        checked_out_at: new Date(now.getTime() - 65 * 60 * 1000).toISOString()
      }
    ];

    console.log('📝 테스트 예약 생성 중...');
    
    for (const reservation of testReservations) {
      const { data, error } = await supabase
        .from('reservations')
        .insert(reservation)
        .select('id, title, status')
        .single();

      if (error) {
        console.error(`❌ ${reservation.title} 생성 실패:`, error.message);
      } else {
        console.log(`✅ ${data.title} (${data.status})`);
      }
    }

    console.log('\n🎉 테스트 데이터 생성 완료!');
    console.log('\n📋 생성된 예약:');
    console.log('1. 체크인 테스트 회의 - 체크인 가능');
    console.log('2. 곧 시작할 테스트 회의 - 1시간 후 시작');
    console.log('3. 진행중 테스트 회의 - 체크아웃 가능');
    console.log('4. No-Show 테스트 회의 - 자동 No-Show 처리 대상');
    console.log('5. 완료된 테스트 회의 - 완료 상태');

    console.log('\n🧪 테스트 방법:');
    console.log('1. npm run dev');
    console.log('2. 브라우저에서 예약 목록 확인');
    console.log('3. 체크인/체크아웃 버튼 테스트');
    console.log('4. 5분 후 자동화 작업 결과 확인');

  } catch (error) {
    console.error('❌ 테스트 데이터 생성 중 오류:', error);
  }
}

createSimpleTestData();