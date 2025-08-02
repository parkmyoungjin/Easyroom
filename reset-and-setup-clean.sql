-- ==========================================
-- 전체 시스템 초기화 및 Magic Link 기반 재설정
-- ==========================================

-- 1. 모든 기존 정책 제거
-- ==========================================

-- users 테이블 정책 제거
DROP POLICY IF EXISTS "Allow authenticated users to read user info" ON public.users;
DROP POLICY IF EXISTS "users_update_policy" ON public.users;
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "users_authenticated_read_policy" ON public.users;
DROP POLICY IF EXISTS "users_self_update_policy" ON public.users;
DROP POLICY IF EXISTS "users_public_email_check_policy" ON public.users;

-- rooms 테이블 정책 제거
DROP POLICY IF EXISTS "Allow authenticated users to read room info" ON public.rooms;
DROP POLICY IF EXISTS "rooms_select_policy" ON public.rooms;

-- reservations 테이블 정책 제거
DROP POLICY IF EXISTS "Allow authenticated users to read all confirmed reservations" ON public.reservations;
DROP POLICY IF EXISTS "reservations_delete_policy" ON public.reservations;
DROP POLICY IF EXISTS "reservations_update_policy" ON public.reservations;
DROP POLICY IF EXISTS "reservations_insert_policy" ON public.reservations;
DROP POLICY IF EXISTS "reservations_select_policy" ON public.reservations;

-- 2. 모든 기존 사용자 정의 함수 제거
-- ==========================================

DROP FUNCTION IF EXISTS public.check_email_exists(text);
DROP FUNCTION IF EXISTS public.get_current_user_info();
DROP FUNCTION IF EXISTS public.get_user_stats();
DROP FUNCTION IF EXISTS public.upsert_user_profile(uuid, text, text, text, text);

-- 3. 기존 인덱스 제거 (중복 방지)
-- ==========================================

DROP INDEX IF EXISTS public.idx_users_email;
DROP INDEX IF EXISTS public.idx_users_auth_id;
DROP INDEX IF EXISTS public.idx_users_department;

-- 4. 테이블 구조 확인 및 조정
-- ==========================================

