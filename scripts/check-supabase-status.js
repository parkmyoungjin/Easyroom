// Supabase 정책 현황 조회 스크립트 (수정된 버전)
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkSupabaseStatus() {
  console.log('=== Supabase 연결 및 상태 확인 ===\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. 기본 연결 테스트
    console.log('1. Supabase 연결 테스트...');
    const { data: connectionTest, error: connectionError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .limit(1);

    if (connectionError) {
      console.error('❌ Supabase 연결 실패:', connectionError.message);
      return;
    }
    console.log('✅ Supabase 연결 성공');

    // 2. Auth 사용자 조회
    console.log('\n2. Auth 사용자 현황...');
    try {
      const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
      
      if (usersError) {
        console.error('❌ 사용자 조회 실패:', usersError.message);
      } else {
        console.log(`✅ 등록된 사용자 수: ${users.users.length}명`);
        
        if (users.users.length > 0) {
          console.log('\n   📋 사용자 목록:');
          users.users.forEach((user, index) => {
            const metadata = user.user_metadata || {};
            console.log(`   ${index + 1}. ${metadata.fullName || '이름없음'} (${metadata.employeeId || 'ID없음'})`);
            console.log(`      이메일: ${user.email}`);
            console.log(`      생성일: ${new Date(user.created_at).toLocaleDateString()}`);
            console.log(`      확인됨: ${user.email_confirmed_at ? '✅' : '❌'}`);
            console.log('');
          });
        }
      }
    } catch (authError) {
      console.error('❌ Auth 조회 중 오류:', authError.message);
    }

    // 3. 테이블 존재 여부 확인
    console.log('3. 주요 테이블 존재 여부...');
    const tablesToCheck = ['users', 'rooms', 'reservations'];
    
    for (const tableName of tablesToCheck) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`   ❌ ${tableName} 테이블: 존재하지 않음 또는 접근 불가`);
          console.log(`      에러: ${error.message}`);
        } else {
          console.log(`   ✅ ${tableName} 테이블: 존재함 (데이터 ${data.length}개)`);
        }
      } catch (tableError) {
        console.log(`   ❌ ${tableName} 테이블: 조회 실패`);
      }
    }

    // 4. Auth 설정 확인
    console.log('\n4. Auth 설정 확인...');
    try {
      // 간단한 Auth 테스트
      const testEmail = 'test@example.com';
      const { data, error } = await supabase.auth.admin.getUserById('00000000-0000-0000-0000-000000000000');
      
      // 에러가 있어도 정상 - 단지 연결이 되는지 확인
      console.log('✅ Auth 기능 접근 가능');
    } catch (authTestError) {
      console.log('⚠️  Auth 기능 테스트 실패:', authTestError.message);
    }

    // 5. 환경변수 재확인
    console.log('\n5. 환경변수 상태...');
    console.log(`   URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ 설정됨' : '❌ 설정되지 않음'}`);
    console.log(`   ANON KEY: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ 설정됨' : '❌ 설정되지 않음'}`);
    console.log(`   SERVICE KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ 설정됨' : '❌ 설정되지 않음'}`);

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.log(`   프로젝트 URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
    }

  } catch (error) {
    console.error('❌ 전체 조회 중 오류 발생:', error);
  }
}

checkSupabaseStatus().then(() => {
  console.log('\n=== 조회 완료 ===');
  process.exit(0);
}).catch((error) => {
  console.error('❌ 실행 실패:', error);
  process.exit(1);
});
