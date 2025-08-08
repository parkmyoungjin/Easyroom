# AuthGatekeeper → Middleware 리팩토링 계획서

## Phase 2-3: 라우팅 최적화를 위한 AuthGatekeeper 분석 및 미들웨어 설계

---

## 1단계: AuthGatekeeper.tsx 로직 완전 분해

### 현재 AuthGatekeeper의 책임과 로직

#### 1.1 인증 상태 관리
- **`authStatus === 'loading'`**: `<AuthLoadingUI />` 컴포넌트를 렌더링
- **로딩 UI 특징**: 
  - 다크모드 지원
  - 회전하는 스피너 애니메이션
  - "인증 확인 중..." 텍스트 표시
  - `fixed inset-0 z-[100]`로 전체 화면 덮음

#### 1.2 라우팅 제어 로직 (useEffect 내부)

**공개 경로 정의:**
```typescript
const publicRoutes = ['/welcome', '/login', '/signup', '/reservations/status'];
const authRoutes = ['/welcome', '/login', '/signup'];
```

**규칙 1 - 비로그인 사용자 제어:**
- `authStatus === 'unauthenticated'`일 때
- 현재 경로가 `publicRoutes`에 없고, `/kiosk`로 시작하지 않으면
- `/welcome`으로 리다이렉트

**규칙 2 - 로그인 사용자의 인증 페이지 접근 제어:**
- `authStatus === 'authenticated'`일 때
- 현재 경로가 `/` (루트) 또는 `authRoutes`에 포함되면
- `/dashboard`로 리다이렉트

**규칙 3 - 관리자 권한 제어:**
- `authStatus === 'authenticated'`일 때
- 현재 경로가 `/admin`으로 시작하는데 `userProfile?.role !== 'admin'`이면
- `/dashboard`로 리다이렉트

#### 1.3 최종 렌더링
- 인증 로딩이 완료되면 `{children}` 렌더링
- 각 페이지가 자체적으로 데이터 로딩 처리

---

## 2단계: 로직 이전 계획 수립

### 2.1 이전 계획표

| 기존 로직 (in AuthGatekeeper) | 이전 위치 | 이유 |
|:---|:---|:---|
| `authStatus === 'loading'`일 때 `<AuthLoadingUI />` 표시 | **유지 (layout.tsx 또는 새로운 클라이언트 컴포넌트)** | 미들웨어는 UI를 렌더링할 수 없음. 복잡한 애니메이션과 다크모드 지원 필요. |
| 비로그인 사용자의 보호된 페이지 접근 차단 | **미들웨어 (middleware.ts)** | 페이지 렌더링 전에 빠르게 차단하여 성능 향상. 서버 사이드에서 처리 가능. |
| 로그인 사용자의 공개 페이지 접근 시 리다이렉트 | **미들웨어 (middleware.ts)** | 불필요한 페이지 로딩을 막아 UX 개선. 단순한 세션 확인만으로 처리 가능. |
| 'admin' 역할 기반의 `/admin` 경로 접근 제어 | **미들웨어 (middleware.ts)** | 역할 기반 라우팅 제어에 가장 적합. userProfile 데이터 필요하지만 캐시 활용 가능. |
| `/kiosk` 경로의 특별 처리 | **미들웨어 (middleware.ts)** | 공개 접근 허용 로직을 미들웨어에서 처리. |
| 복잡한 UI 상태 관리 (로딩 스피너, 애니메이션) | **유지 (새로운 AuthLoadingWrapper 컴포넌트)** | 미들웨어는 UI 렌더링 불가. 클라이언트 사이드에서 처리 필요. |

### 2.2 성능 최적화 효과 예상

**미들웨어로 이전 시 장점:**
1. **빠른 실패(Fail Fast)**: 페이지 컴포넌트 로딩 전에 리다이렉트
2. **서버 사이드 처리**: 클라이언트 JavaScript 실행 전에 라우팅 결정
3. **번들 크기 감소**: AuthGatekeeper 컴포넌트 제거로 클라이언트 번들 최적화
4. **초기 로딩 성능**: 불필요한 페이지 렌더링 방지

