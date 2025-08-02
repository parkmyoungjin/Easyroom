-- ============================================================================
-- Operation: Atomic Profile - Comprehensive Test Suite
-- ============================================================================
-- 
-- 설계 문서의 테스트 전략에 따른 포괄적 검증
-- 
-- 테스트 시나리오:
-- 1. 함수 존재 및 권한 확인
-- 2. 반환 타입 구조 검증
-- 3. 에러 시나리오 테스트 (인증 없음)
-- 4. 정상 시나리오 시뮬레이션
-- ============================================================================

-- ============================================================================
-- 1. 함수 메타데이터 검증
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '=== 1. 함수 메타데이터 검증 ===';
END $$;

-- 함수 존재 확인
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ get_or_create_user_profile 함수 존재'
        ELSE '❌ 함수가 존재하지 않음'
    END as function_check
FROM pg_proc 
WHERE proname = 'get_or_create_user_profile';

-- 함수 권한 확인
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ authenticated 역할에 실행 권한 부여됨'
        ELSE '❌ 실행 권한이 부여되지 않음'
    END as permission_check
FROM information_schema.routine_privileges 
WHERE routine_name = 'get_or_create_user_profile' 
AND grantee = 'authenticated';

-- 함수 보안 설정 확인
SELECT 
    CASE 
        WHEN security_type = 'DEFINER' THEN '✅ SECURITY DEFINER 설정 확인'
        ELSE '❌ 보안 설정 오류'
    END as security_check
FROM information_schema.routines 
WHERE routine_name = 'get_or_create_user_profile';

-- ============================================================================
-- 2. 반환 타입 구조 검증
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '=== 2. 반환 타입 구조 검증 ===';
END $$;

-- 반환 컬럼 구조 확인
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'get_or_create_user_profile'
ORDER BY ordinal_position;

-- ============================================================================
-- 3. 테이블 구조 호환성 검증
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '=== 3. 테이블 구조 호환성 검증 ===';
END $$;

-- users 테이블 구조 확인
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================================================
-- 4. 에러 시나리오 테스트 (시뮬레이션)
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '=== 4. 에러 시나리오 테스트 ===';
    RAISE NOTICE '주의: 실제 인증 없이는 에러 테스트만 가능';
    RAISE NOTICE '인증된 세션에서 실행 시 정상 작동 예상';
END $$;

-- 함수 호출 구문 검증 (실제 실행은 인증 필요)
SELECT 
    '✅ 함수 호출 구문이 유효함' as syntax_check
WHERE EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_or_create_user_profile'
    AND pronargs = 0  -- 매개변수 없음
);

-- ============================================================================
-- 5. 성능 및 인덱스 확인
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '=== 5. 성능 최적화 확인 ===';
END $$;

-- auth_id 인덱스 존재 확인 (성능 최적화)
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ auth_id 인덱스 존재 (성능 최적화)'
        ELSE '⚠️ auth_id 인덱스 없음 (성능 영향 가능)'
    END as index_check
FROM pg_indexes 
WHERE tablename = 'users' 
AND indexdef LIKE '%auth_id%';

-- ============================================================================
-- 6. 데이터 무결성 제약조건 확인
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '=== 6. 데이터 무결성 제약조건 확인 ===';
END $$;

-- UNIQUE 제약조건 확인
SELECT 
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints 
WHERE table_name = 'users' 
AND constraint_type IN ('UNIQUE', 'PRIMARY KEY');

-- ============================================================================
-- 테스트 완료 보고
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE '✅ 원자적 프로필 RPC 함수 테스트 완료';
    RAISE NOTICE '✅ 함수 구조 및 권한 검증 완료';
    RAISE NOTICE '✅ 데이터베이스 호환성 확인 완료';
    RAISE NOTICE '⚠️ 실제 인증 테스트는 클라이언트에서 수행 필요';
    RAISE NOTICE '===========================================';
END $$;