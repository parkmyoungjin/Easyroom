// 기본 Supabase 연결 테스트
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function basicConnectionTest() {
  console.log('=== 기본 Supabase 연결 테스트 ===\n');

  // 환경변수 확인
  console.log('1. 환경변수 확인:');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log(`   URL: ${url ? '✅ 설정됨' : '❌ 없음'}`);
  console.log(`   ANON KEY: ${anonKey ? '✅ 설정됨' : '❌ 없음'}`);
  console.log(`   SERVICE KEY: ${serviceKey ? '✅ 설정됨' : '❌ 없음'}`);

  if (url) {
    console.log(`   프로젝트 URL: ${url}`);
  }

  if (!url || !anonKey || !serviceKey) {
    console.log('\n❌ 환경변수가 설정되지 않았습니다.');
    console.log('다음 파일을 확인해주세요: .env.local');
    console.log('\n필요한 환경변수:');
    console.log('NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co');
    console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key');
    console.log('SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
    return;
  }

  try {
    // 2. 기본 Auth 연결 테스트 (Service Role)
    console.log('\n2. Service Role 클라이언트 테스트:');
    const supabaseAdmin = createClient(url, serviceKey);
    
    try {
      const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (usersError) {
        console.log(`   ❌ Service Role 실패: ${usersError.message}`);
      } else {
        console.log(`   ✅ Service Role 성공: ${users.users.length}명의 사용자 발견`);
        
        users.users.forEach((user, index) => {
          const metadata = user.user_metadata || {};
          console.log(`      ${index + 1}. ${user.email} (${metadata.fullName || '이름없음'})`);
        });
      }
    } catch (serviceError) {
      console.log(`   ❌ Service Role 오류: ${serviceError.message}`);
    }

    // 3. Anonymous 클라이언트 테스트
    console.log('\n3. Anonymous 클라이언트 테스트:');
    const supabaseAnon = createClient(url, anonKey);
    
    try {
      const { data: session, error: sessionError } = await supabaseAnon.auth.getSession();
      
      if (sessionError) {
        console.log(`   ❌ Anonymous 클라이언트 실패: ${sessionError.message}`);
      } else {
        console.log(`   ✅ Anonymous 클라이언트 성공`);
        console.log(`      세션: ${session?.session ? '있음' : '없음'}`);
      }
    } catch (anonError) {
      console.log(`   ❌ Anonymous 클라이언트 오류: ${anonError.message}`);
    }

    // 4. 테스트 로그인 시도
    console.log('\n4. 테스트 로그인 시도:');
    const testCredentials = [
      { employeeId: '6666666', password: 'pnuh6666666' },
      { employeeId: '1234567', password: 'pnuh1234567' }
    ];

    for (const cred of testCredentials) {
      const email = `${cred.employeeId}@company.com`;
      
      try {
        const { data, error } = await supabaseAnon.auth.signInWithPassword({
          email,
          password: cred.password
        });

        if (error) {
          console.log(`   ❌ ${cred.employeeId} 로그인 실패: ${error.message}`);
        } else {
          console.log(`   ✅ ${cred.employeeId} 로그인 성공`);
          const metadata = data.user?.user_metadata || {};
          console.log(`      사용자: ${metadata.fullName || '이름없음'}`);
          
          // 로그아웃
          await supabaseAnon.auth.signOut();
        }
      } catch (loginError) {
        console.log(`   ❌ ${cred.employeeId} 로그인 오류: ${loginError.message}`);
      }
    }

    // 5. Supabase 프로젝트 정보 확인
    console.log('\n5. 프로젝트 정보:');
    const projectId = url.match(/https:\/\/(.+?)\.supabase\.co/)?.[1];
    if (projectId) {
      console.log(`   프로젝트 ID: ${projectId}`);
      console.log(`   대시보드: https://supabase.com/dashboard/project/${projectId}`);
    }

  } catch (error) {
    console.error('\n❌ 전체 테스트 중 오류:', error);
  }
}

basicConnectionTest().then(() => {
  console.log('\n=== 테스트 완료 ===');
  process.exit(0);
}).catch((error) => {
  console.error('❌ 테스트 실패:', error);
  process.exit(1);
});
