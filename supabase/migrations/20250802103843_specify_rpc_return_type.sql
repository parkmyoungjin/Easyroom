-- ============================================================================
-- Operation: RPC Contract Specification
-- ============================================================================
-- 
-- 문제: 백엔드(RETURNS TABLE)와 프론트엔드(.single()) 간의 계약 불일치
-- 해결: 명시적 단일 반환 타입으로 계약 통일
-- 
-- 핵심 변경사항:
-- 1. user_profile_type 생성 - 명시적 계약서 역할
-- 2. RETURNS TABLE → RETURNS user_profile_type - 단일 객체 반환 보증
-- 3. RETURN QUERY → RETURN result - 단일 값 반환 구현
-- ============================================================================

-- 단계 1: 함수가 반환할 '단일 객체'의 구조를 명시하는 새로운 타입을 생성합니다.
-- 이것이 바로 우리의 새로운 '계약서'입니다.
CREATE TYPE public.user_profile_type AS (
    "authId" UUID,
    "dbId" UUID,
    "employeeId" TEXT,
    "email" TEXT,
    "name" TEXT,
    "department" TEXT,
    "role" TEXT,
    "createdAt" TIMESTAMPTZ,
    "updatedAt" TIMESTAMPTZ
);

-- 단계 2: 기존 함수를 삭제하고 새로운 계약으로 재생성합니다.
-- PostgreSQL에서는 반환 타입 변경을 위해 함수를 먼저 삭제해야 합니다.
DROP FUNCTION IF EXISTS public.get_or_create_user_profile();

-- 단계 3: 함수가 이 새로운 타입을 '단일 값'으로 반환하도록 계약을 수정합니다.
CREATE FUNCTION public.get_or_create_user_profile()
RETURNS public.user_profile_type -- ✅ [핵심 계약 수정] 'TABLE'이 아닌, 명시적 '단일 타입'을 반환
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    current_auth_id UUID := auth.uid();
    user_record RECORD;
    result public.user_profile_type; -- ✅ 결과를 담을 변수를 새로운 계약 타입으로 선언
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
    -- 단계 4: 계약된 단일 객체로 결과 구성 및 반환
    -- ========================================================================
    -- 최종 결과를 SELECT INTO를 사용해 단일 변수에 할당합니다.
    SELECT
        user_record.auth_id,
        user_record.id,
        user_record.employee_id,
        user_record.email,
        user_record.name,
        user_record.department,
        user_record.role,
        user_record.created_at,
        user_record.updated_at
    INTO result;

    RETURN result; -- ✅ [핵심 계약 이행] 'TABLE'이 아닌, 계약된 '단일 객체'를 반환
END;
$$;

-- ============================================================================
-- 계약 수정 완료 로그
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE '✅ Operation: RPC Contract Specification';
    RAISE NOTICE '✅ Created: user_profile_type (명시적 계약서)';
    RAISE NOTICE '✅ Changed: RETURNS TABLE → RETURNS user_profile_type';
    RAISE NOTICE '✅ Changed: RETURN QUERY → RETURN result';
    RAISE NOTICE '✅ Contract: 백엔드-프론트엔드 계약 통일 완료';
    RAISE NOTICE '✅ Expected: .single() 호출 성공';
    RAISE NOTICE '===========================================';
END $$;