**클라이언트에 유지 시 장점:**
1. **풍부한 UI**: 복잡한 로딩 애니메이션과 사용자 피드백
2. **상태 관리**: React 상태와 컨텍스트 활용
3. **실시간 반응**: 인증 상태 변화에 즉시 반응

---

## 3단계: middleware.ts 의사코드(Pseudo-code) 작성

### 3.1 새로운 미들웨어 설계

```typescript
// src/middleware.ts (의사코드)
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // 1. 기존 Supabase 클라이언트 설정 (현재 코드 유지)
  let response = NextResponse.next({
    request: { headers: request.headers }
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // 현재 쿠키 설정 로직 유지
        get: (name) => request.cookies.get(name)?.value,
        set: (name, value, options) => { /* 현재 로직 유지 */ },
        remove: (name, options) => { /* 현재 로직 유지 */ }
      }
    }
  );

  // 2. 사용자 세션 및 프로필 정보 가져오기
  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // 3. 경로 정의 (AuthGatekeeper에서 이전)
  const publicRoutes = ['/welcome', '/login', '/signup', '/reservations/status'];
  const authRoutes = ['/welcome', '/login', '/signup'];
  const adminRoutes = ['/admin'];
  const kioskRoutes = ['/kiosk'];

  // 4. 키오스크 경로 - 항상 허용
  if (kioskRoutes.some(route => pathname.startsWith(route))) {
    return response;
  }

  // 5. 관리자 경로 보호 로직
  if (adminRoutes.some(route => pathname.startsWith(route))) {
    if (!user) {
      // 비로그인 사용자는 welcome으로
      return NextResponse.redirect(new URL('/welcome', request.url));
    }
    
    // 사용자 프로필에서 역할 확인 (최적화 필요)
    const { data: profile } = await supabase
      .rpc('get_or_create_user_profile')
      .single();
    
    if (!profile || profile.role !== 'admin') {
      // 관리자가 아니면 dashboard로
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // 6. 인증이 필요한 경로 보호 로직
  const protectedPaths = ['/dashboard', '/reservations', '/profile'];
  if (protectedPaths.some(path => pathname.startsWith(path))) {
    if (!user) {
      // 비로그인 사용자는 welcome으로
      return NextResponse.redirect(new URL('/welcome', request.url));
    }
  }

  // 7. 비로그인 사용자의 일반 보호된 페이지 접근 차단
  if (!user) {
    const isPublicRoute = publicRoutes.includes(pathname);
    if (!isPublicRoute && pathname !== '/') {
      return NextResponse.redirect(new URL('/welcome', request.url));
    }
  }

  // 8. 로그인 사용자의 인증 페이지 접근 시 리다이렉트
  if (user) {
    if (pathname === '/' || authRoutes.includes(pathname)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // 9. 모든 규칙에 해당하지 않으면 요청 그대로 진행
  return response;
}

// 10. 미들웨어 실행 경로 설정 (기존 설정 유지)
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};
```

### 3.2 클라이언트 사이드 로딩 UI 컴포넌트 설계

```typescript
// src/components/layout/AuthLoadingWrapper.tsx (의사코드)
'use client';

import { useAuthContext } from '@/contexts/AuthContext';
import { AuthLoadingUI } from './AuthLoadingUI'; // 기존 UI 컴포넌트 분리

interface AuthLoadingWrapperProps {
  children: React.ReactNode;
}

export default function AuthLoadingWrapper({ children }: AuthLoadingWrapperProps) {
  const { authStatus } = useAuthContext();

  // 인증 로딩 중에만 로딩 UI 표시
  if (authStatus === 'loading') {
    return <AuthLoadingUI />;
  }

  // 인증 완료 후 children 렌더링
  return <>{children}</>;
}
```

---

## 4단계: 구현 우선순위 및 위험 요소