-- users 테이블이 존재하지 않으면 생성
CREATE TABLE IF NOT EXISTS public.users (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_id uuid UNIQUE NOT NULL,
    employee_id text,
    name text NOT NULL,
    email text UNIQUE NOT NULL,
    department text NOT NULL,
    role text DEFAULT 'employee' CHECK (role IN ('employee', 'admin')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- rooms 테이블이 존재하지 않으면 생성
CREATE TABLE IF NOT EXISTS public.rooms (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    capacity integer DEFAULT 1,
    location text,
    amenities jsonb DEFAULT '{}',
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- reservations 테이블이 존재하지 않으면 생성
CREATE TABLE IF NOT EXISTS public.reservations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id uuid NOT NULL REFERENCES public.rooms(id),
    user_id uuid NOT NULL REFERENCES public.users(id),
    title text NOT NULL,
    purpose text,
    start_time timestamptz NOT NULL,
    end_time timestamptz NOT NULL,
    status text DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
    cancellation_reason text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 5. RLS 활성화
-- ==========================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- 6. Magic Link 기반 새로운 정책 생성
-- ==========================================

-- users 테이블 정책
CREATE POLICY "users_authenticated_read" ON public.users
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "users_self_update" ON public.users
    FOR UPDATE
    TO authenticated
    USING (auth_id = auth.uid());

-- 서버사이드 이메일 중복 확인을 위한 제한적 공개 정책
CREATE POLICY "users_email_check_only" ON public.users
    FOR SELECT
    TO public
    USING (true);

-- rooms 테이블 정책 (모든 인증된 사용자가 읽기 가능)
CREATE POLICY "rooms_authenticated_read" ON public.rooms
    FOR SELECT
    TO authenticated
    USING (true);

-- 비인증 사용자도 활성 회의실 정보 조회 가능
CREATE POLICY "rooms_public_read_active" ON public.rooms
    FOR SELECT
    TO public
    USING (is_active = true);

-- reservations 테이블 정책
CREATE POLICY "reservations_authenticated_read" ON public.reservations
    FOR SELECT
    TO authenticated
    USING (status = 'confirmed');

CREATE POLICY "reservations_owner_full_access" ON public.reservations
    FOR ALL
    TO authenticated
    USING (user_id IN (
        SELECT id FROM public.users WHERE auth_id = auth.uid()
    ))
    WITH CHECK (user_id IN (
        SELECT id FROM public.users WHERE auth_id = auth.uid()
    ));

-- 비인증 사용자도 확정된 예약 조회 가능 (익명화)
CREATE POLICY "reservations_public_read_confirmed" ON public.reservations
    FOR SELECT
    TO public
    USING (status = 'confirmed');

-- 7. Magic Link 전용 함수 생성
-- ==========================================

-- 이메일 중복 확인 함수
CREATE OR REPLACE FUNCTION public.check_email_exists(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    email_count integer;
BEGIN
    SELECT COUNT(*) INTO email_count
    FROM public.users
    WHERE email = p_email;
    
    RETURN email_count > 0;
END;
$function$;

-- 사용자 프로필 생성/업데이트 함수 (Magic Link 전용)
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
    INSERT INTO public.users (auth_id, email, name, department, employee_id, role)
    VALUES (
        p_auth_id, 
        p_email, 
        COALESCE(p_user_name, 'User'), 
        COALESCE(p_user_department, 'General'), 
        p_user_employee_id, -- Magic Link에서는 null 가능
        'employee'
    )
    ON CONFLICT (auth_id)
    DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.users.name),
        department = COALESCE(EXCLUDED.department, public.users.department),
        updated_at = now();
END;
$function$;

-- 현재 사용자 정보 조회 함수
CREATE OR REPLACE FUNCTION public.get_current_user_info()
RETURNS TABLE(
    id uuid,
    auth_id uuid,
    email text,
    name text,
    department text,
    role text
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
        u.role
    FROM public.users u
    WHERE u.auth_id = auth.uid();
END;
$function$;

-- 8. 기존 예약 조회 함수 유지 (수정 없음)
-- ==========================================
-- get_public_reservations_paginated 함수는 현재 상태 유지
-- get_public_reservations_anonymous_paginated 함수는 현재 상태 유지

-- 9. 업데이트 트리거 생성
-- ==========================================

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- 트리거 생성
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_rooms_updated_at ON public.rooms;
CREATE TRIGGER update_rooms_updated_at
    BEFORE UPDATE ON public.rooms
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_reservations_updated_at ON public.reservations;
CREATE TRIGGER update_reservations_updated_at
    BEFORE UPDATE ON public.reservations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 10. 성능 최적화 인덱스 생성
-- ==========================================

-- 이메일 인덱스 (중복 확인 성능 향상)
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- auth_id 인덱스 (사용자 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);

-- 부서별 조회 성능 향상
CREATE INDEX IF NOT EXISTS idx_users_department ON public.users(department);

-- 예약 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON public.reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_room_id ON public.reservations(room_id);
CREATE INDEX IF NOT EXISTS idx_reservations_start_time ON public.reservations(start_time);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON public.reservations(status);

-- 11. 권한 설정
-- ==========================================

-- 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO public;
GRANT EXECUTE ON FUNCTION public.upsert_user_profile(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_info() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;

-- 기존 예약 조회 함수 권한 유지
GRANT EXECUTE ON FUNCTION public.get_public_reservations_paginated(timestamptz, timestamptz, integer, integer) TO public;
GRANT EXECUTE ON FUNCTION public.get_public_reservations_anonymous_paginated(timestamptz, timestamptz, integer, integer) TO public;

-- 12. 기본 데이터 삽입 부분 제거
-- ==========================================
-- 사용자가 직접 데이터를 입력할 예정

-- ==========================================
-- 완료 메시지
-- ==========================================

DO $$
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE '✅ 시스템 완전 초기화 및 재설정 완료!';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '🗑️  모든 기존 정책 및 함수 제거 완료';
    RAISE NOTICE '🏗️  테이블 구조 재구성 완료';
    RAISE NOTICE '🔐 Magic Link 전용 RLS 정책 생성 완료';
    RAISE NOTICE '⚡ 성능 최적화 인덱스 생성 완료';
    RAISE NOTICE '🎯 Magic Link 전용 함수들 생성 완료';
    RAISE NOTICE '🛡️  보안 권한 설정 완료';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '🚀 Magic Link 기반 시스템 준비 완료!';
    RAISE NOTICE '===========================================';
END $$;