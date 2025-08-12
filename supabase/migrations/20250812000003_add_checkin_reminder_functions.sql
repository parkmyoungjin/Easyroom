-- 체크인 알림 시스템 PostgreSQL 통합 함수
-- Phase 3: PostgreSQL 통합 함수 (최적화 완료)

-- 1. Edge Function 직접 호출 함수 (내부 네트워크 사용)
CREATE OR REPLACE FUNCTION public.trigger_checkin_reminders()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    response_data JSONB;
    function_result RECORD;
BEGIN
    -- Supabase 내부 네트워크를 통한 Edge Function 직접 호출
    SELECT content INTO response_data
    FROM supabase_functions.invoke('send-checkin-reminders');
    
    -- 응답 처리
    IF response_data IS NOT NULL THEN
        RAISE NOTICE 'Checkin reminders executed: %', response_data->>'message';
        
        RETURN jsonb_build_object(
            'success', true,
            'response', response_data,
            'executed_at', NOW()
        );
    ELSE
        RAISE WARNING 'Checkin reminder function returned null response';
        
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No response from function',
            'executed_at', NOW()
        );
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to trigger checkin reminders: %', SQLERRM;
        
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'executed_at', NOW()
        );
END;
$$;

-- 2. 기존 run_reservation_automation 함수 확장 (통합 완료)
CREATE OR REPLACE FUNCTION public.run_reservation_automation()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    overtime_count INTEGER;
    no_show_count INTEGER;
    checkout_count INTEGER;
    reminder_result JSONB;
    execution_time TIMESTAMPTZ;
    total_processing_time INTERVAL;
BEGIN
    execution_time := NOW();
    
    RAISE NOTICE 'Starting reservation automation at %', execution_time;
    
    -- 1. Overtime 상태 업데이트
    SELECT public.update_overtime_status() INTO overtime_count;
    RAISE NOTICE 'Overtime updated: % reservations', overtime_count;
    
    -- 2. No-Show 처리
    SELECT public.mark_no_show_reservations() INTO no_show_count;
    RAISE NOTICE 'No-shows marked: % reservations', no_show_count;
    
    -- 3. 자동 체크아웃
    SELECT public.auto_checkout_expired_reservations() INTO checkout_count;
    RAISE NOTICE 'Auto checkouts: % reservations', checkout_count;
    
    -- 4. 체크인 알림 발송 (새로 추가 - 최적화됨)
    SELECT public.trigger_checkin_reminders() INTO reminder_result;
    RAISE NOTICE 'Checkin reminders: %', reminder_result->>'message';
    
    total_processing_time := NOW() - execution_time;
    
    -- 통합 결과 반환
    RETURN jsonb_build_object(
        'execution_time', execution_time,
        'processing_time_seconds', EXTRACT(EPOCH FROM total_processing_time),
        'overtime_updated', overtime_count,
        'no_shows_marked', no_show_count,
        'auto_checkouts', checkout_count,
        'checkin_reminders', reminder_result,
        'total_reservations_processed', overtime_count + no_show_count + checkout_count,
        'success', true
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Automation error at %: %', NOW(), SQLERRM;
        RETURN jsonb_build_object(
            'execution_time', execution_time,
            'processing_time_seconds', EXTRACT(EPOCH FROM (NOW() - execution_time)),
            'error', SQLERRM,
            'success', false
        );
END;
$$;

-- 3. 함수 권한 설정
GRANT EXECUTE ON FUNCTION public.trigger_checkin_reminders() TO postgres;
GRANT EXECUTE ON FUNCTION public.run_reservation_automation() TO postgres;

-- 관리자는 수동으로 체크인 알림 함수를 실행할 수 있음
GRANT EXECUTE ON FUNCTION public.trigger_checkin_reminders() TO authenticated;

-- 4. 함수 설명 추가
COMMENT ON FUNCTION public.trigger_checkin_reminders() IS 'Edge Function을 통한 체크인 알림 발송 (내부 네트워크 최적화)';
COMMENT ON FUNCTION public.run_reservation_automation() IS '통합 예약 자동화: Overtime/No-Show/체크아웃/체크인알림 처리';