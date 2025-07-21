-- Migration Cleanup Documentation
-- 마이그레이션 파일 정리 및 통합 문서화
-- 
-- 이 마이그레이션은 실제 스키마 변경을 하지 않고, 
-- 기존 마이그레이션들의 히스토리를 정리하고 문서화합니다.
--
-- 마이그레이션 히스토리:
-- 20250716192239: get_public_reservations 함수 초기 생성 (VARCHAR 타입)
-- 20250716195116: 반환 타입 수정 시도 (여전히 VARCHAR)  
-- 20250716201146: 최종 해결 (TEXT 타입으로 명시적 캐스팅) ✅
--
-- 현재 상태: 모든 테스트 통과 (4/4)
-- 최종 함수: get_public_reservations(TIMESTAMPTZ, TIMESTAMPTZ) → TABLE

-- 함수 상태 확인 (실제 변경 없음)
DO $$
BEGIN
    -- 현재 함수가 올바르게 존재하는지 확인
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'get_public_reservations' 
        AND pronargs = 2
    ) THEN
        RAISE NOTICE 'get_public_reservations 함수가 올바르게 존재합니다.';
    ELSE
        RAISE EXCEPTION 'get_public_reservations 함수를 찾을 수 없습니다!';
    END IF;
    
    -- 권한 확인
    IF EXISTS (
        SELECT 1 FROM information_schema.routine_privileges 
        WHERE routine_name = 'get_public_reservations'
        AND grantee IN ('authenticated', 'anon')
    ) THEN
        RAISE NOTICE '함수 권한이 올바르게 설정되어 있습니다.';
    ELSE
        RAISE WARNING '함수 권한 설정을 확인해주세요.';
    END IF;
END $$;

-- 마이그레이션 정리 완료
-- 향후 get_public_reservations 함수 수정 시에는 
-- 20250716201146_fix_rpc_function_exact_types.sql 파일을 참조하세요.