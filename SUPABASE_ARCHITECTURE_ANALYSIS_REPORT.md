# Supabase 아키텍처 재정립을 위한 최종 애플리케이션 분석 보고서

**TO:** 대표님  
**RE:** Supabase 아키텍처 재정립을 위한 최종 애플리케이션 전체 분석 보고서  
**작성일:** 2025년 2월 8일

---

## 📋 목표

현재 애플리케이션의 전체 코드베이스와 데이터베이스 스키마를 분석하여, 분산되고 비효율적이거나, 과거의 유산(Legacy)으로 남아있는 Supabase 관련 로직(RLS, RPC 등)을 **"하나의 통일된 아키텍처 원칙"**에 따라 재설계하고 재정립합니다.

---

## 1. 데이터베이스의 '완벽한 청사진' (The Single Source of Truth)

### 1.1 현재 데이터베이스 스키마 분석

#### 📊 테이블 구조
```sql
-- 핵심 테이블 3개
1. users (사용자 관리)
   - id (UUID, PK)
   - auth_id (UUID, UNIQUE) ← Supabase Auth와 연결
   - email, name, department, role
   - employee_id (선택적)

2. rooms (회의실 관리)  
   - id (UUID, PK)
   - name, capacity, description, location
   - amenities (JSONB)
   - is_active (boolean)

3. reservations (예약 관리)
   - id (UUID, PK)
   - user_id (FK → users.id) ← 중요: auth_id가 아닌 DB ID 참조
   - room_id (FK → rooms.id)
   - title, purpose, start_time, end_time
   - status (confirmed/cancelled)
```

#### 🔧 RPC 함수 현황 (8개)
```sql
1. get_or_create_user_profile() → 원자적 사용자 프로필 생성/조회
2. get_current_user_info() → 현재 사용자 정보 조회
3. get_available_time_slots(room_id, date) → 예약 가능 시간 슬롯
4. get_booked_slots_for_timeline(room_id, date) → 타임라인용 예약 슬롯
5. get_public_reservations(start_date, end_date, limit, offset) → 공개 예약 목록
6. get_user_reservations_detailed(user_id, limit, offset) → 사용자별 상세 예약
7. check_email_exists(email) → 이메일 중복 확인
8. handle_new_user() → 신규 사용자 자동 프로필 생성 (트리거)
```

#### 🛡️ RLS 정책 현황
```sql
-- users 테이블
- users_select_all: 모든 사용자가 전체 사용자 목록 조회 가능
- users_insert_own: 자신의 프로필만 생성 가능
- users_update_own: 자신의 프로필만 수정 가능

-- rooms 테이블  
- rooms_select_active: 활성 회의실만 조회 가능
- rooms_admin_full_access: 관리자는 모든 회의실 관리 가능

-- reservations 테이블
- reservations_select_public_or_own: 확정된 예약 또는 자신의 예약만 조회
- reservations_insert_own: 자신의 예약만 생성 가능
- reservations_update_own: 자신의 예약만 수정 가능
- reservations_delete_own: 자신의 예약만 삭제 가능
```

### 1.2 데이터베이스 아키텍처 강점
✅ **원자적 프로필 관리**: `get_or_create_user_profile` RPC로 사용자 생성/조회 통합  
✅ **효율적인 시간 슬롯 조회**: 전용 RPC 함수로 성능 최적화  
✅ **적절한 RLS 보안**: 사용자별 데이터 접근 제어 구현  
✅ **실시간 동기화**: Realtime 구독으로 예약 상태 실시간 반영

### 1.3 개선이 필요한 영역
⚠️ **ID 참조 혼재**: auth_id vs DB ID 사용이 일관되지 않음  
⚠️ **RPC 함수 활용도**: 일부 복잡한 쿼리가 클라이언트에서 처리됨  
⚠️ **에러 처리**: RPC 실패 시 fallback 로직이 산재되어 있음

---

## 2. Supabase 클라이언트 상호작용의 모든 경로 (The Pipelines)

### 2.1 인증 및 세션 관리 (The Gatekeeper)

