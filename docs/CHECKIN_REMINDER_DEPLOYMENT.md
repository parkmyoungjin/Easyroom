# 🔔 체크인 알림 시스템 배포 가이드

## 📋 개요

이 문서는 Supabase pg_cron + Edge Function을 활용한 체크인 알림 시스템의 배포 및 운영 가이드입니다.

## 🚀 배포 단계

### 1. 사전 준비

#### 1.1 필수 도구 설치
```bash
# Supabase CLI 설치 확인
supabase --version

# 없다면 설치: https://supabase.com/docs/guides/cli
```

#### 1.2 VAPID 키 생성
```bash
# web-push 라이브러리로 VAPID 키 생성
npx web-push generate-vapid-keys
```

### 2. 데이터베이스 마이그레이션

```bash
# 프로젝트 루트에서 실행
supabase db push
```

**실행되는 마이그레이션:**
- `20250812000002_add_checkin_reminder_system.sql` - 스키마 확장
- `20250812000003_add_checkin_reminder_functions.sql` - PostgreSQL 함수
- `20250812000004_add_monitoring_system.sql` - 모니터링 시스템
- `20250812000005_add_testing_system.sql` - 테스트 시스템

### 3. 환경 변수 설정

```bash
# VAPID 키 설정
supabase secrets set VAPID_PUBLIC_KEY="YOUR_VAPID_PUBLIC_KEY"
supabase secrets set VAPID_PRIVATE_KEY="YOUR_VAPID_PRIVATE_KEY"
supabase secrets set VAPID_EMAIL="your-email@domain.com"

# 설정 확인
supabase secrets list
```

### 4. Edge Function 배포

```bash
# Edge Function 배포
supabase functions deploy send-checkin-reminders \
    --import-map supabase/functions/send-checkin-reminders/import_map.json \
    --no-verify-jwt

# 배포 확인
supabase functions list
```

### 5. 시스템 검증

#### 5.1 자동 검증
```sql
-- Supabase SQL Editor에서 실행
SELECT public.validate_checkin_reminder_system();
```

**예상 결과:**
```json
{
  "schema_ready": true,
  "indexes_ready": true,
  "cron_active": true,
  "push_users_available": true,
  "edge_function_callable": true,
  "required_functions_exist": true,
  "system_ready": true,
  "validated_at": "2025-08-11T13:00:00Z"
}
```

#### 5.2 통합 테스트
```sql
-- 통합 테스트 실행 (자동 정리 포함)
SELECT public.run_checkin_reminder_test();
```

## 📊 모니터링 및 운영

### 1. 실시간 대시보드

#### 1.1 시스템 상태 확인
```sql
SELECT * FROM public.system_status_dashboard;
```

#### 1.2 성능 통계 확인
```sql
SELECT * FROM public.checkin_reminder_performance;
```

#### 1.3 자동화 시스템 상태
```sql
SELECT public.get_automation_system_status();
```

### 2. 로그 확인

#### 2.1 Edge Function 로그
```bash
supabase functions logs send-checkin-reminders
```

#### 2.2 Cron 작업 로그
```sql
SELECT * FROM cron.job_run_details 
WHERE jobname = 'reservation-automation'
ORDER BY start_time DESC 
LIMIT 10;
```

#### 2.3 알림 발송 로그
```sql
SELECT * FROM public.notification_logs 
WHERE notification_type = 'checkin_reminder'
ORDER BY sent_at DESC 
LIMIT 20;
```

### 3. 수동 실행

#### 3.1 체크인 알림 수동 발송
```sql
SELECT public.trigger_checkin_reminders();
```

#### 3.2 전체 자동화 작업 수동 실행
```sql
SELECT public.run_reservation_automation();
```

## 🔧 문제 해결

### 1. 일반적인 문제

#### 1.1 Edge Function 호출 실패
```sql
-- 함수 존재 확인
SELECT * FROM supabase_functions.list();

-- 수동 테스트
SELECT public.trigger_checkin_reminders();
```

#### 1.2 VAPID 키 문제
```bash
# 설정 확인
supabase secrets list

# 재설정
supabase secrets set VAPID_PUBLIC_KEY="NEW_KEY"
```

#### 1.3 푸시 구독 문제
```sql
-- 활성 구독 확인
SELECT COUNT(*) FROM public.users 
WHERE push_subscription IS NOT NULL;

-- 알림 설정 확인
SELECT 
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE (notification_preferences->>'enabled')::boolean = TRUE) as enabled_users
FROM public.users 
WHERE push_subscription IS NOT NULL;
```

### 2. 성능 최적화

#### 2.1 인덱스 사용률 확인
```sql
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE indexname LIKE '%reminder%';
```

#### 2.2 쿼리 성능 분석
```sql
EXPLAIN ANALYZE 
SELECT * FROM public.get_pending_reminder_reservations();
```

## 📈 운영 메트릭

### 1. 핵심 지표

- **알림 성공률**: 95% 이상 유지
- **처리 시간**: 평균 5초 이내
- **대기 중인 알림**: 실시간 모니터링
- **시스템 가용성**: 99.9% 이상

### 2. 알림 설정

```sql
-- 알림 주기: 5분마다 (기존 cron 작업에 통합)
-- 알림 범위: 예약 시작 5-15분 전
-- 재시도: 실패 시 자동 로그 기록
```

## 🔄 업데이트 및 유지보수

### 1. Edge Function 업데이트
```bash
# 코드 수정 후 재배포
supabase functions deploy send-checkin-reminders \
    --import-map supabase/functions/send-checkin-reminders/import_map.json \
    --no-verify-jwt
```

### 2. 데이터베이스 함수 업데이트
```bash
# 마이그레이션 파일 수정 후
supabase db push
```

### 3. 정기 점검 항목

- [ ] 알림 성공률 확인
- [ ] Edge Function 로그 점검
- [ ] 데이터베이스 성능 확인
- [ ] VAPID 키 만료일 확인
- [ ] 사용자 푸시 구독 상태 점검

## 📞 지원 및 문의

시스템 관련 문의사항이나 문제가 발생한 경우:

1. 먼저 시스템 검증 실행: `SELECT public.validate_checkin_reminder_system();`
2. 로그 확인: `supabase functions logs send-checkin-reminders`
3. 모니터링 대시보드 확인: `SELECT * FROM public.system_status_dashboard;`

---

**배포 완료 후 이 문서를 팀과 공유하여 운영 가이드로 활용하세요.**