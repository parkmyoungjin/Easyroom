# 데이터베이스 마이그레이션 가이드

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
    
    -- 과거 시간 예약 방지
    IF NEW.start_time < NOW() THEN
        RAISE EXCEPTION 'Cannot create reservation in the past';
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
    ORDER BY r.start_time ASC
    LIMIT limit_count
    OFFSET offset_count;
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
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 감사 로깅 트리거 함수
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_logs (
        table_name,
        operation,
        old_data,
        new_data,
        user_id
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
        CASE 
            WHEN TG_OP = 'DELETE' THEN OLD.user_id
            ELSE NEW.user_id
        END
    );
    
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- 예약 테이블에 감사 트리거 적용
CREATE TRIGGER audit_reservations_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.reservations
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
```

### 7. RLS 정책 개선

```sql
-- 사용자가 자신의 모든 예약을 볼 수 있는 정책 추가 (상태 무관)
CREATE POLICY "Users can view their own reservations" ON public.reservations
    FOR SELECT USING (auth.uid() IN (SELECT auth_id FROM public.users WHERE id = user_id));

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
```

## 마이그레이션 파일

### 1. 기존 프로젝트 마이그레이션

기존 Supabase 프로젝트에 적용할 마이그레이션:

```bash
supabase/migrations/20250121000000_email_auth_migration.sql
```

### 2. 새 프로젝트 스키마

새로운 Supabase 프로젝트용 완전한 스키마:

```bash
scripts/setup-email-auth-database.sql
```

## 마이그레이션 실행 방법

### 방법 1: 기존 프로젝트 마이그레이션

```bash
# 1. 마이그레이션 적용
supabase db push

# 2. 스키마 검증
node scripts/verify-email-auth-schema.js
```

### 방법 2: 새 프로젝트 설정

```bash
# 1. 새 Supabase 프로젝트 생성
supabase projects create your-project-name

# 2. 로컬 프로젝트 연결
supabase link --project-ref your-project-ref

# 3. 스키마 적용
supabase db push

# 또는 직접 SQL 실행
psql -h your-db-host -U postgres -d postgres -f scripts/setup-email-auth-database.sql
```

## 검증 방법

### 1. 자동 검증 스크립트

```bash
node scripts/verify-email-auth-schema.js
```

### 2. 수동 검증

```sql
-- 1. users 테이블 구조 확인
\d public.users

-- 2. employee_id가 nullable인지 확인
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'employee_id';

-- 3. 인덱스 확인
SELECT indexname FROM pg_indexes WHERE tablename = 'users';

-- 4. 함수 확인
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name IN ('get_public_reservations', 'create_user_profile');
```

## 호환성 보장

### 1. 기존 코드 호환성

- `useAuth` 훅 인터페이스 유지
- 사용자 프로필 구조 유지
- 예약 시스템 로직 변경 없음

### 2. 데이터 호환성

- 기존 예약 데이터 유지
- 사용자 프로필 데이터 유지
- 회의실 데이터 유지

### 3. API 호환성

- `get_public_reservations` 함수 동일한 인터페이스
- RLS 정책 기존 로직 유지
- 권한 체계 동일

## 롤백 계획

마이그레이션 실패 시 롤백 방법:

### 1. 스키마 롤백

```sql
-- employee_id를 다시 NOT NULL로 변경
ALTER TABLE public.users ALTER COLUMN employee_id SET NOT NULL;

-- 새로 추가된 인덱스 제거
DROP INDEX IF EXISTS idx_users_email;

-- 새로 추가된 함수 제거
DROP FUNCTION IF EXISTS create_user_profile;
```

### 2. 데이터 백업

마이그레이션 전 필수 백업:

```bash
# 전체 데이터베이스 백업
pg_dump -h your-db-host -U postgres -d postgres > backup_before_migration.sql

# 특정 테이블만 백업
pg_dump -h your-db-host -U postgres -d postgres -t public.users -t public.reservations > backup_critical_tables.sql
```

## 주의사항

### 1. 마이그레이션 전 확인사항

- [ ] 데이터베이스 백업 완료
- [ ] 환경변수 설정 확인 (.env.local)
- [ ] Supabase 프로젝트 연결 확인
- [ ] 기존 사용자 데이터 확인

### 2. 마이그레이션 후 확인사항

- [ ] 스키마 검증 스크립트 실행
- [ ] 기존 예약 데이터 정상 조회
- [ ] 새로운 이메일 인증 플로우 테스트
- [ ] 기존 사용자 로그인 테스트 (호환성)

### 3. 프로덕션 배포 시 주의사항

- 점진적 배포 권장 (스테이징 → 프로덕션)
- 사용자 트래픽이 적은 시간대 배포
- 롤백 계획 준비
- 모니터링 강화

## 문제 해결

### 1. 일반적인 오류

**오류**: `auth_id 연결이 끊어진 사용자가 존재합니다`
**해결**: 기존 사용자 데이터의 auth_id가 실제 auth.users와 연결되어 있는지 확인

**오류**: `중복된 이메일이 존재합니다`
**해결**: 이메일 중복 데이터 정리 후 마이그레이션 재실행

### 2. 성능 이슈

**문제**: 이메일 검색 속도 저하
**해결**: `idx_users_email` 인덱스 확인 및 재생성

### 3. 권한 문제

**문제**: RLS 정책 오류
**해결**: 기존 정책이 auth_id 기반으로 작동하는지 확인

## 지원

마이그레이션 관련 문제 발생 시:

1. 검증 스크립트 실행: `node scripts/verify-email-auth-schema.js`
2. 로그 확인: Supabase 대시보드 → Logs
3. 데이터베이스 상태 확인: `\d public.users`
4. 롤백 실행 (필요시)

---

**마이그레이션 체크리스트**

- [ ] 백업 완료
- [ ] 마이그레이션 파일 적용
- [ ] 검증 스크립트 실행
- [ ] 기능 테스트 완료
- [ ] 프로덕션 배포 준비