#### 🔐 인증 아키텍처 구조
```typescript
// 계층 구조
1. middleware.ts → 라우트 보호 (서버사이드)
2. SupabaseProvider.tsx → 클라이언트 인스턴스 제공
3. AuthContext.tsx → 인증 상태 관리 (단일 관문)
4. useAuth.ts → 인증 작업 (로그인/로그아웃/회원가입)
```

#### 🎯 핵심 인증 플로우
```typescript
// 1. 단일 관문 아키텍처 (AuthContext.tsx)
- onAuthStateChange 리스너 → 모든 인증 상태 변경 감지
- get_or_create_user_profile RPC → 원자적 프로필 관리
- 방어적 렌더링 → 언마운트 시 상태 업데이트 방지

// 2. 인증 방식 (useAuth.ts)
- Magic Link 로그인 (기존 사용자)
- OTP 코드 인증 (6자리 숫자)
- 즉시 회원가입 (임시 비밀번호 → 즉시 로그아웃)
```

#### ✅ 인증 시스템 강점
- **단일 진실 공급원**: AuthContext가 모든 인증 상태 중앙 관리
- **원자적 프로필 생성**: RPC 함수로 사용자 생성 시 트랜잭션 보장
- **안전한 라우트 보호**: middleware.ts에서 서버사이드 검증

#### ⚠️ 개선 필요 영역
- **에러 처리 복잡성**: useAuth.ts에서 다양한 에러 케이스 개별 처리
- **타입 안전성**: 일부 auth 관련 타입이 any로 처리됨

### 2.2 데이터 조회 (The Query Pipelines)

#### 📊 React Query 기반 데이터 관리
```typescript
// 핵심 훅 구조
1. useReservations.ts → 예약 관련 모든 쿼리/뮤테이션
2. useRooms.ts → 회의실 관련 쿼리/뮤테이션
3. 실시간 동기화 → Supabase Realtime 구독
```

#### 🔄 쿼리 최적화 패턴
```typescript
// 쿼리 키 팩토리 패턴
const reservationKeys = {
  all: ['reservations'],
  public: (startDate, endDate, isAuth) => ['reservations', 'public', startDate, endDate, 'auth', isAuth],
  my: (userId) => ['reservations', 'my', userId],
  withDetails: (startDate, endDate) => ['reservations', 'withDetails', startDate, endDate]
}

// 실시간 동기화
- PostgreSQL 변경 감지 → 캐시 수동 업데이트
- 날짜 범위 필터링 → 서버사이드에서 관련 데이터만 수신
```

#### ✅ 데이터 조회 강점
- **체계적인 캐시 관리**: 쿼리 키 팩토리로 일관된 캐시 키 생성
- **실시간 동기화**: Realtime 구독으로 즉시 UI 업데이트
- **RPC 활용**: 복잡한 쿼리를 데이터베이스에서 처리

#### ⚠️ 개선 필요 영역
- **Fallback 로직 산재**: RPC 실패 시 대체 쿼리가 각 훅에 분산
- **에러 경계 부족**: 일부 쿼리 실패가 전체 UI에 영향

### 2.3 서비스 계층 (The Abstraction Layer)

#### 🏗️ 서비스 아키텍처
```typescript
// reservationService 구조
1. 직접 Supabase 쿼리 → 단순한 CRUD 작업
2. API 라우트 호출 → 복잡한 비즈니스 로직 (getPublicReservations)
3. RPC 우선 → 성능이 중요한 작업 (getMyReservationsOptimized)

// roomService 구조  
1. 싱글톤 패턴 → 인스턴스 재사용
2. 타입 안전성 → TypedSupabaseClient 사용
3. 관리자 권한 → 권한 체크는 호출부에서 처리
```

#### ✅ 서비스 계층 강점
- **책임 분리**: 각 서비스가 명확한 도메인 담당
- **타입 안전성**: TypeScript로 강타입 보장
- **에러 처리**: 일관된 에러 로깅 및 사용자 친화적 메시지

#### ⚠️ 개선 필요 영역
- **일관성 부족**: reservationService는 클래스가 아닌 객체, roomService는 싱글톤 클래스
- **권한 체크 분산**: 관리자 권한 확인이 각 호출부에 분산되어 있음

