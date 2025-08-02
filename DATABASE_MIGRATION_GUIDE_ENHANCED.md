# 데이터베이스 마이그레이션 가이드 (강화 버전)

## 개요

이 문서는 회의실 예약 시스템의 데이터베이스 마이그레이션 과정을 설명합니다. 기존 사번 기반 인증에서 Supabase Auth 이메일 기반 인증으로의 마이그레이션뿐만 아니라, 강화된 데이터 무결성 제약조건, 트리거, 그리고 성능 최적화를 위한 새로운 데이터베이스 구조를 포함합니다.

## 마이그레이션 목표

- ✅ 기존 테이블 구조 최대한 유지
- ✅ 이메일 기반 인증 지원
- ✅ 기존 코드와의 호환성 유지
- ✅ 최소한의 스키마 변경
- ✅ 강화된 데이터 무결성 제약조건 추가
- ✅ 자동화된 데이터 검증 트리거 구현
- ✅ 성능 최적화를 위한 인덱스 및 RPC 함수 추가
- ✅ CI/CD 파이프라인과 통합된 마이그레이션 프로세스

## 주요 변경사항

### 1. users 테이블 수정

```sql
-- 기존
employee_id TEXT UNIQUE NOT NULL  -- 사번 필수

-- 변경 후
employee_id TEXT UNIQUE           -- 사번 선택사항 (NULL 허용)
auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL  -- Supabase Auth 연동 필수
```

### 2. 강화된 데이터 무결성 제약조건

```sql
-- 외래 키 제약조건 강화 (CASCADE 규칙 포함)
ALTER TABLE public.reservations 
ADD CONSTRAINT fk_reservations_user_id 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.reservations 
ADD CONSTRAINT fk_reservations_room_id 
FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE RESTRICT;

-- UUID 형식 검증 제약조건
ALTER TABLE public.users 
ADD CONSTRAINT check_auth_id_format 
CHECK (auth_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

-- 사용자 ID 일관성 제약조건
ALTER TABLE public.users 
ADD CONSTRAINT check_user_id_consistency 
CHECK (id IS NOT NULL AND auth_id IS NOT NULL);

-- 예약 시간 검증 제약조건
ALTER TABLE public.reservations 
ADD CONSTRAINT check_reservation_time_order 
CHECK (start_time < end_time);

-- 이메일 형식 검증 제약조건
ALTER TABLE public.users 
ADD CONSTRAINT check_email_format 
CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
```

### 3. 자동화된 데이터 검증 트리거

```sql
-- 사용자 데이터 변경 시 자동 검증 트리거
CREATE OR REPLACE FUNCTION validate_user_data()
RETURNS TRIGGER AS $$
BEGIN
    -- auth_id와 database id 일관성 검증
    IF NEW.auth_id IS NULL THEN
        RAISE EXCEPTION 'auth_id cannot be null';
    END IF;
    
    -- 이메일 형식 검증
    IF NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'Invalid email format: %', NEW.email;
    END IF;
    
    -- 중복 auth_id 검증
    IF EXISTS (SELECT 1 FROM public.users WHERE auth_id = NEW.auth_id AND id != NEW.id) THEN
        RAISE EXCEPTION 'Duplicate auth_id: %', NEW.auth_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_user_data
    BEFORE INSERT OR UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION validate_user_data();

-- 예약 데이터 무결성 트리거
CREATE OR REPLACE FUNCTION validate_reservation_data()
RETURNS TRIGGER AS $$
BEGIN
    -- 예약 시간 검증
    IF NEW.start_time >= NEW.end_time THEN
        RAISE EXCEPTION 'Start time must be before end time';
    END IF;
    
    -- 과거 시간 예약 방지 (업데이트 시에는 허용)
    IF TG_OP = 'INSERT' AND NEW.start_time < NOW() THEN
        RAISE EXCEPTION 'Cannot create reservation in the past';
    END IF;
    
    -- 중복 예약 방지
    IF EXISTS (
        SELECT 1 FROM public.reservations 
        WHERE room_id = NEW.room_id 
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND status IN ('confirmed', 'in_progress')
        AND (
            (NEW.start_time >= start_time AND NEW.start_time < end_time) OR
            (NEW.end_time > start_time AND NEW.end_time <= end_time) OR
            (NEW.start_time <= start_time AND NEW.end_time >= end_time)
        )
    ) THEN
        RAISE EXCEPTION 'Room is already reserved for this time period';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_reservation_data
    BEFORE INSERT OR UPDATE ON public.reservations
    FOR EACH ROW EXECUTE FUNCTION validate_reservation_data();
```

### 4. 성능 최적화 인덱스

