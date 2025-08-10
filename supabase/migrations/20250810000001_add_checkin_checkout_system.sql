-- Phase 1: 체크인/체크아웃 시스템을 위한 데이터베이스 스키마 변경

-- 1. reservation_status ENUM 확장 (안전한 방식)
DO $$ 
BEGIN
    -- ENUM 값들을 하나씩 안전하게 추가
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'checked_in' AND enumtypid = 'public.reservation_status'::regtype) THEN
        ALTER TYPE public.reservation_status ADD VALUE 'checked_in';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'completed' AND enumtypid = 'public.reservation_status'::regtype) THEN
        ALTER TYPE public.reservation_status ADD VALUE 'completed';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'overtime' AND enumtypid = 'public.reservation_status'::regtype) THEN
        ALTER TYPE public.reservation_status ADD VALUE 'overtime';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'no_show' AND enumtypid = 'public.reservation_status'::regtype) THEN
        ALTER TYPE public.reservation_status ADD VALUE 'no_show';
    END IF;
END $$;

-- 2. reservations 테이블에 체크인/체크아웃 관련 컬럼 추가
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;

-- 3. 체크인/체크아웃 관련 제약 조건 추가
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_checkin_before_checkout') THEN
        ALTER TABLE public.reservations 
        ADD CONSTRAINT check_checkin_before_checkout 
        CHECK (checked_in_at IS NULL OR checked_out_at IS NULL OR checked_in_at <= checked_out_at);
    END IF;
END $$;

-- 4. 체크인/체크아웃 시간 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_reservations_checked_in_at ON public.reservations(checked_in_at) 
WHERE checked_in_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_checked_out_at ON public.reservations(checked_out_at) 
WHERE checked_out_at IS NOT NULL;

-- 5. 상태별 인덱스 추가 (자동화 작업 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_reservations_status_time ON public.reservations(status, start_time, end_time);

-- 6. 기본 통계 뷰 생성 (관리자용 - 권한 체크는 애플리케이션 레벨에서 처리)
CREATE OR REPLACE VIEW public.no_show_reservations_view AS
SELECT 
    r.id,
    r.title,
    r.start_time,
    r.end_time,
    u.name as user_name,
    u.department,
    rm.name as room_name,
    rm.location,
    r.created_at
FROM public.reservations r
JOIN public.users u ON r.user_id = u.id
JOIN public.rooms rm ON r.room_id = rm.id
WHERE r.status = 'no_show'
ORDER BY r.start_time DESC;

CREATE OR REPLACE VIEW public.room_usage_view AS
SELECT 
    rm.id as room_id,
    rm.name as room_name,
    rm.location,
    COUNT(*) as total_reservations,
    COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_reservations,
    COUNT(CASE WHEN r.status = 'no_show' THEN 1 END) as no_show_reservations,
    COUNT(CASE WHEN r.status = 'checked_in' THEN 1 END) as currently_in_use,
    ROUND(
        COUNT(CASE WHEN r.status = 'completed' THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(*), 0) * 100, 2
    ) as completion_rate,
    ROUND(
        COUNT(CASE WHEN r.status = 'no_show' THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(*), 0) * 100, 2
    ) as no_show_rate
FROM public.rooms rm
LEFT JOIN public.reservations r ON rm.id = r.room_id
WHERE rm.is_active = true
GROUP BY rm.id, rm.name, rm.location
ORDER BY total_reservations DESC;

-- 7. 실시간 사용 현황 뷰 (모든 사용자 접근 가능)
CREATE OR REPLACE VIEW public.current_room_status_view AS
SELECT 
    rm.id as room_id,
    rm.name as room_name,
    rm.location,
    rm.capacity,
    CASE 
        WHEN r.id IS NOT NULL AND r.status = 'checked_in' THEN 'occupied'
        WHEN r.id IS NOT NULL AND r.status = 'confirmed' AND r.start_time <= NOW() + INTERVAL '15 minutes' THEN 'reserved_soon'
        WHEN r.id IS NOT NULL AND r.status = 'confirmed' THEN 'reserved'
        ELSE 'available'
    END as current_status,
    r.id as current_reservation_id,
    r.title as current_reservation_title,
    r.start_time as current_start_time,
    r.end_time as current_end_time,
    u.name as current_user_name,
    u.department as current_user_department
FROM public.rooms rm
LEFT JOIN public.reservations r ON rm.id = r.room_id 
    AND r.status IN ('confirmed', 'checked_in')
    AND r.start_time <= NOW() + INTERVAL '1 hour'
    AND r.end_time > NOW()
LEFT JOIN public.users u ON r.user_id = u.id
WHERE rm.is_active = true
ORDER BY rm.name;

-- 8. 뷰 권한 설정 (RLS는 뷰에 직접 적용하지 않고 애플리케이션에서 처리)
GRANT SELECT ON public.no_show_reservations_view TO authenticated;
GRANT SELECT ON public.room_usage_view TO authenticated;
GRANT SELECT ON public.current_room_status_view TO authenticated;

-- 9. 뷰 설명 추가
COMMENT ON VIEW public.no_show_reservations_view IS 'No-Show 예약 목록 - 관리자 전용 (애플리케이션에서 권한 체크)';
COMMENT ON VIEW public.room_usage_view IS '회의실 사용률 통계 - 관리자 전용 (애플리케이션에서 권한 체크)';
COMMENT ON VIEW public.current_room_status_view IS '실시간 회의실 사용 현황 - 모든 사용자 접근 가능';