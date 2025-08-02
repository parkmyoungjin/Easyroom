# API Standardization Patterns and Validation Requirements

## Overview

This guide documents the standardized patterns for API development, input validation, error handling, and response formatting in the RoomBook application. These patterns ensure consistency, security, and maintainability across all API endpoints.

## Table of Contents

1. [API Design Principles](#api-design-principles)
2. [Input Validation Patterns](#input-validation-patterns)
3. [Response Standardization](#response-standardization)
4. [Error Handling Patterns](#error-handling-patterns)
5. [Authentication and Authorization](#authentication-and-authorization)
6. [Pagination and Filtering](#pagination-and-filtering)
7. [Rate Limiting](#rate-limiting)
8. [API Documentation](#api-documentation)

## API Design Principles

### 1. RESTful Design

All APIs follow RESTful conventions:

```typescript
// Resource-based URLs
GET    /api/reservations          // List reservations
POST   /api/reservations          // Create reservation
GET    /api/reservations/{id}     // Get specific reservation
PUT    /api/reservations/{id}     // Update reservation
DELETE /api/reservations/{id}     // Delete reservation

// Nested resources
GET    /api/users/{id}/reservations    // Get user's reservations
POST   /api/rooms/{id}/reservations    // Create reservation for room
```

### 2. Consistent HTTP Status Codes

```typescript
// Success responses
200 OK          // Successful GET, PUT, PATCH
201 Created     // Successful POST
204 No Content  // Successful DELETE

// Client error responses
400 Bad Request         // Invalid input data
401 Unauthorized       // Authentication required
403 Forbidden          // Insufficient permissions
404 Not Found          // Resource not found
409 Conflict           // Resource conflict (e.g., duplicate)
422 Unprocessable Entity // Validation errors

// Server error responses
500 Internal Server Error // Unexpected server error
503 Service Unavailable   // Temporary service issues
```

### 3. Content Type Standards

```typescript
// Request headers
Content-Type: application/json
Accept: application/json

// Response headers
Content-Type: application/json; charset=utf-8
```

## Input Validation Patterns

### 1. Validation Middleware

```typescript
// lib/middleware/validation.ts
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { SecurityMonitor } from '@/lib/security/security-monitor';

export function withValidation<T>(
  schema: z.ZodSchema<T>,
  handler: (req: NextRequest, validatedData: T, context: ValidationContext) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const securityMonitor = SecurityMonitor.getInstance();
    const startTime = Date.now();
    
    try {
      // Parse request body
      const body = await req.json();
      
      // Create validation context
      const context: ValidationContext = {
        endpoint: req.nextUrl.pathname,
        method: req.method,
        userAgent: req.headers.get('user-agent'),
        ipAddress: req.ip,
        timestamp: new Date()
      };
      
      // Validate input
      const validatedData = schema.parse(body);
      
      // Log successful validation
      await securityMonitor.logValidationEvent({
        eventType: 'validation_success',
        endpoint: context.endpoint,
        validationTime: Date.now() - startTime
      });
      
      // Call the actual handler with validated data
      return await handler(req, validatedData, context);
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Log validation failure
        await securityMonitor.logValidationEvent({
          eventType: 'validation_failure',
          endpoint: req.nextUrl.pathname,
          errors: error.errors,
          validationTime: Date.now() - startTime
        });
        
        return NextResponse.json(
          {
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code
            }))
          },
          { status: 422 }
        );
      }
      
      if (error instanceof SyntaxError) {
        return NextResponse.json(
          {
            error: 'Invalid JSON format',
            code: 'INVALID_JSON'
          },
          { status: 400 }
        );
      }
      
      // Re-throw other errors
      throw error;
    }
  };
}

interface ValidationContext {
  endpoint: string;
  method: string;
  userAgent: string | null;
  ipAddress: string | null;
  timestamp: Date;
}
```

### 2. Comprehensive Validation Schemas

```typescript
// lib/schemas/validation-schemas.ts
import { z } from 'zod';

// Base schemas
export const UUIDSchema = z.string().uuid('Invalid UUID format');
export const EmailSchema = z.string().email('Invalid email format');
export const DateTimeSchema = z.string().datetime('Invalid datetime format');

// User validation schemas
export const CreateUserSchema = z.object({
  email: EmailSchema,
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s가-힣]+$/, 'Name contains invalid characters'),
  department: z.string()
    .min(1, 'Department is required')
    .max(50, 'Department must be less than 50 characters'),
  employeeId: z.string()
    .regex(/^\d{7}$/, 'Employee ID must be 7 digits')
    .optional(),
  role: z.enum(['employee', 'admin']).default('employee')
});

export const UpdateUserSchema = CreateUserSchema.partial().extend({
  id: UUIDSchema
});

// Reservation validation schemas
export const CreateReservationSchema = z.object({
  roomId: UUIDSchema,
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters'),
  purpose: z.string()
    .max(500, 'Purpose must be less than 500 characters')
    .optional(),
  startTime: DateTimeSchema,
  endTime: DateTimeSchema,
  attendees: z.array(z.string().email()).max(20, 'Maximum 20 attendees').optional()
}).refine(
  (data) => {
    const start = new Date(data.startTime);
    const end = new Date(data.endTime);
    return start < end;
  },
  {
    message: 'Start time must be before end time',
    path: ['startTime']
  }
).refine(
  (data) => {
    const start = new Date(data.startTime);
    const now = new Date();
    return start > now;
  },
  {
    message: 'Cannot create reservation in the past',
    path: ['startTime']
  }
).refine(
  (data) => {
    const start = new Date(data.startTime);
    const end = new Date(data.endTime);
    const duration = end.getTime() - start.getTime();
    const maxDuration = 8 * 60 * 60 * 1000; // 8 hours
    return duration <= maxDuration;
  },
  {
    message: 'Reservation cannot exceed 8 hours',
    path: ['endTime']
  }
);

// Query parameter schemas
export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc')
});

export const ReservationFilterSchema = z.object({
  roomId: UUIDSchema.optional(),
  userId: UUIDSchema.optional(),
  status: z.enum(['confirmed', 'cancelled', 'completed', 'in_progress']).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional()
});

// File upload schemas
export const FileUploadSchema = z.object({
  file: z.instanceof(File),
  maxSize: z.number().default(5 * 1024 * 1024), // 5MB
  allowedTypes: z.array(z.string()).default(['image/jpeg', 'image/png', 'application/pdf'])
}).refine(
  (data) => data.file.size <= data.maxSize,
  {
    message: 'File size exceeds maximum allowed size',
    path: ['file']
  }
).refine(
  (data) => data.allowedTypes.includes(data.file.type),
  {
    message: 'File type not allowed',
    path: ['file']
  }
);
```

### 3. Query Parameter Validation

```typescript
// lib/middleware/query-validation.ts
import { z } from 'zod';
import { NextRequest } from 'next/server';

export function validateQueryParams<T>(
  req: NextRequest,
  schema: z.ZodSchema<T>
): T {
  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams.entries());
  
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid query parameters', error.errors);
    }
    throw error;
  }
}

// Usage example
export async function GET(req: NextRequest) {
  try {
    const queryParams = validateQueryParams(req, z.object({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      offset: z.coerce.number().int().min(0).default(0),
      search: z.string().optional()
    }));
    
    const reservations = await getReservations(queryParams);
    
    return NextResponse.json({
      success: true,
      data: reservations,
      pagination: {
        limit: queryParams.limit,
        offset: queryParams.offset,
        total: reservations.total
      }
    });
    
  } catch (error) {
    return handleApiError(error);
  }
}
```

## Response Standardization

### 1. Standard Response Format

```typescript
// lib/types/api-responses.ts
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
  timestamp: string;
  requestId: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

export interface ValidationErrorResponse extends ApiResponse {
  details: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}
```

### 2. Response Helper Functions

```typescript
// lib/utils/api-responses.ts
import { NextResponse } from 'next/server';
import { ApiResponse, PaginatedResponse } from '@/lib/types/api-responses';

export function createSuccessResponse<T>(
  data: T,
  status: number = 200,
  message?: string
): NextResponse {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
    requestId: crypto.randomUUID()
  };
  
  return NextResponse.json(response, { status });
}

export function createErrorResponse(
  error: string,
  status: number = 500,
  code?: string,
  details?: any
): NextResponse {
  const response: ApiResponse = {
    success: false,
    error,
    code,
    timestamp: new Date().toISOString(),
    requestId: crypto.randomUUID(),
    ...(details && { details })
  };
  
  return NextResponse.json(response, { status });
}

export function createPaginatedResponse<T>(
  data: T[],
  pagination: {
    limit: number;
    offset: number;
    total: number;
  }
): NextResponse {
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    pagination: {
      ...pagination,
      hasMore: pagination.offset + pagination.limit < pagination.total
    },
    timestamp: new Date().toISOString(),
    requestId: crypto.randomUUID()
  };
  
  return NextResponse.json(response);
}

// Usage examples
export async function GET(req: NextRequest) {
  try {
    const reservations = await getReservations();
    return createSuccessResponse(reservations);
  } catch (error) {
    return createErrorResponse('Failed to fetch reservations', 500, 'FETCH_ERROR');
  }
}

export async function POST(req: NextRequest) {
  try {
    const newReservation = await createReservation(validatedData);
    return createSuccessResponse(
      newReservation, 
      201, 
      'Reservation created successfully'
    );
  } catch (error) {
    return createErrorResponse('Failed to create reservation', 500, 'CREATE_ERROR');
  }
}
```

## Error Handling Patterns

### 1. Centralized Error Handler

```typescript
// lib/errors/api-error-handler.ts
import { NextResponse } from 'next/server';
import { SecurityMonitor } from '@/lib/security/security-monitor';

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = 'ApiError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, public validationErrors: any[]) {
    super(message, 422, 'VALIDATION_ERROR', validationErrors);
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export async function handleApiError(error: unknown, context?: any): Promise<NextResponse> {
  const securityMonitor = SecurityMonitor.getInstance();
  
  // Log error for monitoring
  await securityMonitor.logErrorEvent({
    error: error instanceof Error ? error : new Error(String(error)),
    context,
    timestamp: new Date()
  });
  
  if (error instanceof ApiError) {
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code,
      details: error.details,
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID()
    }, { status: error.statusCode });
  }
  
  if (error instanceof z.ZodError) {
    return NextResponse.json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      })),
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID()
    }, { status: 422 });
  }
  
  // Log unexpected errors
  console.error('Unexpected API error:', error);
  
  return NextResponse.json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
    requestId: crypto.randomUUID()
  }, { status: 500 });
}
```

### 2. Error Handling Middleware

```typescript
// lib/middleware/error-handling.ts
import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors/api-error-handler';

export function withErrorHandling(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    try {
      return await handler(req);
    } catch (error) {
      return await handleApiError(error, {
        endpoint: req.nextUrl.pathname,
        method: req.method,
        userAgent: req.headers.get('user-agent'),
        ipAddress: req.ip
      });
    }
  };
}

// Usage
export const GET = withErrorHandling(async (req: NextRequest) => {
  const data = await fetchData();
  return createSuccessResponse(data);
});
```

## Authentication and Authorization

### 1. Authentication Middleware

```typescript
// lib/middleware/auth.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { AuthenticationError, AuthorizationError } from '@/lib/errors/api-error-handler';

export function withAuth(
  handler: (req: NextRequest, user: User) => Promise<NextResponse>,
  options: AuthOptions = {}
) {
  return async (req: NextRequest) => {
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get: (name: string) => req.cookies.get(name)?.value,
            set: () => {}, // Not needed for API routes
            remove: () => {} // Not needed for API routes
          }
        }
      );
      
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        throw new AuthenticationError();
      }
      
      // Get user profile from database
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', user.id)
        .single();
      
      if (!profile) {
        throw new AuthenticationError('User profile not found');
      }
      
      // Check role requirements
      if (options.requiredRole && profile.role !== options.requiredRole) {
        throw new AuthorizationError(`${options.requiredRole} role required`);
      }
      
      // Check if user is active
      if (!profile.is_active) {
        throw new AuthorizationError('Account is inactive');
      }
      
      return await handler(req, { ...user, profile });
      
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
        throw error;
      }
      
      throw new AuthenticationError('Authentication failed');
    }
  };
}

interface AuthOptions {
  requiredRole?: 'employee' | 'admin';
  requireActive?: boolean;
}

interface User {
  id: string;
  email: string;
  profile: UserProfile;
}

// Usage examples
export const GET = withAuth(async (req, user) => {
  const data = await getUserData(user.profile.id);
  return createSuccessResponse(data);
});

export const POST = withAuth(async (req, user) => {
  const validatedData = await validateInput(req);
  const result = await createResource(validatedData, user.profile.id);
  return createSuccessResponse(result, 201);
}, { requiredRole: 'admin' });
```

### 2. Permission Checking

```typescript
// lib/utils/permissions.ts
export enum Permission {
  READ_RESERVATIONS = 'read:reservations',
  CREATE_RESERVATIONS = 'create:reservations',
  UPDATE_RESERVATIONS = 'update:reservations',
  DELETE_RESERVATIONS = 'delete:reservations',
  MANAGE_USERS = 'manage:users',
  VIEW_ADMIN_PANEL = 'view:admin'
}

export const RolePermissions: Record<string, Permission[]> = {
  employee: [
    Permission.READ_RESERVATIONS,
    Permission.CREATE_RESERVATIONS,
    Permission.UPDATE_RESERVATIONS
  ],
  admin: [
    Permission.READ_RESERVATIONS,
    Permission.CREATE_RESERVATIONS,
    Permission.UPDATE_RESERVATIONS,
    Permission.DELETE_RESERVATIONS,
    Permission.MANAGE_USERS,
    Permission.VIEW_ADMIN_PANEL
  ]
};

export function hasPermission(userRole: string, permission: Permission): boolean {
  const permissions = RolePermissions[userRole] || [];
  return permissions.includes(permission);
}

export function requirePermission(permission: Permission) {
  return (req: NextRequest, user: User) => {
    if (!hasPermission(user.profile.role, permission)) {
      throw new AuthorizationError(`Permission ${permission} required`);
    }
  };
}
```

## Pagination and Filtering

### 1. Pagination Implementation

```typescript
// lib/utils/pagination.ts
export interface PaginationParams {
  limit: number;
  offset: number;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
    totalPages: number;
    currentPage: number;
  };
}

export async function paginateQuery<T>(
  query: any, // Supabase query builder
  params: PaginationParams,
  countQuery?: any
): Promise<PaginationResult<T>> {
  // Apply sorting
  if (params.sortBy) {
    query = query.order(params.sortBy, { ascending: params.sortOrder === 'asc' });
  }
  
  // Apply pagination
  query = query.range(params.offset, params.offset + params.limit - 1);
  
  // Execute query
  const { data, error, count } = await query;
  
  if (error) {
    throw new ApiError(`Query failed: ${error.message}`, 500, 'QUERY_ERROR');
  }
  
  // Get total count if not provided
  let total = count;
  if (total === null && countQuery) {
    const { count: totalCount } = await countQuery;
    total = totalCount || 0;
  }
  
  const totalPages = Math.ceil((total || 0) / params.limit);
  const currentPage = Math.floor(params.offset / params.limit) + 1;
  
  return {
    data: data || [],
    pagination: {
      limit: params.limit,
      offset: params.offset,
      total: total || 0,
      hasMore: params.offset + params.limit < (total || 0),
      totalPages,
      currentPage
    }
  };
}

// Usage example
export const GET = withAuth(async (req, user) => {
  const queryParams = validateQueryParams(req, PaginationSchema.extend({
    search: z.string().optional(),
    status: z.enum(['confirmed', 'cancelled', 'completed']).optional()
  }));
  
  let query = supabase
    .from('reservations')
    .select(`
      *,
      rooms(name),
      users(name)
    `, { count: 'exact' });
  
  // Apply filters
  if (queryParams.search) {
    query = query.ilike('title', `%${queryParams.search}%`);
  }
  
  if (queryParams.status) {
    query = query.eq('status', queryParams.status);
  }
  
  const result = await paginateQuery(query, queryParams);
  
  return createPaginatedResponse(result.data, result.pagination);
});
```

### 2. Advanced Filtering

```typescript
// lib/utils/filtering.ts
export interface FilterOptions {
  search?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  status?: string[];
  tags?: string[];
}

export function applyFilters(query: any, filters: FilterOptions) {
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }
  
  if (filters.dateRange) {
    query = query
      .gte('start_time', filters.dateRange.start)
      .lte('start_time', filters.dateRange.end);
  }
  
  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }
  
  if (filters.tags && filters.tags.length > 0) {
    query = query.contains('tags', filters.tags);
  }
  
  return query;
}
```

## Rate Limiting

### 1. Rate Limiting Middleware

```typescript
// lib/middleware/rate-limiting.ts
import { NextRequest, NextResponse } from 'next/server';
import { SecurityMonitor } from '@/lib/security/security-monitor';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: NextRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function withRateLimit(config: RateLimitConfig) {
  return function(handler: (req: NextRequest) => Promise<NextResponse>) {
    return async (req: NextRequest) => {
      const securityMonitor = SecurityMonitor.getInstance();
      const key = config.keyGenerator ? config.keyGenerator(req) : req.ip || 'anonymous';
      const now = Date.now();
      
      // Clean up expired entries
      for (const [k, v] of rateLimitStore.entries()) {
        if (v.resetTime < now) {
          rateLimitStore.delete(k);
        }
      }
      
      // Get or create rate limit entry
      let entry = rateLimitStore.get(key);
      if (!entry || entry.resetTime < now) {
        entry = {
          count: 0,
          resetTime: now + config.windowMs
        };
        rateLimitStore.set(key, entry);
      }
      
      // Check rate limit
      if (entry.count >= config.maxRequests) {
        // Log rate limit violation
        await securityMonitor.logSecurityViolation({
          eventType: 'rate_limit_exceeded',
          severity: 'medium',
          description: `Rate limit exceeded for ${key}`,
          ipAddress: req.ip,
          metadata: {
            endpoint: req.nextUrl.pathname,
            method: req.method,
            limit: config.maxRequests,
            windowMs: config.windowMs
          }
        });
        
        return NextResponse.json({
          success: false,
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((entry.resetTime - now) / 1000)
        }, { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((entry.resetTime - now) / 1000).toString(),
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': entry.resetTime.toString()
          }
        });
      }
      
      // Increment counter
      entry.count++;
      
      try {
        const response = await handler(req);
        
        // Add rate limit headers
        response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
        response.headers.set('X-RateLimit-Remaining', (config.maxRequests - entry.count).toString());
        response.headers.set('X-RateLimit-Reset', entry.resetTime.toString());
        
        return response;
        
      } catch (error) {
        // Optionally don't count failed requests
        if (config.skipFailedRequests) {
          entry.count--;
        }
        throw error;
      }
    };
  };
}

// Usage examples
export const POST = withRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  keyGenerator: (req) => req.ip || 'anonymous'
})(withAuth(async (req, user) => {
  // Handler implementation
}));

// Stricter rate limiting for sensitive endpoints
export const DELETE = withRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10,
  keyGenerator: (req) => req.ip || 'anonymous'
})(withAuth(async (req, user) => {
  // Handler implementation
}, { requiredRole: 'admin' }));
```

## API Documentation

### 1. OpenAPI Schema Generation

```typescript
// lib/docs/openapi-schema.ts
export const openApiSchema = {
  openapi: '3.0.0',
  info: {
    title: 'RoomBook API',
    version: '1.0.0',
    description: 'Meeting room reservation system API'
  },
  servers: [
    {
      url: 'https://roombook.example.com/api',
      description: 'Production server'
    },
    {
      url: 'http://localhost:3000/api',
      description: 'Development server'
    }
  ],
  components: {
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          department: { type: 'string' },
          role: { type: 'string', enum: ['employee', 'admin'] },
          isActive: { type: 'boolean' }
        }
      },
      Reservation: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          roomId: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          purpose: { type: 'string' },
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['confirmed', 'cancelled', 'completed', 'in_progress'] }
        }
      },
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
          error: { type: 'string' },
          code: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          requestId: { type: 'string', format: 'uuid' }
        }
      },
      ValidationError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string', example: 'Validation failed' },
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          details: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                message: { type: 'string' },
                code: { type: 'string' }
              }
            }
          }
        }
      }
    },
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  },
  paths: {
    '/reservations': {
      get: {
        summary: 'List reservations',
        tags: ['Reservations'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer', minimum: 0, default: 0 }
          },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['confirmed', 'cancelled', 'completed', 'in_progress'] }
          }
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Reservation' }
                        },
                        pagination: {
                          type: 'object',
                          properties: {
                            limit: { type: 'integer' },
                            offset: { type: 'integer' },
                            total: { type: 'integer' },
                            hasMore: { type: 'boolean' }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiResponse' }
              }
            }
          }
        }
      },
      post: {
        summary: 'Create reservation',
        tags: ['Reservations'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['roomId', 'title', 'startTime', 'endTime'],
                properties: {
                  roomId: { type: 'string', format: 'uuid' },
                  title: { type: 'string', minLength: 1, maxLength: 200 },
                  purpose: { type: 'string', maxLength: 500 },
                  startTime: { type: 'string', format: 'date-time' },
                  endTime: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Reservation created successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/Reservation' }
                      }
                    }
                  ]
                }
              }
            }
          },
          '422': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationError' }
              }
            }
          }
        }
      }
    }
  }
};
```

### 2. API Documentation Endpoint

```typescript
// pages/api/docs/openapi.json.ts
import { NextRequest, NextResponse } from 'next/server';
import { openApiSchema } from '@/lib/docs/openapi-schema';

export async function GET(req: NextRequest) {
  return NextResponse.json(openApiSchema);
}
```

## Testing API Endpoints

### 1. API Testing Utilities

```typescript
// lib/testing/api-test-utils.ts
import { NextRequest } from 'next/server';

export function createMockRequest(
  method: string,
  url: string,
  body?: any,
  headers?: Record<string, string>
): NextRequest {
  const request = new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    ...(body && { body: JSON.stringify(body) })
  });
  
  return request;
}

export async function testApiEndpoint(
  handler: (req: NextRequest) => Promise<Response>,
  request: NextRequest
) {
  const response = await handler(request);
  const data = await response.json();
  
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    data
  };
}
```

### 2. Example API Tests

```typescript
// __tests__/api/reservations.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';
import { POST, GET } from '@/app/api/reservations/route';
import { createMockRequest, testApiEndpoint } from '@/lib/testing/api-test-utils';

describe('/api/reservations', () => {
  describe('POST', () => {
    it('should create a reservation with valid data', async () => {
      const request = createMockRequest('POST', 'http://localhost:3000/api/reservations', {
        roomId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Team Meeting',
        startTime: '2024-01-15T10:00:00Z',
        endTime: '2024-01-15T11:00:00Z'
      });
      
      const response = await testApiEndpoint(POST, request);
      
      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('id');
    });
    
    it('should return validation error for invalid data', async () => {
      const request = createMockRequest('POST', 'http://localhost:3000/api/reservations', {
        roomId: 'invalid-uuid',
        title: '',
        startTime: 'invalid-date'
      });
      
      const response = await testApiEndpoint(POST, request);
      
      expect(response.status).toBe(422);
      expect(response.data.success).toBe(false);
      expect(response.data.code).toBe('VALIDATION_ERROR');
      expect(response.data.details).toBeInstanceOf(Array);
    });
  });
  
  describe('GET', () => {
    it('should return paginated reservations', async () => {
      const request = createMockRequest('GET', 'http://localhost:3000/api/reservations?limit=10&offset=0');
      
      const response = await testApiEndpoint(GET, request);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toBeInstanceOf(Array);
      expect(response.data.pagination).toHaveProperty('limit');
      expect(response.data.pagination).toHaveProperty('offset');
      expect(response.data.pagination).toHaveProperty('total');
    });
  });
});
```

---

This API standardization guide provides comprehensive patterns for building consistent, secure, and maintainable APIs in the RoomBook application. Following these patterns ensures code quality, security, and developer productivity across the entire application.