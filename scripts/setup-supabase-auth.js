#!/usr/bin/env node

/**
 * 새 Supabase 프로젝트 초기 설정 스크립트
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

async function createTables() {
  console.log('🔧 데이터베이스 테이블 생성...');
  
  try {
    // 1. users 테이블 생성
    console.log('1. users 테이블 생성...');
    const usersSQL = `
      CREATE TABLE IF NOT EXISTS public.users (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
          employee_id TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          department TEXT NOT NULL,
          role TEXT CHECK (role IN ('employee', 'admin')) DEFAULT 'employee',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    
    const { error: usersError } = await supabase.rpc('exec_sql', { sql: usersSQL });
    if (usersError) {
      console.error('❌ users 테이블 생성 실패:', usersError);
    } else {
      console.log('✅ users 테이블 생성 성공');
    }
    
    // 2. rooms 테이블 생성
    console.log('2. rooms 테이블 생성...');
    const roomsSQL = `
      CREATE TABLE IF NOT EXISTS public.rooms (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          capacity INTEGER NOT NULL,
          location TEXT,
          amenities JSONB DEFAULT '{}',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    
    const { error: roomsError } = await supabase.rpc('exec_sql', { sql: roomsSQL });
    if (roomsError) {
      console.error('❌ rooms 테이블 생성 실패:', roomsError);
    } else {
      console.log('✅ rooms 테이블 생성 성공');
    }
    
    // 3. reservations 테이블 생성
    console.log('3. reservations 테이블 생성...');
    const reservationsSQL = `
      CREATE TABLE IF NOT EXISTS public.reservations (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
          user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
          title TEXT NOT NULL,
          purpose TEXT,
          start_time TIMESTAMPTZ NOT NULL,
          end_time TIMESTAMPTZ NOT NULL,
          status TEXT CHECK (status IN ('confirmed', 'cancelled')) DEFAULT 'confirmed',
          cancellation_reason TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    
    const { error: reservationsError } = await supabase.rpc('exec_sql', { sql: reservationsSQL });
    if (reservationsError) {
      console.error('❌ reservations 테이블 생성 실패:', reservationsError);
    } else {
      console.log('✅ reservations 테이블 생성 성공');
    }
    
  } catch (error) {
    console.error('❌ 테이블 생성 중 예외:', error.message);
  }
}

async function insertSampleData() {
  console.log('📝 샘플 데이터 삽입...');
  
  try {
    // rooms 샘플 데이터
    const { error: roomsError } = await supabase
      .from('rooms')
      .upsert([
        {
          name: '회의실 A',
          description: '대형 회의실',
          capacity: 10,
          location: '1층',
          amenities: { projector: true, whiteboard: true, wifi: true }
        },
        {
          name: '회의실 B', 
          description: '중형 회의실',
          capacity: 6,
          location: '2층',
          amenities: { tv: true, whiteboard: true, wifi: true }
        },
        {
          name: '회의실 C',
          description: '소형 회의실', 
          capacity: 4,
          location: '3층',
          amenities: { whiteboard: true, wifi: true }
        }
      ], { onConflict: 'name' });
    
    if (roomsError) {
      console.error('❌ 회의실 데이터 삽입 실패:', roomsError);
    } else {
      console.log('✅ 회의실 샘플 데이터 삽입 성공');
    }
    
  } catch (error) {
    console.error('❌ 샘플 데이터 삽입 중 예외:', error.message);
  }
}

async function testConnection() {
  console.log('🔍 연결 및 기본 기능 테스트...');
  
  try {
    // 1. 테이블 존재 확인
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('*')
      .limit(1);
    
    if (roomsError) {
      console.error('❌ rooms 테이블 접근 실패:', roomsError);
    } else {
      console.log('✅ rooms 테이블 접근 성공');
    }
    
    // 2. Auth 기본 테스트
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'admin@company.com',
      password: 'pnuhadmin',
      email_confirm: true,
      user_metadata: {
        employeeId: 'ADMIN001',
        fullName: 'System Admin',
        department: 'IT',
        role: 'admin'
      }
    });
    
    if (authError) {
      console.error('❌ Admin 사용자 생성 실패:', authError);
    } else {
      console.log('✅ Admin 사용자 생성 성공:', authData.user?.id);
      
      // users 테이블에도 삽입
      const { error: userInsertError } = await supabase
        .from('users')
        .insert({
          auth_id: authData.user.id,
          employee_id: 'ADMIN001',
          name: 'System Admin',
          email: 'admin@company.com',
          department: 'IT',
          role: 'admin',
          is_active: true,
        });
      
      if (userInsertError) {
        console.error('❌ users 테이블 삽입 실패:', userInsertError);
      } else {
        console.log('✅ users 테이블 삽입 성공');
      }
    }
    
  } catch (error) {
    console.error('❌ 테스트 중 예외:', error.message);
  }
}

async function main() {
  console.log('🚀 새 Supabase 프로젝트 초기 설정 시작\n');
  console.log('프로젝트 URL:', supabaseUrl);
  console.log('='.repeat(60));
  
  await createTables();
  console.log('');
  await insertSampleData();
  console.log('');
  await testConnection();
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 초기 설정 완료!');
  console.log('💡 이제 회원가입 API를 테스트할 수 있습니다.');
}

main().catch(console.error);