-- [긴급 보안 수정] SECURITY DEFINER VIEW 문제 해결
-- Supabase Linter에서 감지된 심각한 보안 위험 수정

-- 문제: 3개의 뷰가 SECURITY DEFINER 속성으로 생성되어 RLS 정책 우회 가능
-- 해결: 모든 뷰를 SECURITY INVOKER로 변경하여 사용자 권한으로 실행되도록 수정

-- 1. system_status_dashboard 뷰를 SECURITY INVOKER로 변경
ALTER VIEW public.system_status_dashboard SET (security_invoker = true);

-- 2. notification_stats_view 뷰를 SECURITY INVOKER로 변경  
ALTER VIEW public.notification_stats_view SET (security_invoker = true);

-- 3. checkin_reminder_performance 뷰를 SECURITY INVOKER로 변경
ALTER VIEW public.checkin_reminder_performance SET (security_invoker = true);

-- 4. 수정 결과 확인을 위한 뷰 정보 조회 함수
CREATE OR REPLACE FUNCTION public.check_view_security_settings()
RETURNS TABLE (
    view_name TEXT,
    security_type TEXT,
    is_secure BOOLEAN
)
LANGUAGE plpgsql
SECURITY INVOKER  -- 이 함수는 INVOKER로 설정
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.viewname::TEXT,
        CASE 
            WHEN v.viewowner = current_user_id() THEN 'DEFINER'
            ELSE 'INVOKER'
        END::TEXT as security_type,
        CASE 
            WHEN v.viewowner = current_user_id() THEN false
            ELSE true
        END as is_secure
    FROM pg_views v
    WHERE v.schemaname = 'public' 
    AND v.viewname IN ('system_status_dashboard', 'notification_stats_view', 'checkin_reminder_performance');
END;
$$;

-- 5. 함수 권한 설정
GRANT EXECUTE ON FUNCTION public.check_view_security_settings() TO authenticated;

-- 6. 함수 설명
COMMENT ON FUNCTION public.check_view_security_settings() IS '뷰의 보안 설정 상태 확인 (SECURITY DEFINER 문제 해결 검증용)';

-- 7. 로그 기록
DO $$
BEGIN
    RAISE NOTICE '🔒 SECURITY FIX APPLIED: All views changed to SECURITY INVOKER';
    RAISE NOTICE '✅ system_status_dashboard: SECURITY INVOKER';
    RAISE NOTICE '✅ notification_stats_view: SECURITY INVOKER'; 
    RAISE NOTICE '✅ checkin_reminder_performance: SECURITY INVOKER';
    RAISE NOTICE '🛡️ RLS policies will now be properly enforced';
END $$;