---

## 3. 핵심 UI 컴포넌트 (The Consumers)

### 3.1 예약 폼 (ReservationForm.tsx)

#### 🎯 핵심 기능
```typescript
// 통합 폼 (생성/수정 모드)
- 동적 시간 슬롯 → useBookedSlots로 실시간 충돌 검사
- 권한 기반 수정 → canEditReservation 유틸리티 사용
- 에러 처리 → ReservationErrorHandler로 통합 처리
```

#### ✅ 강점
- **모드 통합**: 하나의 컴포넌트로 생성/수정 처리
- **실시간 검증**: 시간 슬롯 충돌을 실시간으로 확인
- **사용자 경험**: 직관적인 시간 선택 UI

#### ⚠️ 개선 필요
- **복잡성**: 단일 컴포넌트에 너무 많은 로직 집중
- **상태 관리**: 폼 상태와 서버 상태 동기화 복잡

### 3.2 캘린더 뷰 (GoogleCalendarView.tsx)

#### 🎨 드래그 앤 드롭 시스템
```typescript
// DnD Kit 기반 구현
1. DraggableReservationBlock → 개별 예약 블록
2. DroppableDayColumn → 요일별 드롭 영역  
3. 충돌 검사 → 실시간 시간 겹침 확인
4. 업데이트 → useUpdateReservation으로 즉시 반영
```

#### ✅ 강점
- **직관적 UX**: 드래그로 예약 시간 변경 가능
- **실시간 동기화**: 변경사항 즉시 모든 사용자에게 반영
- **충돌 방지**: 드롭 전 시간 겹침 검사

#### ⚠️ 개선 필요
- **성능**: 많은 예약 시 렌더링 성능 저하 가능
- **접근성**: 키보드 네비게이션 지원 부족

### 3.3 대시보드 (ReservationDashboard.tsx)

#### 📊 실시간 현황 표시
```typescript
// 핵심 기능
1. 현재 진행 중인 회의 표시
2. 오늘 일정 타임라인
3. 실시간 데이터 동기화
4. 반응형 레이아웃
```

#### ✅ 강점
- **실시간성**: 1분마다 현재 시간 업데이트
- **직관적 표시**: 현재 상황을 한눈에 파악 가능
- **에러 처리**: 데이터 로딩 실패 시 적절한 fallback

### 3.4 상세 다이얼로그 (ReservationDetailDialog.tsx)

#### 🔍 예약 상세 정보
```typescript
// 권한 기반 기능
1. 예약 정보 표시
2. 수정/취소 버튼 (권한 있는 경우만)
3. 시간 제한 검사 (10분 전까지만 수정/취소 가능)
```

#### ✅ 강점
- **권한 제어**: 사용자별 적절한 기능 제공
- **시간 제한**: 비즈니스 규칙 준수
- **사용자 경험**: 명확한 정보 표시

---

## 4. 아키텍처 분석 결과 및 재정립 방향

### 4.1 현재 아키텍처의 강점

#### ✅ 잘 구현된 영역
1. **원자적 프로필 관리**: RPC 기반 트랜잭션 보장
2. **실시간 동기화**: Supabase Realtime 효과적 활용
3. **타입 안전성**: TypeScript 기반 강타입 시스템
4. **보안**: RLS 정책으로 적절한 데이터 접근 제어
5. **사용자 경험**: 직관적인 드래그 앤 드롭, 실시간 업데이트

### 4.2 개선이 필요한 핵심 영역

#### ⚠️ 아키텍처 일관성 문제
```typescript
// 1. ID 참조 혼재
- 일부는 auth_id 사용, 일부는 DB ID 사용
- 타입 정의에서 authId vs dbId 혼용

// 2. 서비스 패턴 불일치  
- reservationService: 객체 리터럴
- roomService: 싱글톤 클래스

// 3. 에러 처리 분산
- RPC fallback 로직이 각 훅에 분산
- 에러 타입별 처리가 일관되지 않음
```