```sql
-- 이메일 검색 최적화
CREATE INDEX idx_users_email ON public.users(email);

-- 예약 조회 최적화
CREATE INDEX idx_reservations_user_id ON public.reservations(user_id);
CREATE INDEX idx_reservations_room_id ON public.reservations(room_id);
CREATE INDEX idx_reservations_start_time ON public.reservations(start_time);
CREATE INDEX idx_reservations_status ON public.reservations(status);

-- 복합 인덱스 (자주 함께 조회되는 컬럼들)
CREATE INDEX idx_reservations_room_time ON public.reservations(room_id, start_time, end_time);
CREATE INDEX idx_users_auth_id_active ON public.users(auth_id, is_active);
CREATE INDEX idx_reservations_status_time ON public.reservations(status, start_time);

-- 부분 인덱스 (활성 사용자만)
CREATE INDEX idx_users_active_email ON public.users(email) WHERE is_active = true;
CREATE INDEX idx_reservations_active ON public.reservations(room_id, start_time) 
WHERE status IN ('confirmed', 'in_progress');
```

### 5. 최적화된 RPC 함수

```sql
-- 이메일 인증 완료 후 사용자 프로필 생성
CREATE OR REPLACE FUNCTION create_user_profile(
    user_auth_id UUID, 
    user_email TEXT, 
    user_name TEXT, 
    user_department TEXT
)
RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
BEGIN
    INSERT INTO public.users (auth_id, email, name, department, role, is_active)
    VALUES (user_auth_id, user_email, user_name, user_department, 'employee', true)
    RETURNING id INTO new_user_id;
    
    RETURN new_user_id;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'User with auth_id % already exists', user_auth_id;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to create user profile: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 최적화된 공개 예약 조회 함수
CREATE OR REPLACE FUNCTION get_public_reservations_optimized(
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0,
    room_filter UUID DEFAULT NULL,
    date_filter DATE DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    room_id UUID,
    room_name TEXT,
    user_name TEXT,
    title TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    status reservation_status
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.room_id,
        rm.name as room_name,
        u.name as user_name,
        r.title,
        r.start_time,
        r.end_time,
        r.status
    FROM public.reservations r
    JOIN public.rooms rm ON r.room_id = rm.id
    JOIN public.users u ON r.user_id = u.id
    WHERE 
        (room_filter IS NULL OR r.room_id = room_filter)
        AND (date_filter IS NULL OR DATE(r.start_time) = date_filter)
        AND r.status IN ('confirmed', 'in_progress')
        AND rm.is_active = true
        AND u.is_active = true
    ORDER BY r.start_time ASC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 사용자별 예약 통계 함수
CREATE OR REPLACE FUNCTION get_user_reservation_stats(user_auth_id UUID)
RETURNS TABLE (
    total_reservations BIGINT,
    active_reservations BIGINT,
    completed_reservations BIGINT,
    cancelled_reservations BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_reservations,
        COUNT(*) FILTER (WHERE status IN ('confirmed', 'in_progress')) as active_reservations,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_reservations,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_reservations
    FROM public.reservations r
    JOIN public.users u ON r.user_id = u.id
    WHERE u.auth_id = user_auth_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 6. 감사 로깅 시스템

```sql
-- 감사 로그 테이블
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    user_id UUID REFERENCES public.users(id),
    auth_user_id UUID,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    
    -- 인덱스를 위한 컬럼들
    created_date DATE GENERATED ALWAYS AS (DATE(timestamp)) STORED
);

-- 감사 로그 인덱스
CREATE INDEX idx_audit_logs_table_operation ON public.audit_logs(table_name, operation);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs(timestamp);
CREATE INDEX idx_audit_logs_date ON public.audit_logs(created_date);

-- 감사 로깅 트리거 함수
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
    current_auth_id UUID;
BEGIN
    -- 현재 사용자 정보 가져오기
    SELECT id, auth_id INTO current_user_id, current_auth_id
    FROM public.users 
    WHERE auth_id = auth.uid()
    LIMIT 1;
    
    INSERT INTO public.audit_logs (
        table_name,
        operation,
        old_data,
        new_data,
        user_id,
        auth_user_id
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
        current_user_id,
        current_auth_id
    );
    
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
EXCEPTION
    WHEN OTHERS THEN
        -- 감사 로깅 실패가 주 작업을 방해하지 않도록 함
        RAISE WARNING 'Audit logging failed: %', SQLERRM;
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- 예약 테이블에 감사 트리거 적용
CREATE TRIGGER audit_reservations_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.reservations
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- 사용자 테이블에 감사 트리거 적용
CREATE TRIGGER audit_users_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
```

### 7. RLS 정책 개선

```sql
-- 사용자가 자신의 모든 예약을 볼 수 있는 정책 추가 (상태 무관)
CREATE POLICY "Users can view their own reservations" ON public.reservations
    FOR SELECT USING (
        auth.uid() IN (SELECT auth_id FROM public.users WHERE id = user_id)
    );

-- 사용자가 자신의 예약을 수정할 수 있는 정책
CREATE POLICY "Users can update their own reservations" ON public.reservations
    FOR UPDATE USING (
        auth.uid() IN (SELECT auth_id FROM public.users WHERE id = user_id)
        AND status IN ('confirmed', 'in_progress')
    );