### 4.1 구현 단계별 계획

**1단계: 미들웨어 구현**
- 기존 `middleware.ts`에 라우팅 로직 추가
- 단순한 세션 기반 리다이렉트부터 시작
- 관리자 권한 체크는 마지막에 추가

**2단계: AuthLoadingWrapper 생성**
- 기존 `AuthLoadingUI` 컴포넌트를 분리
- `AuthGatekeeper`에서 로딩 로직만 추출
- `layout.tsx`에 통합

**3단계: AuthGatekeeper 제거**
- 모든 로직이 미들웨어와 AuthLoadingWrapper로 이전된 후
- 점진적으로 AuthGatekeeper 사용 제거
- 빌드 및 기능 테스트

### 4.2 주요 위험 요소 및 대응책

**위험 요소 1: 관리자 권한 체크 성능**
- **문제**: 미들웨어에서 DB 쿼리 실행 시 성능 저하
- **대응**: 사용자 역할 정보를 JWT 토큰에 포함하거나 캐싱 활용

**위험 요소 2: 무한 리다이렉트 루프**
- **문제**: 잘못된 조건문으로 인한 리다이렉트 루프
- **대응**: 각 조건문에 명확한 우선순위 설정 및 테스트

**위험 요소 3: 클라이언트-서버 상태 불일치**
- **문제**: 미들웨어와 클라이언트 AuthContext 간 상태 차이
- **대응**: 동일한 인증 로직 사용 및 세션 동기화

### 4.3 성능 최적화 전략

**미들웨어 최적화:**
1. **조건문 순서**: 가장 빈번한 케이스를 먼저 처리
2. **DB 쿼리 최소화**: 관리자 권한 체크만 필요시에만 실행
3. **캐싱 활용**: 사용자 프로필 정보 캐싱 고려

**클라이언트 최적화:**
1. **번들 크기 감소**: AuthGatekeeper 제거로 클라이언트 번들 최적화
2. **로딩 상태 최적화**: 필요한 경우에만 로딩 UI 표시
3. **메모이제이션**: 불필요한 리렌더링 방지

---

## 5단계: 검증 및 테스트 계획

### 5.1 기능 테스트 시나리오

**인증 플로우 테스트:**
1. 비로그인 사용자가 `/dashboard` 접근 → `/welcome` 리다이렉트
2. 로그인 사용자가 `/login` 접근 → `/dashboard` 리다이렉트
3. 일반 사용자가 `/admin` 접근 → `/dashboard` 리다이렉트
4. 관리자가 `/admin` 접근 → 정상 접근
5. 키오스크 경로 `/kiosk/*` → 항상 접근 허용

**성능 테스트:**
1. 페이지 로딩 시간 측정 (미들웨어 적용 전후)
2. 번들 크기 비교 (AuthGatekeeper 제거 전후)
3. 리다이렉트 응답 시간 측정

### 5.2 롤백 계획

**단계별 롤백 전략:**
1. **미들웨어 문제 발생 시**: 기존 `middleware.ts`로 복원
2. **AuthLoadingWrapper 문제 시**: AuthGatekeeper 임시 복원
3. **전체 롤백**: Phase 2-2 완료 상태로 복원

---

## 결론

이 계획서는 `AuthGatekeeper`의 모든 로직을 체계적으로 분석하고, 성능 최적화를 위해 적절한 책임 분리를 통해 미들웨어와 클라이언트 컴포넌트로 재구성하는 전략을 제시합니다.

**핵심 성과 목표:**
1. **성능 향상**: 서버 사이드 라우팅으로 빠른 리다이렉트
2. **번들 최적화**: AuthGatekeeper 제거로 클라이언트 번들 크기 감소
3. **아키텍처 개선**: 명확한 책임 분리와 유지보수성 향상
4. **사용자 경험**: 불필요한 페이지 로딩 방지

이 설계를 바탕으로 다음 단계에서 실제 구현을 진행할 준비가 완료되었습니다.