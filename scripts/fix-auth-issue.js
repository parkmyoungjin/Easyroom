#!/usr/bin/env node

/**
 * Auth 회원가입 문제 해결 스크립트
 * "Database error saving new user" 에러 해결
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixAuthIssue() {
  console.log('🔧 Auth 문제 해결 시작...\n');
  
  try {
    // 1. 이메일 확인 없이 회원가입 시도
    console.log('1. 이메일 확인 비활성화 회원가입 테스트...');
    
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: 'test@example.com',
      password: 'password123',
      options: {
        emailRedirectTo: undefined, // 이메일 확인 비활성화
        data: {
          email_confirm: false
        }
      }
    });
    
    if (signUpError) {
      console.error('❌ 여전히 실패:', signUpError.message);
      
      // 2. Admin API로 직접 사용자 생성 시도
      console.log('\n2. Admin API로 사용자 직접 생성 시도...');
      
      const { data: adminData, error: adminError } = await supabase.auth.admin.createUser({
        email: 'admin-test@example.com',
        password: 'password123',
        email_confirm: true, // 이메일 확인을 바로 완료로 설정
        user_metadata: {
          employeeId: 'ADMIN001',
          fullName: 'Admin Test User',
          department: 'IT',
          role: 'admin'
        }
      });
      
      if (adminError) {
        console.error('❌ Admin 생성도 실패:', adminError.message);
        
        // 3. 환경 변수 및 프로젝트 설정 확인
        console.log('\n3. 프로젝트 설정 확인...');
        console.log('프로젝트 URL:', supabaseUrl);
        console.log('Service Key 길이:', supabaseServiceKey.length);
        
        // 4. 해결 방법 제시
        console.log('\n🔍 가능한 해결 방법:');
        console.log('1. Supabase 대시보드에서 Authentication > Settings 확인');
        console.log('2. "Enable email confirmations" 비활성화');
        console.log('3. "Enable phone confirmations" 비활성화');
        console.log('4. SMTP 설정이 없다면 이메일 확인 기능 끄기');
        console.log('5. 프로젝트를 새로 생성하거나 초기화');
        
        console.log('\n📋 Supabase 대시보드 링크:');
        const projectId = supabaseUrl.split('//')[1].split('.')[0];
        console.log(`https://supabase.com/dashboard/project/${projectId}/auth/users`);
        console.log(`https://supabase.com/dashboard/project/${projectId}/auth/settings`);
        
      } else {
        console.log('✅ Admin API로 사용자 생성 성공:', adminData.user?.id);
        
        // users 테이블에도 삽입
        const { error: userInsertError } = await supabase
          .from('users')
          .insert({
            auth_id: adminData.user.id,
            employee_id: 'ADMIN001',
            name: 'Admin Test User',
            email: 'admin-test@example.com',
            department: 'IT',
            role: 'admin',
            is_active: true,
          });
        
        if (userInsertError) {
          console.error('❌ users 테이블 삽입 실패:', userInsertError);
        } else {
          console.log('✅ users 테이블 삽입 성공');
          console.log('\n🎉 Admin API를 사용한 회원가입이 작동합니다!');
          console.log('💡 일반 signUp 대신 admin.createUser를 사용하세요.');
        }
      }
      
    } else {
      console.log('✅ 이메일 확인 비활성화 회원가입 성공:', authData.user?.id);
    }
    
  } catch (error) {
    console.error('❌ 예외 발생:', error.message);
  }
}

fixAuthIssue().catch(console.error);