# Mandatory Input Validation Middleware

This middleware provides standardized zod-based validation for all API endpoints, ensuring consistent input validation and error handling across the application.

## Features

- **Automatic Input Validation**: Validates request body, query parameters, and route parameters using zod schemas
- **Consistent Error Handling**: Integrates with the existing `ReservationErrorHandler` for structured error responses
- **Type Safety**: Provides TypeScript types for validated request data
- **Pre-configured Schemas**: Includes common validation patterns for typical API operations
- **Comprehensive Logging**: Logs validation successes and failures for debugging

## Basic Usage

### 1. Import the middleware

```typescript
import { withValidation, validationSchemas } from '@/lib/middleware/validation';
```

### 2. Define your handler function

```typescript
async function myApiHandler(req: ValidatedRequest<BodyType, QueryType, ParamsType>) {
  // Access validated data through req.validatedBody, req.validatedQuery, req.validatedParams
  const { title, description } = req.validatedBody!;
  const { limit, offset } = req.validatedQuery!;
  const { id } = req.validatedParams!;
  
  // Your API logic here
  return NextResponse.json({ success: true });
}
```

### 3. Apply validation middleware

```typescript
export const POST = withValidation(
  {
    body: validationSchemas.createReservation.body,
    query: validationSchemas.publicReservations.query,
    params: commonQuerySchemas.uuid
  },
  myApiHandler
);
```

## Pre-configured Validation Schemas

### Common Query Schemas

```typescript
import { commonQuerySchemas } from '@/lib/middleware/validation';

// Pagination parameters
commonQuerySchemas.pagination
// Validates: { limit?: number, offset?: number }

// Date range parameters  
commonQuerySchemas.dateRange
// Validates: { startDate: string, endDate: string }

// UUID parameter
commonQuerySchemas.uuid
// Validates: { id: string (UUID format) }
```

### API-specific Schemas

```typescript
import { validationSchemas } from '@/lib/middleware/validation';

// Public reservations query
validationSchemas.publicReservations
// Combines dateRange + pagination

// Create reservation
validationSchemas.createReservation
// Body: { room_id, title, purpose?, start_time, end_time }

// Update reservation
validationSchemas.updateReservation
// Params: { id } + Body: partial reservation data

// Authentication
validationSchemas.login
// Body: { email, password }

validationSchemas.signup
// Body: { email, password, name, department }

// Room management
validationSchemas.createRoom
// Body: { name, description?, capacity?, location?, amenities? }

validationSchemas.updateRoom
// Params: { id } + Body: partial room data
```

## Custom Validation Schemas

### Creating Custom Schemas

```typescript
import { z } from 'zod';
import { withValidation } from '@/lib/middleware/validation';

const customValidation = {
  body: z.object({
    title: z.string().min(1, '제목을 입력해주세요'),
    tags: z.array(z.string()).max(10, '태그는 최대 10개까지 가능합니다')
  }),
  query: z.object({
    category: z.enum(['work', 'personal', 'meeting']),
    priority: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined)
  }),
  params: z.object({
    projectId: z.string().uuid('올바른 프로젝트 ID가 아닙니다')
  })
};

export const POST = withValidation(customValidation, myHandler);
```

### Schema Refinements

```typescript
const reservationSchema = z.object({
  start_time: z.string().datetime(),
  end_time: z.string().datetime()
}).refine(data => {
  return new Date(data.end_time) > new Date(data.start_time);
}, {
  message: '종료 시간은 시작 시간보다 늦어야 합니다',
  path: ['end_time']
});
```

## Error Handling

### Validation Error Response Format

```json
{
  "error": "입력 데이터가 올바르지 않습니다.",
  "code": "VALIDATION_ERROR",
  "validation_errors": [
    {
      "field": "email",
      "message": "올바른 이메일 형식이 아닙니다",
      "code": "invalid_string"
    },
    {
      "field": "password",
      "message": "비밀번호는 최소 8자 이상이어야 합니다",
      "code": "too_small"
    }
  ],
  "details": "Development mode error details" // Only in development
}
```

### Integration with ReservationErrorHandler

The middleware automatically integrates with the existing error handling system:

```typescript
// Validation errors are processed through ReservationErrorHandler
const structuredError = ReservationErrorHandler.handleApiError(error, {
  action: 'input_validation',
  endpoint: req.nextUrl.pathname,
  method: req.method,
  source: 'body' | 'query' | 'params',
  timestamp: new Date().toISOString()
});
```

