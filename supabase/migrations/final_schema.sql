-- ============================================================================
-- FINAL SCHEMA BLUEPRINT V2.2 (IDEMPOTENT & AUTH FIX)
-- Author: Gemini AI (in collaboration with the Project Lead)
-- Change: Ensures the script is fully idempotent and fixes a critical auth issue.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 초기 설정 (변경 없음)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- ✅ [핵심 수정] 1단계: 기존의 모든 커스텀 객체를 안전하게 삭제합니다.
-- ----------------------------------------------------------------------------
-- Functions
DROP FUNCTION IF EXISTS public.cancel_reservation(uuid, text);
DROP FUNCTION IF EXISTS public.update_reservation(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.create_reservation(uuid, text, text, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.get_reservations_for_period(timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.get_or_create_user_profile();
-- Tables (CASCADE를 사용하여 의존하는 객체도 함께 삭제)
DROP TABLE IF EXISTS public.reservations CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
-- Types (Enum)
DROP TYPE IF EXISTS public.reservation_status;
DROP TYPE IF EXISTS public.user_role;

-- ----------------------------------------------------------------------------
-- 2단계: 모든 객체를 깨끗한 상태에서 다시 생성합니다.
-- ----------------------------------------------------------------------------
-- Types
CREATE TYPE "public"."reservation_status" AS ENUM ('confirmed', 'cancelled');
CREATE TYPE "public"."user_role" AS ENUM ('employee', 'admin');

-- Tables
CREATE TABLE "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "auth_id" "uuid" NOT NULL UNIQUE,
    "email" "text" NOT NULL UNIQUE,
    "name" "text" NOT NULL,
    "department" "text" DEFAULT 'General'::"text" NOT NULL,
    "role" "public"."user_role" DEFAULT 'employee'::"public"."user_role" NOT NULL,
    "employee_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE "public"."rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "name" "text" NOT NULL,
    "capacity" integer DEFAULT 1 NOT NULL,
    "description" "text",
    "location" "text",
    "amenities" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE "public"."reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "user_id" "uuid" NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
    "room_id" "uuid" NOT NULL REFERENCES "public"."rooms"("id") ON DELETE CASCADE,
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

-- RLS Policies
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."rooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."reservations" ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Allow authenticated users to read all users" ON "public"."users" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow users to update their own profile" ON "public"."users" FOR UPDATE TO authenticated USING (auth.uid() = auth_id);

-- Rooms policies
CREATE POLICY "Allow authenticated users to read active rooms" ON "public"."rooms" FOR SELECT TO authenticated USING (is_active = true);

-- Reservations policies (완전한 CRUD 정책 세트)
CREATE POLICY "reservations_select_public_or_own" ON "public"."reservations" FOR SELECT USING ((("status" = 'confirmed'::"public"."reservation_status") OR ("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())))));

CREATE POLICY "reservations_insert_own" ON "public"."reservations" FOR INSERT WITH CHECK ((("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))) AND ("status" = 'confirmed'::"public"."reservation_status")));

CREATE POLICY "reservations_update_own" ON "public"."reservations" FOR UPDATE USING (("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));

CREATE POLICY "reservations_delete_own" ON "public"."reservations" FOR DELETE USING (("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));

-- RPC Functions
-- ✅ [핵심 수정] get_or_create_user_profile (SECURITY INVOKER로 변경)
CREATE OR REPLACE FUNCTION public.get_or_create_user_profile()
RETURNS TABLE (
    "authId" uuid, "dbId" uuid, "employeeId" text, "email" text,
    "name" text, "department" text, "role" public.user_role,
    "createdAt" timestamptz, "updatedAt" timestamptz
) LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
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

-- (다른 RPC 함수들은 이전 버전과 동일)
CREATE OR REPLACE FUNCTION public.get_reservations_for_period(start_date timestamptz, end_date timestamptz)
RETURNS TABLE ( id uuid, room_id uuid, user_id uuid, title text, purpose text, start_time timestamptz, end_time timestamptz, department text, user_name text, is_mine boolean )
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT r.id, r.room_id, r.user_id,
        CASE WHEN u.auth_id = auth.uid() THEN r.title ELSE u.department END,
        CASE WHEN u.auth_id = auth.uid() THEN r.purpose ELSE NULL END,
        r.start_time, r.end_time, u.department,
        CASE WHEN u.auth_id = auth.uid() THEN u.name ELSE 'Anonymous' END,
        (u.auth_id = auth.uid())
    FROM public.reservations r JOIN public.users u ON r.user_id = u.id
    WHERE r.status = 'confirmed' AND r.start_time < end_date AND r.end_time > start_date;
END; $$;

CREATE OR REPLACE FUNCTION public.create_reservation(p_room_id uuid, p_title text, p_purpose text, p_start_time timestamptz, p_end_time timestamptz)
RETURNS SETOF public.reservations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

CREATE OR REPLACE FUNCTION public.update_reservation(p_reservation_id uuid, p_new_start_time timestamptz, p_new_end_time timestamptz)
RETURNS SETOF public.reservations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

CREATE OR REPLACE FUNCTION public.cancel_reservation(p_reservation_id uuid, p_reason text)
RETURNS SETOF public.reservations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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


-- Triggers
CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql" AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE TRIGGER "update_reservations_updated_at" BEFORE UPDATE ON "public"."reservations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "update_rooms_updated_at" BEFORE UPDATE ON "public"."rooms" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;

-- FILE: supabase/migrations/YYYYMMDDHHMMSS_add_auth_trigger.sql

-- ----------------------------------------------------------------------------
-- ✅ [핵심 수정] 신규 사용자 자동 프로필 생성을 위한 트리거 및 함수
-- ----------------------------------------------------------------------------

-- 1. 신규 사용자 정보를 public.users에 복제하는 함수를 생성합니다.
--    이 함수는 auth 스키마에 대한 접근이 필요하므로, 보안 컨텍스트에 주의해야 합니다.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER -- ✅ auth 스키마에 접근하기 위해 DEFINER 권한이 필요합니다.
SET search_path = public
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

-- 2. auth.users 테이블에 새로운 사용자가 추가될 때마다 위 함수를 실행하는 트리거를 생성합니다.
--    이 트리거는 반드시 'supabase_admin'과 같은 높은 권한으로 생성되어야 합니다.
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();