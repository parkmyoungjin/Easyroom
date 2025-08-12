-- 체크인 알림 시스템 모니터링 및 최적화
-- Phase 5: 모니터링 및 최적화

-- 1. 체크인 알림 성능 통계 뷰
CREATE OR REPLACE VIEW public.checkin_reminder_performance AS
SELECT 
    DATE(sent_at) as date,
    COUNT(*) as total_sent,
    COUNT(*) FILTER (WHERE status = 'sent') as successful,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    ROUND(
        COUNT(*) FILTER (WHERE status = 'sent') * 100.0 / NULLIF(COUNT(*), 0), 2
    ) as success_rate_percent,
    COUNT(DISTINCT reservation_id) as unique_reservations,
    COUNT(DISTINCT user_id) as unique_users
FROM public.notification_logs
WHERE notification_type = 'checkin_reminder'
AND sent_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(sent_at)
ORDER BY date DESC;

-- 2. 실시간 시스템 상태 뷰
CREATE OR REPLACE VIEW public.system_status_dashboard AS
SELECT 
    'Pending Reminders' as metric,
    COUNT(*) as value,
    'reservations' as unit
FROM public.reservations 
WHERE status = 'confirmed' 
AND is_reminder_sent = FALSE 
AND start_time BETWEEN NOW() + INTERVAL '5 minutes' AND NOW() + INTERVAL '15 minutes'

UNION ALL

SELECT 
    'Active Push Subscriptions' as metric,
    COUNT(*) as value,
    'users' as unit
FROM public.users 
WHERE push_subscription IS NOT NULL
AND (notification_preferences->>'enabled')::boolean = TRUE

UNION ALL

SELECT 
    'Today Reminders Sent' as metric,
    COUNT(*) as value,
    'notifications' as unit
FROM public.notification_logs 
WHERE notification_type = 'checkin_reminder' 
AND DATE(sent_at) = CURRENT_DATE
AND status = 'sent';

-- 3. 자동화 작업 상태 확인 함수
CREATE OR REPLACE FUNCTION public.get_automation_system_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cron_status JSONB;
    last_execution JSONB;
    pending_reminders INTEGER;
    system_health JSONB;
BEGIN
    -- Cron 작업 상태 확인
    SELECT jsonb_agg(
        jsonb_build_object(
            'job_name', jobname,
            'schedule', schedule,
            'active', active,
            'last_run', (
                SELECT max(start_time) 
                FROM cron.job_run_details 
                WHERE jobid = j.jobid
            )
        )
    ) INTO cron_status
    FROM cron.job j
    WHERE jobname IN ('reservation-automation', 'daily-reservation-cleanup');
    
    -- 대기 중인 알림 수 확인
    SELECT COUNT(*) INTO pending_reminders
    FROM public.reservations 
    WHERE status = 'confirmed' 
    AND is_reminder_sent = FALSE 
    AND start_time BETWEEN NOW() + INTERVAL '5 minutes' AND NOW() + INTERVAL '15 minutes';
    
    -- 마지막 자동화 실행 결과 확인 (로그에서)
    SELECT jsonb_build_object(
        'last_execution_time', MAX(sent_at),
        'recent_success_count', COUNT(*) FILTER (WHERE status = 'sent' AND sent_at >= NOW() - INTERVAL '1 hour'),
        'recent_failure_count', COUNT(*) FILTER (WHERE status = 'failed' AND sent_at >= NOW() - INTERVAL '1 hour')
    ) INTO last_execution
    FROM public.notification_logs 
    WHERE notification_type = 'checkin_reminder';
    
    -- 통합 상태 반환
    RETURN jsonb_build_object(
        'timestamp', NOW(),
        'cron_jobs', cron_status,
        'pending_reminders', pending_reminders,
        'last_execution', last_execution,
        'system_healthy', (
            cron_status IS NOT NULL AND 
            pending_reminders >= 0 AND
            (last_execution->>'recent_failure_count')::integer < 10
        )
    );
END;
$$;

-- 4. 알림 대상 예약 조회 최적화 함수
CREATE OR REPLACE FUNCTION public.get_pending_reminder_reservations(
    window_start TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes',
    window_end TIMESTAMPTZ DEFAULT NOW() + INTERVAL '15 minutes'
)
RETURNS TABLE (
    reservation_id UUID,
    user_id UUID,
    user_name TEXT,
    room_name TEXT,
    reservation_title TEXT,
    start_time TIMESTAMPTZ,
    minutes_until_start INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        u.id,
        u.name,
        rm.name,
        r.title,
        r.start_time,
        EXTRACT(EPOCH FROM (r.start_time - NOW())) / 60
    FROM public.reservations r
    JOIN public.users u ON r.user_id = u.id
    JOIN public.rooms rm ON r.room_id = rm.id
    WHERE r.status = 'confirmed'
    AND r.is_reminder_sent = FALSE
    AND r.start_time >= window_start
    AND r.start_time <= window_end
    AND u.push_subscription IS NOT NULL
    AND (u.notification_preferences->>'enabled')::boolean = TRUE
    AND (u.notification_preferences->>'checkin_reminder')::boolean = TRUE
    ORDER BY r.start_time ASC;
END;
$$;

-- 5. 뷰 및 함수 권한 설정
GRANT SELECT ON public.checkin_reminder_performance TO authenticated;
GRANT SELECT ON public.system_status_dashboard TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_automation_system_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_reminder_reservations(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- 6. 뷰 및 함수 설명 추가
COMMENT ON VIEW public.checkin_reminder_performance IS '체크인 알림 성능 통계 (최근 30일)';
COMMENT ON VIEW public.system_status_dashboard IS '실시간 시스템 상태 대시보드';
COMMENT ON FUNCTION public.get_automation_system_status() IS 'Cron 작업 및 시스템 상태 통합 확인';
COMMENT ON FUNCTION public.get_pending_reminder_reservations(TIMESTAMPTZ, TIMESTAMPTZ) IS '알림 대상 예약 조회 최적화 함수';