## Migration Guide

### Converting Existing API Routes

**Before (manual validation):**

```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Manual validation
    if (!body.title || typeof body.title !== 'string') {
      return NextResponse.json({ error: '제목이 필요합니다' }, { status: 400 });
    }
    
    if (!body.room_id || !isValidUUID(body.room_id)) {
      return NextResponse.json({ error: '올바른 회의실 ID가 필요합니다' }, { status: 400 });
    }
    
    // API logic...
  } catch (error) {
    // Manual error handling...
  }
}
```

**After (with validation middleware):**

```typescript
async function createReservationHandler(req: ValidatedRequest<CreateReservationBody>) {
  // Validation is already done - access validated data directly
  const { title, room_id, start_time, end_time } = req.validatedBody!;
  
  // API logic...
  return NextResponse.json({ success: true });
}

export const POST = withValidation(
  validationSchemas.createReservation,
  createReservationHandler
);
```

### Step-by-Step Migration

1. **Identify validation logic** in your existing route
2. **Choose or create** appropriate validation schema
3. **Extract handler function** from the route
4. **Apply validation middleware** using `withValidation`
5. **Remove manual validation** from handler
6. **Update TypeScript types** to use `ValidatedRequest`
7. **Test the migrated route**

## Best Practices

### 1. Use Pre-configured Schemas When Possible

```typescript
// Good: Use existing schema
export const GET = withValidation(
  validationSchemas.publicReservations,
  handler
);

// Avoid: Creating duplicate schemas
const customSchema = {
  query: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime()
    // ... duplicating existing logic
  })
};
```

### 2. Combine Schemas for Complex Validation

```typescript
const complexValidation = {
  body: validationSchemas.createReservation.body,
  query: commonQuerySchemas.pagination,
  params: commonQuerySchemas.uuid
};
```

### 3. Provide Clear Error Messages

```typescript
const schema = z.object({
  email: z.string()
    .email('올바른 이메일 형식을 입력해주세요')
    .max(255, '이메일이 너무 깁니다 (최대 255자)'),
  password: z.string()
    .min(8, '비밀번호는 최소 8자 이상이어야 합니다')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, '대문자, 소문자, 숫자를 포함해야 합니다')
});
```

### 4. Handle Optional Parameters Correctly

```typescript
const querySchema = z.object({
  limit: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : undefined)
    .refine(val => val === undefined || (val > 0 && val <= 100), {
      message: 'limit은 1-100 사이의 숫자여야 합니다'
    })
});
```

## Testing

### Unit Testing Validation Schemas

```typescript
import { validationSchemas } from '@/lib/middleware/validation';

describe('Validation Schemas', () => {
  it('should validate reservation creation data', () => {
    const validData = {
      room_id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Team Meeting',
      start_time: '2024-01-01T10:00:00Z',
      end_time: '2024-01-01T11:00:00Z'
    };
    
    const result = validationSchemas.createReservation.body!.parse(validData);
    expect(result.title).toBe('Team Meeting');
  });
  
  it('should reject invalid data', () => {
    const invalidData = {
      room_id: 'invalid-uuid',
      title: '',
      start_time: '2024-01-01T11:00:00Z',
      end_time: '2024-01-01T10:00:00Z' // End before start
    };
    
    expect(() => {
      validationSchemas.createReservation.body!.parse(invalidData);
    }).toThrow();
  });
});
```

### Integration Testing

```typescript
import { withValidation } from '@/lib/middleware/validation';

describe('API Route with Validation', () => {
  it('should return validation error for invalid input', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ invalid: 'data' })
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
  });
});
```

## Performance Considerations

- **Schema Caching**: Zod schemas are compiled once and reused
- **Lazy Validation**: Only validates the parts of the request that are configured
- **Early Returns**: Validation errors return immediately without processing the request
- **Memory Efficient**: Minimal overhead for validated requests

## Security Benefits

- **Input Sanitization**: Automatically validates and sanitizes all inputs
- **Type Safety**: Prevents type-related security vulnerabilities
- **Consistent Validation**: Ensures all endpoints follow the same validation rules
- **Attack Prevention**: Blocks malformed requests before they reach business logic
- **Audit Trail**: Logs all validation attempts for security monitoring