#!/usr/bin/env node

/**
 * 단계별 데이터베이스 스키마 설정 스크립트
 * Supabase 클라이언트를 통해 테이블을 하나씩 생성
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase 환경변수가 설정되지 않았습니다.');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQL(description, sql) {
  console.log(`📝 ${description}...`);
  try {
    const { data, error } = await supabase.rpc('exec', { sql });
    if (error) {
      throw error;
    }
    console.log(`   ✅ ${description} 완료`);
    return true;
  } catch (error) {
    console.error(`   ❌ ${description} 실패:`, error.message);
    return false;
  }
}

async function setupDatabase() {
  console.log('🚀 새 Supabase 프로젝트 데이터베이스 스키마 설정 시작...\n');

  // 1. users 테이블 생성
  const usersTableSQL = `
    CREATE TABLE IF NOT EXISTS public.users (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
        employee_id TEXT UNIQUE,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        department TEXT NOT NULL,
        role TEXT CHECK (role IN ('employee', 'admin')) DEFAULT 'employee',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  // 2. rooms 테이블 생성
  const roomsTableSQL = `
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

  // 3. reservations 테이블 생성
  const reservationsTableSQL = `
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

  // 단계별 실행
  const steps = [
    ['users 테이블 생성', usersTableSQL],
    ['rooms 테이블 생성', roomsTableSQL],
    ['reservations 테이블 생성', reservationsTableSQL]
  ];

  let allSuccess = true;
  for (const [description, sql] of steps) {
    const success = await executeSQL(description, sql);
    if (!success) {
      allSuccess = false;
    }
  }

  if (!allSuccess) {
    console.log('\n⚠️  일부 단계가 실패했습니다. 수동으로 SQL을 실행해주세요.');
    console.log('\n📋 수동 실행 방법:');
    console.log('1. https://supabase.com/dashboard 접속');
    console.log('2. 프로젝트 선택 → SQL Editor');
    console.log('3. scripts/setup-email-auth-database.sql 파일 내용 복사하여 실행');
    return;
  }

  console.log('\n🎉 기본 테이블 생성 완료!');
  console.log('\n다음 단계:');
  console.log('1. Supabase 대시보드에서 SQL Editor 열기');
  console.log('2. scripts/setup-email-auth-database.sql의 나머지 부분 실행:');
  console.log('   - 인덱스 생성');
  console.log('   - 트리거 설정');
  console.log('   - RLS 정책 설정');
  console.log('   - 함수 생성');
  console.log('   - 샘플 데이터 삽입');
}

// 스크립트 실행
if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase };