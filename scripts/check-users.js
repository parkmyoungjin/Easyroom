#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUsers() {
  console.log('🔍 생성된 사용자 확인...');
  
  try {
    // users 테이블 확인
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (usersError) {
      console.error('❌ users 테이블 조회 실패:', usersError);
    } else {
      console.log('✅ users 테이블 조회 성공');
      console.log('📊 총 사용자 수:', users.length);
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.employee_id}) - ${user.department} - ${user.role}`);
      });
    }
    
    // Auth 사용자 확인
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Auth 사용자 조회 실패:', authError);
    } else {
      console.log('\n✅ Auth 사용자 조회 성공');
      console.log('📊 총 Auth 사용자 수:', authUsers.users.length);
    }
    
    // rooms 테이블 확인
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('*');
    
    if (roomsError) {
      console.error('❌ rooms 테이블 조회 실패:', roomsError);
    } else {
      console.log('\n✅ rooms 테이블 조회 성공');
      console.log('📊 총 회의실 수:', rooms.length);
      rooms.forEach((room, index) => {
        console.log(`${index + 1}. ${room.name} - ${room.capacity}명 - ${room.location}`);
      });
    }
    
  } catch (error) {
    console.error('❌ 확인 중 예외:', error.message);
  }
}

checkUsers();