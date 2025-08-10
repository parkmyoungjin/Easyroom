-- [긴급 보안 수정] SECURITY DEFINER 뷰 문제 해결
-- Supabase Advisor에서 감지된 보안 위험 수정

-- 1. no_show_reservations_view 보안 설정 수정
-- 소유자를 postgres로 설정하고 SECURITY INVOKER로 변경
ALTER VIEW public.no_show_reservations_view OWNER TO postgres;
ALTER VIEW public.no_show_reservations_view SET (security_invoker = true);

-- 2. room_usage_view 보안 설정 수정  
-- 소유자를 postgres로 설정하고 SECURITY INVOKER로 변경
ALTER VIEW public.room_usage_view OWNER TO postgres;
ALTER VIEW public.room_usage_view SET (security_invoker = true);

-- 3. current_room_status_view 보안 설정 수정
-- 소유자를 postgres로 설정하고 SECURITY INVOKER로 변경
ALTER VIEW public.current_room_status_view OWNER TO postgres;
ALTER VIEW public.current_room_status_view SET (security_invoker = true);

-- 4. 뷰별 RLS 정책 적용을 위한 기반 테이블 정책 확인
-- reservations 테이블의 RLS 정책이 뷰를 통한 접근에도 적용되도록 보장

-- 5. 관리자 전용 뷰에 대한 추가 보안 함수 생성
-- no_show_reservations_view와 room_usage_view는 관리자만 접근 가능해야 함

CREATE OR REPLACE FUNCTION public.get_no_show_reservations()
RETURNS TABLE (
    id uuid,
    title text,
    start_time timestamptz,
    end_time timestamptz,
    user_name text,
    department text,
    room_name text,
    location text,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER  -- 중요: INVOKER로 설정
AS $$
BEGIN
    -- 관리자 권한 확인
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE auth_id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access denied: admin role required';
    END IF;
    
    -- 관리자만 모든 No-Show 예약 조회 가능
    RETURN QUERY
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
END;
$$;

CREATE OR REPLACE FUNCTION public.get_room_usage_statistics()
RETURNS TABLE (
    room_id uuid,
    room_name text,
    location text,
    total_reservations bigint,
    completed_reservations bigint,
    no_show_reservations bigint,
    currently_in_use bigint,
    completion_rate numeric,
    no_show_rate numeric
)
LANGUAGE plpgsql
SECURITY INVOKER  -- 중요: INVOKER로 설정
AS $$
BEGIN
    -- 관리자 권한 확인
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE auth_id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access denied: admin role required';
    END IF;
    
    -- 관리자만 전체 사용률 통계 조회 가능
    RETURN QUERY
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
END;
$$;

-- 6. 함수 권한 설정
GRANT EXECUTE ON FUNCTION public.get_no_show_reservations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_room_usage_statistics() TO authenticated;

-- 7. 함수 설명 추가
COMMENT ON FUNCTION public.get_no_show_reservations() IS 'No-Show 예약 목록 조회 - 관리자 전용 (SECURITY INVOKER)';
COMMENT ON FUNCTION public.get_room_usage_statistics() IS '회의실 사용률 통계 조회 - 관리자 전용 (SECURITY INVOKER)';

-- 8. 뷰 설명 업데이트
COMMENT ON VIEW public.no_show_reservations_view IS 'No-Show 예약 목록 - SECURITY INVOKER로 수정됨 (RLS 적용)';
COMMENT ON VIEW public.room_usage_view IS '회의실 사용률 통계 - SECURITY INVOKER로 수정됨 (RLS 적용)';
COMMENT ON VIEW public.current_room_status_view IS '실시간 회의실 사용 현황 - SECURITY INVOKER로 수정됨 (RLS 적용)';