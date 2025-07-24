-- Complete Database Schema for Reservation System
-- 새로운 Supabase 프로젝트에 적용할 완전한 스키마
-- 2025-07-23: 모든 기능을 포함한 단일 마이그레이션 파일

-- =============================================================================
-- 1. 테이블 생성
-- =============================================================================

-- Users 테이블 (이메일 인증 기반)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID UNIQUE NOT NULL, -- auth.users.id 참조
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    department TEXT DEFAULT 'General',
    role TEXT DEFAULT 'employee' CHECK (role IN ('employee', 'admin')),
    employee_id TEXT, -- 선택사항 (기존 호환성)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rooms 테이블
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 1,
    description TEXT,
    equipment TEXT[],
    location TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reservations 테이블
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- public.users.id 참조 (auth_id 아님!)
    room_id UUID NOT NULL,
    title TEXT NOT NULL,
    purpose TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'pending')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 시간 검증
    CONSTRAINT reservations_time_check CHECK (start_time < end_time)
);

-- =============================================================================
-- 2. 외래키 제약조건
-- =============================================================================

ALTER TABLE public.reservations 
ADD CONSTRAINT fk_reservations_user_id 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.reservations 
ADD CONSTRAINT fk_reservations_room_id 
FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;

-- =============================================================================
-- 3. 인덱스 생성
-- =============================================================================

-- Users 테이블 인덱스
CREATE INDEX idx_users_auth_id ON public.users(auth_id);
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_employee_id ON public.users(employee_id) WHERE employee_id IS NOT NULL;

-- Reservations 테이블 인덱스
CREATE INDEX idx_reservations_user_id ON public.reservations(user_id);
CREATE INDEX idx_reservations_room_id ON public.reservations(room_id);
CREATE INDEX idx_reservations_time_range ON public.reservations(start_time, end_time);
CREATE INDEX idx_reservations_status ON public.reservations(status);

-- Rooms 테이블 인덱스
CREATE INDEX idx_rooms_active ON public.rooms(is_active) WHERE is_active = TRUE;

-- =============================================================================
-- 4. RLS (Row Level Security) 설정
-- =============================================================================

-- RLS 활성화
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Users 테이블 정책
CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT USING (true); -- 모든 사용자 정보 조회 가능

CREATE POLICY "users_update_policy" ON public.users
    FOR UPDATE USING (auth_id = auth.uid()); -- 자신의 프로필만 수정

-- Rooms 테이블 정책
CREATE POLICY "rooms_select_policy" ON public.rooms
    FOR SELECT USING (is_active = true); -- 활성화된 회의실만 조회

-- Reservations 테이블 정책
CREATE POLICY "reservations_select_policy" ON public.reservations
    FOR SELECT USING (
        status = 'confirmed' OR 
        user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    ); -- 확정된 예약 또는 자신의 예약만 조회

CREATE POLICY "reservations_insert_policy" ON public.reservations
    FOR INSERT WITH CHECK (
        user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    ); -- 자신의 user_id로만 예약 생성

CREATE POLICY "reservations_update_policy" ON public.reservations
    FOR UPDATE USING (
        user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    ); -- 자신의 예약만 수정

CREATE POLICY "reservations_delete_policy" ON public.reservations
    FOR DELETE USING (
        user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    ); -- 자신의 예약만 삭제

-- =============================================================================
-- 5. 트리거 함수 생성
-- =============================================================================

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 트리거 적용
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at
    BEFORE UPDATE ON public.rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at
    BEFORE UPDATE ON public.reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 예약 user_id 검증 트리거
CREATE OR REPLACE FUNCTION validate_reservation_user_id()
RETURNS TRIGGER AS $$
BEGIN
    -- user_id가 실제 users 테이블의 id인지 확인
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.user_id) THEN
        RAISE EXCEPTION 'Invalid user_id: %. Must reference users.id, not auth_id.', NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_reservation_user_id_trigger
    BEFORE INSERT OR UPDATE ON public.reservations
    FOR EACH ROW
    EXECUTE FUNCTION validate_reservation_user_id();

-- =============================================================================
-- 6. 핵심 함수 생성
-- =============================================================================

