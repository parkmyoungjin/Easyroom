-- 새 Supabase 프로젝트 초기 스키마 설정
-- RoomBook 애플리케이션용 테이블 생성

-- 1. users 테이블 생성
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    employee_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    department TEXT NOT NULL,
    role TEXT CHECK (role IN ('employee', 'admin')) DEFAULT 'employee',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. rooms 테이블 생성
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    capacity INTEGER NOT NULL,
    location TEXT,
    amenities JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. reservations 테이블 생성
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    purpose TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT CHECK (status IN ('confirmed', 'cancelled')) DEFAULT 'confirmed',
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON public.users(employee_id);
CREATE INDEX IF NOT EXISTS idx_reservations_room_id ON public.reservations(room_id);
CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON public.reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_time ON public.reservations(start_time, end_time);

-- 5. updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. 트리거 적용
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON public.rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON public.reservations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. RLS (Row Level Security) 정책 설정
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- users 테이블 정책
CREATE POLICY "Users can view all users" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = auth_id);

-- rooms 테이블 정책
CREATE POLICY "Anyone can view active rooms" ON public.rooms
    FOR SELECT USING (is_active = true);

-- reservations 테이블 정책
CREATE POLICY "Users can view all confirmed reservations" ON public.reservations
    FOR SELECT USING (status = 'confirmed');

-- 새로운 정책 추가: 사용자는 상태와 관계없이 자신의 모든 예약을 볼 수 있다.
CREATE POLICY "Users can view their own reservations" ON public.reservations
    FOR SELECT USING (auth.uid() IN (SELECT auth_id FROM public.users WHERE id = user_id));

CREATE POLICY "Users can insert own reservations" ON public.reservations
    FOR INSERT WITH CHECK (auth.uid() IN (SELECT auth_id FROM public.users WHERE id = user_id));

CREATE POLICY "Users can update own reservations" ON public.reservations
    FOR UPDATE USING (auth.uid() IN (SELECT auth_id FROM public.users WHERE id = user_id));

-- 8. get_public_reservations 함수 생성
CREATE OR REPLACE FUNCTION get_public_reservations(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE (
  id UUID,
  room_id UUID,
  user_id UUID,
  title TEXT,
  purpose TEXT,
  department TEXT,
  user_name TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
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
      WHEN current_user_db_id IS NULL THEN 'Booked'::TEXT
      WHEN r.user_id = current_user_db_id THEN r.title
      ELSE 'Booked'::TEXT
    END as title,
    CASE 
      WHEN current_user_db_id IS NULL THEN NULL::TEXT
      WHEN r.user_id = current_user_db_id THEN r.purpose
      ELSE NULL::TEXT
    END as purpose,
    u.department,
    CASE 
      WHEN current_user_db_id IS NULL THEN 'Anonymous'::TEXT
      WHEN r.user_id = current_user_db_id THEN u.name
      ELSE 'Anonymous'::TEXT
    END as user_name,
    r.start_time,
    r.end_time,
    CASE 
      WHEN current_user_db_id IS NULL THEN false
      WHEN r.user_id = current_user_db_id THEN true
      ELSE false
    END as is_mine
  FROM reservations r
  INNER JOIN users u ON r.user_id = u.id
  INNER JOIN rooms rm ON r.room_id = rm.id
  WHERE r.status = 'confirmed'
    AND r.start_time <= end_date
    AND r.end_time >= start_date
  ORDER BY r.start_time;
END;
$$;

-- 9. 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION get_public_reservations(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_reservations(TIMESTAMPTZ, TIMESTAMPTZ) TO anon;

-- 10. 샘플 데이터 삽입
INSERT INTO public.rooms (name, description, capacity, location, amenities) VALUES
('회의실 A', '대형 회의실', 10, '1층', '{"projector": true, "whiteboard": true, "wifi": true}'),
('회의실 B', '중형 회의실', 6, '2층', '{"tv": true, "whiteboard": true, "wifi": true}'),
('회의실 C', '소형 회의실', 4, '3층', '{"whiteboard": true, "wifi": true}')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.users IS '사용자 정보 테이블';
COMMENT ON TABLE public.rooms IS '회의실 정보 테이블';
COMMENT ON TABLE public.reservations IS '예약 정보 테이블';
COMMENT ON FUNCTION get_public_reservations IS '공개 예약 목록 조회 함수 (인증 상태에 따라 데이터 마스킹)';