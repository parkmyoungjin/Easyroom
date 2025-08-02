// Supabase Auth 설정 상태 확인 스크립트
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkAuthSettings() {
  console.log('=== Supabase Auth 설정 확인 ===\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Auth 설정 확인
    console.log('1. Auth 설정 확인...');
    const { data: settings, error: settingsError } = await supabase.auth.getSettings();
    
    if (settingsError) {
      console.error('❌ Auth 설정 확인 실패:', settingsError.message);
    } else {
      console.log('✅ Auth 설정 확인 성공');
      console.log(`   외부 이메일 활성화: ${settings.external_email_enabled ? '✅' : '❌'}`);
      console.log(`   외부 폰 활성화: ${settings.external_phone_enabled ? '✅' : '❌'}`);
      console.log(`   회원가입 비활성화: ${settings.disable_signup ? '❌ 비활성화됨' : '✅ 활성화됨'}`);
      console.log(`   이메일 확인 비활성화: ${settings.email_confirm_change_enabled ? '필요함' : '필요없음'}`);
    }

    // 2. 간단한 이메일 로그인 테스트
    console.log('\n2. 이메일 로그인 기능 테스트...');
    const testEmail = '6666666@company.com';
    const testPassword = 'pnuh6666666';

    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (loginError) {
      console.error(`❌ 로그인 테스트 실패: ${loginError.message}`);
      
      // 구체적인 해결 방안 제시
      if (loginError.message.includes('Email logins are disabled')) {
        console.log('\n🔧 해결 방법:');
        console.log('1. Supabase Dashboard → Authentication → Providers');
        console.log('2. Email provider를 찾아서 "Enable" 토글을 ON으로 설정');
        console.log('3. Save 버튼 클릭');
        console.log('4. 몇 분 후 다시 테스트');
      } else if (loginError.message.includes('Invalid login credentials')) {
        console.log('\n🔧 해결 방법:');
        console.log('1. 사용자가 올바르게 생성되었는지 확인');
        console.log('2. 이메일과 비밀번호가 정확한지 확인');
      } else if (loginError.message.includes('Email not confirmed')) {
        console.log('\n🔧 해결 방법:');
        console.log('1. Authentication → Settings에서 "Enable email confirmations" 해제');
        console.log('2. 또는 사용자의 email_confirmed_at 값을 수동으로 설정');
      }
    } else {
      console.log('✅ 로그인 테스트 성공');
      console.log(`   사용자 ID: ${loginData.user.id}`);
      console.log(`   이메일: ${loginData.user.email}`);
      
      const metadata = loginData.user.user_metadata || {};
      console.log(`   이름: ${metadata.fullName || '없음'}`);
      console.log(`   사번: ${metadata.employeeId || '없음'}`);
      
      // 로그아웃
      await supabase.auth.signOut();
      console.log('   로그아웃 완료');
    }

    // 3. 회원가입 테스트 (임시 사용자)
    console.log('\n3. 회원가입 기능 테스트...');
    const tempEmail = `temp_${Date.now()}@company.com`;
    const tempPassword = 'temppassword123';

    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: tempEmail,
      password: tempPassword,
      options: {
        data: {
          employeeId: '9999999',
          fullName: '임시 테스트 사용자',
          department: '테스트부서',
          role: 'employee'
        }
      }
    });

    if (signupError) {
      console.error(`❌ 회원가입 테스트 실패: ${signupError.message}`);
      
      if (signupError.message.includes('Signups not allowed')) {
        console.log('\n🔧 해결 방법:');
        console.log('1. Authentication → Settings에서 "Enable signup" 체크');
      }
    } else {
      console.log('✅ 회원가입 테스트 성공');
      console.log(`   임시 사용자 생성됨: ${signupData.user?.email}`);
      
      // 임시 사용자 삭제
      if (signupData.user) {
        await supabase.auth.admin.deleteUser(signupData.user.id);
        console.log('   임시 사용자 삭제 완료');
      }
    }

  } catch (error) {
    console.error('❌ 전체 테스트 중 오류:', error);
  }
}

checkAuthSettings().then(() => {
  console.log('\n=== 설정 확인 완료 ===');
  console.log('문제가 있다면 위의 해결 방법을 따라 Supabase Dashboard에서 설정을 수정해주세요.');
  process.exit(0);
}).catch((error) => {
  console.error('❌ 설정 확인 실패:', error);
  process.exit(1);
});
