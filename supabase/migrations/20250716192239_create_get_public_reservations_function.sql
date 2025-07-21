-- RPC 함수: get_public_reservations
-- 공개 예약 목록을 조회하는 함수 (현재 사용자의 예약 여부 포함)

-- 기존 함수가 있다면 제거 (충돌 방지)
-- 모든 가능한 시그니처 제거
DROP FUNCTION IF EXISTS get_public_reservations(TEXT, TEXT);
DROP FUNCTION IF EXISTS get_public_reservations(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS get_public_reservations(start_date TEXT, end_date TEXT);
DROP FUNCTION IF EXISTS get_public_reservations(start_date TIMESTAMPTZ, end_date TIMESTAMPTZ);

-- 스키마에서 완전히 제거
DROP FUNCTION IF EXISTS public.get_public_reservations CASCADE;

CREATE OR REPLACE FUNCTION get_public_reservations(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE (
  id UUID,
  room_id UUID,
  user_id UUID,
  title VARCHAR,
  purpose TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  department VARCHAR,
  user_name VARCHAR,
  is_mine BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_db_id UUID;
BEGIN
  -- 현재 인증된 사용자의 데이터베이스 ID 조회 (인증되지 않은 경우 NULL)
  SELECT u.id INTO current_user_db_id
  FROM users u
  WHERE u.auth_id = auth.uid();

  -- 예약 목록 반환 (is_mine 필드 포함)
  RETURN QUERY
  SELECT 
    r.id,
    r.room_id,
    r.user_id,
    CASE 
      WHEN current_user_db_id IS NOT NULL AND r.user_id = current_user_db_id 
      THEN r.title 
      ELSE 'Booked'::TEXT 
    END as title,
    CASE 
      WHEN current_user_db_id IS NOT NULL AND r.user_id = current_user_db_id 
      THEN r.purpose 
      ELSE NULL::TEXT 
    END as purpose,
    r.start_time,
    r.end_time,
    u.department,
    u.name as user_name,
    CASE 
      WHEN current_user_db_id IS NOT NULL AND r.user_id = current_user_db_id 
      THEN TRUE 
      ELSE FALSE 
    END as is_mine
  FROM reservations r
  INNER JOIN users u ON r.user_id = u.id
  INNER JOIN rooms rm ON r.room_id = rm.id
  WHERE r.status = 'confirmed'
    AND r.start_time < end_date
    AND r.end_time > start_date
  ORDER BY r.start_time ASC;
END;
$$;

-- RPC 함수 실행 권한 부여 (인증된 사용자와 익명 사용자 모두)
GRANT EXECUTE ON FUNCTION get_public_reservations(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_reservations(TIMESTAMPTZ, TIMESTAMPTZ) TO anon;