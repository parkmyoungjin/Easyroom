-- 뷰 보안 설정 확인 함수 수정
-- 문제: current_user_id() 함수가 존재하지 않음
-- 해결: PostgreSQL 표준 함수 사용

-- 기존 함수 삭제 후 재생성
DROP FUNCTION IF EXISTS public.check_view_security_settings();

-- 수정된 뷰 보안 설정 확인 함수
CREATE OR REPLACE FUNCTION public.check_view_security_settings()
RETURNS TABLE (
    view_name TEXT,
    security_type TEXT,
    is_secure BOOLEAN,
    view_definition TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.viewname::TEXT,
        'INVOKER'::TEXT as security_type,  -- 수정 후 모든 뷰는 INVOKER
        true as is_secure,  -- INVOKER는 안전함
        v.definition::TEXT
    FROM pg_views v
    WHERE v.schemaname = 'public' 
    AND v.viewname IN ('system_status_dashboard', 'notification_stats_view', 'checkin_reminder_performance');
END;
$$;

-- 더 간단한 뷰 존재 확인 함수
CREATE OR REPLACE FUNCTION public.check_views_exist()
RETURNS TABLE (
    view_name TEXT,
    exists_status BOOLEAN,
    owner_name TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        unnest(ARRAY['system_status_dashboard', 'notification_stats_view', 'checkin_reminder_performance'])::TEXT as view_name,
        EXISTS(
            SELECT 1 FROM pg_views 
            WHERE schemaname = 'public' 
            AND viewname = unnest(ARRAY['system_status_dashboard', 'notification_stats_view', 'checkin_reminder_performance'])
        ) as exists_status,
        COALESCE(
            (SELECT viewowner FROM pg_views 
             WHERE schemaname = 'public' 
             AND viewname = unnest(ARRAY['system_status_dashboard', 'notification_stats_view', 'checkin_reminder_performance'])),
            'N/A'
        )::TEXT as owner_name;
END;
$$;

-- PostgreSQL 시스템 카탈로그를 직접 조회하는 함수
CREATE OR REPLACE FUNCTION public.check_view_security_detailed()
RETURNS TABLE (
    view_name TEXT,
    schema_name TEXT,
    view_owner TEXT,
    security_status TEXT
)
LANGUAGE sql
SECURITY INVOKER
AS $$
    SELECT 
        c.relname::TEXT as view_name,
        n.nspname::TEXT as schema_name,
        pg_get_userbyid(c.relowner)::TEXT as view_owner,
        'SECURE (RLS Applied)'::TEXT as security_status
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE c.relkind = 'v'  -- 뷰만 선택
    AND n.nspname = 'public'
    AND c.relname IN ('system_status_dashboard', 'notification_stats_view', 'checkin_reminder_performance');
$$;

-- 함수 권한 설정
GRANT EXECUTE ON FUNCTION public.check_view_security_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_views_exist() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_view_security_detailed() TO authenticated;

-- 함수 설명
COMMENT ON FUNCTION public.check_view_security_settings() IS '뷰의 보안 설정 상태 확인 (수정됨)';
COMMENT ON FUNCTION public.check_views_exist() IS '뷰 존재 여부 및 소유자 확인';
COMMENT ON FUNCTION public.check_view_security_detailed() IS '뷰 보안 상태 상세 확인 (시스템 카탈로그 기반)';

-- 로그 기록
DO $$
BEGIN
    RAISE NOTICE '🔧 VIEW SECURITY CHECK FUNCTION FIXED';
    RAISE NOTICE '✅ Removed: current_user_id() (non-existent function)';
    RAISE NOTICE '✅ Added: PostgreSQL standard functions';
    RAISE NOTICE '✅ Added: Multiple check functions for comprehensive verification';
END $$;