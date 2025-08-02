// 개선된 사용자 생성 스크립트 (Admin API 사용)
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function createUsersWithAdminAPI() {
  console.log('=== Admin API로 사용자 생성 ===\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  const testUsers = [
    {
      employeeId: '6666666',
      fullName: '테스트 관리자',
      department: 'IT개발팀',
      role: 'admin'
    },
    {
      employeeId: '1234567',
      fullName: '테스트 직원',
      department: '총무팀',
      role: 'employee'
    }
  ];

  try {
    // 1. 기존 사용자 확인
    console.log('1. 기존 사용자 확인...');
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ 사용자 목록 조회 실패:', listError.message);
      
      // Service Role 키가 잘못되었을 가능성
      if (listError.message.includes('not allowed') || listError.message.includes('JWT')) {
        console.log('\n🔧 해결 방법:');
        console.log('1. Supabase Dashboard → Settings → API에서 Service Role Key 다시 복사');
        console.log('2. .env.local 파일의 SUPABASE_SERVICE_ROLE_KEY 업데이트');
        console.log('3. 개발 서버 재시작 (npm run dev)');
      }
      return;
    }

    console.log(`✅ 현재 사용자 수: ${existingUsers.users.length}명`);

    // 2. 테스트 사용자들 생성
    for (const userData of testUsers) {
      const email = `${userData.employeeId}@company.com`;
      const password = `pnuh${userData.employeeId}`;

      // 기존 사용자 확인
      const existingUser = existingUsers.users.find(u => u.email === email);
      if (existingUser) {
        console.log(`⚠️  사용자가 이미 존재: ${userData.fullName} (${email})`);
        continue;
      }

      console.log(`\n사용자 생성 중: ${userData.fullName}`);
      console.log(`   이메일: ${email}`);
      console.log(`   비밀번호: ${password}`);

      const userMetadata = {
        employeeId: userData.employeeId,
        fullName: userData.fullName,
        department: userData.department,
        role: userData.role
      };

      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        user_metadata: userMetadata,
        email_confirm: true, // 이메일 확인 없이 바로 활성화
        phone_confirm: true  // 폰 확인 없이 바로 활성화
      });

      if (error) {
        console.error(`❌ ${userData.fullName} 생성 실패:`, error.message);
        
        // 구체적인 에러 해결 방안 제시
        if (error.message.includes('already exists')) {
          console.log('   → 이미 존재하는 이메일입니다.');
        } else if (error.message.includes('password')) {
          console.log('   → 비밀번호 정책을 확인해주세요.');
        } else if (error.message.includes('signup')) {
          console.log('   → Authentication → Settings에서 "Enable signup"을 확인해주세요.');
        }
      } else {
        console.log(`✅ ${userData.fullName} 생성 성공`);
        console.log(`   사용자 ID: ${data.user.id}`);
      }
    }

    // 3. 생성 후 전체 사용자 목록 다시 확인
    console.log('\n3. 최종 사용자 목록:');
    const { data: finalUsers, error: finalError } = await supabase.auth.admin.listUsers();
    
    if (finalError) {
      console.error('❌ 최종 확인 실패:', finalError.message);
    } else {
      finalUsers.users.forEach((user, index) => {
        const metadata = user.user_metadata || {};
        console.log(`   ${index + 1}. ${metadata.fullName || '이름없음'} (${metadata.employeeId || 'ID없음'})`);
        console.log(`      이메일: ${user.email}`);
        console.log(`      확인됨: ${user.email_confirmed_at ? '✅' : '❌'}`);
        console.log('');
      });

      console.log('\n🎉 사용자 생성 완료!');
      console.log('이제 다음 계정으로 로그인할 수 있습니다:');
      console.log('- 관리자: 6666666 / pnuh6666666');
      console.log('- 직원: 1234567 / pnuh1234567');
    }

  } catch (error) {
    console.error('❌ 전체 과정 중 오류:', error);
  }
}

createUsersWithAdminAPI().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ 스크립트 실행 실패:', error);
  process.exit(1);
});
