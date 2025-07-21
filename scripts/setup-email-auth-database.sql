-- 새 Supabase 프로젝트 이메일 인증 스키마 설정
-- RoomBook 애플리케이션용 테이블 생성 (이메일 인증 지원)

-- 1. users 테이블 생성 (이메일 인증 지원)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    employee_id TEXT UNIQUE, -- NULL 허용으로 변경 (기존 호환성)
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    department TEXT NOT NULL,
    role TEXT CHECK (role IN ('employee', 'admin')) DEFAULT 'employee',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. rooms 테이블 생성 (기존과 동일)
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

-- 3. reservations 테이블 생성 (기존과 동일)
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

-- 4. 인덱스 생성 (이메일 인증 최적화)
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON public.users(employee_id) WHERE employee_id IS NOT NULL;
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

-- users 테이블 정책 (이메일 인증 기반)
CREATE POLICY "Users can view all users" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = auth_id);

-- rooms 테이블 정책 (기존과 동일)
CREATE POLICY "Anyone can view active rooms" ON public.rooms
    FOR SELECT USING (is_active = true);

-- reservations 테이블 정책 (기존과 동일)
CREATE POLICY "Users can view all confirmed reservations" ON public.reservations
    FOR SELECT USING (status = 'confirmed');

-- 새로운 정책 추가: 사용자는 상태와 관계없이 자신의 모든 예약을 볼 수 있다.
CREATE POLICY "Users can view their own reservations" ON public.reservations
    FOR SELECT USING (auth.uid() IN (SELECT auth_id FROM public.users WHERE id = user_id));

CREATE POLICY "Users can insert own reservations" ON public.reservations
    FOR INSERT WITH CHECK (auth.uid() IN (SELECT auth_id FROM public.users WHERE id = user_id));

CREATE POLICY "Users can update own reservations" ON public.reservations
    FOR UPDATE USING (auth.uid() IN (SELECT auth_id FROM public.users WHERE id = user_id));

-- 8. 사용자 프로필 생성 함수 (이메일 인증 후 호출)
CREATE OR REPLACE FUNCTION create_user_profile(
    user_auth_id UUID,
    user_email TEXT,
    user_name TEXT,
    user_department TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_user_id UUID;
BEGIN
    -- 이미 프로필이 존재하는지 확인
    SELECT id INTO new_user_id
    FROM public.users
    WHERE auth_id = user_auth_id;
    
    IF new_user_id IS NOT NULL THEN
        RETURN new_user_id;
    END IF;
    
    -- 새 사용자 프로필 생성
    INSERT INTO public.users (auth_id, email, name, department)
    VALUES (user_auth_id, user_email, user_name, user_department)
    RETURNING id INTO new_user_id;
    
    RETURN new_user_id;
END;
$$;

-- 9. get_public_reservations 함수 (기존과 동일, 이미 auth_id 기반)
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
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  department TEXT,
  user_name TEXT,
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
      THEN r.title::TEXT 
      ELSE 'Booked'::TEXT 
    END as title,
    CASE 
      WHEN current_user_db_id IS NOT NULL AND r.user_id = current_user_db_id 
      THEN r.purpose::TEXT 
      ELSE NULL::TEXT 
    END as purpose,
    r.start_time,
    r.end_time,
    u.department::TEXT as department,
    u.name::TEXT as user_name,
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

-- 10. 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION get_public_reservations(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_reservations(TIMESTAMPTZ, TIMESTAMPTZ) TO anon;
GRANT EXECUTE ON FUNCTION create_user_profile(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- 11. 샘플 데이터 삽입 (rooms만, users는 실제 가입 시 생성)
INSERT INTO public.rooms (name, description, capacity, location, amenities) VALUES
('회의실 A', '대형 회의실', 10, '1층', '{"projector": true, "whiteboard": true, "wifi": true}'),
('회의실 B', '중형 회의실', 6, '2층', '{"tv": true, "whiteboard": true, "wifi": true}'),
('회의실 C', '소형 회의실', 4, '3층', '{"whiteboard": true, "wifi": true}')
ON CONFLICT DO NOTHING;

-- 12. 테이블 및 함수 설명
COMMENT ON TABLE public.users IS '사용자 정보 테이블 - 이메일 인증 지원 (employee_id는 선택사항)';
COMMENT ON TABLE public.rooms IS '회의실 정보 테이블';
COMMENT ON TABLE public.reservations IS '예약 정보 테이블';
COMMENT ON FUNCTION get_public_reservations IS '공개 예약 목록 조회 함수 (인증 상태에 따라 데이터 마스킹)';
COMMENT ON FUNCTION create_user_profile IS '이메일 인증 완료 후 사용자 프로필 생성 함수';

-- 13. 스키마 설정 완료 로그
DO $$
BEGIN
    RAISE NOTICE '이메일 인증 데이터베이스 스키마 설정이 완료되었습니다.';
    RAISE NOTICE '주요 변경사항:';
    RAISE NOTICE '- users.employee_id: nullable (기존 호환성 유지)';
    RAISE NOTICE '- users.auth_id: Supabase Auth 연동 필수';
    RAISE NOTICE '- users.email: 이메일 인증 기반 로그인';
    RAISE NOTICE '- create_user_profile(): 이메일 인증 후 프로필 생성';
    RAISE NOTICE '- 기존 함수 및 정책: 호환성 유지';
END $$;