# Developer Guide: Security and Performance Monitoring Patterns

## Overview

This guide provides comprehensive documentation for developers on implementing and using the security and performance monitoring patterns in the RoomBook application. It covers the standardized patterns for `EnvironmentSecurityManager`, `SecurityMonitor`, `PerformanceMonitor`, and `UserIdGuards`.

## Table of Contents

1. [Security Monitoring Patterns](#security-monitoring-patterns)
2. [Performance Monitoring Patterns](#performance-monitoring-patterns)
3. [Environment Security Management](#environment-security-management)
4. [Data Integrity and Type Safety](#data-integrity-and-type-safety)
5. [API Standardization Patterns](#api-standardization-patterns)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

## Security Monitoring Patterns

### SecurityMonitor Usage

The `SecurityMonitor` class provides centralized security event tracking and logging.

#### Basic Usage

```typescript
import { SecurityMonitor } from '@/lib/security/security-monitor';

// Initialize security monitor
const securityMonitor = SecurityMonitor.getInstance();

// Log authentication events
await securityMonitor.logAuthenticationEvent({
  eventType: 'login_attempt',
  userId: 'user123',
  success: true,
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  metadata: {
    loginMethod: 'email',
    sessionId: 'session123'
  }
});

// Log authorization events
await securityMonitor.logAuthorizationEvent({
  eventType: 'resource_access',
  userId: 'user123',
  resource: '/api/admin/users',
  action: 'read',
  granted: false,
  reason: 'insufficient_permissions'
});

// Log security violations
await securityMonitor.logSecurityViolation({
  eventType: 'suspicious_activity',
  severity: 'high',
  description: 'Multiple failed login attempts',
  userId: 'user123',
  ipAddress: '192.168.1.1',
  metadata: {
    attemptCount: 5,
    timeWindow: '5 minutes'
  }
});
```

#### Integration in API Routes

```typescript
// pages/api/auth/login.ts
import { SecurityMonitor } from '@/lib/security/security-monitor';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const securityMonitor = SecurityMonitor.getInstance();
  const { email, password } = await request.json();
  
  try {
    // Attempt authentication
    const result = await authenticateUser(email, password);
    
    // Log successful authentication
    await securityMonitor.logAuthenticationEvent({
      eventType: 'login_success',
      userId: result.user.id,
      success: true,
      ipAddress: request.ip,
      userAgent: request.headers.get('user-agent'),
      metadata: {
        loginMethod: 'email',
        sessionId: result.session.id
      }
    });
    
    return NextResponse.json({ success: true, user: result.user });
    
  } catch (error) {
    // Log failed authentication
    await securityMonitor.logAuthenticationEvent({
      eventType: 'login_failure',
      userId: null,
      success: false,
      ipAddress: request.ip,
      userAgent: request.headers.get('user-agent'),
      metadata: {
        email,
        error: error.message,
        loginMethod: 'email'
      }
    });
    
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }
}
```

#### Security Event Types

```typescript
// Security event types and their usage
interface SecurityEventTypes {
  // Authentication events
  'login_attempt': { success: boolean; method: string };
  'login_success': { sessionId: string; method: string };
  'login_failure': { reason: string; method: string };
  'logout': { sessionId: string };
  'session_expired': { sessionId: string };
  
  // Authorization events
  'resource_access': { resource: string; action: string; granted: boolean };
  'permission_denied': { resource: string; requiredRole: string };
  'admin_access': { action: string; targetUserId?: string };
  
  // Security violations
  'suspicious_activity': { description: string; severity: 'low' | 'medium' | 'high' };
  'rate_limit_exceeded': { endpoint: string; limit: number };
  'invalid_token': { tokenType: string };
  'csrf_violation': { endpoint: string };
}
```

### Security Context Tracking

```typescript
// Middleware for security context tracking
import { SecurityMonitor } from '@/lib/security/security-monitor';

export async function securityMiddleware(request: NextRequest) {
  const securityMonitor = SecurityMonitor.getInstance();
  const startTime = Date.now();
  
  // Create security context
  const securityContext = {
    requestId: crypto.randomUUID(),
    ipAddress: request.ip,
    userAgent: request.headers.get('user-agent'),
    endpoint: request.nextUrl.pathname,
    method: request.method,
    timestamp: new Date()
  };
  
  // Log request start
  await securityMonitor.logSecurityEvent({
    eventType: 'request_start',
    context: securityContext
  });
  
  try {
    // Process request
    const response = await next();
    
    // Log successful request
    await securityMonitor.logSecurityEvent({
      eventType: 'request_success',
      context: {
        ...securityContext,
        responseTime: Date.now() - startTime,
        statusCode: response.status
      }
    });
    
    return response;
    
  } catch (error) {
    // Log request error
    await securityMonitor.logSecurityEvent({
      eventType: 'request_error',
      context: {
        ...securityContext,
        error: error.message,
        responseTime: Date.now() - startTime
      }
    });
    
    throw error;
  }
}
```

## Performance Monitoring Patterns

### PerformanceMonitor Usage

The `PerformanceMonitor` class provides comprehensive performance tracking and optimization insights.

#### Basic Performance Tracking

```typescript
import { PerformanceMonitor } from '@/lib/monitoring/performance-monitor';

// Initialize performance monitor
const performanceMonitor = PerformanceMonitor.getInstance();

// Track API endpoint performance
const apiTimer = performanceMonitor.startTimer('api_endpoint', {
  endpoint: '/api/reservations',
  method: 'GET',
  userId: 'user123'
});

try {
  const result = await fetchReservations();
  
  // End timer with success
  apiTimer.end({
    success: true,
    recordCount: result.length,
    cacheHit: result.fromCache
  });
  
  return result;
  
} catch (error) {
  // End timer with error
  apiTimer.end({
    success: false,
    error: error.message
  });
  
  throw error;
}
```

#### Database Query Performance

```typescript
// Track database query performance
async function getReservationsWithPerformanceTracking(userId: string) {
  const performanceMonitor = PerformanceMonitor.getInstance();
  
  const dbTimer = performanceMonitor.startTimer('database_query', {
    operation: 'select',
    table: 'reservations',
    userId
  });
  
  try {
    const query = supabase
      .from('reservations')
      .select(`
        *,
        rooms(name),
        users(name)
      `)
      .eq('user_id', userId);
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    dbTimer.end({
      success: true,
      recordCount: data.length,
      queryComplexity: 'medium' // simple, medium, complex
    });
    
    return data;
    
  } catch (error) {
    dbTimer.end({
      success: false,
      error: error.message
    });
    
    throw error;
  }
}
```

#### React Hook Performance Monitoring

```typescript
// Custom hook with performance monitoring
import { useQuery } from '@tanstack/react-query';
import { PerformanceMonitor } from '@/lib/monitoring/performance-monitor';

export function useReservationsWithMonitoring(userId: string) {
  const performanceMonitor = PerformanceMonitor.getInstance();
  
  return useQuery({
    queryKey: ['reservations', userId],
    queryFn: async () => {
      const hookTimer = performanceMonitor.startTimer('react_hook', {
        hook: 'useReservations',
        userId,
        component: 'ReservationsList'
      });
      
      try {
        const data = await fetchUserReservations(userId);
        
        hookTimer.end({
          success: true,
          recordCount: data.length,
          cacheStrategy: 'stale-while-revalidate'
        });
        
        return data;
        
      } catch (error) {
        hookTimer.end({
          success: false,
          error: error.message
        });
        
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
    retry: (failureCount, error) => {
      // Log retry attempts
      performanceMonitor.logEvent('query_retry', {
        hook: 'useReservations',
        failureCount,
        error: error.message,
        userId
      });
      
      return failureCount < 3;
    }
  });
}
```

#### Performance Metrics Collection

```typescript
// Collect and analyze performance metrics
class PerformanceAnalyzer {
  private performanceMonitor: PerformanceMonitor;
  
  constructor() {
    this.performanceMonitor = PerformanceMonitor.getInstance();
  }
  
  async generatePerformanceReport() {
    const metrics = await this.performanceMonitor.getMetrics();
    
    return {
      apiPerformance: this.analyzeApiPerformance(metrics.api),
      databasePerformance: this.analyzeDatabasePerformance(metrics.database),
      frontendPerformance: this.analyzeFrontendPerformance(metrics.frontend),
      recommendations: this.generateRecommendations(metrics)
    };
  }
  
  private analyzeApiPerformance(apiMetrics: ApiMetric[]) {
    const endpointStats = apiMetrics.reduce((acc, metric) => {
      const endpoint = metric.endpoint;
      if (!acc[endpoint]) {
        acc[endpoint] = {
          totalRequests: 0,
          totalTime: 0,
          errors: 0,
          averageResponseTime: 0
        };
      }
      
      acc[endpoint].totalRequests++;
      acc[endpoint].totalTime += metric.duration;
      if (!metric.success) acc[endpoint].errors++;
      
      return acc;
    }, {} as Record<string, any>);
    
    // Calculate averages and identify slow endpoints
    Object.keys(endpointStats).forEach(endpoint => {
      const stats = endpointStats[endpoint];
      stats.averageResponseTime = stats.totalTime / stats.totalRequests;
      stats.errorRate = stats.errors / stats.totalRequests;
    });
    
    return endpointStats;
  }
  
  private generateRecommendations(metrics: PerformanceMetrics) {
    const recommendations = [];
    
    // Identify slow API endpoints
    const slowEndpoints = Object.entries(metrics.api)
      .filter(([_, stats]) => stats.averageResponseTime > 500)
      .map(([endpoint]) => endpoint);
    
    if (slowEndpoints.length > 0) {
      recommendations.push({
        type: 'performance',
        severity: 'medium',
        message: `Slow API endpoints detected: ${slowEndpoints.join(', ')}`,
        action: 'Consider optimizing database queries or adding caching'
      });
    }
    
    // Identify high error rates
    const highErrorEndpoints = Object.entries(metrics.api)
      .filter(([_, stats]) => stats.errorRate > 0.05)
      .map(([endpoint]) => endpoint);
    
    if (highErrorEndpoints.length > 0) {
      recommendations.push({
        type: 'reliability',
        severity: 'high',
        message: `High error rates detected: ${highErrorEndpoints.join(', ')}`,
        action: 'Review error handling and add proper validation'
      });
    }
    
    return recommendations;
  }
}
```

## Environment Security Management

### EnvironmentSecurityManager Usage

The `EnvironmentSecurityManager` provides centralized and secure access to environment variables.

#### Basic Environment Variable Access

```typescript
import { environmentManager } from '@/lib/security/environment-manager';

// Access public environment variables
const supabaseUrl = environmentManager.getPublicKey('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = environmentManager.getPublicKey('NEXT_PUBLIC_SUPABASE_ANON_KEY');

// Access server-only environment variables
const serverConfig = {
  supabaseUrl: environmentManager.getServerKey('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: environmentManager.getServerKey('NEXT_PUBLIC_SUPABASE_ANON_KEY')
};

// Access service role key (restricted access)
import { getServiceRoleKey } from '@/lib/security/environment-manager';

const serviceKey = getServiceRoleKey({
  caller: 'createAdminClient',
  endpoint: '/api/admin/users',
  userId: 'admin123'
});
```

#### Creating Secure Supabase Clients

```typescript
// lib/supabase/clients.ts
import { createClient } from '@supabase/supabase-js';
import { environmentManager, getServiceRoleKey } from '@/lib/security/environment-manager';

// Public client (for client-side operations)
export const supabasePublic = createClient(
  environmentManager.getPublicKey('NEXT_PUBLIC_SUPABASE_URL'),
  environmentManager.getPublicKey('NEXT_PUBLIC_SUPABASE_ANON_KEY')
);

// Server client (for server-side operations)
export const supabaseServer = createClient(
  environmentManager.getServerKey('NEXT_PUBLIC_SUPABASE_URL'),
  environmentManager.getServerKey('NEXT_PUBLIC_SUPABASE_ANON_KEY')
);

// Admin client (for administrative operations)
export function createAdminClient(context: {
  caller: string;
  endpoint: string;
  userId?: string;
}) {
  const serviceKey = getServiceRoleKey(context);
  
  return createClient(
    environmentManager.getServerKey('NEXT_PUBLIC_SUPABASE_URL'),
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
```

#### Environment Validation

```typescript
// Validate environment configuration at startup
import { environmentManager } from '@/lib/security/environment-manager';

export function validateEnvironmentConfiguration() {
  const validationResult = environmentManager.validateEnvironment();
  
  if (!validationResult.valid) {
    console.error('Environment validation failed:', validationResult.errors);
    
    if (process.env.NODE_ENV === 'production') {
      // In production, exit if validation fails
      process.exit(1);
    } else {
      // In development, show warnings but continue
      console.warn('Continuing with invalid environment configuration');
    }
  }
  
  return validationResult;
}

// Call during application initialization
validateEnvironmentConfiguration();
```

## Data Integrity and Type Safety

### UserIdGuards Implementation

The `UserIdGuards` provide runtime validation and type safety for user identifiers.

#### Branded Types for Type Safety

```typescript
// types/user-ids.ts
export type AuthId = string & { readonly __brand: 'AuthId' };
export type DatabaseUserId = string & { readonly __brand: 'DatabaseUserId' };

// Type guard functions
export function isAuthId(value: unknown): value is AuthId {
  return typeof value === 'string' && 
         /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isDatabaseUserId(value: unknown): value is DatabaseUserId {
  return typeof value === 'string' && 
         /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

// Type conversion functions
export function toAuthId(value: string): AuthId {
  if (!isAuthId(value)) {
    throw new Error(`Invalid AuthId format: ${value}`);
  }
  return value as AuthId;
}

export function toDatabaseUserId(value: string): DatabaseUserId {
  if (!isDatabaseUserId(value)) {
    throw new Error(`Invalid DatabaseUserId format: ${value}`);
  }
  return value as DatabaseUserId;
}
```

#### UserIdGuards Usage

```typescript
import { UserIdGuards } from '@/lib/security/user-id-guards';
import { AuthId, DatabaseUserId } from '@/types/user-ids';

// Validate user ID consistency
async function validateUserOperation(authId: AuthId, databaseUserId: DatabaseUserId) {
  const guards = UserIdGuards.getInstance();
  
  const validationResult = await guards.validateUserIdConsistency({
    authId,
    databaseUserId,
    operation: 'update',
    context: {
      endpoint: '/api/users/profile',
      timestamp: new Date()
    }
  });
  
  if (!validationResult.valid) {
    throw new Error(`User ID validation failed: ${validationResult.errors.join(', ')}`);
  }
  
  return validationResult;
}

// Use in API routes
export async function PUT(request: NextRequest) {
  try {
    const { userId, authId } = await request.json();
    
    // Validate user IDs before processing
    await validateUserOperation(
      toAuthId(authId),
      toDatabaseUserId(userId)
    );
    
    // Proceed with update operation
    const result = await updateUserProfile(userId, updateData);
    
    return NextResponse.json({ success: true, data: result });
    
  } catch (error) {
    if (error.message.includes('User ID validation failed')) {
      return NextResponse.json(
        { error: 'Invalid user identification' },
        { status: 400 }
      );
    }
    
    throw error;
  }
}
```

#### Database Operation Validation

```typescript
// Validate database operations with user ID guards
class SecureUserRepository {
  private userIdGuards: UserIdGuards;
  
  constructor() {
    this.userIdGuards = UserIdGuards.getInstance();
  }
  
  async updateUser(authId: AuthId, databaseUserId: DatabaseUserId, updateData: any) {
    // Validate user ID consistency
    const validation = await this.userIdGuards.validateUserIdConsistency({
      authId,
      databaseUserId,
      operation: 'update',
      context: {
        table: 'users',
        timestamp: new Date()
      }
    });
    
    if (!validation.valid) {
      throw new Error(`User validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Perform database update
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', databaseUserId)
      .eq('auth_id', authId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Database update failed: ${error.message}`);
    }
    
    // Log successful operation
    await this.userIdGuards.logValidationEvent({
      eventType: 'user_update_success',
      authId,
      databaseUserId,
      operation: 'update'
    });
    
    return data;
  }
  
  async deleteUser(authId: AuthId, databaseUserId: DatabaseUserId) {
    // Extra validation for delete operations
    const validation = await this.userIdGuards.validateUserIdConsistency({
      authId,
      databaseUserId,
      operation: 'delete',
      context: {
        table: 'users',
        requiresAdminRole: true,
        timestamp: new Date()
      }
    });
    
    if (!validation.valid) {
      throw new Error(`User validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Check for dependent records
    const dependentRecords = await this.checkDependentRecords(databaseUserId);
    if (dependentRecords.length > 0) {
      throw new Error(`Cannot delete user with dependent records: ${dependentRecords.join(', ')}`);
    }
    
    // Perform soft delete
    const { data, error } = await supabase
      .from('users')
      .update({ is_active: false, deleted_at: new Date() })
      .eq('id', databaseUserId)
      .eq('auth_id', authId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`User deletion failed: ${error.message}`);
    }
    
    return data;
  }
  
  private async checkDependentRecords(userId: DatabaseUserId): Promise<string[]> {
    const dependencies = [];
    
    // Check for active reservations
    const { data: reservations } = await supabase
      .from('reservations')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['confirmed', 'in_progress']);
    
    if (reservations && reservations.length > 0) {
      dependencies.push(`${reservations.length} active reservations`);
    }
    
    return dependencies;
  }
}
```

## API Standardization Patterns

### Input Validation Middleware

```typescript
// lib/middleware/validation.ts
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

export function withValidation<T>(
  schema: z.ZodSchema<T>,
  handler: (req: NextRequest, validatedData: T) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    try {
      // Parse request body
      const body = await req.json();
      
      // Validate input
      const validatedData = schema.parse(body);
      
      // Call the actual handler with validated data
      return await handler(req, validatedData);
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message
            }))
          },
          { status: 400 }
        );
      }
      
      // Re-throw other errors
      throw error;
    }
  };
}
```

#### Standardized API Schemas

```typescript
// lib/schemas/api-schemas.ts
import { z } from 'zod';

