-- FILE: supabase/migrations/YYYYMMDDHHMMSS_get_booked_slots_for_timeline.sql

-- --- 1단계: 기존에 혹시라도 존재할 수 있는 타입과 함수를 안전하게 삭제합니다. ---
-- 이것이 '멱등성(idempotent)'을 보장하여, 스크립트를 여러 번 실행해도 항상 동일한 결과를 만듭니다.
DROP FUNCTION IF EXISTS public.get_booked_slots_for_timeline(p_room_id uuid, p_date date);
DROP TYPE IF EXISTS public.booked_slot_details;


-- --- 2단계: 필요한 타입을 깨끗한 상태에서 다시 생성합니다. ---
CREATE TYPE public.booked_slot_details AS (
    start_time timestamptz,
    end_time timestamptz,
    title text,
    user_name text,
    is_mine boolean
);


-- --- 3단계: 필요한 함수를 생성합니다. (최적화 및 오류 수정) ---
CREATE OR REPLACE FUNCTION public.get_booked_slots_for_timeline(
    p_room_id uuid,
    p_date date
)
RETURNS SETOF public.booked_slot_details -- SETOF를 사용하여 여러 행을 반환할 수 있음을 명시
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    -- 함수 내에서 사용할 변수 선언
    date_start_kst timestamptz;
    date_end_kst timestamptz;
    current_user_auth_id uuid := auth.uid(); -- 현재 로그인한 사용자의 '인증 ID'
BEGIN
    -- 입력 검증
    IF p_room_id IS NULL OR p_date IS NULL THEN
        RETURN;
    END IF;

    -- KST(UTC+9) 기준으로 조회할 날짜의 시작과 끝을 정의
    date_start_kst := (p_date::text || ' 00:00:00+09:00')::timestamptz;
    date_end_kst := (p_date::text || ' 23:59:59.999+09:00')::timestamptz;

    -- ✅ [핵심 수정] LOOP 대신, 단일 쿼리로 모든 결과를 처리하고 즉시 반환하여 성능을 최적화합니다.
    RETURN QUERY
    SELECT
        r.start_time,
        r.end_time,
        -- ✅ [핵심 수정] '내 예약'이 아닐 경우, 'Booked' 대신 '부서명'을 표시하여 다른 정책과 통일합니다.
        CASE
            WHEN u.auth_id = current_user_auth_id THEN r.title
            ELSE u.department
        END AS title,
        CASE
            WHEN u.auth_id = current_user_auth_id THEN u.name
            ELSE 'Anonymous'
        END AS user_name,
        -- ✅ [핵심 수정] users 테이블의 auth_id와 직접 비교하여 '내 예약' 여부를 정확하게 판단합니다.
        (u.auth_id = current_user_auth_id) AS is_mine
    FROM
        public.reservations r
    JOIN -- INNER JOIN을 사용하여 user 정보가 없는 예약을 안전하게 제외합니다.
        public.users u ON r.user_id = u.id
    WHERE
        r.room_id = p_room_id
        AND r.status = 'confirmed'
        -- ✅ [핵심 수정] 하루에 '걸쳐 있는' 모든 예약을 포함하도록 시간 범위 필터링을 수정합니다.
        AND r.start_time < date_end_kst   -- 예약이 하루의 끝 이전에 시작하고
        AND r.end_time > date_start_kst;    -- 예약이 하루의 시작 이후에 끝나는 경우
        -- 정렬은 프론트엔드에서도 수행 가능하지만, DB에서 하는 것이 효율적일 수 있습니다.
        -- ORDER BY r.start_time;
END;
$$;


-- --- 4단계: 권한을 부여합니다. (선택적이지만 권장) ---
GRANT EXECUTE ON FUNCTION public.get_booked_slots_for_timeline(uuid, date) TO authenticated;