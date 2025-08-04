

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'Legacy upsert_user_profile function removed in favor of atomic get_or_create_user_profile function';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."booked_slot_details" AS (
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"title" "text",
	"user_name" "text",
	"is_mine" boolean
);


ALTER TYPE "public"."booked_slot_details" OWNER TO "postgres";


CREATE TYPE "public"."reservation_status" AS ENUM (
    'confirmed',
    'cancelled'
);


ALTER TYPE "public"."reservation_status" OWNER TO "postgres";


CREATE TYPE "public"."user_profile_type" AS (
	"authId" "uuid",
	"dbId" "uuid",
	"employeeId" "text",
	"email" "text",
	"name" "text",
	"department" "text",
	"role" "text",
	"createdAt" timestamp with time zone,
	"updatedAt" timestamp with time zone
);


ALTER TYPE "public"."user_profile_type" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'employee',
    'admin'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_email_exists"("p_email" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
BEGIN
    -- 입력 검증
    IF p_email IS NULL OR LENGTH(TRIM(p_email)) = 0 THEN
        RETURN FALSE;
    END IF;
    
    -- 이메일 형식 검증
    IF NOT (p_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') THEN
        RETURN FALSE;
    END IF;
    
    -- 사용자 존재 확인
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE LOWER(email) = LOWER(TRIM(p_email))
    );
END;
$_$;


