# [정보 제공] 작전명 "유령 컬럼(Phantom Column)" 분석 자료

**To:** 선임 작전 담당 AI  
**From:** 후임 작전 담당 AI (Kiro)  
**Subject:** 작전명 "유령 컬럼(Phantom Column)" - RPC 및 데이터베이스 스키마 불일치 분석  
**Date:** 2025-01-03  
**Status:** 🔴 CRITICAL - 데이터베이스 스키마 불일치 확인됨

---

## 📋 작전 개요

'my-reservations' 페이지에서 발생한 `400 Bad Request` 오류에 대한 조사를 완료했습니다. **예상대로 데이터베이스 스키마 불일치가 확인되었습니다.** RPC 함수 `get_user_reservations_detailed`가 존재하지 않는 `equipment` 컬럼을 참조하고 있어 오류가 발생하고 있습니다.

---

## 🔍 핵심 문제 분석

### ❌ **문제의 핵심**
- **RPC 함수**: `rm.equipment` 컬럼을 참조
- **실제 테이블**: `rooms` 테이블에 `equipment` 컬럼이 존재하지 않음
- **대신 존재하는 컬럼**: `amenities` (JSONB 타입)

---

## 📊 상세 분석 자료

### 1. 데이터 호출 서비스 로직 (Data Fetching Service Logic)

**파일명: `src/lib/services/reservations.ts`**

*오류가 발생한 `get_user_reservations_detailed` RPC를 호출하는 `getMyReservationsOptimized` 함수의 전체 코드입니다.*

```typescript
/**
 * '내 예약' 목록을 최적화된 방식으로 조회합니다.
 * RPC 호출을 우선 시도하고, 실패 시 일반 쿼리로 안전하게 대체합니다.
 */
async getMyReservationsOptimized(supabase: SupabaseClient<Database>, userId: string): Promise<ReservationWithDetails[]> {
  if (!userId) {
    logger.warn('사용자 ID가 없어 최적화된 예약 조회를 할 수 없습니다');
    return [];
  }

  // 1. RPC 함수 (빠른 길) 시도
  try {
    const { data, error } = await supabase.rpc('get_user_reservations_detailed', {
      p_user_id: userId, // SQL 파일의 인자 이름과 일치
      p_limit_count: 50,
      p_offset_count: 0
    });

    if (error) throw new Error(`RPC failed: ${error.message}`);

    logger.info('Successfully fetched reservations via RPC.');
    // SQL 함수는 { data: [...] } 형태로 반환하므로, data.data를 사용
    return (data as any)?.data || [];
  } catch (rpcError) {
    logger.warn('RPC function get_user_reservations_detailed failed, falling back to standard query.', { 
      error: rpcError instanceof Error ? rpcError.message : String(rpcError) 
    });
    
    // 2. 대체 경로 (안전한 길): 기존 getMyReservations 함수 호출
    return this.getMyReservations(supabase, userId);
  }
},

async getMyReservations(supabase: SupabaseClient<Database>, userId?: string): Promise<ReservationWithDetails[]> {
  if (!userId) {
    logger.warn('사용자 ID가 없어 내 예약을 조회할 수 없습니다');
    return [];
  }
  try {
    const { data, error } = await supabase
      .from('reservations')
      .select(`*, room:rooms!inner(*)`)
      .eq('user_id', userId)
      .order('start_time', { ascending: true });
    if (error) throw error;
    return data as ReservationWithDetails[];
  } catch (error) {
    logger.error('내 예약 목록 조회 실패', { error });
    throw new Error('내 예약 목록을 불러오는데 실패했습니다.');
  }
}
```

### 2. 데이터베이스 RPC 함수 정의 (Database RPC Function Definition)

**파일명: `supabase/migrations/20250802093533_remote_schema.sql`**

*문제가 된 `get_user_reservations_detailed` 함수의 전체 `CREATE FUNCTION` SQL 구문입니다.*

```sql
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
    
    -- 🔴 문제 발생 지점: rm.equipment 컬럼이 존재하지 않음
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
                'equipment', rm.equipment,  -- ❌ 존재하지 않는 컬럼
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
```

### 3. 데이터베이스 테이블 스키마 (Database Table Schema)

**파일명: `supabase/migrations/20250802093533_remote_schema.sql`**

#### 🏢 rooms 테이블 스키마

```sql
CREATE TABLE IF NOT EXISTS "public"."rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "capacity" integer DEFAULT 1 NOT NULL,
    "description" "text",
    "location" "text",
    "amenities" "jsonb" DEFAULT '{}'::"jsonb",  -- ✅ equipment 대신 amenities 존재
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rooms_capacity_positive" CHECK (("capacity" > 0)),
    CONSTRAINT "rooms_name_not_empty" CHECK (("length"(TRIM(BOTH FROM "name")) > 0))
);
```

#### 📅 reservations 테이블 스키마

```sql
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
```

### 4. 관련 타입 정의 (Associated Type Definitions)

**파일명: `src/types/database.ts`**

```typescript
export type Room = {
  id: string
  name: string
  description?: string
  capacity: number
  location?: string
  amenities: Json  // ✅ equipment가 아닌 amenities 필드
  is_active: boolean
  created_at: string
  updated_at: string
}

// Extended types with relations
export type ReservationWithDetails = Reservation & {
  room: Room
  user: User
}

export type RoomAmenities = {
  projector?: boolean
  whiteboard?: boolean
  wifi?: boolean
  tv?: boolean
  microphone?: boolean
  speakers?: boolean
  [key: string]: boolean | undefined
}
```

---

## 🎯 해결 방안 제시

### 🔧 **즉시 수정 방안**

RPC 함수에서 `rm.equipment`를 `rm.amenities`로 변경해야 합니다:

```sql
-- 수정 전 (오류 발생)
'equipment', rm.equipment,

-- 수정 후 (올바른 컬럼명)
'amenities', rm.amenities,
```

### 📋 **작전 실행 계획**

1. **긴급 수정**: RPC 함수의 컬럼명 수정
2. **검증**: 수정된 함수 테스트
3. **배포**: 프로덕션 환경 적용
4. **모니터링**: 오류 해결 확인

---

## 🚨 **작전 우선순위: HIGH**

이 문제는 사용자의 예약 조회 기능을 완전히 차단하고 있으므로 즉시 수정이 필요합니다. 다행히 fallback 로직이 있어 완전한 서비스 중단은 피할 수 있지만, 성능 최적화된 RPC 함수가 작동하지 않고 있습니다.

---

**보고 완료**  
**후임 작전 담당 AI (Kiro)**