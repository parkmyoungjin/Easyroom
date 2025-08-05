

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
    CONSTRAINT "reservations_time_valid" CHECK (("start_time" < "end_time"))
);


ALTER TABLE "public"."reservations" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_reservation"("p_reservation_id" "uuid", "p_reason" "text") RETURNS SETOF "public"."reservations"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    target_reservation public.reservations;
    current_user_record public.users;
BEGIN
    SELECT * INTO current_user_record FROM public.users WHERE auth_id = auth.uid();
    IF current_user_record IS NULL THEN RAISE EXCEPTION 'User profile not found.'; END IF;
    SELECT * INTO target_reservation FROM public.reservations WHERE id = p_reservation_id;
    IF target_reservation IS NULL THEN RAISE EXCEPTION 'Reservation not found.'; END IF;
    IF target_reservation.user_id != current_user_record.id AND current_user_record.role != 'admin' THEN
        RAISE EXCEPTION 'Permission denied to cancel this reservation.';
    END IF;
    UPDATE public.reservations SET status = 'cancelled', cancellation_reason = p_reason WHERE id = p_reservation_id;
    RETURN QUERY SELECT * FROM public.reservations WHERE id = p_reservation_id;
END; $$;


ALTER FUNCTION "public"."cancel_reservation"("p_reservation_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_reservation"("p_room_id" "uuid", "p_title" "text", "p_purpose" "text", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone) RETURNS SETOF "public"."reservations"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    current_user_id uuid;
BEGIN
    SELECT id INTO current_user_id FROM public.users WHERE auth_id = auth.uid();
    IF current_user_id IS NULL THEN RAISE EXCEPTION 'User profile not found.'; END IF;
    IF EXISTS (
        SELECT 1 FROM public.reservations res
        WHERE res.room_id = p_room_id AND res.status = 'confirmed' AND (res.start_time, res.end_time) OVERLAPS (p_start_time, p_end_time)
    ) THEN RAISE EXCEPTION 'Reservation conflict detected.'; END IF;
    RETURN QUERY INSERT INTO public.reservations(user_id, room_id, title, purpose, start_time, end_time)
    VALUES (current_user_id, p_room_id, p_title, p_purpose, p_start_time, p_end_time)
    RETURNING *;
END; $$;


ALTER FUNCTION "public"."create_reservation"("p_room_id" "uuid", "p_title" "text", "p_purpose" "text", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_user_profile"() RETURNS TABLE("authId" "uuid", "dbId" "uuid", "employeeId" "text", "email" "text", "name" "text", "department" "text", "role" "public"."user_role", "createdAt" timestamp with time zone, "updatedAt" timestamp with time zone)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    user_record public.users;
    auth_user_email text;
    auth_user_name text;
    auth_user_department text;
BEGIN
    SELECT * INTO user_record FROM public.users WHERE auth_id = auth.uid();
    IF user_record IS NULL THEN
        select auth.jwt()->>'email' into auth_user_email;
        select auth.jwt()->'user_metadata'->>'full_name' into auth_user_name;
        select auth.jwt()->'user_metadata'->>'department' into auth_user_department;

        INSERT INTO public.users (auth_id, email, name, department, role)
        VALUES (
            auth.uid(),
            auth_user_email,
            COALESCE(auth_user_name, SPLIT_PART(auth_user_email, '@', 1)),
            COALESCE(auth_user_department, 'General'),
            'employee'::public.user_role
        )
        RETURNING * INTO user_record;
    END IF;
    RETURN QUERY SELECT 
        user_record.auth_id, user_record.id, user_record.employee_id,
        user_record.email, user_record.name, user_record.department,
        user_record.role, user_record.created_at, user_record.updated_at;
END; $$;


ALTER FUNCTION "public"."get_or_create_user_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_reservations_with_room"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "page_limit" integer DEFAULT 100, "page_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "room_id" "uuid", "user_id" "uuid", "title" "text", "purpose" "text", "start_time" timestamp with time zone, "end_time" timestamp with time zone, "department" "text", "user_name" "text", "room_name" "text", "is_mine" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_public_reservations_with_room"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "page_limit" integer, "page_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_reservations_for_period"("start_date" timestamp with time zone, "end_date" timestamp with time zone) RETURNS TABLE("id" "uuid", "room_id" "uuid", "user_id" "uuid", "title" "text", "purpose" "text", "start_time" timestamp with time zone, "end_time" timestamp with time zone, "department" "text", "user_name" "text", "room_name" "text", "is_mine" boolean)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_reservations_for_period"("start_date" timestamp with time zone, "end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_reservations_detailed"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    reservation_data jsonb;
BEGIN
    -- 권한 검사는 그대로 유지
    IF NOT (
        (SELECT id FROM users WHERE auth_id = auth.uid()) = p_user_id 
        OR 
        EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
    ) THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;

    -- 예약 데이터를 JSON 배열로 만듭니다.
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
            'room', to_jsonb(rm),
            'user', to_jsonb(u)
        )
        -- ✅ [핵심 수정] DESC (내림차순)를 ASC (오름차순)으로 변경합니다.
        ORDER BY r.start_time ASC
    )
    INTO reservation_data
    FROM reservations r
    JOIN rooms rm ON r.room_id = rm.id
    JOIN users u ON r.user_id = u.id
    WHERE r.user_id = p_user_id;

    -- 결과가 없으면 빈 JSON 배열을 반환합니다.
    RETURN COALESCE(reservation_data, '[]'::jsonb);
