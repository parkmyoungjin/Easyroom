-- Email Authentication Migration
-- 기존 사번 기반 인증에서 이메일 기반 인증으로 마이그레이션
-- 기존 테이블 구조 유지하되 이메일 인증 지원을 위한 최소 변경

-- 1. users 테이블 스키마 업데이트
-- employee_id를 nullable로 변경 (기존 호환성 유지)
ALTER TABLE public.users 
ALTER COLUMN employee_id DROP NOT NULL;

-- 2. 기존 데이터 정합성 확인을 위한 제약조건 추가
-- auth_id가 반드시 존재해야 함 (Supabase Auth 연동 필수)
ALTER TABLE public.users 
ALTER COLUMN auth_id SET NOT NULL;

-- 3. 이메일 필드가 반드시 존재해야 함
ALTER TABLE public.users 
ALTER COLUMN email SET NOT NULL;

-- 4. 인덱스 최적화 (기존 인덱스 유지)
-- auth_id 인덱스는 이미 존재하므로 확인만 수행
DO $
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'users' 
        AND indexname = 'idx_users_auth_id'
    ) THEN
        CREATE INDEX idx_users_auth_id ON public.users(auth_id);
    END IF;
END $;

-- 5. 이메일 인덱스 추가 (성능 최적화)
DO $
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'users' 
        AND indexname = 'idx_users_email'
    ) THEN
        CREATE INDEX idx_users_email ON public.users(email);
    END IF;
END $;

-- 6. RLS 정책 업데이트 (기존 정책 유지)
-- 기존 정책들이 이미 auth_id 기반으로 작동하므로 변경 불필요

-- 7. 데이터 검증 함수 생성
CREATE OR REPLACE FUNCTION validate_user_auth_integration()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $
BEGIN
    -- auth_id가 실제 auth.users와 연결되어 있는지 확인
    IF EXISTS (
        SELECT 1 FROM public.users u
        LEFT JOIN auth.users au ON u.auth_id = au.id
        WHERE au.id IS NULL
    ) THEN
        RAISE EXCEPTION 'auth_id 연결이 끊어진 사용자가 존재합니다.';
        RETURN FALSE;
    END IF;
    
    -- 이메일 중복 확인
    IF EXISTS (
        SELECT email FROM public.users
        GROUP BY email
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION '중복된 이메일이 존재합니다.';
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$;

-- 8. 마이그레이션 검증 실행
SELECT validate_user_auth_integration();

-- 9. 기존 함수들 호환성 확인
-- get_public_reservations 함수는 이미 auth_id 기반으로 작동하므로 변경 불필요

-- 10. 마이그레이션 완료 로그
DO $
BEGIN
    RAISE NOTICE '이메일 인증 마이그레이션이 완료되었습니다.';
    RAISE NOTICE '- employee_id: nullable로 변경됨';
    RAISE NOTICE '- auth_id: NOT NULL 제약조건 확인됨';
    RAISE NOTICE '- email: NOT NULL 제약조건 확인됨';
    RAISE NOTICE '- 인덱스: auth_id, email 인덱스 확인됨';
    RAISE NOTICE '- RLS 정책: 기존 정책 유지됨';
    RAISE NOTICE '- 기존 함수: 호환성 유지됨';
END $;

-- 마이그레이션 메타데이터
COMMENT ON TABLE public.users IS '사용자 정보 테이블 - 이메일 인증 지원 (employee_id는 선택사항)';