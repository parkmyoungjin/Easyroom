-- Migration: Create get_available_time_slots RPC function
-- Purpose: Server-side time slot availability calculation for reservation system
-- Date: 2025-08-03

-- ✅ 예약 가능 시간 슬롯 조회 함수
CREATE OR REPLACE FUNCTION "public"."get_available_time_slots"(
    "p_room_id" "uuid", 
    "p_date" "date"
) RETURNS "jsonb"
    LANGUAGE "plpgsql" 
    SECURITY DEFINER
    AS $$
DECLARE
    time_slot_record RECORD;
    existing_reservation_record RECORD;
    available_slots JSONB := '[]'::jsonb;
    slot_time TIME;
    slot_start_timestamp TIMESTAMPTZ;
    slot_end_timestamp TIMESTAMPTZ;
    date_start_kst TIMESTAMPTZ;
    date_end_kst TIMESTAMPTZ;
    is_slot_available BOOLEAN;
BEGIN
    -- 입력 검증
    IF p_room_id IS NULL THEN
        RAISE EXCEPTION 'room_id cannot be null';
    END IF;
    
    IF p_date IS NULL THEN
        RAISE EXCEPTION 'date cannot be null';
    END IF;
    
    -- 회의실 존재 및 활성 상태 확인
    IF NOT EXISTS (
        SELECT 1 FROM public.rooms 
        WHERE id = p_room_id AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Room not found or inactive: %', p_room_id;
    END IF;
    
    -- ✅ 한국 시간대(KST) 기준으로 날짜 범위 설정
    -- p_date의 00:00:00 KST를 UTC로 변환 (UTC-9시간)
    date_start_kst := (p_date::text || ' 00:00:00+09:00')::timestamptz;
    -- p_date의 23:59:59.999 KST를 UTC로 변환
    date_end_kst := (p_date::text || ' 23:59:59.999+09:00')::timestamptz;
    
    -- ✅ 전체 시간 슬롯 생성 및 가용성 검사 (08:00 ~ 18:30, 30분 간격)
    FOR slot_time IN 
        SELECT generate_series(
            '08:00:00'::time, 
            '18:30:00'::time, 
            '30 minutes'::interval
        )::time
    LOOP
        -- 현재 슬롯의 시작/종료 시간을 KST 기준으로 계산
        slot_start_timestamp := (p_date::text || ' ' || slot_time::text || '+09:00')::timestamptz;
        slot_end_timestamp := slot_start_timestamp + '30 minutes'::interval;
        
        -- 기본적으로 사용 가능하다고 가정
        is_slot_available := TRUE;
        
        -- ✅ 해당 시간 슬롯과 겹치는 기존 예약이 있는지 확인
        FOR existing_reservation_record IN
            SELECT start_time, end_time
            FROM public.reservations
            WHERE room_id = p_room_id
                AND status = 'confirmed'
                AND start_time < slot_end_timestamp
                AND end_time > slot_start_timestamp
        LOOP
            -- 겹치는 예약이 발견되면 해당 슬롯은 사용 불가
            is_slot_available := FALSE;
            EXIT; -- 첫 번째 충돌 발견 시 즉시 루프 종료
        END LOOP;
        
        -- ✅ 사용 가능한 슬롯이면 결과 배열에 추가
        IF is_slot_available THEN
            available_slots := available_slots || to_jsonb(slot_time::text);
        END IF;
    END LOOP;
    
    -- ✅ 최종 결과 반환 (JSON 배열 형태)
    RETURN available_slots;
    
EXCEPTION
    WHEN OTHERS THEN
        -- 에러 발생 시 로그 남기고 빈 배열 반환
        RAISE WARNING 'Error in get_available_time_slots for room % on date %: %', 
            p_room_id, p_date, SQLERRM;
        RETURN '[]'::jsonb;
END;
$$;

-- ✅ 함수 소유권 설정
ALTER FUNCTION "public"."get_available_time_slots"("p_room_id" "uuid", "p_date" "date") OWNER TO "postgres";

-- ✅ 함수에 대한 설명 추가
COMMENT ON FUNCTION "public"."get_available_time_slots"("p_room_id" "uuid", "p_date" "date") 
IS '특정 회의실과 날짜에 대해 예약 가능한 30분 단위 시간 슬롯 목록을 반환하는 함수 (08:00-18:30, KST 기준)';

-- ✅ 권한 부여 (인증된 사용자에게 실행 권한)
GRANT ALL ON FUNCTION "public"."get_available_time_slots"("p_room_id" "uuid", "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_time_slots"("p_room_id" "uuid", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_time_slots"("p_room_id" "uuid", "p_date" "date") TO "service_role";