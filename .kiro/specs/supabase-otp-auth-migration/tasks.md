# Implementation Plan

- [x] 1. Create complete OTP input component





  - Build reusable OTPInput component with 6 individual input fields
  - Implement automatic focus progression, backspace navigation, and paste handling
  - Add mobile numeric keypad support and browser auto-fill with autocomplete="one-time-code"
  - Include comprehensive error handling, validation, and user feedback
  - Implement responsive design for all device sizes and accessibility features
  - Write unit tests covering all behaviors, error states, and accessibility
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 3.1, 3.3_

- [x] 2. Extend authentication hook with complete OTP functionality







  - Add requestOTP and verifyOTP methods to useAuth hook using Supabase Auth
  - Implement comprehensive error handling for all OTP scenarios (invalid, expired, rate limited, network)
  - Add proper retry logic with attempt counting and user-friendly error messages
  - Include offline detection and appropriate messaging for PWA environments
  - Write unit tests for all authentication methods and error scenarios
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.2_

- [x] 3. Update LoginForm with integrated OTP verification flow





  - Modify existing LoginForm to include OTP verification step after email submission
  - Integrate OTPInput component with countdown timer and resend functionality
  - Implement complete state management for email and OTP verification phases
  - Add comprehensive error handling, loading states, and user feedback
  - Ensure PWA compatibility with offline detection and mobile optimization
  - Maintain existing UI/UX patterns and write integration tests for complete flow
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 4. Implement migration compatibility and session management





  - Ensure existing magic link sessions remain valid during transition
  - Add redirect handling for old magic link URLs to new OTP flow
  - Verify OTP-based authentication maintains same session structure and middleware compatibility
  - Implement clear user messaging explaining the change from magic links to OTP
  - Test backward compatibility, user profile data preservation, and route protection
  - Write migration and session management tests
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 5. Verify signup process compatibility and create validation schemas





  - Ensure existing signup flow works unchanged with new OTP authentication
  - Add OTP validation schema for 6-digit numeric codes to existing validation system
  - Test signup to OTP login transition with proper user guidance
  - Verify PWA signup functionality with offline detection
  - Write comprehensive tests for signup compatibility and validation
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3_

- [x] 6. Create comprehensive test suite and final integration








  - Write end-to-end tests for complete OTP authentication flow
  - Add PWA-specific tests for offline scenarios and mobile behavior
  - Include accessibility tests for screen readers and keyboard navigation
  - Test all error scenarios, edge cases, and migration compatibility
  - Perform final integration testing with existing application features
  - _Requirements: All requirements - comprehensive testing and integration verification_