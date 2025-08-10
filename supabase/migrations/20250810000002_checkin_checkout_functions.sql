-- Phase 1: 체크인/체크아웃 API 함수들

-- 1. 체크인 함수
CREATE OR REPLACE FUNCTION public.check_in_reservation(
    p_reservation_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_db_id UUID;
    reservation_record RECORD;
    result JSONB;
BEGIN
    -- 현재 사용자 확인
    SELECT u.id INTO current_user_db_id
    FROM public.users u
    WHERE u.auth_id = auth.uid();
    
    IF current_user_db_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User not authenticated',
            'code', 'AUTH_REQUIRED'
        );
    END IF;
    
    -- 예약 정보 조회 및 권한 확인
    SELECT r.*, rm.name as room_name
    INTO reservation_record
    FROM public.reservations r
    JOIN public.rooms rm ON r.room_id = rm.id
    WHERE r.id = p_reservation_id
    AND r.user_id = current_user_db_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Reservation not found or access denied',
            'code', 'NOT_FOUND'
        );
    END IF;
    
    -- 예약 상태 확인
    IF reservation_record.status != 'confirmed' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Reservation is not in confirmed status',
            'code', 'INVALID_STATUS',
            'current_status', reservation_record.status
        );
    END IF;
    
    -- 시간 유효성 확인 (예약 시작 30분 전부터 체크인 가능)
    IF NOW() < reservation_record.start_time - INTERVAL '30 minutes' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Check-in is only available 30 minutes before reservation start time',
            'code', 'TOO_EARLY',
            'start_time', reservation_record.start_time
        );
    END IF;
    
    -- 예약 시간이 이미 지났는지 확인 (시작 후 30분까지만 체크인 가능)
    IF NOW() > reservation_record.start_time + INTERVAL '30 minutes' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Check-in time has expired (30 minutes after start time)',
            'code', 'EXPIRED',
            'start_time', reservation_record.start_time
        );
    END IF;
    
    -- 체크인 처리
    UPDATE public.reservations
    SET 
        status = 'checked_in',
        checked_in_at = NOW(),
        updated_at = NOW()
    WHERE id = p_reservation_id;
    
    -- 성공 응답
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Successfully checked in',
        'data', jsonb_build_object(
            'reservation_id', p_reservation_id,
            'room_name', reservation_record.room_name,
            'checked_in_at', NOW(),
            'start_time', reservation_record.start_time,
            'end_time', reservation_record.end_time
        )
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Internal server error: ' || SQLERRM,
            'code', 'INTERNAL_ERROR'
        );
END;
$$;

-- 2. 체크아웃 함수
CREATE OR REPLACE FUNCTION public.check_out_reservation(
    p_reservation_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_db_id UUID;
    reservation_record RECORD;
    actual_duration INTERVAL;
    result JSONB;
BEGIN
    -- 현재 사용자 확인
    SELECT u.id INTO current_user_db_id
    FROM public.users u
    WHERE u.auth_id = auth.uid();
    
    IF current_user_db_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User not authenticated',
            'code', 'AUTH_REQUIRED'
        );
    END IF;
    
    -- 예약 정보 조회 및 권한 확인
    SELECT r.*, rm.name as room_name
    INTO reservation_record
    FROM public.reservations r
    JOIN public.rooms rm ON r.room_id = rm.id
    WHERE r.id = p_reservation_id
    AND r.user_id = current_user_db_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Reservation not found or access denied',
            'code', 'NOT_FOUND'
        );
    END IF;
    
    -- 예약 상태 확인 (체크인된 상태여야 함)
    IF reservation_record.status NOT IN ('checked_in', 'overtime') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Reservation must be checked in to check out',
            'code', 'INVALID_STATUS',
            'current_status', reservation_record.status
        );
    END IF;
    
    -- 체크인 시간이 없는 경우 (데이터 무결성 확인)
    IF reservation_record.checked_in_at IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Check-in time not found',
            'code', 'DATA_INTEGRITY_ERROR'
        );
    END IF;
    
    -- 실제 사용 시간 계산
    actual_duration := NOW() - reservation_record.checked_in_at;
    
    -- 체크아웃 처리
    UPDATE public.reservations
    SET 
        status = 'completed',
        checked_out_at = NOW(),
        updated_at = NOW()
    WHERE id = p_reservation_id;
    
    -- 성공 응답
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Successfully checked out',
        'data', jsonb_build_object(
            'reservation_id', p_reservation_id,
            'room_name', reservation_record.room_name,
            'checked_in_at', reservation_record.checked_in_at,
            'checked_out_at', NOW(),
            'actual_duration_minutes', EXTRACT(EPOCH FROM actual_duration) / 60,
            'scheduled_duration_minutes', EXTRACT(EPOCH FROM (reservation_record.end_time - reservation_record.start_time)) / 60,
            'was_overtime', NOW() > reservation_record.end_time
        )
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Internal server error: ' || SQLERRM,
            'code', 'INTERNAL_ERROR'
        );