#### ⚠️ 성능 최적화 기회
```typescript
// 1. 쿼리 중복
- 동일한 데이터를 여러 방식으로 조회
- 캐시 무효화가 과도하게 광범위

// 2. RPC 활용도
- 복잡한 쿼리가 클라이언트에서 처리되는 경우 존재
- 데이터베이스 레벨 최적화 기회 미활용
```

### 4.3 재정립 우선순위

#### 🎯 1순위: 아키텍처 통일
1. **ID 참조 표준화**: 모든 곳에서 일관된 ID 참조 방식 사용
2. **서비스 패턴 통일**: 모든 서비스를 동일한 패턴으로 구현
3. **에러 처리 중앙화**: 공통 에러 처리 시스템 구축

#### 🎯 2순위: 성능 최적화
1. **RPC 함수 확장**: 복잡한 쿼리를 데이터베이스로 이관
2. **캐시 전략 개선**: 더 정밀한 캐시 무효화 전략
3. **쿼리 최적화**: 중복 쿼리 제거 및 배치 처리

#### 🎯 3순위: 개발자 경험 개선
1. **타입 안전성 강화**: 더 엄격한 타입 정의
2. **디버깅 도구**: 개발 환경에서의 디버깅 지원 강화
3. **문서화**: 아키텍처 결정사항 문서화

---

## 5. 구체적인 재정립 실행 계획

### 5.1 Phase 1: 기반 통일 (2주)
```typescript
// 1. ID 참조 표준화
- 모든 타입에서 authId/dbId 명확히 구분
- 서비스 함수에서 일관된 ID 사용

// 2. 서비스 패턴 통일
- 모든 서비스를 클래스 기반으로 통일
- 공통 베이스 클래스 도입

// 3. 에러 처리 중앙화
- 공통 에러 처리 클래스 구현
- 모든 서비스에서 동일한 에러 처리 패턴 사용
```

### 5.2 Phase 2: 성능 최적화 (3주)
```sql
-- 1. RPC 함수 확장
CREATE OR REPLACE FUNCTION get_dashboard_data(p_date date)
RETURNS jsonb AS $$
-- 대시보드에 필요한 모든 데이터를 한 번에 조회
$$;

-- 2. 복합 쿼리 RPC화
CREATE OR REPLACE FUNCTION get_calendar_view_data(
  p_start_date date, 
  p_end_date date
) RETURNS jsonb AS $$
-- 캘린더 뷰에 필요한 모든 데이터를 한 번에 조회
$$;
```

### 5.3 Phase 3: 개발자 경험 개선 (1주)
```typescript
// 1. 타입 안전성 강화
interface StrictUserProfile {
  authId: string;  // 항상 문자열
  dbId: string;    // 항상 문자열
  // ... 기타 필드
}

// 2. 디버깅 도구
class SupabaseDebugger {
  static logQuery(operation: string, params: any) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Supabase] ${operation}`, params);
    }
  }
}
```

---

## 6. 결론 및 권고사항

### 6.1 현재 상태 평가
현재 Supabase 아키텍처는 **기능적으로는 완전하고 안정적**이지만, **일관성과 최적화 측면에서 개선의 여지**가 있습니다. 특히 빠른 개발 과정에서 생긴 패턴의 불일치와 성능 최적화 기회를 놓친 부분들이 발견됩니다.

### 6.2 재정립의 필요성
1. **유지보수성 향상**: 일관된 패턴으로 새로운 개발자의 학습 곡선 단축
2. **성능 개선**: 데이터베이스 레벨 최적화로 응답 속도 향상
3. **확장성 확보**: 향후 기능 추가 시 아키텍처 부채 방지

### 6.3 최종 권고
**점진적 개선 방식**을 권장합니다. 현재 시스템이 안정적으로 운영되고 있으므로, 한 번에 모든 것을 바꾸기보다는 위에서 제시한 3단계 계획에 따라 단계적으로 개선하는 것이 리스크를 최소화하면서도 목표를 달성할 수 있는 최적의 방법입니다.

---

**보고서 작성자**: Kiro AI Assistant  
**검토 완료일**: 2025년 2월 8일  
**다음 단계**: Phase 1 실행 계획 수립 및 착수