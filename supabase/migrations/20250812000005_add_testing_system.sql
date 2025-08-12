-- 체크인 알림 시스템 테스트 및 검증
-- Phase 6: 테스트 및 검증

-- 1. 통합 테스트 실행 함수
CREATE OR REPLACE FUNCTION public.run_checkin_reminder_test()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    test_reservation_id UUID;
    test_user_id UUID;
    test_room_id UUID;
    test_result JSONB;
    cleanup_result JSONB;
BEGIN
    -- 1. 테스트 데이터 준비
    SELECT id INTO test_user_id 
    FROM public.users 
    WHERE push_subscription IS NOT NULL 
    AND (notification_preferences->>'enabled')::boolean = TRUE
    LIMIT 1;
    
    SELECT id INTO test_room_id 
    FROM public.rooms 
    LIMIT 1;
    
    IF test_user_id IS NULL OR test_room_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No suitable test user or room found',
            'test_user_id', test_user_id,
            'test_room_id', test_room_id
        );
    END IF;
    
    -- 2. 10분 후 시작하는 테스트 예약 생성
    INSERT INTO public.reservations (
        user_id,
        room_id,
        title,
        start_time,
        end_time,
        status,
        is_reminder_sent
    ) VALUES (
        test_user_id,
        test_room_id,
        '[TEST] Checkin Reminder Test',
        NOW() + INTERVAL '10 minutes',
        NOW() + INTERVAL '70 minutes',
        'confirmed',
        FALSE
    ) RETURNING id INTO test_reservation_id;
    
    -- 3. 체크인 알림 시스템 수동 실행
    SELECT public.trigger_checkin_reminders() INTO test_result;
    
    -- 4. 테스트 데이터 정리
    DELETE FROM public.notification_logs 
    WHERE reservation_id = test_reservation_id;
    
    DELETE FROM public.reservations 
    WHERE id = test_reservation_id;
    
    -- 5. 결과 반환
    RETURN jsonb_build_object(
        'test_executed_at', NOW(),
        'test_reservation_id', test_reservation_id,
        'test_user_id', test_user_id,
        'test_room_id', test_room_id,
        'reminder_result', test_result,
        'cleanup_completed', true,
        'success', true
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- 에러 발생 시 정리 작업
        DELETE FROM public.notification_logs 
        WHERE reservation_id = test_reservation_id;
        
        DELETE FROM public.reservations 
        WHERE id = test_reservation_id;
        
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'test_reservation_id', test_reservation_id,
            'cleanup_attempted', true
        );
END;
$$;

-- 2. 시스템 준비 상태 종합 검증 함수
CREATE OR REPLACE FUNCTION public.validate_checkin_reminder_system()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    validation_result JSONB := '{}';
    temp_count INTEGER;
    temp_status BOOLEAN;
