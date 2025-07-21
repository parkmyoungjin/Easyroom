// 테스트 사용자 생성 스크립트
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function createTestUsers() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const testUsers = [
    {
      employeeId: '6666666',
      fullName: '테스트 사용자',
      department: 'IT개발팀',
      role: 'admin'
    },
    {
      employeeId: '1234567',
      fullName: '일반 사용자',
      department: '총무팀',
      role: 'employee'
    }
  ];

  for (const userData of testUsers) {
    const email = `${userData.employeeId}@company.com`;
    const password = `pnuh${userData.employeeId}`;

    // 📝 camelCase로 user_metadata 구성
    const userMetadata = {
      employeeId: userData.employeeId,
      fullName: userData.fullName,
      department: userData.department,
      role: userData.role
    };

    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        user_metadata: userMetadata,
        email_confirm: true // 이메일 확인 없이 바로 활성화
      });

      if (error) {
        console.error(`❌ Error creating user ${userData.employeeId}:`, error.message);
      } else {
        console.log(`✅ Created user: ${userData.fullName} (${userData.employeeId})`);
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}`);
      }
    } catch (error) {
      console.error(`Exception creating user ${userData.employeeId}:`, error);
    }
  }
}

createTestUsers().then(() => {
  console.log('\n🎉 Test users creation completed');
  console.log('You can now login with:');
  console.log('- Admin: 6666666 / pnuh6666666');
  console.log('- Employee: 1234567 / pnuh1234567');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Failed to create test users:', error);
  process.exit(1);
});
