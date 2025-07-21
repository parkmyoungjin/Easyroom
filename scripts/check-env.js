// 환경변수 확인 스크립트
require('dotenv').config({ path: '.env.local' });

console.log('=== 환경변수 확인 ===');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ 설정됨' : '❌ 설정되지 않음');
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ 설정됨' : '❌ 설정되지 않음');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ 설정됨' : '❌ 설정되지 않음');

if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
}

console.log('\n=== Supabase 연결 테스트 ===');
const { createClient } = require('@supabase/supabase-js');

try {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  console.log('✅ Supabase 클라이언트 생성 성공');
  
  // Auth 기본 설정 확인
  supabase.auth.getSettings().then((settings) => {
    console.log('✅ Auth 설정 확인 성공');
  }).catch((error) => {
    console.log('❌ Auth 설정 확인 실패:', error.message);
  });
  
} catch (error) {
  console.log('❌ Supabase 클라이언트 생성 실패:', error.message);
}
