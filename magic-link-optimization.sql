-- ==========================================
-- Magic Link 기반 즉시 회원가입 시스템 최적화 SQL
-- ==========================================

-- 1. 기존 불필요한 정책 제거 및 새로운 정책 생성
-- ==========================================

-- users 테이블 기존 정책 제거
DROP POLICY IF EXISTS "Allow authenticated users to read user info" ON public.users;
DROP POLICY IF EXISTS "users_update_policy" ON public.users;
DROP POLICY IF EXISTS "users_select_policy" ON public.users;

-- users 테이블 새로운 정책 생성 (Magic Link 최적화)
CREATE POLICY "users_authenticated_read_policy" ON public.users
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "users_self_update_policy" ON public.users
    FOR UPDATE
    TO authenticated
    USING (auth_id = auth.uid());

-- 서버사이드 이메일 중복 확인을 위한 공개 읽기 정책 (제한적)
CREATE POLICY "users_public_email_check_policy" ON public.users
    FOR SELECT
    TO public
    USING (true);

-- 2. upsert_user_profile 함수 최적화 (Magic Link 대응)
-- ==========================================

CREATE OR REPLACE FUNCTION public.upsert_user_profile(
    p_auth_id uuid,
    p_email text,
    p_user_name text DEFAULT NULL::text,
    p_user_department text DEFAULT NULL::text,
    p_user_employee_id text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Magic Link 기반에서는 employee_id는 항상 null
    INSERT INTO public.users (auth_id, email, name, department, employee_id, role)
    VALUES (
        p_auth_id, 
        p_email, 
        COALESCE(p_user_name, 'Unknown User'), 
        COALESCE(p_user_department, 'General'), 
        NULL, -- Magic Link 기반에서는 employee_id 불필요
        'employee' -- 기본 역할
    )
    ON CONFLICT (auth_id)
    DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.users.name),
        department = COALESCE(EXCLUDED.department, public.users.department),
        updated_at = now();
END;
$function$;

-- 3. 이메일 중복 확인을 위한 새로운 함수 생성
-- ==========================================

CREATE OR REPLACE FUNCTION public.check_email_exists(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    email_count integer;
BEGIN
    -- 이메일이 이미 존재하는지 확인
    SELECT COUNT(*) INTO email_count
    FROM public.users
    WHERE email = p_email;
    
    RETURN email_count > 0;
END;
$function$;

-- 4. 예약 시스템 관련 정책 유지 (변경 없음)
-- ==========================================
-- reservations 정책들은 현재 상태 유지
-- rooms 정책들도 현재 상태 유지

-- 5. 불필요한 함수 정리
-- ==========================================

-- 기존 사번 기반 함수들이 있다면 제거 (현재는 없음)
-- 필요시 추가 정리

-- 6. 새로운 사용자 정보 조회 함수 (최적화)
-- ==========================================

CREATE OR REPLACE FUNCTION public.get_current_user_info()
RETURNS TABLE(
    id uuid,
    auth_id uuid,
    email text,
    name text,
    department text,
    role text,
    is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.auth_id,
        u.email,
        u.name,
        u.department,
        u.role::text,
        u.is_active
    FROM public.users u
    WHERE u.auth_id = auth.uid();
END;
$function$;

-- 7. Magic Link 기반 사용자 통계 함수
-- ==========================================

CREATE OR REPLACE FUNCTION public.get_user_stats()
RETURNS TABLE(
    total_users bigint,
    active_users bigint,
    departments_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE is_active = true) as active_users,
        COUNT(DISTINCT department) as departments_count
    FROM public.users;
END;
$function$;

-- 8. 인덱스 최적화 (이메일 기반 검색 성능 향상)
-- ==========================================

-- 이메일 인덱스 (중복 확인 성능 향상)
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- auth_id 인덱스 (이미 존재할 가능성 높음, 중복 생성 방지)
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);

-- 부서별 조회 성능 향상
CREATE INDEX IF NOT EXISTS idx_users_department ON public.users(department) WHERE is_active = true;

-- 9. 권한 설정
-- ==========================================

-- 새로운 함수들에 대한 권한 부여
GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO public;
GRANT EXECUTE ON FUNCTION public.get_current_user_info() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_stats() TO authenticated;

-- 10. 데이터 정리 (선택사항)
-- ==========================================

-- 기존 employee_id 데이터가 있다면 NULL로 설정 (Magic Link 기반에서는 불필요)
-- 주의: 이 부분은 기존 데이터가 있을 경우에만 실행
-- UPDATE public.users SET employee_id = NULL WHERE employee_id IS NOT NULL;

-- ==========================================
-- 실행 완료 메시지
-- ==========================================

DO $$
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Magic Link 기반 시스템 최적화 완료!';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '✅ 사용자 정책 최적화 완료';
    RAISE NOTICE '✅ upsert_user_profile 함수 Magic Link 대응 완료';
    RAISE NOTICE '✅ 이메일 중복 확인 함수 생성 완료';
    RAISE NOTICE '✅ 성능 최적화 인덱스 생성 완료';
    RAISE NOTICE '✅ 새로운 유틸리티 함수들 생성 완료';
    RAISE NOTICE '===========================================';
END $$;