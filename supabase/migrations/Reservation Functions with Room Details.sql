-- 모든 작업을 하나의 트랜잭션으로 묶어 안전하게 실행합니다.
BEGIN;

-- 1. 기존의 get_reservations_for_period 함수를 안전하게 제거합니다.
DROP FUNCTION public.get_reservations_for_period(timestamptz, timestamptz);

-- 2. room_name이 추가된 새로운 버전의 함수를 생성합니다.
-- CREATE OR REPLACE 대신 CREATE를 사용해도 무방합니다. (이미 DROP 했으므로)
CREATE OR REPLACE FUNCTION public.get_reservations_for_period(start_date timestamptz, end_date timestamptz)
RETURNS TABLE ( 
    id uuid, 
    room_id uuid, 
    user_id uuid, 
    title text, 
    purpose text, 
    start_time timestamptz, 
    end_time timestamptz, 
    department text, 
    user_name text, 
    room_name text, -- ✅ room_name 추가
    is_mine boolean 
)
LANGUAGE plpgsql 
SECURITY INVOKER 
SET search_path = public 
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id, 
        r.room_id, 
        r.user_id,
        CASE WHEN u.auth_id = auth.uid() THEN r.title ELSE u.department END,
        CASE WHEN u.auth_id = auth.uid() THEN r.purpose ELSE NULL END,
        r.start_time, 
        r.end_time, 
        u.department,
        CASE WHEN u.auth_id = auth.uid() THEN u.name ELSE 'Anonymous' END,
        rm.name as room_name, -- ✅ room_name 추가
        (u.auth_id = auth.uid())
    FROM public.reservations r 
    JOIN public.users u ON r.user_id = u.id
    JOIN public.rooms rm ON r.room_id = rm.id -- ✅ rooms 테이블 조인
    WHERE r.status = 'confirmed' 
        AND r.start_time < end_date 
        AND r.end_time > start_date
        AND rm.is_active = true; -- ✅ 활성 회의실만 조회
END; 
$$;

-- 3. 새로 만든 get_public_reservations_with_room 함수도 함께 생성합니다.
-- (이 함수는 새로 만드는 것이므로 DROP이 필요 없습니다.)
CREATE OR REPLACE FUNCTION public.get_public_reservations_with_room(
    start_date timestamptz, 
    end_date timestamptz,
    page_limit integer DEFAULT 100,
    page_offset integer DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    room_id uuid,
    user_id uuid,
    title text,
    purpose text,
    start_time timestamptz,
    end_time timestamptz,
    department text,
    user_name text,
    room_name text,
    is_mine boolean
)
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
-- ... (함수 내용은 제공해주신 그대로) ...
DECLARE
    current_user_db_id UUID;
BEGIN
    -- 입력 검증
    IF start_date IS NULL OR end_date IS NULL THEN
        RAISE EXCEPTION 'Start date and end date cannot be null';
    END IF;
    
    IF start_date >= end_date THEN
        RAISE EXCEPTION 'Start date must be before end date';
    END IF;
    
    -- 페이지네이션 검증
    IF page_limit IS NULL OR page_limit <= 0 OR page_limit > 1000 THEN
        page_limit := 100;
    END IF;
    
    IF page_offset IS NULL OR page_offset < 0 THEN
        page_offset := 0;
    END IF;
    
    -- 현재 사용자 ID 조회 (인증되지 않은 경우 NULL)
    SELECT u.id INTO current_user_db_id
    FROM public.users u
    WHERE u.auth_id = auth.uid();

    -- 예약 목록 반환 (room 정보 포함, 데이터 마스킹 적용)
    RETURN QUERY
    SELECT 
        r.id,
        r.room_id,
        r.user_id,
        CASE 
            WHEN current_user_db_id IS NOT NULL AND r.user_id = current_user_db_id 
            THEN r.title
            ELSE 'Booked'
        END as title,
        CASE 
            WHEN current_user_db_id IS NOT NULL AND r.user_id = current_user_db_id 
            THEN r.purpose
            ELSE NULL
        END as purpose,
        r.start_time,
        r.end_time,
        u.department,
        CASE 
            WHEN current_user_db_id IS NOT NULL AND r.user_id = current_user_db_id 
            THEN u.name
            ELSE 'Anonymous'
        END as user_name,
        rm.name as room_name, -- ✅ room 정보 추가
        CASE 
            WHEN current_user_db_id IS NOT NULL AND r.user_id = current_user_db_id 
            THEN TRUE 
            ELSE FALSE 
        END as is_mine
    FROM public.reservations r
    INNER JOIN public.users u ON r.user_id = u.id
    INNER JOIN public.rooms rm ON r.room_id = rm.id -- ✅ rooms 테이블 조인
    WHERE r.status = 'confirmed'
        AND r.start_time < end_date
        AND r.end_time > start_date
        AND rm.is_active = true -- ✅ 활성 회의실만 조회
    ORDER BY r.start_time ASC
    LIMIT page_limit
    OFFSET page_offset;
END;
$$;

-- 4. 새로운 함수에 대한 권한을 부여합니다.
GRANT EXECUTE ON FUNCTION public.get_public_reservations_with_room(timestamptz, timestamptz, integer, integer) TO anon, authenticated, service_role;

-- 모든 작업이 성공했을 경우에만 변경사항을 최종 적용합니다.
COMMIT;