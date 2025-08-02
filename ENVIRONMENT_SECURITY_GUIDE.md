# 환경 변수 보안 관리 가이드

## 개요

이 문서는 예약 시스템의 환경 변수 보안 관리 방법과 모범 사례를 설명합니다. EnvironmentSecurityManager를 통해 민감한 환경 변수에 대한 접근을 제어하고 감사하는 방법을 다룹니다.

## 환경 변수 분류

### 1. 공개 환경 변수 (Public Environment Variables)
클라이언트 사이드에서 접근 가능한 환경 변수입니다.

```typescript
const publicKeys = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NODE_ENV'
];
```

**사용 방법:**
```typescript
import { environmentManager } from '@/lib/security/environment-manager';

const supabaseUrl = environmentManager.getPublicKey('NEXT_PUBLIC_SUPABASE_URL');
```

### 2. 서버 전용 환경 변수 (Server-Only Environment Variables)
서버 사이드에서만 접근 가능한 환경 변수입니다.

```typescript
const serverKeys = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NODE_ENV'
];
```

**사용 방법:**
```typescript
const anonKey = environmentManager.getServerKey('NEXT_PUBLIC_SUPABASE_ANON_KEY');
```

### 3. 서비스 역할 키 (Service Role Key)
가장 민감한 환경 변수로, 관리자 기능에서만 사용 가능합니다.

**사용 방법:**
```typescript
import { getServiceRoleKey } from '@/lib/security/environment-manager';

const serviceKey = getServiceRoleKey({
  caller: 'createAdminClient',
  endpoint: '/api/admin/users',
  userId: 'user123'
});
```

## 환경별 설정

### 개발 환경 (Development)

**.env.local 예시:**
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Environment
NODE_ENV=development

# Development Tools (선택사항)
NEXTAUTH_URL=http://localhost:3000
```

**개발 환경 특징:**
- 환경 변수 검증 실패 시 경고만 출력하고 계속 진행
- 로컬 Supabase 인스턴스 사용 시 네트워크 연결 확인 권장
- NEXTAUTH_URL 설정 권장

### 프로덕션 환경 (Production)

**프로덕션 환경 요구사항:**
- HTTPS URL 필수
- 서비스 역할 키 필수
- 개발용 기본값 사용 금지
- 환경 변수 검증 실패 시 애플리케이션 종료

**보안 검증 항목:**
```typescript
// 1. HTTPS 검증
if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
  errors.push('프로덕션 환경에서는 HTTPS URL이 필요합니다');
}

// 2. 서비스 키와 익명 키 동일성 검증
if (serviceKey === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  errors.push('서비스 역할 키와 익명 키가 동일합니다. 보안상 위험합니다');
}

// 3. 개발용 기본값 검증
const devDefaults = [
  'your_supabase_url_here',
  'your_supabase_anon_key_here',
  'your_service_role_key_here'
];
```

### 테스트 환경 (Test)

**테스트 환경 권장사항:**
- 테스트용 Supabase 프로젝트 사용
- 실제 키 대신 모의 값 사용 권장
- 테스트 데이터베이스 분리

## 보안 기능

### 1. 접근 제어 (Access Control)

**서비스 역할 키 접근 제한:**
```typescript
private isAuthorizedCaller(caller: string): boolean {
  const authorizedCallers = [
    'createAdminClient',
    'admin-api',
    'user-management',
    'system-maintenance'
  ];
  return authorizedCallers.includes(caller);
}

private isAdminEndpoint(endpoint: string): boolean {
  return endpoint.startsWith('/api/admin/') || endpoint.includes('admin');
}
```

### 2. 감사 로깅 (Audit Logging)

**접근 기록 관리:**
```typescript
interface EnvironmentAccessContext {
  caller: string;
  endpoint?: string;
  userId?: string;
  timestamp: Date;
}
```

**로그 보안:**
- 사용자 ID는 `[REDACTED]`로 마스킹
- 최근 100개 접근 기록만 메모리에 유지
- 모든 서비스 역할 키 접근 기록

### 3. 유효성 검증 (Validation)

**시작 시 검증:**
```typescript
// 애플리케이션 시작 시 자동 검증
const validationResult = environmentManager.validateEnvironment();

