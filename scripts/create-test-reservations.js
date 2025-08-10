#!/usr/bin/env node

/**
 * 체크인/체크아웃 테스트를 위한 예약 데이터 생성 스크립트
 * 현재 시간 기준으로 다양한 상태의 예약들을 생성합니다.
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

async function createTestReservations() {
    console.log('🧪 체크인/체크아웃 테스트용 예약 데이터 생성 중...\n');

    try {
        // 현재 시간
        const now = new Date();

        // 사용자와 회의실 정보 가져오기
        let { data: users } = await supabase.from('users').select('id, name').limit(5);
        let { data: rooms } = await supabase.from('rooms').select('id, name').limit(3);

        // 사용자가 없으면 테스트 사용자 생성
        if (!users || users.length === 0) {
            console.log('👤 테스트 사용자 생성 중...');

            const testUsers = [
                {
                    auth_id: '00000000-0000-0000-0000-000000000001',
                    email: 'test1@example.com',
                    name: '테스트 사용자1',
                    department: '개발팀',
                    role: 'employee'
                },
                {
                    auth_id: '00000000-0000-0000-0000-000000000002',
                    email: 'test2@example.com',
                    name: '테스트 사용자2',
                    department: '기획팀',
                    role: 'employee'
                },
                {
                    auth_id: '00000000-0000-0000-0000-000000000003',
                    email: 'admin@example.com',
                    name: '관리자',
                    department: '관리팀',
                    role: 'admin'
                }
            ];

            for (const user of testUsers) {
                const { data, error } = await supabase
                    .from('users')
                    .upsert(user, { onConflict: 'auth_id' })
                    .select('id, name')
                    .single();

                if (!error && data) {
                    console.log(`✅ 사용자 생성: ${data.name}`);
                }
            }

            // 사용자 다시 조회
            const { data: newUsers } = await supabase.from('users').select('id, name').limit(5);
            users = newUsers;
        }

        // 회의실이 없으면 테스트 회의실 생성
        if (!rooms || rooms.length === 0) {
            console.log('🏢 테스트 회의실 생성 중...');

            const testRooms = [
                {
                    name: '회의실 A',
                    capacity: 8,
                    location: '1층',
                    description: '소규모 회의용',
                    amenities: { projector: true, whiteboard: true, wifi: true }
                },
                {
                    name: '회의실 B',
                    capacity: 12,
                    location: '2층',
                    description: '중규모 회의용',
                    amenities: { projector: true, tv: true, wifi: true, microphone: true }
                },
                {
                    name: '대회의실',
                    capacity: 20,
                    location: '3층',
                    description: '대규모 회의용',
                    amenities: { projector: true, tv: true, wifi: true, microphone: true, speakers: true }
                }
            ];

            for (const room of testRooms) {
                const { data, error } = await supabase
                    .from('rooms')
                    .insert(room)
                    .select('id, name')
                    .single();

                if (!error && data) {
                    console.log(`✅ 회의실 생성: ${data.name}`);
                }
            }

            // 회의실 다시 조회
            const { data: newRooms } = await supabase.from('rooms').select('id, name').limit(3);
            rooms = newRooms;
        }

        if (!users || users.length === 0) {
            console.error('❌ 사용자 생성에 실패했습니다.');
            return;
        }

        if (!rooms || rooms.length === 0) {
            console.error('❌ 회의실 생성에 실패했습니다.');
            return;
        }

        console.log(`\n📋 사용 가능한 사용자: ${users.length}명`);
        console.log(`📋 사용 가능한 회의실: ${rooms.length}개\n`);

        const testReservations = [];

        // 1. 체크인 가능한 예약 (현재 시간 기준 -10분 ~ +30분)
        const checkinTime = new Date(now.getTime() - 10 * 60 * 1000); // 10분 전 시작
        const checkinEndTime = new Date(checkinTime.getTime() + 60 * 60 * 1000); // 1시간 후 종료

        testReservations.push({
            user_id: users[0].id,
            room_id: rooms[0].id,
            title: '체크인 테스트 회의',
            purpose: '체크인/체크아웃 기능 테스트용',
            start_time: checkinTime.toISOString(),
            end_time: checkinEndTime.toISOString(),
            status: 'confirmed'
        });

        // 2. 곧 시작할 예약 (현재 시간 + 10분)
        const soonTime = new Date(now.getTime() + 10 * 60 * 1000);
        const soonEndTime = new Date(soonTime.getTime() + 60 * 60 * 1000);

        testReservations.push({
            user_id: users[1].id,
            room_id: rooms[1].id,
            title: '곧 시작할 회의',
            purpose: '10분 후 시작 예정',
            start_time: soonTime.toISOString(),
            end_time: soonEndTime.toISOString(),
            status: 'confirmed'
        });

        // 3. 이미 체크인된 예약 (현재 진행 중)
        const activeTime = new Date(now.getTime() - 30 * 60 * 1000); // 30분 전 시작
        const activeEndTime = new Date(now.getTime() + 30 * 60 * 1000); // 30분 후 종료

        testReservations.push({
            user_id: users[0].id,
            room_id: rooms[2].id,
            title: '진행 중인 회의',
            purpose: '현재 사용 중 (체크아웃 테스트용)',
            start_time: activeTime.toISOString(),
            end_time: activeEndTime.toISOString(),
            status: 'checked_in',
            checked_in_at: new Date(activeTime.getTime() + 5 * 60 * 1000).toISOString() // 시작 5분 후 체크인
        });

        // 4. 연장 중인 예약 (종료 시간 지남)
        const overtimeTime = new Date(now.getTime() - 90 * 60 * 1000); // 90분 전 시작
        const overtimeEndTime = new Date(now.getTime() - 10 * 60 * 1000); // 10분 전 종료 예정이었음

        testReservations.push({
            user_id: users[1].id,
            room_id: rooms[0].id,
            title: '연장 사용 중인 회의',
            purpose: '종료 시간을 넘겨서 사용 중',
            start_time: overtimeTime.toISOString(),
            end_time: overtimeEndTime.toISOString(),
            status: 'overtime',
            checked_in_at: new Date(overtimeTime.getTime() + 3 * 60 * 1000).toISOString()
        });

        // 5. No-Show 처리될 예약 (시작 후 35분 경과)
        const noShowTime = new Date(now.getTime() - 35 * 60 * 1000); // 35분 전 시작
        const noShowEndTime = new Date(now.getTime() + 25 * 60 * 1000); // 25분 후 종료

        testReservations.push({
            user_id: users[2].id,
            room_id: rooms[1].id,
            title: 'No-Show 테스트 회의',
            purpose: '체크인하지 않아서 No-Show 처리될 예약',
            start_time: noShowTime.toISOString(),
            end_time: noShowEndTime.toISOString(),
            status: 'confirmed' // 자동화에 의해 no_show로 변경될 예정
        });

        // 6. 완료된 예약
        const completedTime = new Date(now.getTime() - 120 * 60 * 1000); // 2시간 전 시작
        const completedEndTime = new Date(now.getTime() - 60 * 60 * 1000); // 1시간 전 종료

        testReservations.push({
            user_id: users[0].id,
            room_id: rooms[2].id,
            title: '완료된 회의',
            purpose: '정상적으로 완료된 회의',
            start_time: completedTime.toISOString(),
            end_time: completedEndTime.toISOString(),
            status: 'completed',
            checked_in_at: new Date(completedTime.getTime() + 2 * 60 * 1000).toISOString(),
            checked_out_at: new Date(completedEndTime.getTime() - 5 * 60 * 1000).toISOString()
        });

        // 예약 데이터 삽입
        console.log('📝 테스트 예약 생성 중...');

        for (let i = 0; i < testReservations.length; i++) {
            const reservation = testReservations[i];
            const { data, error } = await supabase
                .from('reservations')
                .insert(reservation)
                .select('id, title, status')
                .single();

            if (error) {
                console.error(`❌ 예약 생성 실패 (${reservation.title}):`, error.message);
            } else {
                console.log(`✅ ${data.title} (${data.status}) - ID: ${data.id}`);
            }
        }

        console.log('\n🎉 테스트 예약 데이터 생성 완료!');
        console.log('\n📋 생성된 예약 상태:');
        console.log('1. 체크인 가능한 예약 (현재 시간 기준)');
        console.log('2. 곧 시작할 예약 (10분 후)');
        console.log('3. 진행 중인 회의 (체크아웃 가능)');
        console.log('4. 연장 중인 회의 (overtime 상태)');
        console.log('5. No-Show 처리될 예약 (35분 전 시작, 미체크인)');
        console.log('6. 완료된 회의');

        console.log('\n🧪 테스트 방법:');
        console.log('1. 개발 서버 시작: npm run dev');
        console.log('2. 브라우저에서 예약 목록 확인');
        console.log('3. "내 예약"에서 체크인/체크아웃 버튼 테스트');
        console.log('4. 관리자 계정으로 통계 대시보드 확인');
        console.log('5. 5분 후 자동화 작업 결과 확인');

        console.log('\n⚠️  참고사항:');
        console.log('- 체크인은 예약 시작 30분 전부터 가능');
        console.log('- No-Show는 시작 후 30분 경과 시 자동 처리');
        console.log('- 자동화 작업은 5분마다 실행됨');

    } catch (error) {
        console.error('❌ 테스트 데이터 생성 중 오류:', error);
    }
}

// 기존 테스트 예약 삭제 함수
async function cleanupTestReservations() {
    console.log('🧹 기존 테스트 예약 정리 중...');

    const testTitles = [
        '체크인 테스트 회의',
        '곧 시작할 회의',
        '진행 중인 회의',
        '연장 사용 중인 회의',
        'No-Show 테스트 회의',
        '완료된 회의'
    ];

    for (const title of testTitles) {
        const { error } = await supabase
            .from('reservations')
            .delete()
            .eq('title', title);

        if (error) {
            console.log(`⚠️  ${title} 삭제 실패 (존재하지 않을 수 있음)`);
        } else {
            console.log(`✅ ${title} 삭제 완료`);
        }
    }
}

// 메인 실행
async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--cleanup')) {
        await cleanupTestReservations();
        return;
    }

    if (args.includes('--reset')) {
        await cleanupTestReservations();
        console.log('');
    }

    await createTestReservations();
}

main().catch(error => {
    console.error('❌ 스크립트 실행 중 오류:', error);
    process.exit(1);
});