ALTER FUNCTION "public"."check_email_exists"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_reservation_conflict"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.reservations 
        WHERE room_id = NEW.room_id 
        AND status = 'confirmed'
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
        AND (
            (NEW.start_time >= start_time AND NEW.start_time < end_time) OR
            (NEW.end_time > start_time AND NEW.end_time <= end_time) OR
            (NEW.start_time <= start_time AND NEW.end_time >= end_time)
        )
    ) THEN
        RAISE EXCEPTION 'Reservation conflict: Another confirmed reservation exists for this time slot';
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_reservation_conflict"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_available_time_slots"("p_room_id" "uuid", "p_date" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_available_time_slots"("p_room_id" "uuid", "p_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_available_time_slots"("p_room_id" "uuid", "p_date" "date") IS '특정 회의실과 날짜에 대해 예약 가능한 30분 단위 시간 슬롯 목록을 반환하는 함수 (08:00-18:30, KST 기준)';



CREATE OR REPLACE FUNCTION "public"."get_booked_slots_for_timeline"("p_room_id" "uuid", "p_date" "date") RETURNS SETOF "public"."booked_slot_details"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_booked_slots_for_timeline"("p_room_id" "uuid", "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_user_info"() RETURNS TABLE("id" "uuid", "auth_id" "uuid", "email" "text", "name" "text", "department" "text", "role" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- 인증된 사용자만 접근 가능
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;
    
    RETURN QUERY
    SELECT 
        u.id,
        u.auth_id,
        u.email,
        u.name,
        u.department,
        u.role::TEXT
    FROM public.users u
    WHERE u.auth_id = auth.uid();
END;
$$;


ALTER FUNCTION "public"."get_current_user_info"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_user_profile"() RETURNS "public"."user_profile_type"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    current_auth_id UUID := auth.uid();
    user_record RECORD;
    result public.user_profile_type; 
BEGIN
    -- ========================================================================
    -- 단계 1: 인증 검증
    -- ========================================================================
    IF current_auth_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: User is not logged in.';
    END IF;

    -- ========================================================================
    -- 단계 2: 기존 사용자 프로필 조회
    -- ========================================================================
    SELECT * INTO user_record 
    FROM public.users 
    WHERE auth_id = current_auth_id;

    -- ========================================================================
    -- 단계 3: 사용자가 없는 경우 안전하게 생성
    -- ========================================================================
    IF user_record IS NULL THEN
        DECLARE
            auth_user RECORD;
        BEGIN
            -- auth.users 테이블에서 최신 사용자 정보 가져오기
            SELECT * INTO auth_user 
            FROM auth.users 
            WHERE id = current_auth_id;

            -- auth.users에도 없다면 심각한 문제
            IF auth_user IS NULL THEN
                RAISE EXCEPTION 'Critical error: User not found in auth.users despite being authenticated.';
            END IF;

            -- 안전한 사용자 생성
            INSERT INTO public.users (
                auth_id, 
                email, 
                name, 
                department,
                role
            )
            VALUES (
                current_auth_id,
                auth_user.email,
                COALESCE(
                    auth_user.raw_user_meta_data->>'fullName', 
                    auth_user.raw_user_meta_data->>'full_name', 
                    SPLIT_PART(auth_user.email, '@', 1)
                ),
                COALESCE(
                    auth_user.raw_user_meta_data->>'department', 
                    'General'
                ),
                COALESCE(
                    (auth_user.raw_user_meta_data->>'role')::public.user_role,
                    'employee'
                )
            )
            ON CONFLICT (auth_id) DO NOTHING
            RETURNING * INTO user_record;

            -- 재조회 로직
            IF user_record IS NULL THEN
                SELECT * INTO user_record 
                FROM public.users 
                WHERE auth_id = current_auth_id;
                
                IF user_record IS NULL THEN
                    RAISE EXCEPTION 'Failed to create or find user profile after insert attempt.';
                END IF;
            END IF;
        END;
    END IF;

    -- ========================================================================
    -- 단계 4: 결과 구성 및 반환
    -- ========================================================================
    SELECT
        user_record.auth_id,
        user_record.id,
        user_record.employee_id,
        user_record.email,
        user_record.name,
        user_record.department,
        user_record.role,
        user_record.created_at,
        user_record.updated_at
    INTO result;

    RETURN result; -- ✅ 원래의 '단일 객체 반환' 방식으로 복원
END;
$$;


ALTER FUNCTION "public"."get_or_create_user_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_reservations"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "page_limit" integer DEFAULT 100, "page_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "room_id" "uuid", "user_id" "uuid", "title" "text", "purpose" "text", "start_time" timestamp with time zone, "end_time" timestamp with time zone, "department" "text", "user_name" "text", "is_mine" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$DECLARE
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

    -- 예약 목록 반환 (데이터 마스킹 적용)
    RETURN QUERY
    SELECT 
        r.id,
        r.room_id,
        r.user_id,
        CASE 
            WHEN current_user_db_id IS NOT NULL AND r.user_id = current_user_db_id 
            THEN r.title
            ELSE u.department
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
        CASE 
            WHEN current_user_db_id IS NOT NULL AND r.user_id = current_user_db_id 
            THEN TRUE 
            ELSE FALSE 
        END as is_mine
    FROM public.reservations r
    INNER JOIN public.users u ON r.user_id = u.id
    WHERE r.status = 'confirmed'
        AND r.start_time < end_date
        AND r.end_time > start_date
    ORDER BY r.start_time ASC
    LIMIT page_limit
    OFFSET page_offset;
END;$$;


ALTER FUNCTION "public"."get_public_reservations"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "page_limit" integer, "page_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_reservations_detailed"("p_user_id" "uuid", "p_limit_count" integer DEFAULT 50, "p_offset_count" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$DECLARE
    current_user_db_id UUID;
    reservation_data JSONB;
BEGIN
    -- 입력 검증
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_id cannot be null';
    END IF;
    
    IF p_limit_count IS NULL OR p_limit_count <= 0 THEN
        p_limit_count := 50;
    END IF;
    
    IF p_offset_count IS NULL OR p_offset_count < 0 THEN
        p_offset_count := 0;
    END IF;
    
    -- 현재 인증된 사용자의 DB ID 확인
    SELECT u.id INTO current_user_db_id
    FROM public.users u
    WHERE u.auth_id = auth.uid();
    
    -- 권한 확인: 자신의 예약만 조회 가능 (또는 관리자)
    IF current_user_db_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;
    
    IF current_user_db_id != p_user_id THEN
        -- 관리자 권한 확인
        IF NOT EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = current_user_db_id AND role = 'admin'
        ) THEN
            RAISE EXCEPTION 'Access denied: can only view own reservations';
        END IF;
    END IF;
    
    -- 예약 데이터 조회 (ReservationWithDetails 구조에 맞게)
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
            'room', jsonb_build_object(
                'id', rm.id,
                'name', rm.name,
                'description', rm.description,
                'capacity', rm.capacity,
                'location', rm.location,
                'equipment', rm.amenities,
                'is_active', rm.is_active,
                'created_at', rm.created_at,
                'updated_at', rm.updated_at
            ),
            'user', jsonb_build_object(
                'id', u.id,
                'auth_id', u.auth_id,
                'employee_id', u.employee_id,
                'name', u.name,
                'email', u.email,
                'department', u.department,
                'role', u.role,
                'created_at', u.created_at,
                'updated_at', u.updated_at
            )
        )
        ORDER BY r.start_time ASC
    ) INTO reservation_data
    FROM public.reservations r
    INNER JOIN public.rooms rm ON r.room_id = rm.id
    INNER JOIN public.users u ON r.user_id = u.id
    WHERE r.user_id = p_user_id
    LIMIT p_limit_count
    OFFSET p_offset_count;
    
    -- 결과가 없으면 빈 배열 반환
    IF reservation_data IS NULL THEN
        reservation_data := '[]'::jsonb;
    END IF;
    
    -- 결과를 { data: [...] } 형태로 반환
    RETURN jsonb_build_object('data', reservation_data);
