#!/usr/bin/env node
/**
 * 회의실 예약 시스템 - 사용자 일괄 생성 스크립트
 * 
 * 사용법:
 * node create_bulk_users.js
 * 
 * 환경변수 설정 필요:
 * NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
 * NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// .env.local 파일 로드
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 환경변수가 설정되지 않았습니다.');
  console.error('NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 확인해주세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 생성할 사용자 목록
const testUsers = [
  {
    employee_id: '1001',
    name: '김직원',
    department: '개발팀',
    role: 'employee'
  },
  {
    employee_id: '1002', 
    name: '이사원',
    department: '기획팀',
    role: 'employee'
  },
  {
    employee_id: '1003',
    name: '박대리',
    department: '영업팀', 
    role: 'employee'
  },
  {
    employee_id: '1004',
    name: '최과장',
    department: '인사팀',
    role: 'employee'
  },
  {
    employee_id: '1005',
    name: '정부장',
    department: '개발팀',
    role: 'employee'
  }
];

async function createUser(userData) {
  try {
    const email = `emp${userData.employee_id}@gmail.com`;
    const password = `pnuh${userData.employee_id}`;

    console.log(`👤 사용자 생성 중: ${userData.name} (${userData.employee_id})`);

    // 1. Supabase Auth에 사용자 생성
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          employee_id: userData.employee_id,
          name: userData.name,
          department: userData.department,
          role: userData.role
        }
      }
    });

    if (signUpError) {
      if (signUpError.message.includes('already been registered')) {
        console.log(`⚠️  이미 존재하는 사용자: ${userData.name}`);
        return { success: true, existed: true };
      }
      throw signUpError;
    }

    if (!authData.user) {
      throw new Error('사용자 생성 실패: authData.user가 null입니다');
    }

    // 2. 트리거가 실행될 시간을 위한 대기
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. users 테이블에서 사용자 확인
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select()
      .eq('auth_id', authData.user.id)
      .single();

    if (fetchError || !user) {
      console.error(`❌ 사용자 정보 조회 실패: ${userData.name}`, fetchError);
      return { success: false, error: fetchError };
    }

    console.log(`✅ 사용자 생성 완료: ${userData.name} (${email})`);
    return { success: true, user };

  } catch (error) {
    console.error(`❌ 사용자 생성 실패: ${userData.name}`, error.message);
    return { success: false, error };
  }
}

async function createAllUsers() {
  console.log('🚀 회의실 예약 시스템 - 사용자 일괄 생성 시작\n');

  const results = [];
  
  for (const userData of testUsers) {
    const result = await createUser(userData);
    results.push({ ...userData, ...result });
    
    // API 요청 간격을 위한 대기
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n📊 생성 결과 요약:');
  console.log('='.repeat(50));

  let successCount = 0;
  let existedCount = 0;
  let errorCount = 0;

  results.forEach(result => {
    if (result.success && result.existed) {
      console.log(`⚠️  ${result.name} (${result.employee_id}) - 이미 존재`);
      existedCount++;
    } else if (result.success) {
      console.log(`✅ ${result.name} (${result.employee_id}) - 생성 완료`);
      successCount++;
    } else {
      console.log(`❌ ${result.name} (${result.employee_id}) - 생성 실패`);
      errorCount++;
    }
  });

  console.log('\n📈 통계:');
  console.log(`- 새로 생성: ${successCount}명`);
  console.log(`- 이미 존재: ${existedCount}명`);
  console.log(`- 생성 실패: ${errorCount}명`);
  console.log(`- 총 처리: ${results.length}명`);

  console.log('\n🔑 생성된 계정 정보:');
  console.log('='.repeat(50));
  testUsers.forEach(user => {
    console.log(`사번: ${user.employee_id} | 비밀번호: pnuh${user.employee_id} | 이름: ${user.name}`);
  });

  console.log('\n🎉 사용자 생성 작업 완료!');
}

// 스크립트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  createAllUsers().catch(error => {
    console.error('스크립트 실행 중 오류 발생:', error);
    process.exit(1);
  });
} 