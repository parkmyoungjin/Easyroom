# Requirements Document

## Introduction

This feature involves migrating from the current Magic Link authentication system to Supabase Email OTP authentication. The system will maintain the existing signup process (email, name, department) but replace magic link login with a 6-digit OTP code sent via email. The entire system must work seamlessly in PWA (Progressive Web App) environments, ensuring offline capability and mobile-first user experience.

## Requirements

### Requirement 1

**User Story:** As a user, I want to sign up with my email, name, and department information, so that I can create an account in the system with the same process as before.

#### Acceptance Criteria

1. WHEN a user accesses the signup page THEN the system SHALL display fields for email, full name, and department
2. WHEN a user submits valid signup information THEN the system SHALL create a new user account in Supabase Auth
3. WHEN a user submits duplicate email THEN the system SHALL display an appropriate error message
4. WHEN signup is successful THEN the system SHALL redirect the user to the login page with a success message
5. WHEN the PWA is offline during signup THEN the system SHALL display a clear message that internet connection is required for account creation

### Requirement 2

**User Story:** As a user, I want to login using my registered email and a 6-digit OTP code, so that I can access the application securely without passwords or magic links.

#### Acceptance Criteria

1. WHEN a user enters their registered email on the login page THEN the system SHALL send a 6-digit OTP code to their email address
2. WHEN a user enters the correct OTP code within 5 minutes THEN the system SHALL create a valid session and authenticate the user
3. WHEN a user enters an incorrect OTP code THEN the system SHALL display an error message and allow up to 3 retry attempts
4. WHEN an OTP code expires THEN the system SHALL reject the code and allow the user to request a new one
5. WHEN a user requests a new OTP code THEN the system SHALL invalidate any previous codes and send a fresh 6-digit code

### Requirement 3

**User Story:** As a user, I want the OTP authentication to work perfectly in PWA environments, so that I can login reliably on mobile devices and when the app is installed as a PWA.

#### Acceptance Criteria

1. WHEN using the PWA on mobile devices THEN the OTP input SHALL trigger the numeric keypad for easy code entry
2. WHEN the PWA is offline during OTP request THEN the system SHALL show appropriate offline messaging and retry when online
3. WHEN receiving OTP codes on mobile devices THEN the system SHALL support browser auto-fill functionality using appropriate HTML attributes
4. WHEN the PWA is backgrounded during OTP entry THEN the system SHALL maintain the authentication state and timer
5. WHEN OTP codes are requested THEN the system SHALL display clear on-screen confirmation that the code has been sent to the user's email

### Requirement 4

**User Story:** As a user, I want an intuitive and responsive OTP input interface, so that I can easily enter the 6-digit code on any device size.

#### Acceptance Criteria

1. WHEN entering OTP codes THEN the system SHALL provide 6 individual input fields with automatic focus progression
2. WHEN a digit is entered THEN the focus SHALL automatically move to the next input field
3. WHEN backspacing THEN the focus SHALL move to the previous field and clear the current digit
4. WHEN pasting a 6-digit code THEN the system SHALL automatically distribute the digits across all input fields
5. WHEN the OTP input is displayed THEN it SHALL be fully responsive and accessible on mobile, tablet, and desktop devices

### Requirement 5

**User Story:** As a user, I want a smooth migration from the current magic link system, so that I can continue using the application without losing access or data.

#### Acceptance Criteria

1. WHEN the migration is deployed THEN existing user accounts SHALL be preserved with all profile data intact
2. WHEN a user with an existing magic link session accesses the app THEN their session SHALL remain valid until natural expiration
3. WHEN existing magic link URLs are accessed THEN the system SHALL redirect users to the new OTP login flow
4. WHEN the migration is complete THEN all user roles and permissions SHALL be maintained exactly as before
5. WHEN users first encounter the new system THEN clear messaging SHALL explain the change from magic links to OTP codes

### Requirement 6

**User Story:** As a user, I want the OTP system to integrate seamlessly with the existing application features, so that all functionality continues to work as expected after authentication.

#### Acceptance Criteria

1. WHEN successfully authenticated via OTP THEN the system SHALL maintain the same user session structure as before
2. WHEN accessing protected routes THEN the OTP-based authentication SHALL work with existing middleware and route protection
3. WHEN user profile data is accessed THEN all existing user metadata (name, department, role) SHALL be available as before
4. WHEN logging out THEN the system SHALL properly clear the OTP-based session and redirect to the login page
5. WHEN the PWA is used offline after authentication THEN cached user data SHALL remain accessible for offline functionality