-- 예약 조회 함수 (인증 상태에 따른 데이터 마스킹)
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
    room_name TEXT,
    is_mine BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    
    -- 현재 사용자 ID 조회 (인증되지 않은 경우 NULL)
    SELECT u.id INTO current_user_db_id
    FROM users u
    WHERE u.auth_id = auth.uid();

    -- 예약 목록 반환
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
        CASE 
            WHEN current_user_db_id IS NOT NULL AND r.user_id = current_user_db_id 
            THEN u.name::TEXT 
            ELSE 'Anonymous'::TEXT 
        END as user_name,
        rm.name::TEXT as room_name,
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

-- 사용자 프로필 생성/업데이트 함수
CREATE OR REPLACE FUNCTION upsert_user_profile(
    user_name TEXT,
    user_department TEXT DEFAULT 'General',
    user_employee_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_auth_id UUID;
    user_email TEXT;
    existing_user_id UUID;
    new_user_id UUID;
BEGIN
    -- 현재 인증된 사용자 정보 가져오기
    user_auth_id := auth.uid();
    
    IF user_auth_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;
    
    -- auth.users에서 이메일 가져오기
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = user_auth_id;
    
    IF user_email IS NULL THEN
        RAISE EXCEPTION 'User email not found in auth system';
    END IF;
    
    -- 기존 프로필 확인
    SELECT id INTO existing_user_id
    FROM public.users
    WHERE auth_id = user_auth_id;
    
    IF existing_user_id IS NOT NULL THEN
        -- 기존 프로필 업데이트
        UPDATE public.users
        SET 
            name = user_name,
            department = user_department,
            employee_id = user_employee_id,
            updated_at = NOW()
        WHERE id = existing_user_id;
        
        RETURN existing_user_id;
    ELSE
        -- 새 프로필 생성
        INSERT INTO public.users (auth_id, email, name, department, employee_id)
        VALUES (user_auth_id, user_email, user_name, user_department, user_employee_id)
        RETURNING id INTO new_user_id;
        
        RETURN new_user_id;
    END IF;
END;
$$;

-- =============================================================================
-- 7. 권한 설정
-- =============================================================================

-- 함수 실행 권한
GRANT EXECUTE ON FUNCTION get_public_reservations(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_reservations(TIMESTAMPTZ, TIMESTAMPTZ) TO anon;
GRANT EXECUTE ON FUNCTION upsert_user_profile(TEXT, TEXT, TEXT) TO authenticated;

-- =============================================================================
-- 8. 기본 데이터 삽입
-- =============================================================================

-- 기본 회의실 데이터
INSERT INTO public.rooms (name, capacity, description, location) VALUES
('Conference Room A', 10, 'Large conference room with projector', 'Floor 1'),
('Conference Room B', 6, 'Medium meeting room', 'Floor 1'),
('Small Meeting Room', 4, 'Small discussion room', 'Floor 2')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 9. 테이블 및 함수 설명
-- =============================================================================

COMMENT ON TABLE public.users IS '사용자 정보 테이블 - 이메일 인증 기반, employee_id 선택사항';
COMMENT ON TABLE public.rooms IS '회의실 정보 테이블';
COMMENT ON TABLE public.reservations IS '예약 정보 테이블 - user_id는 users.id 참조 (auth_id 아님)';

COMMENT ON FUNCTION get_public_reservations IS '예약 조회 함수 - 인증 상태에 따른 데이터 마스킹';
COMMENT ON FUNCTION upsert_user_profile IS '사용자 프로필 생성/업데이트 함수 - 이메일 인증 후 사용';

-- =============================================================================
-- 10. 완료 로그
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '=== 완전한 데이터베이스 스키마 생성 완료 ===';
    RAISE NOTICE '✅ 테이블 생성: users, rooms, reservations';
    RAISE NOTICE '✅ 외래키 제약조건 설정';
    RAISE NOTICE '✅ 인덱스 최적화';
    RAISE NOTICE '✅ RLS 정책 설정';
    RAISE NOTICE '✅ 트리거 및 검증 함수';
    RAISE NOTICE '✅ 핵심 함수: get_public_reservations, upsert_user_profile';
    RAISE NOTICE '✅ 권한 설정';
    RAISE NOTICE '✅ 기본 데이터 삽입';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '새로운 Supabase 프로젝트에 이 파일만 적용하면 됩니다.';
END $$;