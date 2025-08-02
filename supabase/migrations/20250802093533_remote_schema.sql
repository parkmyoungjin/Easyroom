

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."reservation_status" AS ENUM (
    'confirmed',
    'cancelled'
);


ALTER TYPE "public"."reservation_status" OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."get_public_reservations"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "page_limit" integer DEFAULT 100, "page_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "room_id" "uuid", "user_id" "uuid", "title" "text", "purpose" "text", "start_time" timestamp with time zone, "end_time" timestamp with time zone, "department" "text", "user_name" "text", "is_mine" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
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
END;
$$;


ALTER FUNCTION "public"."get_public_reservations"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "page_limit" integer, "page_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_reservations_detailed"("p_user_id" "uuid", "p_limit_count" integer DEFAULT 50, "p_offset_count" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
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
                'equipment', rm.equipment,
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
END;
$$;


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


CREATE OR REPLACE FUNCTION "public"."upsert_user_profile"("p_auth_id" "text", "p_email" "text", "p_user_name" "text" DEFAULT NULL::"text", "p_user_department" "text" DEFAULT 'General'::"text", "p_user_employee_id" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    auth_uuid UUID;
    final_name TEXT;
    final_department TEXT;
BEGIN
    -- 입력 검증
    IF p_auth_id IS NULL OR LENGTH(TRIM(p_auth_id)) = 0 THEN
        RAISE EXCEPTION 'auth_id cannot be null or empty';
    END IF;
    
    IF p_email IS NULL OR LENGTH(TRIM(p_email)) = 0 THEN
        RAISE EXCEPTION 'email cannot be null or empty';
    END IF;
    
    -- auth_id를 UUID로 변환
    BEGIN
        auth_uuid := p_auth_id::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Invalid auth_id format: %', p_auth_id;
    END;
    
    -- 기본값 설정
    final_name := COALESCE(NULLIF(TRIM(p_user_name), ''), SPLIT_PART(p_email, '@', 1));
    final_department := COALESCE(NULLIF(TRIM(p_user_department), ''), 'General');
    
    -- 프로필 업데이트 (트리거에 의해 이미 생성되어 있을 것임)
    UPDATE public.users
    SET 
        email = TRIM(p_email),
        name = final_name,
        department = final_department,
        employee_id = p_user_employee_id,
        updated_at = NOW()
    WHERE auth_id = auth_uuid;
    
    -- 만약 업데이트된 행이 없다면 (트리거가 실패한 경우) 직접 생성
    IF NOT FOUND THEN
        INSERT INTO public.users (auth_id, email, name, department, employee_id)
        VALUES (auth_uuid, TRIM(p_email), final_name, final_department, p_user_employee_id)
        ON CONFLICT (auth_id) DO UPDATE SET
            email = EXCLUDED.email,
            name = EXCLUDED.name,
            department = EXCLUDED.department,
            employee_id = EXCLUDED.employee_id,
            updated_at = NOW();
    END IF;
END;
$$;


ALTER FUNCTION "public"."upsert_user_profile"("p_auth_id" "text", "p_email" "text", "p_user_name" "text", "p_user_department" "text", "p_user_employee_id" "text") OWNER TO "postgres";


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



GRANT ALL ON FUNCTION "public"."get_current_user_info"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_user_info"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_user_info"() TO "service_role";



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



GRANT ALL ON FUNCTION "public"."upsert_user_profile"("p_auth_id" "text", "p_email" "text", "p_user_name" "text", "p_user_department" "text", "p_user_employee_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_user_profile"("p_auth_id" "text", "p_email" "text", "p_user_name" "text", "p_user_department" "text", "p_user_employee_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_user_profile"("p_auth_id" "text", "p_email" "text", "p_user_name" "text", "p_user_department" "text", "p_user_employee_id" "text") TO "service_role";



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
