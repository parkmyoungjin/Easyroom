-- Phase 1: pg_cron을 사용한 자동화 작업

-- pg_cron 확장 활성화 (이미 활성화되어 있을 수 있음)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. 자동 체크아웃 함수
CREATE OR REPLACE FUNCTION public.auto_checkout_expired_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    checkout_count INTEGER := 0;
    reservation_record RECORD;
BEGIN
    -- 예약 종료 시간이 지났지만 아직 체크아웃되지 않은 예약들을 체크아웃 처리
    FOR reservation_record IN
        SELECT id, title, end_time, checked_in_at
        FROM public.reservations
        WHERE status = 'checked_in'
        AND end_time <= NOW()
        AND checked_out_at IS NULL
    LOOP
        -- 자동 체크아웃 처리
        UPDATE public.reservations
        SET 
            status = 'completed',
            checked_out_at = NOW(),
            updated_at = NOW()
        WHERE id = reservation_record.id;
        
        checkout_count := checkout_count + 1;
        
        -- 로그 기록 (선택사항)
        RAISE NOTICE 'Auto checkout: Reservation % (%) completed at %', 
            reservation_record.id, 
            reservation_record.title, 
            NOW();
    END LOOP;
    
    RETURN checkout_count;
END;
$$;

-- 2. No-Show 처리 함수
CREATE OR REPLACE FUNCTION public.mark_no_show_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    no_show_count INTEGER := 0;
    reservation_record RECORD;
BEGIN
    -- 예약 시작 후 30분이 지났지만 체크인되지 않은 예약들을 No-Show로 처리
    FOR reservation_record IN
        SELECT id, title, start_time, user_id
        FROM public.reservations
        WHERE status = 'confirmed'
        AND start_time + INTERVAL '30 minutes' <= NOW()
        AND checked_in_at IS NULL
    LOOP
        -- No-Show 처리
        UPDATE public.reservations
        SET 
            status = 'no_show',
            updated_at = NOW()
        WHERE id = reservation_record.id;
        
        no_show_count := no_show_count + 1;
        
        -- 로그 기록
        RAISE NOTICE 'No-Show marked: Reservation % (%) for user %', 
            reservation_record.id, 
            reservation_record.title, 
            reservation_record.user_id;
    END LOOP;
    
    RETURN no_show_count;
END;
$$;

-- 3. 연장 시간(Overtime) 상태 업데이트 함수
CREATE OR REPLACE FUNCTION public.update_overtime_status()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    overtime_count INTEGER := 0;
    reservation_record RECORD;
BEGIN
    -- 예약 종료 시간이 지났지만 아직 체크인 상태인 예약들을 overtime으로 변경
    FOR reservation_record IN
        SELECT id, title, end_time
        FROM public.reservations
        WHERE status = 'checked_in'
        AND end_time < NOW()
    LOOP
        -- Overtime 상태로 변경
        UPDATE public.reservations
        SET 
            status = 'overtime',
            updated_at = NOW()
        WHERE id = reservation_record.id;
        
        overtime_count := overtime_count + 1;
        
        -- 로그 기록
        RAISE NOTICE 'Overtime status: Reservation % (%) is now overtime', 
            reservation_record.id, 
            reservation_record.title;
    END LOOP;
    
    RETURN overtime_count;
END;
$$;

-- 4. 통합 자동화 함수 (모든 자동화 작업을 한 번에 실행)
CREATE OR REPLACE FUNCTION public.run_reservation_automation()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    overtime_count INTEGER;
    no_show_count INTEGER;
    checkout_count INTEGER;
    execution_time TIMESTAMPTZ;
