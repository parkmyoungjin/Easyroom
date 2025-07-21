// 간단한 로그인 테스트 스크립트
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function simpleLoginTest() {
  console.log('=== 간단한 로그인 테스트 ===\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY // Anonymous key 사용
  );

  const testCredentials = [
    { employeeId: '6666666', password: 'pnuh6666666', name: '테스트 관리자' },
    { employeeId: '1234567', password: 'pnuh1234567', name: '테스트 직원' }
  ];

  console.log('🔍 생성된 사용자들로 로그인 테스트를 시작합니다...\n');

  for (const cred of testCredentials) {
    const email = `${cred.employeeId}@company.com`;
    
    console.log(`${cred.name} 로그인 시도:`);
    console.log(`   이메일: ${email}`);
    console.log(`   비밀번호: ${cred.password}`);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: cred.password
      });

      if (error) {
        console.log(`   ❌ 로그인 실패: ${error.message}`);
        
        // 구체적인 에러별 해결 방안
        if (error.message.includes('Email logins are disabled')) {
          console.log('   🔧 해결: Supabase Dashboard → Authentication → Providers → Email을 활성화하세요');
        } else if (error.message.includes('Invalid login credentials')) {
          console.log('   🔧 해결: 사용자 생성을 다시 확인하거나 비밀번호를 확인하세요');
        } else if (error.message.includes('Email not confirmed')) {
          console.log('   🔧 해결: Authentication → Settings에서 "Email confirmations"를 비활성화하세요');
        } else if (error.message.includes('Signups not allowed')) {
          console.log('   🔧 해결: Authentication → Settings에서 "Enable signup"을 활성화하세요');
        }
      } else if (data.user) {
        console.log(`   ✅ 로그인 성공!`);
        console.log(`   사용자 ID: ${data.user.id}`);
        console.log(`   이메일: ${data.user.email}`);
        
        const metadata = data.user.user_metadata || {};
        console.log(`   이름: ${metadata.fullName || '메타데이터 없음'}`);
        console.log(`   사번: ${metadata.employeeId || '메타데이터 없음'}`);
        console.log(`   부서: ${metadata.department || '메타데이터 없음'}`);
        console.log(`   권한: ${metadata.role || '메타데이터 없음'}`);
        
        // 세션 정보
        if (data.session) {
          console.log(`   세션 만료: ${new Date(data.session.expires_at * 1000).toLocaleString()}`);
        }
        
        // 로그아웃
        await supabase.auth.signOut();
        console.log(`   ✅ 로그아웃 완료`);
      } else {
        console.log(`   ⚠️  로그인 데이터가 없습니다`);
      }
      
    } catch (loginError) {
      console.log(`   ❌ 로그인 중 예외 발생: ${loginError.message}`);
    }
    
    console.log(''); // 빈 줄
  }

  // 추가: 회원가입 테스트 (임시)
  console.log('📝 회원가입 기능 테스트...');
  const tempEmail = `temp_${Date.now()}@company.com`;
  const tempPassword = 'temp123456';

  try {
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: tempEmail,
      password: tempPassword,
      options: {
        data: {
          employeeId: '9999999',
          fullName: '임시 테스트',
          department: '테스트부서',
          role: 'employee'
        }
      }
    });

    if (signupError) {
      console.log(`❌ 회원가입 실패: ${signupError.message}`);
      
      if (signupError.message.includes('Signups not allowed')) {
        console.log('🔧 해결: Authentication → Settings에서 "Enable signup"을 활성화하세요');
      }
    } else {
      console.log(`✅ 회원가입 성공: ${signupData.user?.email}`);
      
      // 임시 사용자 삭제 (Admin API 사용)
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      if (signupData.user) {
        await adminClient.auth.admin.deleteUser(signupData.user.id);
        console.log('✅ 임시 사용자 삭제 완료');
      }
    }
  } catch (signupErr) {
    console.log(`❌ 회원가입 테스트 중 오류: ${signupErr.message}`);
  }
}

simpleLoginTest().then(() => {
  console.log('\n=== 테스트 완료 ===');
  console.log('만약 "Email logins are disabled" 에러가 나온다면:');
  console.log('1. https://supabase.com/dashboard/project/wneuinjfajzmknwiqdcd/auth/providers');
  console.log('2. Email provider를 활성화하세요');
  console.log('3. 설정 변경 후 몇 분 기다린 다음 다시 테스트하세요');
  process.exit(0);
}).catch((error) => {
  console.error('❌ 테스트 실패:', error);
  process.exit(1);
});
