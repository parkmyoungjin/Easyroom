-- Supabase 정책 현황 조회 SQL 쿼리들
-- 이 쿼리들을 Supabase Dashboard > SQL Editor에서 실행하세요

-- 1. 모든 테이블의 RLS 상태 확인
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '🔒 RLS 활성화'
        ELSE '🔓 RLS 비활성화'
    END as rls_status
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. 설정된 모든 RLS 정책 조회
SELECT 
    schemaname as "스키마",
    tablename as "테이블",
    policyname as "정책명",
    cmd as "명령어",
    permissive as "허용방식",
    roles as "적용역할",
    qual as "조건",
    with_check as "체크조건"
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. 특정 테이블의 정책만 조회 (예: users 테이블)
SELECT 
    policyname as "정책명",
    cmd as "명령어",
    roles as "적용역할",
    qual as "WHERE 조건",
    with_check as "CHECK 조건"
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'users';

-- 4. Auth 스키마의 테이블들 확인
SELECT 
    table_name as "Auth 테이블",
    table_type as "테이블 타입"
FROM information_schema.tables 
WHERE table_schema = 'auth' 
ORDER BY table_name;

-- 5. 현재 데이터베이스 사용자 및 권한 확인
SELECT 
    current_user as "현재사용자",
    current_setting('role') as "현재역할",
    session_user as "세션사용자";

-- 6. 모든 스키마와 테이블 조회
SELECT 
    schemaname as "스키마",
    tablename as "테이블",
    tableowner as "소유자",
    hasindexes as "인덱스여부",
    hasrules as "규칙여부",
    hastriggers as "트리거여부"
FROM pg_tables 
WHERE schemaname IN ('public', 'auth')
ORDER BY schemaname, tablename;

-- 7. 사용자 정의 함수들 확인
SELECT 
    routine_schema as "스키마",
    routine_name as "함수명",
    routine_type as "타입",
    security_type as "보안타입"
FROM information_schema.routines 
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- 8. RLS가 비활성화된 테이블들만 조회
SELECT 
    schemaname,
    tablename,
    '🔓 RLS 비활성화' as status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename NOT IN (
    SELECT tablename 
    FROM pg_tables 
    WHERE rowsecurity = true
  )
ORDER BY tablename;

-- 9. 정책이 없는 테이블들 조회
SELECT 
    t.tablename as "테이블",
    '⚠️ 정책 없음' as status
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public' 
  AND p.policyname IS NULL
ORDER BY t.tablename;

-- 10. 현재 Auth 사용자 수 확인 (Service Role로만 실행 가능)
SELECT 
    COUNT(*) as "총 사용자 수",
    COUNT(CASE WHEN email_confirmed_at IS NOT NULL THEN 1 END) as "이메일 확인된 사용자",
    COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as "활성 사용자"
FROM auth.users;
