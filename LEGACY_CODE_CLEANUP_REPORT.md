# Legacy Supabase Code Cleanup Report

## 개요
이 보고서는 Supabase auth-helpers 리팩터링 과정에서 안전하게 제거할 수 있는 레거시 코드를 식별한 결과입니다.

## 현재 상태 분석

### ✅ 이미 올바르게 마이그레이션된 파일들
- `src/middleware.ts` - `createMiddlewareClient` 사용 (올바름)
- `src/lib/supabase/client.ts` - `createPagesBrowserClient` 사용 (올바름)
- `src/lib/supabase/server.ts` - `createServerComponentClient` 사용 (올바름)
- `src/lib/supabase/actions.ts` - `createRouteHandlerClient`, `createServerActionClient` 사용 (올바름)

### ⚠️ 아직 레거시 패턴을 사용하는 파일들

#### 1. 서버 컴포넌트/유틸리티 파일들
다음 파일들이 여전히 `@/lib/supabase/server`에서 `createClient`를 import하고 있습니다:

1. **`src/lib/security/user-id-guards-server.ts`**
   - 현재: `import { createClient } from '@/lib/supabase/server';`
   - 수정 필요: 이미 올바른 auth-helpers 기반 server.ts를 사용하므로 문제없음

2. **`src/lib/auth/server.ts`**
   - 현재: `import { createClient } from '@/lib/supabase/server'`
   - 수정 필요: 이미 올바른 auth-helpers 기반 server.ts를 사용하므로 문제없음

#### 2. API 라우트 파일들
다음 API 라우트들이 여전히 레거시 패턴을 사용하고 있습니다:

1. **`src/app/api/reservations/public-anonymous/route.validated.ts`**
   - 현재: `import { createClient } from '@/lib/supabase/server';`
   - 수정 필요: `createRouteClient` from actions.ts 사용해야 함

2. **`src/app/api/reservations/public/route.ts`**
   - 현재: `import { createClient } from '@/lib/supabase/server';`
   - 수정 필요: `createRouteClient` from actions.ts 사용해야 함

3. **`src/app/api/reservations/public-anonymous/route.ts`**
   - 현재: `import { createClient } from '@/lib/supabase/server';`
   - 수정 필요: `createRouteClient` from actions.ts 사용해야 함

#### 3. 타입 import 문제
1. **`src/app/api/health/detailed/route.ts`**
   - 현재: `import type { TypedSupabaseClient } from '@/lib/supabase/server';`
   - 수정 필요: 타입만 import하므로 문제없지만, actions.ts에서 import하는 것이 더 적절

### 🧪 테스트 파일들
다음 테스트 파일들이 `@supabase/ssr`을 직접 import하고 있습니다:

1. **`src/__tests__/security/authentication-authorization.test.ts`**
   - `import { createServerClient } from '@supabase/ssr';`
   - 테스트용이므로 mock 패턴 업데이트 필요

2. **`src/__tests__/middleware.test.ts`**
   - `import { createServerClient } from '@supabase/ssr';`
   - 테스트용이므로 mock 패턴 업데이트 필요

## 제거 대상 식별

### 🚫 제거할 수 없는 항목들
1. **`@supabase/ssr` 패키지 의존성**
   - `package.json`에서 제거할 수 없음
   - 이유: 현재 `src/lib/supabase/client.ts`가 `createBrowserClient`를 `@supabase/ssr`에서 import하고 있음
   - 참고: 문서에서는 `createPagesBrowserClient`를 사용하고 있지만, 실제로는 `@supabase/ssr`의 `createBrowserClient`를 사용할 수도 있음

2. **현재 helper 파일들**
   - `src/lib/supabase/server.ts` - 이미 올바르게 마이그레이션됨
   - `src/lib/supabase/client.ts` - 이미 올바르게 마이그레이션됨
   - `src/lib/supabase/actions.ts` - 이미 올바르게 마이그레이션됨

### ✅ 안전하게 제거할 수 있는 항목들

#### 1. 백업 파일들
현재 발견된 백업 파일은 없음 (이미 정리된 상태)

#### 2. 사용되지 않는 함수들
`src/lib/supabase/client.ts`에서:
- `createLegacyClient()` - deprecated 함수
- `supabase()` - deprecated 함수

이 함수들은 backward compatibility를 위해 유지되고 있지만, 실제 사용처를 확인 후 제거 가능

## 수정이 필요한 파일들

### 1. API 라우트 파일들 수정
다음 파일들의 import 구문을 수정해야 합니다:

```typescript
// 현재 (잘못된 패턴)
import { createClient } from '@/lib/supabase/server';

// 수정 후 (올바른 패턴)
import { createRouteClient } from '@/lib/supabase/actions';
```

**수정 대상 파일들:**
- `src/app/api/reservations/public-anonymous/route.validated.ts`
- `src/app/api/reservations/public/route.ts`
- `src/app/api/reservations/public-anonymous/route.ts`

### 2. 클라이언트 생성 코드 수정
API 라우트에서 클라이언트 생성 방식을 수정해야 합니다:

```typescript
// 현재 (잘못된 패턴)
const supabase = await createClient();

// 수정 후 (올바른 패턴)
const supabase = createRouteClient();
```

### 3. 테스트 파일 mock 패턴 업데이트
테스트 파일들의 mock 패턴을 auth-helpers 기반으로 업데이트해야 합니다.

## 검증 방법

### 1. 컴파일 검증
```bash
npx tsc --noEmit
```

### 2. 테스트 실행
```bash
npm test
```

### 3. 실제 기능 테스트
- 로그인/로그아웃
- 예약 조회 (인증/비인증)
- 예약 생성
- 관리자 기능

## 권장 작업 순서

1. **API 라우트 수정** (우선순위: 높음)
   - 현재 401 에러의 원인이 될 수 있는 파일들 수정
   
2. **테스트 파일 수정** (우선순위: 중간)
   - 테스트가 올바르게 실행되도록 mock 패턴 업데이트
   
3. **Deprecated 함수 제거** (우선순위: 낮음)
   - 실제 사용처 확인 후 backward compatibility 함수들 제거

## 주의사항

1. **점진적 제거**: 한 번에 모든 것을 제거하지 말고 단계적으로 진행
2. **철저한 테스트**: 각 단계마다 기능 테스트 수행
3. **롤백 준비**: 문제 발생 시 즉시 롤백할 수 있도록 백업 유지
4. **의존성 확인**: 파일 삭제 전 다른 파일에서의 참조 여부 재확인

## 결론

현재 대부분의 핵심 파일들이 이미 올바르게 마이그레이션되어 있습니다. 주요 작업은 몇 개의 API 라우트 파일들의 import 구문을 수정하는 것입니다. 실제로 "제거"해야 할 레거시 파일은 거의 없으며, 대부분 "수정"이 필요한 상황입니다.