END;$$;


ALTER FUNCTION "public"."get_user_reservations_detailed"("p_user_id" "uuid", "p_limit_count" integer, "p_offset_count" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_reservations_detailed"("p_user_id" "uuid", "p_limit_count" integer, "p_offset_count" integer) IS '사용자의 예약 목록을 상세 정보와 함께 조회하는 함수 - 페이지네이션 지원';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- auth.users에 새 사용자가 생성되면 public.users에도 자동으로 생성
  INSERT INTO public.users (auth_id, email, name, department, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'fullName', 
      NEW.raw_user_meta_data->>'full_name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'department', 
      'General'
    ),
    'employee'
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- 이미 존재하는 경우 무시 (중복 방지)
    RETURN NEW;
  WHEN OTHERS THEN
    -- 다른 에러 발생 시 로그만 남기고 계속 진행
    RAISE WARNING 'Failed to create user profile for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_reservation_user_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.user_id) THEN
        RAISE EXCEPTION 'Invalid user_id: %. Must reference users.id, not auth_id.', NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_reservation_user_id"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "room_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "purpose" "text",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "status" "public"."reservation_status" DEFAULT 'confirmed'::"public"."reservation_status" NOT NULL,
    "cancellation_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reservations_future_booking" CHECK (("start_time" > ("now"() - '01:00:00'::interval))),
    CONSTRAINT "reservations_max_duration" CHECK ((("end_time" - "start_time") <= '08:00:00'::interval)),
    CONSTRAINT "reservations_time_valid" CHECK (("start_time" < "end_time")),
    CONSTRAINT "reservations_title_not_empty" CHECK (("length"(TRIM(BOTH FROM "title")) > 0))
);


ALTER TABLE "public"."reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "capacity" integer DEFAULT 1 NOT NULL,
    "description" "text",
    "location" "text",
    "amenities" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rooms_capacity_positive" CHECK (("capacity" > 0)),
    CONSTRAINT "rooms_name_not_empty" CHECK (("length"(TRIM(BOTH FROM "name")) > 0))
);


ALTER TABLE "public"."rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "department" "text" DEFAULT 'General'::"text" NOT NULL,
    "role" "public"."user_role" DEFAULT 'employee'::"public"."user_role" NOT NULL,
    "employee_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "users_department_not_empty" CHECK (("length"(TRIM(BOTH FROM "department")) > 0)),
    CONSTRAINT "users_email_format" CHECK (("email" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::"text")),
    CONSTRAINT "users_name_not_empty" CHECK (("length"(TRIM(BOTH FROM "name")) > 0))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_id_key" UNIQUE ("auth_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_reservations_room_id" ON "public"."reservations" USING "btree" ("room_id");



CREATE INDEX "idx_reservations_room_time" ON "public"."reservations" USING "btree" ("room_id", "start_time", "end_time");



CREATE INDEX "idx_reservations_start_time" ON "public"."reservations" USING "btree" ("start_time");



