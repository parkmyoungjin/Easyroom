-- Consolidated Database Policies and Schema Cleanup
-- 2025-07-23: 기존 설정과 충돌 없이 정책 정리 및 최적화
-- 현재 상황에 맞는 통합된 정책 설정

-- =============================================================================
-- 1. 기존 정책 정리 (중복 제거)
-- =============================================================================

-- 기존 중복 정책들 삭제
DROP POLICY IF EXISTS "Users can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

DROP POLICY IF EXISTS "Anyone can view active rooms" ON public.rooms;

DROP POLICY IF EXISTS "Users can view all confirmed reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users can view their own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users can insert own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users can create reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users can update own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users can update their own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users can delete their own reservations" ON public.reservations;

-- =============================================================================
-- 2. 통합된 RLS 정책 설정
-- =============================================================================

-- Users 테이블 정책
CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT USING (
        -- 사용자는 모든 사용자 정보를 볼 수 있음 (부서, 이름 등 공개 정보)
        true
    );

CREATE POLICY "users_update_policy" ON public.users
    FOR UPDATE USING (
        -- 사용자는 자신의 프로필만 수정 가능
        auth_id = auth.uid()
    );

-- Rooms 테이블 정책
CREATE POLICY "rooms_select_policy" ON public.rooms
    FOR SELECT USING (
        -- 활성화된 회의실만 조회 가능
        is_active = true
    );

-- Reservations 테이블 정책
CREATE POLICY "reservations_select_policy" ON public.reservations
    FOR SELECT USING (
        -- 확정된 예약은 모두 볼 수 있고, 자신의 예약은 상태와 관계없이 모두 볼 수 있음
        status = 'confirmed' OR 
        user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    );

CREATE POLICY "reservations_insert_policy" ON public.reservations
    FOR INSERT WITH CHECK (
        -- 자신의 user_id로만 예약 생성 가능
        user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    );

CREATE POLICY "reservations_update_policy" ON public.reservations
    FOR UPDATE USING (
        -- 자신의 예약만 수정 가능
        user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    );

CREATE POLICY "reservations_delete_policy" ON public.reservations
    FOR DELETE USING (
        -- 자신의 예약만 삭제 가능
        user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    );

-- =============================================================================
-- 3. 핵심 함수 정리 및 최적화
-- =============================================================================

