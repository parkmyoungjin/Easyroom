# Design Document

## Overview

This design outlines the comprehensive refactoring of Supabase client creation logic to use @supabase/auth-helpers-nextjs consistently across all execution contexts in the Next.js 13+ App Router application. The current implementation has a critical inconsistency where client-side components use auth-helpers (createPagesBrowserClient) but server-side components still use legacy createServerClient from @supabase/ssr, causing authentication cookie parsing issues and resulting in 401 Unauthorized errors.

The refactoring will establish a unified, context-aware client creation system that properly handles authentication state across all Next.js execution contexts while maintaining backward compatibility and improving maintainability.

## Architecture

### Current State Analysis

**Client-Side (Working Correctly):**
- Uses `createPagesBrowserClient` from @supabase/auth-helpers-nextjs
- Properly handles authentication cookies
- Session persistence works correctly
- Located in `src/lib/supabase/client.ts`

**Server-Side (Problematic):**
- Uses `createServerClient` from @supabase/ssr (legacy approach)
- Cannot properly parse auth-helpers cookies
- Causes 401 errors in API routes like `/api/reservations/public-authenticated`
- Located in `src/lib/supabase/server.ts`

**Middleware (Working Correctly):**
- Uses `createMiddlewareClient` from @supabase/auth-helpers-nextjs
- Properly handles session validation
- Located in `src/middleware.ts`

### Target Architecture

The new architecture will provide context-specific client creation functions organized into three helper files:

```
src/lib/supabase/
├── client.ts      # Client components ('use client')
├── server.ts      # Server components (pages, layouts)
└── actions.ts     # API routes and server actions
```

### Client Creation Strategy

Each execution context requires a specific auth-helpers function:

1. **Client Components**: `createBrowserClient` (App Router standard) or `createPagesBrowserClient` (Pages Router compatibility)
2. **Server Components**: `createServerClient` from auth-helpers (not @supabase/ssr)
3. **API Routes**: `createRouteHandlerClient`
4. **Server Actions**: `createServerActionClient` (dedicated wrapper around createServerClient for server actions)
5. **Middleware**: `createMiddlewareClient` (already implemented correctly)

## Components and Interfaces

### 1. Client Helper (`src/lib/supabase/client.ts`)

**Purpose**: Provide Supabase clients for client-side React components

**Functions**:
- `createClient()`: Main client creation function for client components
- `supabase()`: Backward compatibility function (deprecated but maintained)

**Implementation Strategy**:
- Use `createBrowserClient` for App Router (standard approach for Next.js 13+ App Router)
- Maintain `createPagesBrowserClient` for backward compatibility (legacy support only during transition)
- Ensure proper TypeScript typing with Database interface
- Note: `createBrowserClient` is the recommended standard for App Router environments

### 2. Server Helper (`src/lib/supabase/server.ts`)

**Purpose**: Provide Supabase clients for server components (pages, layouts)

**Functions**:
- `createClient()`: Main server client creation function
- `createAdminClient()`: Service role client for admin operations

**Implementation Strategy**:
- Replace current `createServerClient` from @supabase/ssr with `createServerClient` from auth-helpers
- Maintain proper cookie handling with Next.js cookies() API
- Preserve existing admin client functionality
- Ensure proper error handling and environment validation

### 3. Actions Helper (`src/lib/supabase/actions.ts`)

**Purpose**: Provide Supabase clients for API routes and server actions

**Functions**:
- `createRouteClient()`: For API route handlers
- `createActionClient()`: For server actions
- `createAdminRouteClient()`: For admin API routes requiring service role

**Implementation Strategy**:
- Use `createRouteHandlerClient` for API routes with request/response context
- Use `createServerActionClient` for server actions (dedicated wrapper around createServerClient for server actions)
- Provide admin clients for privileged operations
- Ensure proper request context passing

### 4. Type Definitions

**Shared Types**:
```typescript
import type { Database } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

export type TypedSupabaseClient = SupabaseClient<Database>;
```

## Data Models

### Client Creation Context

```typescript
interface ClientContext {
  type: 'browser' | 'server' | 'route' | 'action' | 'middleware';
  request?: NextRequest;
  response?: NextResponse;
  cookies?: ReadonlyRequestCookies;
}
```

### Environment Configuration

```typescript
interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string; // Only for admin clients
}
```

### Migration Tracking

```typescript
interface MigrationStatus {
  clientComponents: string[]; // Files using client.ts
  serverComponents: string[]; // Files using server.ts
  apiRoutes: string[];       // Files using actions.ts
  legacyFiles: string[];     // Files still using old patterns
}
```

## Error Handling

### Authentication Errors

**Current Problem**: 401 Unauthorized errors due to cookie parsing issues
**Solution**: Proper auth-helpers client creation with correct cookie handling

**Error Handling Strategy**:
1. Graceful fallback for authentication failures
2. Clear error messages distinguishing between:
   - No session (user not logged in)
   - Invalid session (expired/corrupted cookies)
   - Client creation failures (configuration issues)
3. Proper logging for debugging authentication issues

### Client Creation Errors