CREATE INDEX "idx_reservations_status" ON "public"."reservations" USING "btree" ("status");



CREATE INDEX "idx_reservations_time_range" ON "public"."reservations" USING "btree" ("start_time", "end_time");



CREATE INDEX "idx_reservations_user_id" ON "public"."reservations" USING "btree" ("user_id");



CREATE INDEX "idx_rooms_active" ON "public"."rooms" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_rooms_capacity" ON "public"."rooms" USING "btree" ("capacity");



CREATE UNIQUE INDEX "idx_users_auth_id" ON "public"."users" USING "btree" ("auth_id");



CREATE INDEX "idx_users_department" ON "public"."users" USING "btree" ("department");



CREATE UNIQUE INDEX "idx_users_email" ON "public"."users" USING "btree" ("email");



CREATE INDEX "idx_users_employee_id" ON "public"."users" USING "btree" ("employee_id") WHERE ("employee_id" IS NOT NULL);



CREATE INDEX "idx_users_role" ON "public"."users" USING "btree" ("role");



CREATE OR REPLACE TRIGGER "check_reservation_conflict_trigger" BEFORE INSERT OR UPDATE ON "public"."reservations" FOR EACH ROW EXECUTE FUNCTION "public"."check_reservation_conflict"();



CREATE OR REPLACE TRIGGER "update_reservations_updated_at" BEFORE UPDATE ON "public"."reservations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_rooms_updated_at" BEFORE UPDATE ON "public"."rooms" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "validate_reservation_user_id_trigger" BEFORE INSERT OR UPDATE ON "public"."reservations" FOR EACH ROW EXECUTE FUNCTION "public"."validate_reservation_user_id"();



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "fk_reservations_room_id" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "fk_reservations_user_id" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."reservations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reservations_delete_own" ON "public"."reservations" FOR DELETE USING (("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "reservations_insert_own" ON "public"."reservations" FOR INSERT WITH CHECK ((("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))) AND ("status" = 'confirmed'::"public"."reservation_status")));



CREATE POLICY "reservations_select_public_or_own" ON "public"."reservations" FOR SELECT USING ((("status" = 'confirmed'::"public"."reservation_status") OR ("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())))));



CREATE POLICY "reservations_update_own" ON "public"."reservations" FOR UPDATE USING (("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



ALTER TABLE "public"."rooms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rooms_admin_full_access" ON "public"."rooms" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "rooms_select_active" ON "public"."rooms" FOR SELECT USING (("is_active" = true));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_insert_own" ON "public"."users" FOR INSERT WITH CHECK (("auth_id" = "auth"."uid"()));



CREATE POLICY "users_select_all" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "users_update_own" ON "public"."users" FOR UPDATE USING (("auth_id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."reservations";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."check_email_exists"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_email_exists"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_email_exists"("p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_reservation_conflict"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_reservation_conflict"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_reservation_conflict"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_available_time_slots"("p_room_id" "uuid", "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_time_slots"("p_room_id" "uuid", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_time_slots"("p_room_id" "uuid", "p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_booked_slots_for_timeline"("p_room_id" "uuid", "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_booked_slots_for_timeline"("p_room_id" "uuid", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_booked_slots_for_timeline"("p_room_id" "uuid", "p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_user_info"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_user_info"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_user_info"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_user_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_user_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_user_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_reservations"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "page_limit" integer, "page_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_reservations"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "page_limit" integer, "page_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_reservations"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "page_limit" integer, "page_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_reservations_detailed"("p_user_id" "uuid", "p_limit_count" integer, "p_offset_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_reservations_detailed"("p_user_id" "uuid", "p_limit_count" integer, "p_offset_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_reservations_detailed"("p_user_id" "uuid", "p_limit_count" integer, "p_offset_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_reservation_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_reservation_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_reservation_user_id"() TO "service_role";


















GRANT ALL ON TABLE "public"."reservations" TO "anon";
GRANT ALL ON TABLE "public"."reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."reservations" TO "service_role";



GRANT ALL ON TABLE "public"."rooms" TO "anon";
GRANT ALL ON TABLE "public"."rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."rooms" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
