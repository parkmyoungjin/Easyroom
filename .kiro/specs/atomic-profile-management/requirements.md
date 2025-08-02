# Requirements Document

## Introduction

현재 시스템의 `getOrCreateProfile` 함수는 여러 단계의 네트워크 통신과 복잡한 분기 로직으로 인해 데이터 무결성 문제와 신뢰할 수 없는 상태를 야기하고 있습니다. 이 문제는 "조회(SELECT) -> (조건부) 생성(RPC) -> 재조회(SELECT)"라는 다단계 프로세스에서 발생하는 레이스 컨디션과 부분적 실패 상황들로 인해 사용자 프로필 데이터가 불완전하거나 누락될 수 있는 근본적인 아키텍처 취약점입니다. 

이를 해결하기 위해 모든 프로필 관련 비즈니스 로직을 단일 원자적(Atomic) 데이터베이스 RPC 함수로 통합하여, 프론트엔드는 단순한 호출자 역할만 하고 데이터베이스가 모든 복잡성을 처리하도록 하는 패러다임 전환이 필요합니다.

## Requirements

### Requirement 1

**User Story:** As a system architect, I want all user profile operations to be atomic and reliable, so that the application never encounters incomplete or inconsistent profile data.

#### Acceptance Criteria

1. WHEN a user profile is requested THEN the system SHALL return either a complete, valid profile or a clear error - never partial data
2. WHEN profile creation is needed THEN it SHALL be handled atomically within a single database transaction
3. WHEN concurrent profile requests occur THEN the system SHALL handle them safely without race conditions
4. WHEN any step in profile retrieval/creation fails THEN the entire operation SHALL fail cleanly with proper error reporting
5. WHEN profile data is returned THEN it SHALL be guaranteed to be complete and consistent with all required fields populated

### Requirement 2

**User Story:** As a developer, I want a single atomic RPC function that handles all profile logic, so that frontend code is simplified and all complexity is centralized in the database.

#### Acceptance Criteria

1. WHEN the atomic profile function is called THEN it SHALL internally handle user lookup, creation if needed, and final data retrieval in one operation
2. WHEN the RPC function executes THEN it SHALL use proper PostgreSQL transaction semantics to ensure atomicity
3. WHEN user creation is required THEN the RPC function SHALL safely create the user with proper conflict handling
4. WHEN the function completes successfully THEN it SHALL return a complete UserProfile with all required fields
5. WHEN the function encounters any error THEN it SHALL provide specific, actionable error messages

### Requirement 3

**User Story:** As a frontend developer, I want the getOrCreateProfile function to be dramatically simplified, so that it becomes a simple RPC caller with minimal logic.

#### Acceptance Criteria

1. WHEN getOrCreateProfile is called THEN it SHALL make only a single RPC call to the database
2. WHEN the RPC call succeeds THEN getOrCreateProfile SHALL perform only type conversion and return the profile
3. WHEN the RPC call fails THEN getOrCreateProfile SHALL propagate the error without additional processing
4. WHEN getOrCreateProfile executes THEN it SHALL not contain any conditional logic, retry mechanisms, or multi-step operations
5. WHEN the function is reviewed THEN it SHALL be under 20 lines of code with clear, single-responsibility logic

### Requirement 4

**User Story:** As a database administrator, I want the atomic profile RPC function to handle all edge cases and error conditions, so that data integrity is maintained under all circumstances.

#### Acceptance Criteria

1. WHEN a user is not authenticated THEN the RPC function SHALL immediately return a clear authentication error
2. WHEN a user exists in auth.users but not in public.users THEN the function SHALL safely create the public.users record
3. WHEN concurrent requests attempt to create the same user THEN the function SHALL handle conflicts gracefully using proper SQL conflict resolution
4. WHEN auth.users data is incomplete THEN the function SHALL use sensible defaults and log the issue
5. WHEN any database constraint is violated THEN the function SHALL provide specific error messages for debugging

### Requirement 5

**User Story:** As an end user, I want profile operations to be fast and reliable, so that I never experience loading delays or authentication failures due to profile issues.

#### Acceptance Criteria

1. WHEN I log in THEN my profile SHALL be available immediately without multiple loading states
2. WHEN I refresh the page THEN my profile SHALL load consistently without errors
3. WHEN I am a new user THEN my profile SHALL be created seamlessly during first login
4. WHEN network issues occur THEN I SHALL receive clear error messages rather than infinite loading states
5. WHEN profile operations complete THEN the UI SHALL update immediately with my complete profile information

### Requirement 6

**User Story:** As a system maintainer, I want the new atomic architecture to be backward compatible, so that existing functionality continues to work during and after the migration.

#### Acceptance Criteria

1. WHEN the new RPC function is deployed THEN existing API endpoints SHALL continue to function
2. WHEN the frontend is updated THEN all existing UI components SHALL work with the new profile data structure
3. WHEN the migration is complete THEN all existing user profiles SHALL be accessible through the new system
4. WHEN rollback is needed THEN the system SHALL be able to revert to the previous implementation safely
5. WHEN the new system is active THEN it SHALL maintain all existing security policies and access controls