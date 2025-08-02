# Implementation Plan

- [x] 1. Create Supabase client helper file structure





  - Create organized helper files for each execution context with proper auth-helpers implementation
  - Establish clear separation of concerns between client, server, and action contexts
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 1.1 Create client-side helper file


  - Create `src/lib/supabase/client.ts` with `createBrowserClient` for App Router standard
  - Include backward compatibility function using `createPagesBrowserClient`
  - Add comprehensive JSDoc documentation explaining usage contexts and examples
  - Implement proper TypeScript typing with Database interface
  - _Requirements: 3.2, 5.1, 5.2, 5.4_

- [x] 1.2 Create server-side helper file





  - Create `src/lib/supabase/server.ts` with `createServerClient` from auth-helpers (not @supabase/ssr)
  - Implement proper cookie handling with Next.js cookies() API
  - Maintain existing `createAdminClient` functionality with service role access
  - Add detailed documentation for server component usage patterns
  - _Requirements: 3.3, 5.1, 5.2, 5.4_

- [x] 1.3 Create actions helper file


  - Create `src/lib/supabase/actions.ts` with context-specific client creation functions
  - Implement `createRouteClient` using `createRouteHandlerClient` for API routes
  - Implement `createActionClient` using `createServerActionClient` for server actions
  - Add `createAdminRouteClient` for privileged API operations
  - Include comprehensive usage examples and JSDoc documentation
  - _Requirements: 3.4, 5.1, 5.2, 5.4_

- [x] 2. Fix critical API route authentication issues




  - Update the problematic `/api/reservations/public-authenticated/route.ts` to use proper auth-helpers client
  - Resolve 401 Unauthorized errors by implementing correct cookie parsing
  - Verify authentication flow works end-to-end
  - _Requirements: 2.1, 2.4, 4.1, 7.1_

- [x] 2.1 Update reservations API route import statements



  - Replace `import { createClient } from '@/lib/supabase/server'` with actions helper import
  - Import `createRouteClient` from `src/lib/supabase/actions.ts`
  - Remove any legacy createClient references
  - _Requirements: 4.1, 4.4_

- [x] 2.2 Refactor API route client creation logic


  - Replace `const supabase = await createClient()` with `const supabase = createRouteClient(request)`
  - Update client creation to pass request context for proper cookie handling
  - Ensure session validation logic remains intact
  - Test that authentication state is properly maintained
  - _Requirements: 1.1, 2.1, 2.4, 7.1_

- [x] 2.3 Validate API route authentication flow


  - Test that authenticated users can successfully access the reservations endpoint
  - Verify that unauthenticated requests receive proper 401 responses
  - Confirm that user session data is correctly retrieved and used
  - Test error handling for invalid or expired sessions
  - _Requirements: 2.1, 2.2, 2.5, 7.1, 7.2_

- [x] 3. Migrate other API routes to use auth-helpers



  - Update remaining API routes that use legacy createClient patterns
  - Ensure consistent authentication handling across all endpoints
  - Maintain existing API interfaces and functionality
  - _Requirements: 4.1, 4.2, 4.4_

- [x] 3.1 Update rooms API route


  - Migrate `src/app/api/rooms/route.ts` to use `createRouteClient` from actions helper
  - Test CRUD operations work correctly with new client creation
  - Verify admin operations use proper service role client
  - _Requirements: 4.1, 4.2_



- [x] 3.2 Update admin API routes

  - Migrate `src/app/api/admin/users/route.ts` and related admin endpoints
  - Ensure admin operations use `createAdminRouteClient` for service role access
  - Test privilege escalation and access control

  - _Requirements: 4.1, 4.2_

- [x] 3.3 Update health check and monitoring API routes

  - Migrate health check endpoints to use appropriate client creation methods
  - Update monitoring endpoints that require authentication
  - Ensure system monitoring continues to work correctly
  - _Requirements: 4.1, 4.2_

- [x] 4. Migrate server components to use auth-helpers


  - Update server components (pages, layouts) to use new server helper
  - Ensure authentication state consistency across server-rendered content
  - Test session persistence in server-side rendering
  - _Requirements: 1.3, 4.2, 4.4_

- [x] 4.1 Identify and catalog server components using legacy clients



  - Search codebase for server components importing from old supabase/server
  - Create list of files requiring migration to new server helper
  - Prioritize components by usage frequency and criticality
  - _Requirements: 4.4, 6.1_





- [x] 4.2 Update server component client creation


  - Replace legacy `createClient` imports with `src/lib/supabase/server.ts` imports
  - Update client creation calls to use new auth-helpers-based function
  - Test that server-side authentication continues to work correctly
  - Verify session data is properly available in server components



  - _Requirements: 1.3, 4.2, 4.4_

