-- 긴급 보안 수정: SECURITY DEFINER VIEW 문제 해결
-- 모든 뷰를 SECURITY INVOKER로 변경하여 RLS 정책 적용

-- 1. system_status_dashboard 뷰 수정
ALTER VIEW public.system_status_dashboard SET (security_invoker = true);

-- 2. notification_stats_view 뷰 수정  
ALTER VIEW public.notification_stats_view SET (security_invoker = true);

-- 3. checkin_reminder_performance 뷰 수정
ALTER VIEW public.checkin_reminder_performance SET (security_invoker = true);

-- 수정 결과 확인
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE schemaname = 'public' 
AND viewname IN ('system_status_dashboard', 'notification_stats_view', 'checkin_reminder_performance');