-- 기존 중복 함수들 정리
DROP FUNCTION IF EXISTS get_public_reservations_anonymous(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS create_user_profile(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_correct_user_id(UUID);
DROP FUNCTION IF EXISTS is_valid_user_id(UUID);

-- 메인 예약 조회 함수 (통합 버전)
CREATE OR REPLACE FUNCTION get_public_reservations(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE (
  id UUID,
  room_id UUID,
  user_id UUID,
  title TEXT,
  purpose TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  department TEXT,
  user_name TEXT,
  room_name TEXT,
  is_mine BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
  current_user_db_id UUID;
BEGIN
  -- 입력 검증
  IF start_date IS NULL OR end_date IS NULL THEN
    RAISE EXCEPTION 'Start date and end date cannot be null';
  END IF;
  
  IF start_date >= end_date THEN
    RAISE EXCEPTION 'Start date must be before end date';
  END IF;
  
  -- 현재 사용자 ID 조회 (인증되지 않은 경우 NULL)
  SELECT u.id INTO current_user_db_id
  FROM users u
  WHERE u.auth_id = auth.uid();

  -- 예약 목록 반환
  RETURN QUERY
  SELECT 
    r.id,
    r.room_id,
    r.user_id,
    CASE 
      WHEN current_user_db_id IS NOT NULL AND r.user_id = current_user_db_id 
      THEN r.title::TEXT 
      ELSE 'Booked'::TEXT 
    END as title,
    CASE 
      WHEN current_user_db_id IS NOT NULL AND r.user_id = current_user_db_id 
      THEN r.purpose::TEXT 
      ELSE NULL::TEXT 
    END as purpose,
    r.start_time,
    r.end_time,
    u.department::TEXT as department,
    CASE 
      WHEN current_user_db_id IS NOT NULL AND r.user_id = current_user_db_id 
      THEN u.name::TEXT 
      ELSE 'Anonymous'::TEXT 
    END as user_name,
    rm.name::TEXT as room_name,
    CASE 
      WHEN current_user_db_id IS NOT NULL AND r.user_id = current_user_db_id 
      THEN TRUE 
      ELSE FALSE 
    END as is_mine
  FROM reservations r
  INNER JOIN users u ON r.user_id = u.id
  INNER JOIN rooms rm ON r.room_id = rm.id
  WHERE r.status = 'confirmed'
    AND r.start_time < end_date
    AND r.end_time > start_date
  ORDER BY r.start_time ASC;
END;
$;

-- 사용자 프로필 생성/업데이트 함수 (이메일 인증용)
CREATE OR REPLACE FUNCTION upsert_user_profile(
    user_name TEXT,
    user_department TEXT DEFAULT 'General',
    user_employee_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
    user_auth_id UUID;
    user_email TEXT;
    existing_user_id UUID;
    new_user_id UUID;
BEGIN
    -- 현재 인증된 사용자 정보 가져오기
    user_auth_id := auth.uid();
    
    IF user_auth_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;
    
    -- auth.users에서 이메일 가져오기
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = user_auth_id;
    
    IF user_email IS NULL THEN
        RAISE EXCEPTION 'User email not found in auth system';
    END IF;
    
    -- 기존 프로필 확인
    SELECT id INTO existing_user_id
    FROM public.users
    WHERE auth_id = user_auth_id;
    
    IF existing_user_id IS NOT NULL THEN
        -- 기존 프로필 업데이트
        UPDATE public.users
        SET 
            name = user_name,
            department = user_department,
            employee_id = user_employee_id,
            updated_at = NOW()
        WHERE id = existing_user_id;
        
        RETURN existing_user_id;
    ELSE
        -- 새 프로필 생성
        INSERT INTO public.users (auth_id, email, name, department, employee_id)
        VALUES (user_auth_id, user_email, user_name, user_department, user_employee_id)
        RETURNING id INTO new_user_id;
        
        RETURN new_user_id;
    END IF;
END;
$;

-- =============================================================================
-- 4. 권한 설정
-- =============================================================================

-- 함수 실행 권한
GRANT EXECUTE ON FUNCTION get_public_reservations(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_reservations(TIMESTAMPTZ, TIMESTAMPTZ) TO anon;
GRANT EXECUTE ON FUNCTION upsert_user_profile(TEXT, TEXT, TEXT) TO authenticated;

-- 기존 불필요한 권한 정리
REVOKE ALL ON FUNCTION validate_reservation_date_range(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
DROP FUNCTION IF EXISTS validate_reservation_date_range(TIMESTAMPTZ, TIMESTAMPTZ);

-- =============================================================================
-- 5. 인덱스 최적화
-- =============================================================================

-- 중복 인덱스 확인 및 정리
DROP INDEX IF EXISTS idx_reservations_user_id_performance;

-- 필수 인덱스만 유지 (이미 존재하는 것들)
-- idx_users_auth_id, idx_users_email, idx_reservations_user_id, 
-- idx_reservations_room_id, idx_reservations_time_range 등은 유지

-- =============================================================================
-- 6. 트리거 및 제약조건 정리
-- =============================================================================

-- 기존 검증 트리거 유지 (validate_reservation_user_id)
-- updated_at 트리거들 유지

-- =============================================================================
-- 7. 테이블 코멘트 업데이트
-- =============================================================================

COMMENT ON TABLE public.users IS '사용자 정보 테이블 - 이메일 인증 기반, employee_id 선택사항';
COMMENT ON TABLE public.rooms IS '회의실 정보 테이블';
COMMENT ON TABLE public.reservations IS '예약 정보 테이블 - user_id는 users.id 참조';

COMMENT ON FUNCTION get_public_reservations IS '통합 예약 조회 함수 - 인증 상태에 따른 데이터 마스킹';
COMMENT ON FUNCTION upsert_user_profile IS '사용자 프로필 생성/업데이트 함수 - 이메일 인증 후 사용';

-- =============================================================================
-- 8. 완료 로그
-- =============================================================================

DO $
BEGIN
    RAISE NOTICE '=== 데이터베이스 정책 통합 완료 ===';
    RAISE NOTICE '✅ 중복 정책 제거 완료';
    RAISE NOTICE '✅ 통합된 RLS 정책 적용';
    RAISE NOTICE '✅ 핵심 함수만 유지 (get_public_reservations, upsert_user_profile)';
    RAISE NOTICE '✅ 불필요한 함수 및 권한 정리';
    RAISE NOTICE '✅ 인덱스 최적화';
    RAISE NOTICE '✅ 기존 데이터와 호환성 유지';
    RAISE NOTICE '=====================================';
END $;