if (!validationResult.valid) {
  // 프로덕션: 프로세스 종료
  // 개발: 경고 출력 후 계속
}
```

**검증 항목:**
- 필수 환경 변수 존재 여부
- URL 형식 유효성
- 키 길이 검증
- 환경별 특정 요구사항

## 모범 사례

### 1. 환경 변수 설정

**DO:**
- 환경별로 적절한 값 설정
- 프로덕션에서 HTTPS URL 사용
- 서비스 역할 키와 익명 키 분리
- 정기적인 키 로테이션

**DON'T:**
- 개발용 기본값을 프로덕션에서 사용
- 서비스 역할 키를 클라이언트에서 사용
- 환경 변수를 코드에 하드코딩
- 민감한 키를 버전 관리에 포함

### 2. 코드에서 사용

**올바른 사용:**
```typescript
// 공개 환경 변수
const url = environmentManager.getPublicKey('NEXT_PUBLIC_SUPABASE_URL');

// 서비스 역할 키 (관리자 기능에서만)
const serviceKey = getServiceRoleKey({
  caller: 'createAdminClient',
  endpoint: '/api/admin/users'
});
```

**잘못된 사용:**
```typescript
// 직접 process.env 접근 (권장하지 않음)
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 비관리자 엔드포인트에서 서비스 키 사용
const serviceKey = getServiceRoleKey({
  caller: 'publicAPI',
  endpoint: '/api/reservations/public'
}); // 오류 발생
```

### 3. 배포 시 고려사항

**Vercel 배포:**
```bash
# 환경 변수 설정
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
```

**Docker 배포:**
```dockerfile
# 환경 변수를 빌드 시점에 주입하지 않음
# 런타임에 환경 변수 제공
ENV NODE_ENV=production
```

## 문제 해결

### 일반적인 오류

**1. 환경 변수 누락:**
```
필수 환경 변수 NEXT_PUBLIC_SUPABASE_URL가 설정되지 않았습니다
```
**해결:** `.env.local` 파일에 해당 환경 변수 추가

**2. 서비스 역할 키 접근 거부:**
```
서비스 역할 키에 대한 접근 권한이 없습니다
```
**해결:** 승인된 호출자인지 확인하고 관리자 엔드포인트에서만 사용

**3. URL 형식 오류:**
```
NEXT_PUBLIC_SUPABASE_URL이 유효한 URL 형식이 아닙니다
```
**해결:** 올바른 URL 형식으로 수정 (예: https://project.supabase.co)

### 디버깅

**환경 변수 검증 상태 확인:**
```typescript
import { environmentManager } from '@/lib/security/environment-manager';

const result = environmentManager.validateEnvironment();
console.log('검증 결과:', result);
```

**서비스 역할 키 접근 로그 확인:**
```typescript
const accessLog = environmentManager.getServiceRoleAccessLog();
console.log('접근 기록:', accessLog);
```

## 보안 업데이트

### 정기 점검 항목

1. **환경 변수 로테이션** (월 1회)
   - Supabase 키 재생성
   - 새 키로 환경 변수 업데이트

2. **접근 로그 검토** (주 1회)
   - 비정상적인 접근 패턴 확인
   - 승인되지 않은 호출자 탐지

3. **보안 설정 검토** (분기 1회)
   - 새로운 보안 요구사항 적용
   - 환경별 설정 최적화

### 보안 인시던트 대응

**서비스 역할 키 노출 시:**
1. 즉시 Supabase에서 키 비활성화
2. 새 키 생성 및 환경 변수 업데이트
3. 접근 로그 검토 및 영향 범위 파악
4. 보안 패치 적용

**환경 변수 검증 실패 시:**
1. 오류 메시지 확인
2. 환경별 요구사항 검토
3. 설정 수정 후 재배포
4. 모니터링 강화

이 가이드를 따라 환경 변수를 안전하게 관리하고, 정기적으로 보안 설정을 검토하여 시스템의 보안성을 유지하세요.