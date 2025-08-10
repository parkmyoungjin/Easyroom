# 체크인/체크아웃 시스템 구현 가이드

## 📋 개요

회의실 예약 시스템에 실시간 체크인/체크아웃 기능을 추가하여 회의실 사용률을 높이고 "No-Show" 문제를 효과적으로 관리하는 시스템입니다.

## 🎯 주요 기능

### Phase 1: MVP - 핵심 체크인/아웃 및 상태 추적

- ✅ **수동 체크인/체크아웃**: 앱 내 버튼을 통한 체크인/체크아웃
- ✅ **자동화 시스템**: pg_cron을 활용한 자동 상태 관리
- ✅ **실시간 상태 추적**: 예약 상태 실시간 업데이트
- ✅ **기본 통계**: 관리자용 사용률 및 No-Show 통계

## 🚀 설치 및 설정

### 1. 마이그레이션 실행

```bash
# 체크인/체크아웃 시스템 설치
npm run checkin:install

# 시스템 테스트
npm run checkin:test
```

### 2. 환경 변수 확인

`.env.local` 파일에 다음 변수들이 설정되어 있는지 확인:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. 개발 서버 재시작

```bash
npm run dev
```

## 📊 데이터베이스 스키마 변경사항

### 예약 상태 확장

```sql
-- 기존: 'confirmed', 'cancelled'
-- 추가: 'checked_in', 'completed', 'overtime', 'no_show'
ALTER TYPE reservation_status ADD VALUE 'checked_in';
ALTER TYPE reservation_status ADD VALUE 'completed';
ALTER TYPE reservation_status ADD VALUE 'overtime';
ALTER TYPE reservation_status ADD VALUE 'no_show';
```

### 새로운 컬럼

```sql
ALTER TABLE reservations 
ADD COLUMN checked_in_at TIMESTAMPTZ,
ADD COLUMN checked_out_at TIMESTAMPTZ;
```

## 🔧 API 함수

### 체크인/체크아웃 함수

- `check_in_reservation(reservation_id)`: 예약 체크인
- `check_out_reservation(reservation_id)`: 예약 체크아웃
- `get_reservation_checkin_status(reservation_id)`: 상태 조회

### 자동화 함수

- `run_reservation_automation()`: 수동 자동화 실행
- `auto_checkout_expired_reservations()`: 자동 체크아웃
- `mark_no_show_reservations()`: No-Show 처리
- `update_overtime_status()`: 연장 상태 업데이트

## 📈 통계 뷰

### 관리자용 뷰

- `room_usage_view`: 회의실별 사용률 통계
- `no_show_reservations_view`: No-Show 예약 목록
- `current_room_status_view`: 실시간 회의실 상태

## ⚙️ 자동화 스케줄

### Cron 작업

```sql
-- 매 5분마다 자동화 작업 실행
'*/5 * * * *' -> run_reservation_automation()

-- 매일 자정 정리 작업
'0 0 * * *' -> daily_reservation_cleanup()
```

### 자동화 규칙

1. **자동 체크아웃**: 예약 종료 시간 경과 시
2. **No-Show 처리**: 예약 시작 후 30분 미체크인 시
3. **연장 상태**: 예약 종료 시간 경과했지만 아직 사용 중인 경우

## 🎨 UI 컴포넌트

### 체크인/체크아웃 버튼

```tsx
import { CheckInOutButton } from '@/components/reservations/CheckInOutButton';

<CheckInOutButton
  reservationId={reservation.id}
  startTime={reservation.start_time}
  endTime={reservation.end_time}
  roomName={room.name}
/>
```

### 실시간 회의실 상태

```tsx
import { RoomStatusGrid } from '@/components/dashboard/RoomStatusGrid';

<RoomStatusGrid refreshInterval={30000} />
```

### 관리자 통계

```tsx
import { AdminStatistics } from '@/components/dashboard/AdminStatistics';

<AdminStatistics />
```

## 🔗 React Query 훅

### 기본 훅

```tsx
import { 
  useReservationStatus,
  useCheckIn,
  useCheckOut,
  useRoomStatus 
} from '@/hooks/useCheckInOut';

// 예약 상태 조회
const { data: status } = useReservationStatus(reservationId);

// 체크인/체크아웃
const checkInMutation = useCheckIn();
const checkOutMutation = useCheckOut();

// 실시간 회의실 상태
const { data: roomStatuses } = useRoomStatus();
```

### 관리자 훅

```tsx
import { 
  useRoomUsageStatistics,
  useNoShowReservations,
  useManualAutomation 
} from '@/hooks/useCheckInOut';
```

## 📱 사용자 플로우

### 일반 사용자

1. **예약 생성**: 기존과 동일
2. **체크인**: 예약 시작 30분 전부터 가능
3. **사용**: 회의실 사용
4. **체크아웃**: 수동 또는 자동 체크아웃
5. **완료**: 사용 완료 상태

### 시간 규칙

- **체크인 가능 시간**: 예약 시작 30분 전 ~ 시작 후 30분
- **자동 No-Show**: 시작 후 30분 미체크인 시
- **자동 체크아웃**: 예약 종료 시간 경과 시

## 🔍 모니터링 및 디버깅

### 로그 확인

```sql
-- 최근 자동화 실행 결과 확인
SELECT * FROM cron.job_run_details 
WHERE jobname = 'reservation-automation' 
ORDER BY run_start_time DESC LIMIT 10;
```

### 상태 확인

```sql
-- 현재 예약 상태 분포
SELECT status, COUNT(*) 
FROM reservations 
WHERE start_time >= CURRENT_DATE 
GROUP BY status;
```

## 🚨 문제 해결

### 일반적인 문제

1. **체크인 버튼이 보이지 않음**
   - 사용자 권한 확인 (본인 예약만 가능)
   - 예약 시간 확인 (체크인 가능 시간 내)

2. **자동화가 작동하지 않음**
   - Cron 작업 상태 확인: `SELECT * FROM cron.job`
   - 수동 실행 테스트: `SELECT run_reservation_automation()`

3. **실시간 업데이트가 안됨**
   - Supabase Realtime 설정 확인
   - 네트워크 연결 상태 확인

### 디버깅 명령어

```bash
# 시스템 테스트
npm run checkin:test

# Supabase 상태 확인
supabase status

# 로그 확인
supabase logs
```

## 🔮 향후 계획 (Phase 2, 3)

### Phase 2: 자동화 고도화
- 알림 시스템 (이메일/푸시)
- QR 코드 체크인
- 회의 연장 기능
- 관리자 대시보드 개선

### Phase 3: 동적 예약 시스템
- 조기 체크아웃 시 즉시 예약 가능
- 회의 연장 시 충돌 처리
- 위치 기반 체크인
- 오프라인 동기화

## 📞 지원

문제가 발생하거나 추가 기능이 필요한 경우:

1. GitHub Issues 생성
2. 로그 파일 첨부
3. 재현 단계 상세 기술

---

**참고**: 이 시스템은 기존 회의실 예약 시스템과 완전히 호환되며, 기존 기능에 영향을 주지 않습니다.