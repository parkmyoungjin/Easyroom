# Easyroom 프로바이더 구조 리팩토링 계획서

## 현재 프로바이더 구조 분석

### 1단계: 현재 프로바이더 중첩 구조

```
1. ClientPolyfillManager (enableServiceWorker=true, enablePWAComponents=true)
2. Providers
   2.1. StartupValidationProvider (skipValidation=true)
   2.2. MantineProvider (theme, defaultColorScheme="auto")
   2.3. QueryClientProvider
3. SupabaseProvider
4. AuthProvider (initialSession from server)
5. AppInitializer
6. AuthGatekeeper
   - {children}
   - AuthToastManager (sibling)
   - UpdateNotification (sibling)
   - GlobalNotification (sibling)
7. Toaster (outside AuthProvider)
```

### 2단계: 각 프로바이더 역할 및 책임 분석

#### **프로바이더 이름:** ClientPolyfillManager
- **주요 역할:** 브라우저 호환성 검사, 폴리필 로딩, PWA 컴포넌트 동적 로딩 관리
- **의존성:** 없음 (최상위)
- **문제점/개선점:** 복잡한 브라우저 호환성 로직이 있지만 실제로는 단순한 래퍼 역할. PWA 관련 컴포넌트들을 동적으로 로딩하는 기능이 있어 유지 필요.

#### **프로바이더 이름:** StartupValidationProvider
- **주요 역할:** 앱 시작 시 환경 변수 및 설정 검증
- **의존성:** 없음
- **문제점/개선점:** **현재 `skipValidation={true}`로 설정되어 실제로 아무 기능도 하지 않음. 완전히 제거 가능.**

#### **프로바이더 이름:** MantineProvider
- **주요 역할:** Mantine UI 라이브러리의 테마 및 스타일 시스템 제공
- **의존성:** 없음
- **문제점/개선점:** 필수 프로바이더. 위치는 적절함.

#### **프로바이더 이름:** QueryClientProvider
- **주요 역할:** React Query(TanStack Query) 클라이언트 제공, 서버 상태 관리
- **의존성:** 없음
- **문제점/개선점:** 필수 프로바이더. 위치는 적절함.

#### **프로바이더 이름:** SupabaseProvider
- **주요 역할:** Supabase 클라이언트 인스턴스를 생성하고 하위 컴포넌트에 제공
- **의존성:** 없음
- **문제점/개선점:** 매우 단순하고 효율적으로 구현됨. 유지 필요.

#### **프로바이더 이름:** AuthProvider
- **주요 역할:** Supabase 세션을 기반으로 사용자 인증 상태(user, userProfile)를 관리하고 하위 컴포넌트에 제공
- **의존성:** 반드시 `SupabaseProvider`의 하위에 있어야 함
- **문제점/개선점:** 잘 구현되어 있음. 서버에서 초기 세션을 받아 SSR 최적화도 되어 있음. 유지 필요.

#### **프로바이더 이름:** AppInitializer
- **주요 역할:** 앱 최초 시작 시 브랜딩 스플래시 화면 표시 (최소 5.4초 보장)
- **의존성:** 없음 (순수 타이머 로직)
- **문제점/개선점:** **단순한 스플래시 화면 로직으로 프로바이더가 아닌 일반 컴포넌트로 충분함. 프로바이더에서 제거하고 일반 컴포넌트로 변경 가능.**

#### **프로바이더 이름:** AuthGatekeeper
- **주요 역할:** 인증 상태에 따른 페이지 접근 권한 제어 및 라우팅 관리
- **의존성:** `AuthProvider`에 의존 (useAuthContext 사용)
- **문제점/개선점:** **복잡한 라우팅 로직이 클라이언트에서 실행됨. Next.js 미들웨어로 이전하면 더 효율적이고 보안성이 높아짐. 또는 각 페이지에서 개별적으로 처리하는 것이 더 명확할 수 있음.**

#### **기타 컴포넌트들:**
- **AuthToastManager, UpdateNotification, GlobalNotification:** 전역 UI 컴포넌트들로 프로바이더가 아님
- **Toaster:** Sonner 라이브러리의 토스트 컨테이너

## 3단계: 리팩토링 계획 수립

### 제거 대상 식별

1. **StartupValidationProvider** - 완전 제거
   - 현재 `skipValidation={true}`로 아무 기능도 하지 않음
   - 제거해도 기능에 전혀 영향 없음

