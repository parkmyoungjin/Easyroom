// Supabase 정책 현황 조회 스크립트
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkSupbasePolicies() {
  console.log('=== Supabase 정책 현황 조회 ===\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. 모든 테이블의 RLS 상태 확인
    console.log('1. 테이블별 RLS(Row Level Security) 상태:');
    const { data: rlsStatus, error: rlsError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE');

    if (rlsError) {
      console.error('❌ RLS 상태 조회 실패:', rlsError.message);
    } else {
      for (const table of rlsStatus) {
        const { data: rlsInfo } = await supabase.rpc('check_rls_status', { 
          table_name: table.table_name 
        }).single();
        
        console.log(`   📋 ${table.table_name}: ${rlsInfo ? '🔒 RLS 활성화' : '🔓 RLS 비활성화'}`);
      }
    }

    // 2. 모든 정책 조회
    console.log('\n2. 설정된 RLS 정책들:');
    const policiesQuery = `
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies 
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `;

    const { data: policies, error: policiesError } = await supabase.rpc('exec_sql', {
      sql: policiesQuery
    });

    if (policiesError) {
      console.error('❌ 정책 조회 실패:', policiesError.message);
    } else if (policies && policies.length > 0) {
      policies.forEach(policy => {
        console.log(`\n   📜 테이블: ${policy.tablename}`);
        console.log(`      정책명: ${policy.policyname}`);
        console.log(`      명령어: ${policy.cmd}`);
        console.log(`      역할: ${JSON.stringify(policy.roles)}`);
        console.log(`      조건: ${policy.qual || '없음'}`);
        console.log(`      체크: ${policy.with_check || '없음'}`);
      });
    } else {
      console.log('   ⚠️  설정된 RLS 정책이 없습니다.');
    }

    // 3. Auth 관련 테이블 확인
    console.log('\n3. Auth 스키마 테이블들:');
    const authTablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'auth' 
      ORDER BY table_name;
    `;

    const { data: authTables, error: authError } = await supabase.rpc('exec_sql', {
      sql: authTablesQuery
    });

    if (authError) {
      console.error('❌ Auth 테이블 조회 실패:', authError.message);
    } else if (authTables) {
      authTables.forEach(table => {
        console.log(`   🔐 ${table.table_name}`);
      });
    }

    // 4. 현재 사용자 권한 확인
    console.log('\n4. 현재 데이터베이스 사용자:');
    const { data: currentUser } = await supabase.rpc('exec_sql', {
      sql: 'SELECT current_user, current_setting(\'role\') as current_role;'
    });

    if (currentUser && currentUser.length > 0) {
      console.log(`   👤 사용자: ${currentUser[0].current_user}`);
      console.log(`   🎭 역할: ${currentUser[0].current_role}`);
    }

  } catch (error) {
    console.error('❌ 조회 중 오류 발생:', error);
  }
}

// RLS 상태 확인 함수 생성 (만약 없다면)
async function createHelperFunctions() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const createRlsCheckFunction = `
    CREATE OR REPLACE FUNCTION check_rls_status(table_name text)
    RETURNS boolean AS $$
    DECLARE
        rls_enabled boolean;
    BEGIN
        SELECT relrowsecurity INTO rls_enabled
        FROM pg_class
        WHERE relname = table_name;
        
        RETURN COALESCE(rls_enabled, false);
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  const createExecSqlFunction = `
    CREATE OR REPLACE FUNCTION exec_sql(sql text)
    RETURNS json AS $$
    DECLARE
        result json;
    BEGIN
        EXECUTE 'SELECT json_agg(t) FROM (' || sql || ') t' INTO result;
        RETURN COALESCE(result, '[]'::json);
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  try {
    await supabase.rpc('exec', { sql: createRlsCheckFunction });
    await supabase.rpc('exec', { sql: createExecSqlFunction });
    console.log('✅ 헬퍼 함수 생성 완료');
  } catch (error) {
    console.log('⚠️  헬퍼 함수 생성 실패 (이미 존재할 수 있음)');
  }
}

async function main() {
  await createHelperFunctions();
  await checkSupbasePolicies();
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ 실행 실패:', error);
  process.exit(1);
});
