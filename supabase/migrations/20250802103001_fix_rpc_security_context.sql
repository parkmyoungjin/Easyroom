-- ============================================================================
-- Operation: RPC Security Context Correction
-- ============================================================================
-- 
-- 문제: SECURITY DEFINER로 인해 auth.uid()가 올바른 사용자 컨텍스트를 가져오지 못함
-- 해결: SECURITY INVOKER로 변경하여 호출한 사용자의 권한으로 실행되도록 수정
-- 
-- 핵심 변경사항:
-- - SECURITY DEFINER → SECURITY INVOKER
-- - search_path 명시적 설정으로 안정성 확보
-- ============================================================================

CREATE OR REPLACE FUNCTION get_or_create_user_profile()
RETURNS TABLE (
    "authId" UUID,
    "dbId" UUID,
    "employeeId" TEXT,
    "email" TEXT,
    "name" TEXT,
    "department" TEXT,
    "role" TEXT,
    "createdAt" TIMESTAMPTZ,
    "updatedAt" TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER -- ✅ [핵심 수정] DEFINER에서 INVOKER로 변경
SET search_path = public -- 💡 SECURITY INVOKER 사용 시 스키마 경로를 명시해주는 것이 안전합니다.
AS $$
DECLARE
    current_auth_id UUID := auth.uid();
    user_record RECORD;
BEGIN
    -- ========================================================================
    -- 단계 1: 인증 검증 - 인증된 사용자만 접근 가능
    -- ========================================================================
    IF current_auth_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: User is not logged in.';
    END IF;

    -- ========================================================================
    -- 단계 2: 기존 사용자 프로필 조회
    -- ========================================================================
    SELECT * INTO user_record 
    FROM public.users 
    WHERE auth_id = current_auth_id;

    -- ========================================================================
    -- 단계 3: 사용자가 없는 경우 안전하게 생성
    -- ========================================================================
    IF user_record IS NULL THEN
        DECLARE
            auth_user RECORD;
        BEGIN
            -- auth.users 테이블에서 최신 사용자 정보 가져오기
            SELECT * INTO auth_user 
            FROM auth.users 
            WHERE id = current_auth_id;

            -- auth.users에도 없다면 심각한 문제
            IF auth_user IS NULL THEN
                RAISE EXCEPTION 'Critical error: User not found in auth.users despite being authenticated.';
            END IF;

            -- 안전한 사용자 생성 (동시성 문제 방지)
            INSERT INTO public.users (
                auth_id, 
                email, 
                name, 
                department,
                role
            )
            VALUES (
                current_auth_id,
                auth_user.email,
                COALESCE(
                    auth_user.raw_user_meta_data->>'fullName', 
                    auth_user.raw_user_meta_data->>'full_name', 
                    SPLIT_PART(auth_user.email, '@', 1)
                ),
                COALESCE(
                    auth_user.raw_user_meta_data->>'department', 
                    'General'
                ),
                COALESCE(
                    auth_user.raw_user_meta_data->>'role',
                    'employee'
                )
            )
            ON CONFLICT (auth_id) DO NOTHING -- 동시성 문제 방지
            RETURNING * INTO user_record;

            -- INSERT 후에도 레코드가 없으면 재조회 (ON CONFLICT 처리)
            IF user_record IS NULL THEN
                SELECT * INTO user_record 
                FROM public.users 
                WHERE auth_id = current_auth_id;
                
                IF user_record IS NULL THEN
                    RAISE EXCEPTION 'Failed to create or find user profile after insert attempt.';
                END IF;
            END IF;
        END;
    END IF;

    -- ========================================================================
    -- 단계 4: 완전한 프로필 데이터 반환
    -- ========================================================================
    -- 이 시점에서 user_record는 반드시 유효한 값을 가져야 함
    RETURN QUERY
    SELECT
        user_record.auth_id,
        user_record.id,
        user_record.employee_id,
        user_record.email,
        user_record.name,
        user_record.department,
        user_record.role,
        user_record.created_at,
        user_record.updated_at;
END;
$$;

-- ============================================================================
-- 수정 완료 로그
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE '✅ Operation: RPC Security Context Correction';
    RAISE NOTICE '✅ Changed: SECURITY DEFINER → SECURITY INVOKER';
    RAISE NOTICE '✅ Added: search_path = public';
    RAISE NOTICE '✅ Expected: auth.uid() now works correctly';
    RAISE NOTICE '✅ Status: Ready for testing';
    RAISE NOTICE '===========================================';
END $$;