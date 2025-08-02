# 데이터베이스 정책 통합 마이그레이션 가이드

## 개요
기존 중복되고 일관성 없던 SQL 파일들을 정리하고, 현재 상황에 맞는 통합된 데이터베이스 정책을 적용하는 가이드입니다.

## 변경 사항

### 1. 정리된 파일들
- ❌ `scripts/create-users-sql.sql` (삭제됨)
- ❌ `scripts/setup-new-database.sql` (삭제됨) 
- ❌ `scripts/setup-email-auth-database.sql` (삭제됨)
- ✅ `supabase/migrations/20250723000000_consolidate_database_policies.sql` (새로 생성)

### 2. 유지되는 파일들
- ✅ `scripts/data-integrity-queries.sql` - 데이터 무결성 검증용
- ✅ `scripts/policy-queries.sql` - 정책 현황 조회용
- ✅ 기존 마이그레이션 파일들 (supabase/migrations/)

## 마이그레이션 실행

### 1. 백업 생성 (필수)
```bash
# 전체 데이터베이스 백업
pg_dump -h your-db-host -U postgres -d postgres > backup_before_policy_migration.sql

# 또는 Supabase CLI 사용
supabase db dump -f backup_before_policy_migration.sql
```

### 2. 마이그레이션 실행
```bash
# Supabase CLI로 마이그레이션 실행
supabase db push

# 또는 직접 SQL 실행
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/20250723000000_consolidate_database_policies.sql
```

### 3. 마이그레이션 검증
```bash
# 정책 현황 확인
psql -h your-db-host -U postgres -d postgres -f scripts/policy-queries.sql

# 데이터 무결성 확인
psql -h your-db-host -U postgres -d postgres -f scripts/data-integrity-queries.sql
```

## 주요 변경 내용

### RLS 정책 통합
기존 중복된 정책들을 제거하고 명확한 네이밍으로 통합:

- **Users 테이블**
  - `users_select_policy`: 모든 사용자 정보 조회 가능
  - `users_update_policy`: 자신의 프로필만 수정 가능

- **Rooms 테이블**
  - `rooms_select_policy`: 활성화된 회의실만 조회 가능

- **Reservations 테이블**
  - `reservations_select_policy`: 확정된 예약 + 자신의 모든 예약 조회
  - `reservations_insert_policy`: 자신의 user_id로만 예약 생성
  - `reservations_update_policy`: 자신의 예약만 수정
  - `reservations_delete_policy`: 자신의 예약만 삭제

### 함수 정리
- ✅ `get_public_reservations()`: 통합된 예약 조회 함수 (room_name 필드 추가)
- ✅ `upsert_user_profile()`: 사용자 프로필 생성/업데이트 함수
- ❌ 중복 함수들 제거: `get_public_reservations_anonymous`, `create_user_profile` 등

### 권한 최적화
- 불필요한 함수 권한 정리
- 핵심 함수만 authenticated/anon 권한 부여

## 호환성 보장

### 기존 코드와의 호환성
- 기존 `get_public_reservations()` 함수 시그니처 유지
- 기존 테이블 구조 및 인덱스 유지
- 기존 데이터에 영향 없음

### API 호출 예시
```javascript
// 기존 코드 그대로 사용 가능
const { data, error } = await supabase
  .rpc('get_public_reservations', {
    start_date: '2025-07-23T00:00:00Z',
    end_date: '2025-07-24T00:00:00Z'
  });

// 새로운 프로필 생성/업데이트
const { data: userId, error } = await supabase
  .rpc('upsert_user_profile', {
    user_name: '홍길동',
    user_department: '개발팀',
    user_employee_id: 'EMP001' // 선택사항
  });
```

## 문제 해결

### 마이그레이션 실패 시
1. 백업에서 복원
2. 기존 정책 충돌 확인
3. 수동으로 중복 정책 제거 후 재실행

### 권한 문제 시
```sql
-- 권한 재설정
GRANT EXECUTE ON FUNCTION get_public_reservations(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_reservations(TIMESTAMPTZ, TIMESTAMPTZ) TO anon;
GRANT EXECUTE ON FUNCTION upsert_user_profile(TEXT, TEXT, TEXT) TO authenticated;
```

### 정책 확인
```sql
-- 현재 정책 상태 확인
SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public';
```

## 마이그레이션 후 확인사항

1. ✅ 모든 테이블에 RLS 활성화 확인
2. ✅ 정책 이름이 명확하고 중복 없음 확인
3. ✅ 함수 권한 정상 작동 확인
4. ✅ 기존 애플리케이션 정상 작동 확인
5. ✅ 데이터 무결성 검증 통과 확인

## 완료
이 마이그레이션을 통해 데이터베이스 정책이 깔끔하게 정리되고, 향후 유지보수가 용이해집니다.