// User schemas
export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  department: z.string().min(1, 'Department is required'),
  employeeId: z.string().optional(),
  role: z.enum(['employee', 'admin']).default('employee')
});

export const UpdateUserSchema = CreateUserSchema.partial().extend({
  id: z.string().uuid('Invalid user ID format')
});

// Reservation schemas
export const CreateReservationSchema = z.object({
  roomId: z.string().uuid('Invalid room ID format'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  purpose: z.string().max(500, 'Purpose too long').optional(),
  startTime: z.string().datetime('Invalid start time format'),
  endTime: z.string().datetime('Invalid end time format')
}).refine(
  (data) => new Date(data.startTime) < new Date(data.endTime),
  {
    message: 'Start time must be before end time',
    path: ['startTime']
  }
).refine(
  (data) => new Date(data.startTime) > new Date(),
  {
    message: 'Cannot create reservation in the past',
    path: ['startTime']
  }
);

// Pagination schema
export const PaginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc')
});
```

#### Using Validation Middleware

```typescript
// pages/api/users/index.ts
import { withValidation } from '@/lib/middleware/validation';
import { CreateUserSchema } from '@/lib/schemas/api-schemas';
import { NextRequest, NextResponse } from 'next/server';

export const POST = withValidation(
  CreateUserSchema,
  async (req: NextRequest, validatedData) => {
    try {
      // Data is already validated at this point
      const newUser = await createUser(validatedData);
      
      return NextResponse.json({
        success: true,
        data: newUser
      }, { status: 201 });
      
    } catch (error) {
      return NextResponse.json({
        error: 'Failed to create user',
        message: error.message
      }, { status: 500 });
    }
  }
);
```

### Standardized Error Handling

```typescript
// lib/errors/api-error-handler.ts
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error);
  
  if (error instanceof ApiError) {
    return NextResponse.json({
      error: error.message,
      code: error.code,
      details: error.details
    }, { status: error.statusCode });
  }
  
  if (error instanceof z.ZodError) {
    return NextResponse.json({
      error: 'Validation failed',
      details: error.errors
    }, { status: 400 });
  }
  
  // Generic error response
  return NextResponse.json({
    error: 'Internal server error'
  }, { status: 500 });
}