END;
$$;


ALTER FUNCTION "public"."get_user_reservations_detailed"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.users (auth_id, email, name, department, role)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'department', 'General'),
    'employee'::public.user_role
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_reservation"("p_reservation_id" "uuid", "p_new_start_time" timestamp with time zone, "p_new_end_time" timestamp with time zone) RETURNS SETOF "public"."reservations"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    target_reservation public.reservations;
    current_user_record public.users;
BEGIN
    SELECT * INTO current_user_record FROM public.users WHERE auth_id = auth.uid();
    IF current_user_record IS NULL THEN RAISE EXCEPTION 'User profile not found.'; END IF;
    SELECT * INTO target_reservation FROM public.reservations WHERE id = p_reservation_id;
    IF target_reservation IS NULL THEN RAISE EXCEPTION 'Reservation not found.'; END IF;
    IF target_reservation.user_id != current_user_record.id AND current_user_record.role != 'admin' THEN
        RAISE EXCEPTION 'Permission denied to update this reservation.';
    END IF;
    UPDATE public.reservations SET start_time = p_new_start_time, end_time = p_new_end_time WHERE id = p_reservation_id;
    RETURN QUERY SELECT * FROM public.reservations WHERE id = p_reservation_id;
END; $$;


ALTER FUNCTION "public"."update_reservation"("p_reservation_id" "uuid", "p_new_start_time" timestamp with time zone, "p_new_end_time" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "capacity" integer DEFAULT 1 NOT NULL,
    "description" "text",
    "location" "text",
    "amenities" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
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
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
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



CREATE OR REPLACE TRIGGER "update_reservations_updated_at" BEFORE UPDATE ON "public"."reservations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_rooms_updated_at" BEFORE UPDATE ON "public"."rooms" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow authenticated users to create reservations" ON "public"."reservations" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "Allow authenticated users to read active rooms" ON "public"."rooms" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Allow authenticated users to read all users" ON "public"."users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read confirmed reservations" ON "public"."reservations" FOR SELECT TO "authenticated" USING (("status" = 'confirmed'::"public"."reservation_status"));



CREATE POLICY "Allow users to delete their own reservations" ON "public"."reservations" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "Allow users to update their own profile" ON "public"."users" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "auth_id"));



CREATE POLICY "Allow users to update their own reservations" ON "public"."reservations" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())))) WITH CHECK (("user_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



ALTER TABLE "public"."reservations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."reservations";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON TABLE "public"."reservations" TO "anon";
GRANT ALL ON TABLE "public"."reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."reservations" TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_reservation"("p_reservation_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_reservation"("p_reservation_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_reservation"("p_reservation_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_reservation"("p_room_id" "uuid", "p_title" "text", "p_purpose" "text", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."create_reservation"("p_room_id" "uuid", "p_title" "text", "p_purpose" "text", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_reservation"("p_room_id" "uuid", "p_title" "text", "p_purpose" "text", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_user_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_user_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_user_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_reservations_with_room"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "page_limit" integer, "page_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_reservations_with_room"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "page_limit" integer, "page_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_reservations_with_room"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "page_limit" integer, "page_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_reservations_for_period"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_reservations_for_period"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_reservations_for_period"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_reservations_detailed"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_reservations_detailed"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_reservations_detailed"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_reservation"("p_reservation_id" "uuid", "p_new_start_time" timestamp with time zone, "p_new_end_time" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."update_reservation"("p_reservation_id" "uuid", "p_new_start_time" timestamp with time zone, "p_new_end_time" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_reservation"("p_reservation_id" "uuid", "p_new_start_time" timestamp with time zone, "p_new_end_time" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















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
