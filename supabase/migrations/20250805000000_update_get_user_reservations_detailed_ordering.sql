-- Update get_user_reservations_detailed function with corrected ordering
-- 드래그 앤 드롭 예약 업데이트 실패 원인 분석에 따른 수정

CREATE OR REPLACE FUNCTION get_user_reservations_detailed(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    reservation_data jsonb;
BEGIN
    -- 권한 검사는 그대로 유지
    IF NOT ((SELECT id FROM users WHERE auth_id = auth.uid()) = p_user_id OR 
            EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')) THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;

    -- 예약 데이터를 JSON 배열로 만듭니다.
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
            'room', to_jsonb(rm),
            'user', to_jsonb(u)
        )
        -- ✅ [핵심 수정] DESC (내림차순)를 ASC (오름차순)으로 변경합니다.
        ORDER BY r.start_time ASC
    )
    INTO reservation_data
    FROM reservations r
    JOIN rooms rm ON r.room_id = rm.id
    JOIN users u ON r.user_id = u.id
    WHERE r.user_id = p_user_id;

    -- 결과가 없으면 빈 JSON 배열을 반환합니다.
    RETURN COALESCE(reservation_data, '[]'::jsonb);
END;
$function$;

-- 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION get_user_reservations_detailed(UUID) TO authenticated;

-- 함수 설명 업데이트
COMMENT ON FUNCTION get_user_reservations_detailed IS '사용자의 예약 목록을 상세 정보와 함께 조회하는 함수 - 시간순 정렬 수정 (ASC)';