// Usage in API routes
export async function GET(req: NextRequest) {
  try {
    const data = await fetchData();
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
```

## Best Practices

### 1. Security Monitoring Best Practices

- **Log all authentication events** (success and failure)
- **Track authorization decisions** for audit trails
- **Monitor for suspicious patterns** (multiple failed logins, unusual access patterns)
- **Use structured logging** with consistent event types
- **Implement rate limiting** with security event logging
- **Regular security audit reviews** of logged events

### 2. Performance Monitoring Best Practices

- **Monitor critical user journeys** end-to-end
- **Set performance budgets** and alert on violations
- **Track both client and server performance**
- **Monitor database query performance**
- **Use performance data for optimization decisions**
- **Regular performance review meetings**

### 3. Environment Security Best Practices

- **Never hardcode secrets** in source code
- **Use different keys** for different environments
- **Rotate keys regularly** (quarterly recommended)
- **Audit environment variable access**
- **Validate environment configuration** at startup
- **Use least privilege principle** for service role keys

### 4. Data Integrity Best Practices

- **Use branded types** for type safety
- **Validate user IDs** at API boundaries
- **Implement database constraints** as backup validation
- **Log all validation failures** for debugging
- **Regular data integrity audits**
- **Automated data consistency checks**

## Troubleshooting

### Common Issues and Solutions

#### 1. Security Monitor Not Logging Events

**Symptoms**: Security events not appearing in logs
**Possible Causes**:
- SecurityMonitor not properly initialized
- Database connection issues
- Insufficient permissions

**Solutions**:
```typescript
// Check SecurityMonitor initialization
const monitor = SecurityMonitor.getInstance();
console.log('Monitor initialized:', monitor.isInitialized());

// Test database connection
await monitor.testConnection();

// Check permissions
await monitor.validatePermissions();
```

#### 2. Performance Monitor High Memory Usage

**Symptoms**: Application memory usage increasing over time
**Possible Causes**:
- Performance metrics not being cleaned up
- Too many concurrent timers
- Memory leaks in event listeners

**Solutions**:
```typescript
// Configure cleanup intervals
const performanceMonitor = PerformanceMonitor.getInstance();
performanceMonitor.configure({
  maxMetricsInMemory: 1000,
  cleanupInterval: 60000, // 1 minute
  enableGarbageCollection: true
});

// Manual cleanup
performanceMonitor.cleanup();
```

#### 3. Environment Variable Access Denied

**Symptoms**: Service role key access denied errors
**Possible Causes**:
- Unauthorized caller
- Non-admin endpoint trying to access service key
- Missing context information

**Solutions**:
```typescript
// Check authorized callers list
import { environmentManager } from '@/lib/security/environment-manager';

const accessLog = environmentManager.getServiceRoleAccessLog();
console.log('Recent access attempts:', accessLog);

// Verify caller authorization
const isAuthorized = environmentManager.isAuthorizedCaller('your-caller-name');
console.log('Caller authorized:', isAuthorized);
```

#### 4. User ID Validation Failures

**Symptoms**: User operations failing with validation errors
**Possible Causes**:
- Mismatched auth_id and database user_id
- Invalid UUID formats
- Database inconsistencies

**Solutions**:
```typescript
// Debug user ID validation
import { UserIdGuards } from '@/lib/security/user-id-guards';

const guards = UserIdGuards.getInstance();
const debugInfo = await guards.debugUserIdConsistency(authId, databaseUserId);
console.log('Debug info:', debugInfo);

// Run consistency check
const consistencyReport = await guards.runConsistencyCheck();
console.log('Consistency report:', consistencyReport);
```

### Debugging Tools

#### 1. Security Event Viewer

```typescript
// Create a debug endpoint to view security events
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }
  
  const securityMonitor = SecurityMonitor.getInstance();
  const events = await securityMonitor.getRecentEvents(100);
  
  return NextResponse.json({ events });
}
```

#### 2. Performance Metrics Dashboard

```typescript
// Create a debug endpoint for performance metrics
export async function GET(req: NextRequest) {
  const performanceMonitor = PerformanceMonitor.getInstance();
  const metrics = await performanceMonitor.getMetricsSummary();
  
  return NextResponse.json({
    summary: metrics,
    recommendations: await performanceMonitor.getRecommendations()
  });
}
```

#### 3. Environment Configuration Checker

```typescript
// Debug endpoint for environment configuration
export async function GET(req: NextRequest) {
  const environmentManager = require('@/lib/security/environment-manager').environmentManager;
  const validation = environmentManager.validateEnvironment();
  
  return NextResponse.json({
    valid: validation.valid,
    errors: validation.errors,
    warnings: validation.warnings,
    configuration: {
      nodeEnv: process.env.NODE_ENV,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    }
  });
}
```

---

This developer guide provides comprehensive patterns and best practices for implementing security and performance monitoring in the RoomBook application. Regular review and updates of these patterns ensure continued security and performance optimization.