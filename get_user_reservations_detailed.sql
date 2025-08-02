-- get_user_reservations_detailed 함수 생성
-- useMyReservations 훅에서 사용하는 RPC 함수

CREATE OR REPLACE FUNCTION get_user_reservations_detailed(
    user_id UUID,
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
    data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    current_user_db_id UUID;
    reservation_data JSONB;
BEGIN
    -- 입력 검증
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'user_id cannot be null';
    END IF;
    
    IF limit_count IS NULL OR limit_count <= 0 THEN
        limit_count := 50;
    END IF;
    
    IF offset_count IS NULL OR offset_count < 0 THEN
        offset_count := 0;
    END IF;
    
    -- 현재 인증된 사용자의 DB ID 확인
    SELECT u.id INTO current_user_db_id
    FROM public.users u
    WHERE u.auth_id = auth.uid();
    
    -- 권한 확인: 자신의 예약만 조회 가능 (또는 관리자)
    IF current_user_db_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;
    
    IF current_user_db_id != user_id THEN
        -- 관리자 권한 확인
        IF NOT EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = current_user_db_id AND role = 'admin'
        ) THEN
            RAISE EXCEPTION 'Access denied: can only view own reservations';
        END IF;
    END IF;
    
    -- 예약 데이터 조회 (ReservationWithDetails 구조에 맞게)
    -- cancellation_reason 컬럼이 없으므로 제거하고 기본 스키마에 맞게 수정
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', r.id,
            'room_id', r.room_id,
            'user_id', r.user_id,
            'title', r.title,
            'purpose', r.purpose,
            'start_time', r.start_time,
            'end_time', r.end_time,
            'status', r.status,
            'created_at', r.created_at,
            'updated_at', r.updated_at,
            'room', jsonb_build_object(
                'id', rm.id,
                'name', rm.name,
                'description', rm.description,
                'capacity', rm.capacity,
                'location', rm.location,
                'equipment', rm.equipment,
                'is_active', rm.is_active,
                'created_at', rm.created_at,
                'updated_at', rm.updated_at
            ),
            'user', jsonb_build_object(
                'id', u.id,
                'auth_id', u.auth_id,
                'employee_id', u.employee_id,
                'name', u.name,
                'email', u.email,
                'department', u.department,
                'role', u.role,
                'created_at', u.created_at,
                'updated_at', u.updated_at
            )
        )
        ORDER BY r.start_time ASC
    ) INTO reservation_data
    FROM public.reservations r
    INNER JOIN public.rooms rm ON r.room_id = rm.id
    INNER JOIN public.users u ON r.user_id = u.id
    WHERE r.user_id = get_user_reservations_detailed.user_id
    LIMIT limit_count
    OFFSET offset_count;
    
    -- 결과가 없으면 빈 배열 반환
    IF reservation_data IS NULL THEN
        reservation_data := '[]'::jsonb;
    END IF;
    
    -- 결과 반환
    RETURN QUERY SELECT reservation_data;
END;
$function$;

-- 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION get_user_reservations_detailed(UUID, INTEGER, INTEGER) TO authenticated;

-- 함수 설명 추가
COMMENT ON FUNCTION get_user_reservations_detailed IS '사용자의 예약 목록을 상세 정보와 함께 조회하는 함수 - 페이지네이션 지원';