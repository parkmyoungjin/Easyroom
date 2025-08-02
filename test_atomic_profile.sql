-- ============================================================================
-- Operation: Atomic Profile - Function Test Script
-- ============================================================================
-- 
-- 이 스크립트는 새로 생성된 get_or_create_user_profile() 함수를 테스트합니다.
-- 
-- 테스트 시나리오:
-- 1. 인증되지 않은 사용자 호출 (에러 예상)
-- 2. 인증된 사용자 호출 (성공 예상)
-- ============================================================================

-- 함수 존재 확인
SELECT 
    proname as function_name,
    pronargs as argument_count,
    prorettype::regtype as return_type
FROM pg_proc 
WHERE proname = 'get_or_create_user_profile';

-- 함수 권한 확인
SELECT 
    grantee,
    privilege_type
FROM information_schema.routine_privileges 
WHERE routine_name = 'get_or_create_user_profile';

-- 함수 정의 확인 (일부)
SELECT 
    routine_name,
    routine_type,
    security_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'get_or_create_user_profile';