- [x] 4.3 Test server component authentication consistency



  - Verify that authentication state is consistent between client and server components
  - Test navigation between authenticated and unauthenticated pages
  - Confirm that protected routes properly enforce authentication
  - _Requirements: 1.3, 2.3, 4.2_

- [x] 5. Migrate server actions to use auth-helpers





  - Update server actions to use `createActionClient` from actions helper
  - Ensure form submissions and data mutations work correctly
  - Test authentication context preservation in server actions
  - _Requirements: 1.4, 4.3, 4.4_

- [x] 5.1 Identify server actions using legacy clients



  - Search for server actions ('use server') that import legacy createClient
  - Catalog server actions requiring migration to new action helper
  - Prioritize by functionality criticality (reservation creation, user management, etc.)
  - _Requirements: 4.4, 6.1_

- [x] 5.2 Update server action client creation


  - Replace legacy imports with `createActionClient` from actions helper
  - Update client creation to use `createServerActionClient` for proper cookie handling
  - Test that form submissions continue to work with authentication
  - Verify that user context is properly maintained in server actions
  - _Requirements: 1.4, 4.3, 4.4_

- [x] 5.3 Test server action authentication flows

  - Test reservation creation server action with authenticated users
  - Verify user profile update server actions work correctly
  - Test admin server actions with proper privilege escalation
  - Confirm error handling for unauthenticated server action attempts
  - _Requirements: 1.4, 2.3, 4.3, 7.3_

- [x] 6. Update client components and hooks



  - Verify client components work correctly with new server-side auth-helpers
  - Update any client-side code using deprecated patterns
  - Ensure real-time subscriptions and client-side authentication remain functional
  - _Requirements: 4.4, 7.4_

- [x] 6.1 Verify client component compatibility


  - Test that existing client components using `createPagesBrowserClient` work with new server clients
  - Verify session synchronization between client and server contexts
  - Test real-time subscription functionality with auth-helpers
  - _Requirements: 1.2, 2.3, 4.4_

- [x] 6.2 Update client-side hooks and utilities








  - Review and update hooks like `useReservations.ts` that interact with authenticated APIs
  - Ensure client-side authentication state management works with new server implementation
  - Test client-side error handling for authentication failures
  - _Requirements: 4.4, 7.2, 7.4_

- [x] 6.3 Test cross-context authentication consistency



  - Test complete user flows: login → client component → API call → server action
  - Verify authentication state remains consistent across all contexts
  - Test session persistence during navigation and page refreshes
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.3_

- [ ] 7. Clean up legacy code and imports
  - Remove old client creation files and functions
  - Update all import statements to use new helper functions
  - Remove backward compatibility wrappers after migration is complete
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 7.1 Identify legacy code for removal









  - Create comprehensive list of files and functions that can be safely removed
  - Verify no remaining references to legacy createClient patterns exist
  - Document which files are safe to delete vs. need to be updated
  - _Requirements: 6.1, 6.2_

- [x] 7.2 Update import statements across codebase










  - Replace all legacy import statements with new helper function imports
  - Update test files to mock new helper functions instead of legacy ones
  - Ensure no broken imports remain after legacy code removal
  - _Requirements: 6.3, 6.4_

- [ ] 7.3 Remove legacy client creation files



  - Safely delete old server.ts implementation after verifying no dependencies
  - Remove any unused utility functions related to legacy client creation
  - Clean up environment variable handling code that's no longer needed
  - _Requirements: 6.1, 6.4_

- [ ] 8. Comprehensive testing and validation
  - Perform end-to-end testing of complete authentication flows
  - Validate that all reservation system functionality works correctly
  - Test error handling and edge cases
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 8.1 Test complete reservation system flow
  - Test user login → view reservations → create new reservation → edit reservation
  - Verify all API endpoints return correct data without 401 errors
  - Test admin reservation management functionality
  - Confirm error messages are clear and helpful when authentication fails
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 8.2 Test authentication edge cases
  - Test behavior with expired sessions
  - Test concurrent session handling (multiple tabs/devices)
  - Test authentication during network connectivity issues
  - Verify proper cleanup when users log out
  - _Requirements: 2.2, 2.5, 7.5_

- [ ] 8.3 Performance and monitoring validation
  - Measure authentication performance before and after migration
  - Monitor API response times and error rates
  - Test client creation performance across different contexts
  - Verify no memory leaks or performance regressions
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 8.4 Final integration testing
  - Test complete user journeys from registration to advanced features
  - Verify all authentication-dependent features work correctly
  - Test rollback procedures in case issues are discovered
  - Document any remaining known issues or limitations
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_