**Error Types**:
- Environment variable missing/invalid
- Cookie parsing failures
- Network connectivity issues
- Service role key access failures (admin clients)

**Handling Strategy**:
- Fail fast for critical configuration errors
- Provide meaningful error messages for debugging
- Maintain backward compatibility during migration
- Log errors with appropriate context for monitoring

### Migration Errors

**Potential Issues**:
- Import path changes breaking existing code
- Function signature changes
- Cookie format incompatibilities
- Session state inconsistencies

**Mitigation Strategy**:
- Maintain backward compatibility wrappers during transition
- Comprehensive testing of authentication flows
- Gradual migration with rollback capability
- Clear documentation of breaking changes

## Testing Strategy

### Unit Tests

**Client Creation Tests**:
- Test each helper function creates proper client type
- Verify environment variable handling
- Test error conditions and fallbacks
- Validate TypeScript type safety

**Authentication Flow Tests**:
- Test session creation and validation
- Verify cookie handling across contexts
- Test admin client privilege escalation
- Validate error handling scenarios

### Integration Tests

**Cross-Context Authentication**:
- Test client → server component authentication flow
- Verify API route authentication with client-created sessions
- Test server action authentication consistency
- Validate middleware → API route session passing

**Migration Compatibility**:
- Test backward compatibility during migration
- Verify existing authentication flows continue working
- Test mixed old/new client usage scenarios
- Validate session persistence across client types

### End-to-End Tests

**Complete Authentication Flows**:
- Login → Dashboard → API calls → Server actions
- Registration → Email verification → Profile access
- Password reset → Session restoration
- Logout → Session cleanup

**Specific Reservation System Tests**:
- Login → View reservations (API call)
- Create reservation (server action)
- Edit reservation (mixed client/server operations)
- Admin operations (service role client usage)

### Performance Tests

**Client Creation Performance**:
- Measure client creation time across contexts
- Test concurrent client creation scenarios
- Validate memory usage patterns
- Monitor cookie parsing performance

**Authentication Performance**:
- Session validation speed
- Cookie read/write performance
- Database query performance with proper RLS
- API response times after migration

## Implementation Phases

### Phase 1: Helper File Creation
1. Create new helper files with proper auth-helpers implementation
2. Maintain backward compatibility with existing interfaces
3. Add comprehensive documentation and examples
4. Implement proper TypeScript typing

### Phase 2: Critical API Route Migration
1. Fix `/api/reservations/public-authenticated/route.ts` first (highest priority)
2. Update other API routes causing 401 errors
3. Test authentication flows thoroughly
4. Monitor for regression issues

### Phase 3: Server Component Migration
1. Update server components (pages, layouts)
2. Migrate server actions
3. Update admin functionality
4. Test cross-component authentication consistency

### Phase 4: Client Component Verification
1. Verify client components work with new server-side clients
2. Test session synchronization
3. Update any client-side code using deprecated patterns
4. Ensure real-time subscription compatibility

### Phase 5: Legacy Code Cleanup
1. Remove old client creation files
2. Update all import statements
3. Remove backward compatibility wrappers
4. Update documentation and examples

### Phase 6: Validation and Monitoring
1. Comprehensive end-to-end testing
2. Performance monitoring
3. Error rate monitoring
4. User acceptance testing

## Security Considerations

### Cookie Security
- Ensure proper httpOnly, secure, and sameSite cookie attributes
- Validate cookie encryption and signing
- Test cross-site request forgery (CSRF) protection
- Monitor for session hijacking vulnerabilities

### Environment Variable Security
- Maintain secure access to service role keys
- Validate environment variable encryption
- Test access control for admin clients
- Monitor for credential exposure

### Authentication Security
- Validate Row Level Security (RLS) policy enforcement
- Test privilege escalation prevention
- Monitor authentication bypass attempts
- Ensure proper session timeout handling

## Monitoring and Observability

### Authentication Metrics
- Session creation/validation success rates
- Authentication error rates by context
- Cookie parsing failure rates
- Client creation performance metrics

### Migration Metrics
- Files migrated vs. remaining
- Authentication flow success rates
- API endpoint error rates
- User-reported authentication issues

### Performance Metrics
- Client creation latency
- Authentication validation time
- API response times
- Database query performance

## Rollback Strategy

### Immediate Rollback Triggers
- Authentication success rate drops below 95%
- API error rate increases above 5%
- Critical user flows break
- Security vulnerabilities discovered

### Rollback Process
1. Revert helper file changes
2. Restore original import statements
3. Re-enable legacy client creation
4. Validate authentication flows
5. Monitor for stability restoration

### Rollback Testing
- Pre-migration state backup
- Automated rollback scripts
- Rollback validation tests
- Communication plan for users

## Success Criteria

### Technical Success
- Zero 401 authentication errors in reservation system
- All authentication flows working consistently
- Performance maintained or improved
- Clean, maintainable codebase

### User Experience Success
- Seamless authentication across all features
- No user-visible disruption during migration
- Improved reliability of authenticated features
- Clear error messages when authentication fails

### Development Success
- Clear, documented client creation patterns
- Easy-to-use helper functions
- Comprehensive test coverage
- Maintainable architecture for future changes