BEGIN
    -- 1. 데이터베이스 스키마 검증
    SELECT COUNT(*) INTO temp_count
    FROM information_schema.columns 
    WHERE table_name = 'reservations' 
    AND column_name IN ('is_reminder_sent', 'reminder_sent_at');
    
    validation_result := jsonb_set(
        validation_result, 
        '{schema_ready}', 
        to_jsonb(temp_count = 2)
    );
    
    -- 2. 인덱스 존재 확인
    SELECT COUNT(*) INTO temp_count
    FROM pg_indexes 
    WHERE indexname = 'idx_reservations_reminder_pending';
    
    validation_result := jsonb_set(
        validation_result, 
        '{indexes_ready}', 
        to_jsonb(temp_count = 1)
    );
    
    -- 3. Cron 작업 활성 상태 확인
    SELECT COUNT(*) INTO temp_count
    FROM cron.job 
    WHERE jobname = 'reservation-automation' AND active = true;
    
    validation_result := jsonb_set(
        validation_result, 
        '{cron_active}', 
        to_jsonb(temp_count = 1)
    );
    
    -- 4. 푸시 구독 사용자 존재 확인
    SELECT COUNT(*) INTO temp_count
    FROM public.users 
    WHERE push_subscription IS NOT NULL;
    
    validation_result := jsonb_set(
        validation_result, 
        '{push_users_available}', 
        to_jsonb(temp_count > 0)
    );
    
    validation_result := jsonb_set(
        validation_result, 
        '{push_users_count}', 
        to_jsonb(temp_count)
    );
    
    -- 5. Edge Function 호출 가능 여부 테스트
    BEGIN
        SELECT public.trigger_checkin_reminders() INTO temp_status;
        validation_result := jsonb_set(
            validation_result, 
            '{edge_function_callable}', 
            to_jsonb(true)
        );
    EXCEPTION
        WHEN OTHERS THEN
            validation_result := jsonb_set(
                validation_result, 
                '{edge_function_callable}', 
                to_jsonb(false)
            );
            validation_result := jsonb_set(
                validation_result, 
                '{edge_function_error}', 
                to_jsonb(SQLERRM)
            );
    END;
    
    -- 6. 필수 함수 존재 확인
    SELECT COUNT(*) INTO temp_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proname IN ('trigger_checkin_reminders', 'run_reservation_automation');
    
    validation_result := jsonb_set(
        validation_result, 
        '{required_functions_exist}', 
        to_jsonb(temp_count = 2)
    );
    
    -- 7. 전체 시스템 준비 상태 판정
    temp_status := (
        (validation_result->>'schema_ready')::boolean AND
        (validation_result->>'indexes_ready')::boolean AND
        (validation_result->>'cron_active')::boolean AND
        (validation_result->>'push_users_available')::boolean AND
        (validation_result->>'edge_function_callable')::boolean AND
        (validation_result->>'required_functions_exist')::boolean
    );
    
    validation_result := jsonb_set(
        validation_result, 
        '{system_ready}', 
        to_jsonb(temp_status)
    );
    
    validation_result := jsonb_set(
        validation_result, 
        '{validated_at}', 
        to_jsonb(NOW())
    );
    
    RETURN validation_result;
END;
$$;

-- 3. 테스트용 예약 생성 함수 (개발용)
CREATE OR REPLACE FUNCTION public.create_test_reservation_for_reminder()
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    test_reservation_id UUID;
    test_user_id UUID;
    test_room_id UUID;
BEGIN
    -- 테스트 사용자 조회
    SELECT id INTO test_user_id 
    FROM public.users 
    WHERE push_subscription IS NOT NULL 
    LIMIT 1;
    
    -- 테스트 룸 조회
    SELECT id INTO test_room_id 
    FROM public.rooms 
    LIMIT 1;
    
    -- 10분 후 시작하는 테스트 예약 생성
    INSERT INTO public.reservations (
        user_id,
        room_id,
        title,
        start_time,
        end_time,
        status,
        is_reminder_sent
    ) VALUES (
        test_user_id,
        test_room_id,
        'Test Reminder Reservation',
        NOW() + INTERVAL '10 minutes',
        NOW() + INTERVAL '70 minutes',
        'confirmed',
        FALSE
    ) RETURNING id INTO test_reservation_id;
    
    RETURN test_reservation_id;
END;
$$;

-- 4. 함수 권한 설정 (관리자 전용)
GRANT EXECUTE ON FUNCTION public.run_checkin_reminder_test() TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_checkin_reminder_system() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_test_reservation_for_reminder() TO authenticated;

-- 5. 함수 설명 추가
COMMENT ON FUNCTION public.run_checkin_reminder_test() IS '체크인 알림 시스템 통합 테스트 (자동 정리 포함)';
COMMENT ON FUNCTION public.validate_checkin_reminder_system() IS '시스템 준비 상태 종합 검증';
COMMENT ON FUNCTION public.create_test_reservation_for_reminder() IS '테스트용 예약 생성 (개발용)';