END;
$$;

-- 3. 예약 상태 조회 함수 (체크인/체크아웃 가능 여부 확인)
CREATE OR REPLACE FUNCTION public.get_reservation_checkin_status(
    p_reservation_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_db_id UUID;
    reservation_record RECORD;
    can_checkin BOOLEAN := false;
    can_checkout BOOLEAN := false;
    status_message TEXT;
BEGIN
    -- 현재 사용자 확인
    SELECT u.id INTO current_user_db_id
    FROM public.users u
    WHERE u.auth_id = auth.uid();
    
    IF current_user_db_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User not authenticated',
            'code', 'AUTH_REQUIRED'
        );
    END IF;
    
    -- 예약 정보 조회
    SELECT r.*, rm.name as room_name
    INTO reservation_record
    FROM public.reservations r
    JOIN public.rooms rm ON r.room_id = rm.id
    WHERE r.id = p_reservation_id
    AND r.user_id = current_user_db_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Reservation not found or access denied',
            'code', 'NOT_FOUND'
        );
    END IF;
    
    -- 상태별 체크인/체크아웃 가능 여부 판단
    CASE reservation_record.status
        WHEN 'confirmed' THEN
            -- 체크인 가능 시간 확인
            IF NOW() >= reservation_record.start_time - INTERVAL '30 minutes' 
               AND NOW() <= reservation_record.start_time + INTERVAL '30 minutes' THEN
                can_checkin := true;
                status_message := 'Ready for check-in';
            ELSIF NOW() < reservation_record.start_time - INTERVAL '30 minutes' THEN
                status_message := 'Check-in available 30 minutes before start time';
            ELSE
                status_message := 'Check-in time expired';
            END IF;
            
        WHEN 'checked_in' THEN
            can_checkout := true;
            -- 연장 시간 확인
            IF NOW() > reservation_record.end_time THEN
                status_message := 'Meeting is overtime - please check out';
            ELSE
                status_message := 'Meeting in progress';
            END IF;
            
        WHEN 'overtime' THEN
            can_checkout := true;
            status_message := 'Meeting is overtime - please check out immediately';
            
        WHEN 'completed' THEN
            status_message := 'Meeting completed';
            
        WHEN 'no_show' THEN
            status_message := 'Marked as no-show';
            
        WHEN 'cancelled' THEN
            status_message := 'Reservation cancelled';
            
        ELSE
            status_message := 'Unknown status';
    END CASE;
    
    -- 결과 반환
    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'reservation_id', p_reservation_id,
            'room_name', reservation_record.room_name,
            'current_status', reservation_record.status,
            'can_checkin', can_checkin,
            'can_checkout', can_checkout,
            'status_message', status_message,
            'start_time', reservation_record.start_time,
            'end_time', reservation_record.end_time,
            'checked_in_at', reservation_record.checked_in_at,
            'checked_out_at', reservation_record.checked_out_at,
            'is_overtime', CASE 
                WHEN reservation_record.status IN ('checked_in', 'overtime') 
                THEN NOW() > reservation_record.end_time 
                ELSE false 
            END
        )
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Internal server error: ' || SQLERRM,
            'code', 'INTERNAL_ERROR'
        );
END;
$$;

-- 4. 함수 권한 설정
GRANT EXECUTE ON FUNCTION public.check_in_reservation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_out_reservation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reservation_checkin_status(UUID) TO authenticated;

-- 5. 함수 설명 추가
COMMENT ON FUNCTION public.check_in_reservation(UUID) IS '예약 체크인 처리 - 예약 시작 30분 전부터 시작 후 30분까지 가능';
COMMENT ON FUNCTION public.check_out_reservation(UUID) IS '예약 체크아웃 처리 - 체크인된 예약만 체크아웃 가능';
COMMENT ON FUNCTION public.get_reservation_checkin_status(UUID) IS '예약의 체크인/체크아웃 가능 상태 조회';