-- 관리자 전체 접근 정책
CREATE POLICY "Admins can access all reservations" ON public.reservations
    FOR ALL USING (
        auth.uid() IN (
            SELECT auth_id FROM public.users 
            WHERE role = 'admin' AND is_active = true
        )
    );

-- 감사 로그 접근 정책 (관리자만)
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
    FOR SELECT USING (
        auth.uid() IN (
            SELECT auth_id FROM public.users 
            WHERE role = 'admin' AND is_active = true
        )
    );

-- 사용자 프로필 접근 정책
CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT USING (auth_id = auth.uid());

CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth_id = auth.uid());
```

## CI/CD 통합 마이그레이션 프로세스

### 1. 자동화된 마이그레이션 검증

```bash
# 마이그레이션 구문 검증
npm run migration:validate-syntax

# 마이그레이션 의존성 확인
npm run migration:check-dependencies

# 테스트 환경에서 마이그레이션 시뮬레이션
npm run migration:dry-run
```

### 2. 배포 파이프라인 통합

```yaml
# GitHub Actions 워크플로우 예시
- name: Validate Migration
  run: npm run migration:validate-syntax

- name: Apply Migration
  run: supabase db push

- name: Verify Migration
  run: npm run migration:verify

- name: Run Data Integrity Check
  run: npm run integrity:post-deploy
```

### 3. 롤백 자동화

```bash
# 롤백 필요성 자동 감지
npm run rollback:check

# 자동 롤백 실행
npm run rollback:automatic

# 롤백 검증
npm run rollback:verify
```

## 성능 모니터링 및 최적화

### 1. 쿼리 성능 모니터링

```sql
-- 느린 쿼리 식별을 위한 뷰
CREATE VIEW slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements
WHERE mean_time > 100  -- 100ms 이상 쿼리
ORDER BY mean_time DESC;
```

### 2. 인덱스 사용률 모니터링

```sql
-- 인덱스 사용률 확인
CREATE VIEW index_usage AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### 3. 테이블 크기 모니터링

```sql
-- 테이블 크기 및 성장률 모니터링
CREATE VIEW table_sizes AS
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY size_bytes DESC;
```

## 보안 강화 조치

### 1. 데이터 암호화

```sql
-- 민감한 데이터 암호화를 위한 함수
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 개인정보 암호화 함수
CREATE OR REPLACE FUNCTION encrypt_pii(data TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(encrypt(data::bytea, 'encryption_key', 'aes'), 'base64');
END;
$$ LANGUAGE plpgsql;

-- 개인정보 복호화 함수 (관리자만 사용)
CREATE OR REPLACE FUNCTION decrypt_pii(encrypted_data TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN convert_from(decrypt(decode(encrypted_data, 'base64'), 'encryption_key', 'aes'), 'UTF8');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. 접근 로깅 강화

```sql
-- 민감한 테이블 접근 로깅
CREATE OR REPLACE FUNCTION log_sensitive_access()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_logs (
        table_name,
        operation,
        user_id,
        auth_user_id,
        timestamp
    ) VALUES (
        TG_TABLE_NAME,
        'ACCESS',
        (SELECT id FROM public.users WHERE auth_id = auth.uid()),
        auth.uid(),
        NOW()
    );
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 사용자 테이블 접근 로깅
CREATE TRIGGER log_users_access
    AFTER SELECT ON public.users
    FOR EACH STATEMENT EXECUTE FUNCTION log_sensitive_access();
```

## 문제 해결 및 디버깅

### 1. 마이그레이션 실패 시 대응

```bash
# 마이그레이션 상태 확인
supabase migration list

# 실패한 마이그레이션 롤백
supabase migration repair

# 수동 마이그레이션 적용
supabase db push --include-all
```

### 2. 성능 문제 진단

```sql
-- 현재 실행 중인 쿼리 확인
SELECT 
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';

-- 락 대기 상황 확인
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

### 3. 데이터 무결성 문제 해결

```bash
# 데이터 무결성 검사 실행
npm run integrity:comprehensive

# 특정 테이블 무결성 검사
npm run integrity:table users

# 자동 복구 시도
npm run integrity:auto-repair
```

## 유지보수 및 모니터링

### 1. 정기 유지보수 작업

```sql
-- 통계 정보 업데이트 (주간)
ANALYZE;

-- 인덱스 재구성 (월간)
REINDEX DATABASE postgres;

-- 오래된 감사 로그 정리 (월간)
DELETE FROM public.audit_logs 
WHERE timestamp < NOW() - INTERVAL '6 months';
```

### 2. 모니터링 대시보드

```bash
# 시스템 상태 모니터링
npm run monitor:database

# 성능 메트릭 수집
npm run monitor:performance

# 보안 이벤트 모니터링
npm run monitor:security
```

---

이 강화된 마이그레이션 가이드는 데이터베이스의 안정성, 성능, 보안을 종합적으로 개선하는 방법을 제시합니다. 각 단계를 신중히 검토하고 테스트 환경에서 충분히 검증한 후 프로덕션에 적용하시기 바랍니다.