2. **AppInitializer** - 프로바이더에서 제거
   - 단순한 스플래시 화면 로직
   - 프로바이더가 아닌 일반 컴포넌트로 충분
   - `layout.tsx`에서 직접 사용하도록 변경

3. **AuthGatekeeper** - 프로바이더에서 제거 (선택적)
   - 복잡한 클라이언트 사이드 라우팅 로직
   - Next.js 미들웨어로 이전하거나 각 페이지에서 개별 처리하는 것이 더 효율적

### 기능 이전 계획

#### StartupValidationProvider 제거
- **이전할 기능:** 없음 (현재 비활성화 상태)
- **영향받는 컴포넌트:** 없음
- **작업:** `providers.tsx`에서 해당 프로바이더 제거

#### AppInitializer 프로바이더 제거
- **이전할 기능:** 스플래시 화면 표시 로직
- **이전 위치:** `layout.tsx`에서 직접 사용
- **작업:** 
  1. `AppInitializer`를 일반 컴포넌트로 유지
  2. 프로바이더 중첩에서 제거하고 `layout.tsx`에서 직접 래핑

#### AuthGatekeeper 최적화 (Phase 2-3에서 진행)
- **이전할 기능:** 페이지 접근 권한 제어
- **이전 위치:** Next.js `middleware.ts` 또는 각 페이지 컴포넌트
- **작업:**
  1. 미들웨어에서 기본적인 인증 체크
  2. 각 페이지에서 세부적인 권한 체크
  3. AuthGatekeeper 제거

### 최종 목표 구조 설계

#### Phase 2-2 완료 후 (즉시 적용 가능):
```
1. ClientPolyfillManager
2. Providers
   2.1. MantineProvider
   2.2. QueryClientProvider
3. SupabaseProvider
4. AuthProvider
5. AppInitializer (일반 컴포넌트로 변경)
6. AuthGatekeeper (임시 유지)
   - {children}
   - AuthToastManager
   - UpdateNotification
   - GlobalNotification
7. Toaster
```

#### Phase 2-3 완료 후 (최종 목표):
```
1. ClientPolyfillManager
2. Providers
   2.1. MantineProvider
   2.2. QueryClientProvider
3. SupabaseProvider
4. AuthProvider
   - AppInitializer (일반 컴포넌트)
   - {children}
   - AuthToastManager
   - UpdateNotification
   - GlobalNotification
5. Toaster
```

## 4단계: 구체적 작업 계획

### Phase 2-2: 안전한 프로바이더 제거
1. **StartupValidationProvider 완전 제거**
   - `providers.tsx`에서 import 및 사용 제거
   - 관련 props 제거

2. **AppInitializer 프로바이더 해제**
   - 프로바이더 중첩에서 제거
   - `layout.tsx`에서 직접 사용하도록 변경
   - 기능은 그대로 유지

### Phase 2-3: 라우팅 최적화 (선택적)
1. **AuthGatekeeper 로직 분산**
   - 기본 인증 체크를 `middleware.ts`로 이전
   - 세부 권한 체크를 각 페이지로 이전
   - AuthGatekeeper 컴포넌트 제거

### 예상 효과

1. **성능 개선**
   - 불필요한 프로바이더 제거로 컴포넌트 트리 단순화
   - 렌더링 성능 향상
   - 번들 크기 감소

2. **코드 가독성 향상**
   - 프로바이더 중첩 깊이 감소
   - 각 프로바이더의 역할이 더 명확해짐

3. **유지보수성 향상**
   - 불필요한 추상화 제거
   - 더 직관적인 구조

### 위험 요소 및 대응 방안

1. **StartupValidationProvider 제거**
   - **위험:** 없음 (현재 비활성화 상태)
   - **대응:** 없음

2. **AppInitializer 변경**
   - **위험:** 스플래시 화면 동작 변경 가능성
   - **대응:** 철저한 테스트, 기능 동일성 확인

3. **AuthGatekeeper 제거 (Phase 2-3)**
   - **위험:** 인증 로직 누락 가능성
   - **대응:** 단계적 이전, 각 페이지별 테스트

## 결론

이 리팩토링 계획은 프로바이더 구조를 단순화하면서도 기능을 보존하는 것을 목표로 합니다. Phase 2-2에서는 안전하고 즉시 적용 가능한 변경사항을, Phase 2-3에서는 더 복잡하지만 장기적으로 유익한 변경사항을 다룰 예정입니다.