BEGIN
    execution_time := NOW();
    
    -- 1. Overtime 상태 업데이트
    SELECT public.update_overtime_status() INTO overtime_count;
    
    -- 2. No-Show 처리 (overtime 업데이트 후 실행)
    SELECT public.mark_no_show_reservations() INTO no_show_count;
    
    -- 3. 자동 체크아웃 (마지막에 실행)
    SELECT public.auto_checkout_expired_reservations() INTO checkout_count;
    
    -- 결과 반환
    RETURN jsonb_build_object(
        'execution_time', execution_time,
        'overtime_updated', overtime_count,
        'no_shows_marked', no_show_count,
        'auto_checkouts', checkout_count,
        'total_processed', overtime_count + no_show_count + checkout_count
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- 에러 로그
        RAISE WARNING 'Automation error at %: %', NOW(), SQLERRM;
        RETURN jsonb_build_object(
            'execution_time', execution_time,
            'error', SQLERRM,
            'success', false
        );
END;
$$;

-- 5. cron 작업 스케줄링
-- 매 5분마다 자동화 작업 실행
SELECT cron.schedule(
    'reservation-automation',
    '*/5 * * * *',  -- 매 5분마다 실행
    'SELECT public.run_reservation_automation();'
);

-- 6. 일일 통계 정리 함수 (선택사항)
CREATE OR REPLACE FUNCTION public.daily_reservation_cleanup()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cleanup_date DATE;
    old_reservations_count INTEGER;
BEGIN
    cleanup_date := CURRENT_DATE - INTERVAL '30 days';
    
    -- 30일 이전의 완료된 예약들의 개인정보 마스킹 (선택사항)
    -- 실제 운영에서는 데이터 보존 정책에 따라 조정
    
    RETURN jsonb_build_object(
        'cleanup_date', cleanup_date,
        'message', 'Daily cleanup completed',
        'execution_time', NOW()
    );
END;
$$;

-- 매일 자정에 정리 작업 실행 (선택사항)
SELECT cron.schedule(
    'daily-reservation-cleanup',
    '0 0 * * *',  -- 매일 자정
    'SELECT public.daily_reservation_cleanup();'
);

-- 7. 함수 권한 설정
GRANT EXECUTE ON FUNCTION public.auto_checkout_expired_reservations() TO postgres;
GRANT EXECUTE ON FUNCTION public.mark_no_show_reservations() TO postgres;
GRANT EXECUTE ON FUNCTION public.update_overtime_status() TO postgres;
GRANT EXECUTE ON FUNCTION public.run_reservation_automation() TO postgres;
GRANT EXECUTE ON FUNCTION public.daily_reservation_cleanup() TO postgres;

-- 관리자는 수동으로 자동화 함수를 실행할 수 있음
GRANT EXECUTE ON FUNCTION public.run_reservation_automation() TO authenticated;

-- 8. 함수 설명 추가
COMMENT ON FUNCTION public.auto_checkout_expired_reservations() IS '예약 종료 시간이 지난 체크인된 예약들을 자동으로 체크아웃 처리';
COMMENT ON FUNCTION public.mark_no_show_reservations() IS '예약 시작 후 30분이 지나도 체크인되지 않은 예약을 No-Show로 처리';
COMMENT ON FUNCTION public.update_overtime_status() IS '예약 종료 시간이 지났지만 아직 사용 중인 예약을 overtime 상태로 변경';
COMMENT ON FUNCTION public.run_reservation_automation() IS '모든 예약 자동화 작업을 통합 실행하는 함수';
COMMENT ON FUNCTION public.daily_reservation_cleanup() IS '일일 예약 데이터 정리 작업';

-- 9. cron 작업 상태 확인을 위한 함수 (관리자용 - 뷰 대신 함수 사용)
CREATE OR REPLACE FUNCTION public.get_cron_jobs_status()
RETURNS TABLE (
    jobname text,
    schedule text,
    command text,
    nodename text,
    nodeport integer,
    database text,
    username text,
    active boolean,
    jobid bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 관리자 권한 확인
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE auth_id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access denied: admin role required';
    END IF;
    
    -- cron 작업 상태 반환
    RETURN QUERY
    SELECT 
        j.jobname::text,
        j.schedule::text,
        j.command::text,
        j.nodename::text,
        j.nodeport,
        j.database::text,
        j.username::text,
        j.active,
        j.jobid
    FROM cron.job j
    WHERE j.jobname IN ('reservation-automation', 'daily-reservation-cleanup');
END;
$$;

-- 함수 권한 설정
GRANT EXECUTE ON FUNCTION public.get_cron_jobs_status() TO authenticated;

COMMENT ON FUNCTION public.get_cron_jobs_status() IS 'Cron 작업 상태 조회 - 관리자 전용';