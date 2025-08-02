# Design Document

## Overview

로그인 후 "시스템을 준비하고 있습니다..." 메시지와 함께 무한 로딩 상태에 빠지는 문제를 해결하기 위한 설계입니다. 현재 코드 분석 결과, 로그인 성공 후 리다이렉션 로직이 여러 곳에 분산되어 있고, 인증 상태 변경과 페이지 리다이렉션 간의 타이밍 문제가 발생하고 있습니다.

## Architecture

### 현재 문제점 분석

1. **리다이렉션 로직 분산**: 로그인 후 리다이렉션이 `LoginForm.tsx`, `useAuth.ts`, `useAuthNavigation.ts` 등 여러 곳에서 처리됨
2. **타이밍 문제**: 인증 상태 업데이트와 리다이렉션 간의 경쟁 조건(race condition) 발생
3. **중복 리다이렉션**: `window.location.href`와 `router.push` 혼용으로 인한 충돌
4. **로딩 상태 관리**: 페이지 간 전환 시 로딩 상태가 적절히 해제되지 않음

### 해결 방안 아키텍처

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   LoginForm     │───▶│  useAuth Hook    │───▶│  Page Content   │
│                 │    │                  │    │                 │
│ - 로그인 요청    │    │ - 인증 상태 관리  │    │ - 조건부 렌더링  │
│ - 로딩 상태     │    │ - 세션 초기화    │    │ - 리다이렉션     │
│ - 에러 처리     │    │ - 상태 변경 감지  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Centralized     │    │ Auth State       │    │ Navigation      │
│ Error Handler   │    │ Manager          │    │ Controller      │
│                 │    │                  │    │                 │
│ - 통합 에러 처리 │    │ - 단일 상태 소스  │    │ - 중앙화된 라우팅│
│ - 사용자 피드백  │    │ - 상태 동기화    │    │ - 타임아웃 처리  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Components and Interfaces

### 1. Enhanced Authentication Hook (useAuth)

```typescript
interface AuthState {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  authStatus: 'loading' | 'authenticated' | 'unauthenticated';
  initialized: boolean;
}

interface AuthActions {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  refreshAuth: () => Promise<void>;
}
```

### 2. Navigation Controller

```typescript
interface NavigationController {
  handlePostLoginRedirect: (userProfile: UserProfile) => void;
  handleAuthTimeout: () => void;
  getRedirectPath: (userProfile: UserProfile) => string;
  clearRedirectState: () => void;
}
```

### 3. Loading State Manager

```typescript
interface LoadingStateManager {
  setLoadingState: (state: LoadingState) => void;
  clearLoadingState: () => void;
  isTimeout: () => boolean;
  getLoadingMessage: () => string;
}

type LoadingState = 
  | 'initializing'
  | 'authenticating' 
  | 'redirecting'
  | 'timeout'
  | 'error';
```

## Data Models

### Enhanced User Profile

```typescript
interface UserProfile {
  id: string;
  authId: string;
  dbId?: number;
  employeeId?: string;
  email: string;
  name: string;
  department: string;
  role: 'employee' | 'admin';
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string; // 새로 추가
  preferredLandingPage?: string; // 새로 추가
}
```

### Auth Navigation State

```typescript
interface AuthNavigationState {
  isRedirecting: boolean;
  redirectPath: string | null;
  redirectReason: 'login' | 'logout' | 'timeout' | 'error';
  timestamp: number;
}
```

## Error Handling

### 1. Centralized Error Handler

```typescript
interface AuthError {
  type: 'network' | 'auth' | 'timeout' | 'redirect' | 'unknown';
  message: string;
  code?: string;
  recoverable: boolean;
  retryAction?: () => void;
}

interface ErrorHandler {
  handleAuthError: (error: AuthError) => void;
  showUserFriendlyMessage: (error: AuthError) => void;
  logError: (error: AuthError) => void;
  getRecoveryOptions: (error: AuthError) => RecoveryOption[];
}
```

### 2. Timeout Management

- 로그인 프로세스: 10초 타임아웃
- 리다이렉션 프로세스: 5초 타임아웃
- 인증 상태 확인: 15초 타임아웃

### 3. Fallback Mechanisms

1. **Primary**: 정상적인 리다이렉션 (`router.push`)
2. **Secondary**: 강제 페이지 이동 (`window.location.href`)
3. **Tertiary**: 사용자 수동 액션 (새로고침 버튼 제공)

## Testing Strategy

### 1. Unit Tests

- `useAuth` 훅의 상태 변경 로직
- 리다이렉션 경로 결정 로직
- 에러 처리 및 복구 메커니즘
- 타임아웃 처리

### 2. Integration Tests

- 로그인 플로우 전체 과정
- 인증 상태 변경과 UI 업데이트 동기화
- 다양한 사용자 역할별 리다이렉션
- 네트워크 오류 시나리오

### 3. E2E Tests

- 실제 로그인부터 메인 페이지 도달까지
- 브라우저 뒤로가기 버튼 시나리오
- 다양한 네트워크 조건에서의 동작
- 모바일 환경에서의 동작

### 4. Performance Tests

- 로그인 후 리다이렉션 시간 측정
- 메모리 누수 검사
- 불필요한 리렌더링 최소화

## Implementation Phases

### Phase 1: Core Authentication Fix
- `useAuth` 훅 리팩토링
- 중앙화된 인증 상태 관리
- 기본 리다이렉션 로직 구현

### Phase 2: Enhanced Error Handling
- 통합 에러 처리 시스템
- 사용자 친화적 에러 메시지
- 복구 메커니즘 구현

### Phase 3: Advanced Features
- 타임아웃 관리
- 로딩 상태 개선
- 성능 최적화

### Phase 4: Testing & Monitoring
- 포괄적인 테스트 스위트
- 에러 모니터링 시스템
- 사용자 경험 메트릭 수집