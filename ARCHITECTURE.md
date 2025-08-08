# Easyroom 아키텍처 개요

이 문서는 Easyroom 프로젝트의 핵심 아키텍처와 설계 원칙을 설명합니다.

## 1. 인증 및 라우팅

### 인증 상태 관리
- **AuthProvider**: `src/contexts/AuthContext.tsx`에서 전역 인증 상태를 관리합니다.
- **세션 관리**: Supabase Auth를 통한 JWT 기반 인증
- **프로필 관리**: `get_or_create_user_profile` RPC 함수를 통한 사용자 프로필 자동 생성

### 라우팅 제어
- **미들웨어 기반**: `src/middleware.ts`에서 서버 사이드 라우팅 제어
- **보호된 경로**: `/dashboard`, `/reservations`, `/profile`, `/admin`
- **공개 경로**: `/welcome`, `/login`, `/signup`, `/reservations/status`
- **특수 경로**: `/kiosk/*` (항상 접근 허용)

### 인증 로딩 UI
- **AuthLoadingWrapper**: `src/components/layout/AuthLoadingWrapper.tsx`
- **AuthLoadingUI**: 다크모드 지원 로딩 스피너 컴포넌트
- **책임 분리**: 미들웨어(라우팅) vs 클라이언트(UI)

## 2. UI 및 스타일링

### UI 라이브러리
- **Mantine UI**: 모든 UI 컴포넌트의 기본 라이브러리
- **일관성**: Mantine의 props(`c`, `p`, `m`)와 테마 시스템 사용
- **다크모드**: `useMantineColorScheme` 훅을 통한 테마 관리

### 스타일링 원칙
- **Mantine 우선**: 컴포넌트 스타일링은 Mantine props 사용
- **CSS-in-JS**: 동적 스타일링이 필요한 경우에만 사용
- **Tailwind 금지**: 일관성을 위해 Tailwind CSS 사용 금지

## 3. 상태 관리

### 서버 상태
- **TanStack Query**: 모든 API 데이터 페칭 및 캐싱
- **React Query**: 서버 상태와 클라이언트 상태의 명확한 분리
- **캐싱 전략**: 적절한 staleTime과 cacheTime 설정

### 클라이언트 상태
- **useState**: 단순한 컴포넌트 레벨 상태
- **Zustand**: 복잡한 전역 클라이언트 상태 (예: UI 상태, 알림)
- **Context API**: 인증 상태와 같은 전역 상태

## 4. 데이터베이스 및 API

### Supabase 통합
- **RLS (Row Level Security)**: 모든 테이블에 적용된 보안 정책
- **RPC 함수**: 복잡한 비즈니스 로직은 PostgreSQL 함수로 구현
- **실시간 구독**: 예약 상태 변경 등 실시간 업데이트

### API 설계
- **RESTful**: 표준 HTTP 메서드와 상태 코드 사용
- **타입 안전성**: TypeScript를 통한 엄격한 타입 체크
- **에러 처리**: 일관된 에러 응답 형식

## 5. 성능 최적화

### 번들 최적화
- **코드 분할**: Next.js의 자동 코드 분할 활용
- **트리 쉐이킹**: 사용하지 않는 코드 자동 제거
- **이미지 최적화**: Next.js Image 컴포넌트 사용

### 렌더링 최적화
- **서버 컴포넌트**: 가능한 한 서버 컴포넌트 사용
- **메모이제이션**: React.memo, useMemo, useCallback 적절히 활용
- **지연 로딩**: 필요한 시점에만 컴포넌트 로드

## 6. 보안

### 인증 보안
- **JWT 토큰**: 안전한 토큰 기반 인증
- **세션 관리**: 자동 토큰 갱신 및 만료 처리
- **권한 체크**: 미들웨어와 RLS를 통한 이중 보안

### 데이터 보안
- **입력 검증**: Zod를 통한 런타임 타입 검증
- **SQL 인젝션 방지**: Supabase의 매개변수화된 쿼리 사용
- **XSS 방지**: React의 기본 XSS 보호 + CSP 헤더

## 7. 개발 환경

### 개발 도구
- **TypeScript**: 엄격한 타입 체크
- **ESLint**: 코드 품질 관리
- **Prettier**: 일관된 코드 포맷팅

### 테스트 전략
- **Jest**: 단위 테스트 및 통합 테스트
- **React Testing Library**: 컴포넌트 테스트
- **E2E 테스트**: 주요 사용자 플로우 검증

## 8. 배포 및 모니터링

### 배포 전략
- **Vercel**: Next.js 최적화된 배포 플랫폼
- **환경 변수**: 환경별 설정 분리
- **빌드 최적화**: 프로덕션 빌드 최적화

### 모니터링
- **에러 추적**: 프로덕션 에러 모니터링
- **성능 모니터링**: Core Web Vitals 추적
- **사용자 분석**: 사용 패턴 분석

## 9. 주요 설계 결정

### 아키텍처 원칙
1. **단일 책임 원칙**: 각 컴포넌트와 함수는 하나의 책임만 가짐
2. **의존성 역전**: 추상화에 의존하고 구체화에 의존하지 않음
3. **개방-폐쇄 원칙**: 확장에는 열려있고 수정에는 닫혀있음

### 기술 선택 이유
- **Next.js**: SSR/SSG 지원과 뛰어난 개발 경험
- **Supabase**: PostgreSQL 기반의 완전한 백엔드 솔루션
- **Mantine**: 풍부한 컴포넌트와 뛰어난 접근성
- **TanStack Query**: 강력한 서버 상태 관리

## 10. 마이그레이션 히스토리

### Phase 0: 초기 정리
- 불필요한 의존성 제거
- 코드 중복 제거
- 기본 구조 정리

### Phase 1: 프로바이더 최적화
- 불필요한 프로바이더 제거
- 프로바이더 계층 단순화
- 성능 최적화

### Phase 2: 아키텍처 리팩토링
- AuthGatekeeper → Middleware 이전
- 라우팅 로직 서버 사이드 이동
- UI와 로직의 명확한 분리

### Phase 3: 최종 최적화
- 설정 파일 단순화
- 불필요한 스크립트 제거
- 문서화 완료

---

이 문서는 프로젝트의 핵심 아키텍처를 이해하고 유지보수하는 데 도움이 되도록 작성되었습니다. 새로운 기능을 추가하거나 기존 코드를 수정할 때는 이 원칙들을 따라주시기 바랍니다.