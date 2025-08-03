# Requirements Document

## Introduction

이 기능은 프로젝트의 마지막 기술 부채를 청산하여 아키텍처의 일관성을 100% 달성하는 것을 목표로 합니다. 현재 `email-validation-service.ts`와 같은 하이브리드 유틸리티 파일들이 내부적으로 Supabase 클라이언트를 생성하거나 React 훅을 잘못 사용하고 있어, 의존성 주입 패턴을 적용하여 이를 해결해야 합니다.

## Requirements

### Requirement 1

**User Story:** As a developer, I want all utility services to use dependency injection for Supabase clients, so that they can be used consistently across server and client environments without architectural violations.

#### Acceptance Criteria

1. WHEN a utility service needs database access THEN it SHALL receive a SupabaseClient instance as a parameter rather than creating it internally
2. WHEN a service is called from server-side code THEN it SHALL work with server-created Supabase clients
3. WHEN a service is called from client-side code THEN it SHALL work with client-created Supabase clients
4. WHEN a service is tested THEN it SHALL be easily mockable through dependency injection

### Requirement 2

**User Story:** As a developer, I want to eliminate React hook usage violations in service classes, so that the code follows React's rules of hooks and maintains clean separation of concerns.

#### Acceptance Criteria

1. WHEN a service class method is called THEN it SHALL NOT attempt to use React hooks internally
2. WHEN a service needs React context data THEN it SHALL receive that data as parameters from components that can legally use hooks
3. WHEN the application builds THEN it SHALL produce no warnings about hook usage violations

### Requirement 3

**User Story:** As a developer, I want consistent error handling across all refactored services, so that the user experience remains seamless after the architectural changes.

#### Acceptance Criteria

1. WHEN a service method is refactored THEN it SHALL maintain the same error handling behavior as before
2. WHEN a service receives an invalid or null client THEN it SHALL return appropriate error responses
3. WHEN a service operation fails THEN it SHALL provide the same user-friendly error messages as the original implementation

### Requirement 4

**User Story:** As a developer, I want all calling code to be updated to use the new dependency injection pattern, so that the refactored services work correctly throughout the application.

#### Acceptance Criteria

1. WHEN an API route calls a refactored service THEN it SHALL create a server Supabase client and pass it as a parameter
2. WHEN a React component calls a refactored service THEN it SHALL use the Supabase client from context and pass it as a parameter
3. WHEN a service method signature changes THEN all callers SHALL be updated to match the new signature
4. WHEN the refactoring is complete THEN all existing functionality SHALL work exactly as before

### Requirement 5

**User Story:** As a developer, I want clean build logs with no deprecation warnings, so that the codebase represents production-ready, modern code standards.

#### Acceptance Criteria

1. WHEN the project builds THEN it SHALL produce no Node.js deprecation warnings
2. WHEN the project builds THEN it SHALL produce no TypeScript errors or warnings
3. WHEN the project builds THEN it SHALL complete successfully with clean output
4. WHEN the project runs in development THEN it SHALL start without any console warnings