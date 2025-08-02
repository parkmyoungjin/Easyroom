# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development & Build
- `npm run dev` - Start development server
- `npm run build` - Production build (includes deployment info generation)
- `npm run build:check` - Type-check and build
- `npm run type-check` - TypeScript type checking
- `npm run lint` - ESLint code linting
- `npm run start` - Start production server

### Testing
- `npm run test` - Run Jest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report
- `npm run test:infrastructure` - Run automated infrastructure tests
- `npm run test:infrastructure:parallel` - Run infrastructure tests in parallel
- `npm run test:data-integrity` - Run data integrity tests
- `npm run test:security-performance` - Run security and performance tests

### Database & Environment
- `npm run check-env` - Validate environment variables
- `npm run test-auth-flow` - Test authentication flow
- `npm run setup-rpc` - Setup Supabase RPC functions
- `npm run test-connection` - Basic connection test
- `npm run check-auth-settings` - Verify auth settings

### Data Integrity & Monitoring
- `npm run integrity:pipeline` - Run data integrity pipeline
- `npm run integrity:pre-deploy` - Pre-deployment validation
- `npm run integrity:post-deploy` - Post-deployment validation
- `npm run monitor:health` - System health monitoring
- `npm run report:generate` - Generate security/performance reports

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Frontend**: React 19, TypeScript, Tailwind CSS, Radix UI
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **State Management**: TanStack Query, Zustand
- **Form Handling**: React Hook Form with Zod validation
- **Testing**: Jest with Testing Library

### Project Structure

#### Core Directories
- `src/app/` - Next.js App Router pages and API routes
- `src/components/` - Reusable UI components and providers
- `src/features/` - Feature-specific components (auth, admin, reservation)
- `src/hooks/` - Custom React hooks
- `src/lib/` - Core utilities and configurations
- `src/types/` - TypeScript type definitions

#### Key Library Modules
- `src/lib/supabase/` - Supabase client configuration with enhanced error handling
- `src/lib/security/` - Security utilities (UserIdGuards, EnvironmentManager)
- `src/lib/monitoring/` - Environment and performance monitoring
- `src/lib/middleware/` - API validation middleware with Zod schemas
- `src/lib/auth/` - Authentication utilities (client/server)
- `src/lib/config/` - Environment configuration and validation

### Security Architecture

#### Type Safety with Branded Types
- Uses `AuthId` and `DatabaseUserId` branded types to prevent ID confusion
- `UserIdGuards` provide runtime validation of user IDs
- Enhanced type system prevents auth/database ID mixing at compile time

#### Environment Security
- `EnvironmentSecurityManager` centralizes environment variable access
- `SecureEnvironmentAccess` provides safe client-side env var access
- All environment variables validated on startup

#### API Security
- Mandatory Zod-based input validation middleware for all API routes
- Row Level Security (RLS) policies in Supabase
- Centralized error handling with `ReservationErrorHandler`

### Data Layer Architecture

#### Database Schema
**Important**: The actual database schema and RPC functions are deployed directly in Supabase browser console, not from local SQL files. Local SQL files may be outdated. Always reference the application code and type definitions for current database structure.

Core tables from `src/types/database.ts`:
- **users**: Employee data with auth integration (id, auth_id, employee_id, name, email, department, role, is_active)
- **rooms**: Meeting room information (id, name, description, capacity, location, amenities, is_active)
- **reservations**: Booking data with relations (id, room_id, user_id, title, purpose, start_time, end_time, status, cancellation_reason)

#### Enhanced Supabase Integration
- `EnhancedSupabaseClientManager` with retry logic and error categorization
- **RPC functions deployed in Supabase console** (not local files):
  - `get_public_reservations_paginated` - Paginated public reservations for authenticated users
  - `get_public_reservations_anonymous_paginated` - Anonymous access version
  - Parameters use `p_` prefix: `p_start_date`, `p_end_date`, `p_limit`, `p_offset`
- Realtime subscriptions for live updates
- Automatic connection health monitoring
- Fallback to direct queries if RPC functions unavailable

#### Data Integrity System
- Automated data validation pipelines
- Pre/post-deployment integrity checks
- Comprehensive test coverage for database operations
- Rollback mechanisms for failed deployments

### Performance Optimizations

#### Frontend
- Infinite scrolling with `useInfinitePublicReservations`
- Optimized pagination with cursor-based queries
- TanStack Query for intelligent caching and background updates
- Polyfill management for client/server isolation

#### Backend
- RPC functions for complex queries
- Standardized pagination across all API endpoints
- Connection pooling and retry mechanisms
- Performance monitoring and benchmarking

### Key Patterns

#### API Validation
All API routes must use the validation middleware:
```typescript
import { withValidation, validationSchemas } from '@/lib/middleware/validation';

export const POST = withValidation(
  validationSchemas.createReservation,
  async (req: ValidatedRequest<CreateReservationBody>) => {
    const { title, room_id } = req.validatedBody!;
    // Handler logic
  }
);
```

#### Authentication Flow
- Supabase Auth handles login/signup with custom employee ID system
- Login format: employee_id (7 digits) + password (pnuh + employee_id)
- Authentication guards protect all secured routes
- User roles: 'employee' | 'admin'

#### Error Handling
- Centralized error handling through `ReservationErrorHandler`
- Categorized errors (environment, network, configuration)
- Structured error responses with troubleshooting info
- Development vs production error detail levels

#### State Management
- TanStack Query for server state (reservations, rooms, users)
- Zustand for client state (UI state, auth state)
- Realtime subscriptions for live data updates

## Development Guidelines

### Code Quality
- All TypeScript strict mode enabled
- ESLint configuration with Next.js rules
- Mandatory input validation for all API endpoints
- Comprehensive test coverage required

### Testing Strategy
- Unit tests for utilities and hooks
- Integration tests for API routes
- Infrastructure tests for database operations
- Security and performance regression tests

### Deployment Process
1. Run `npm run integrity:pre-deploy` - Validate data integrity
2. Run `npm run build:check` - Type-check and build
3. Deploy to environment
4. Run `npm run integrity:post-deploy` - Verify deployment
5. Monitor with `npm run monitor:health`

### Environment Configuration
- Development: `.env.local` with Supabase credentials
- Production: Environment variables via deployment platform
- Use `npm run check-env` to validate configuration
- All env vars validated through `src/lib/config/env.ts`

## Important Implementation Notes

### Supabase Configuration
- Enhanced client manager with automatic retry and error categorization
- **Database changes made directly in Supabase console**: RPC functions, schema changes, and policies are deployed there, not from local SQL files
- RPC functions handle complex queries with built-in pagination (see API routes for current function signatures)
- Row Level Security enforced at database level
- Realtime subscriptions for collaborative features
- Always check application code in `src/app/api/` and `src/types/database.ts` for current database integration patterns

### Form Handling
- React Hook Form with Zod validation schemas
- Consistent error messaging in Korean
- Type-safe form data with branded types
- Integration with API validation middleware

### Navigation & Routing
- App Router with TypeScript route matching
- Protected routes with authentication guards
- Navigation controller for consistent UX
- Breadcrumb and feedback systems

When working with this codebase, always run the appropriate validation and testing commands before making changes. The architecture emphasizes type safety, security, and performance - ensure any modifications align with these principles.