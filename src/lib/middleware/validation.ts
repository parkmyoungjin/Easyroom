/**
 * Mandatory Input Validation Middleware
 * Provides standardized zod-based validation for all API endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { z, ZodSchema, ZodError } from 'zod';
import { ReservationErrorHandler } from '@/lib/utils/error-handler';
import { logger } from '@/lib/utils/logger';

export interface ValidationConfig {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export interface ValidatedRequest<T = any, Q = any, P = any> extends NextRequest {
  validatedBody?: T;
  validatedQuery?: Q;
  validatedParams?: P;
}

/**
 * Creates a validation middleware wrapper for API routes
 */
export function withValidation<T = any, Q = any, P = any>(
  config: ValidationConfig,
  handler: (req: ValidatedRequest<T, Q, P>, ...args: any[]) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const endpoint = req.nextUrl.pathname;
    const method = req.method;
    
    try {
      const validatedReq = req as ValidatedRequest<T, Q, P>;

      // Validate request body
      if (config.body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        try {
          const body = await req.json();
          validatedReq.validatedBody = config.body.parse(body);
          logger.debug('Request body validation successful', { endpoint, method });
        } catch (error) {
          if (error instanceof ZodError) {
            return handleValidationError(error, 'body', endpoint, method);
          }
          throw error;
        }
      }

      // Validate query parameters
      if (config.query) {
        try {
          const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
          validatedReq.validatedQuery = config.query.parse(searchParams);
          logger.debug('Query parameters validation successful', { endpoint, method });
        } catch (error) {
          if (error instanceof ZodError) {
            return handleValidationError(error, 'query', endpoint, method);
          }
          throw error;
        }
      }

      // Validate route parameters
      if (config.params && args.length > 0) {
        try {
          // Extract params from the context (Next.js 13+ App Router pattern)
          const context = args[0];
          const params = context?.params || {};
          validatedReq.validatedParams = config.params.parse(params);
          logger.debug('Route parameters validation successful', { endpoint, method });
        } catch (error) {
          if (error instanceof ZodError) {
            return handleValidationError(error, 'params', endpoint, method);
          }
          throw error;
        }
      }

      // Call the original handler with validated request
      return await handler(validatedReq, ...args);

    } catch (error) {
      const structuredError = ReservationErrorHandler.handleApiError(error, {
        action: 'validation_middleware',
        endpoint,
        method,
        timestamp: new Date().toISOString()
      });

      logger.error('Validation middleware error', { 
        structuredError, 
        endpoint, 
        method,
        originalError: error instanceof Error ? error.message : String(error)
      });

      return NextResponse.json(
        {
          error: structuredError.userMessage,
          code: structuredError.code,
          details: process.env.NODE_ENV === 'development' 
            ? structuredError.message 
            : undefined
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Handles zod validation errors and returns appropriate response
 */
function handleValidationError(
  error: ZodError, 
  source: 'body' | 'query' | 'params',
  endpoint: string,
  method: string
): NextResponse {
  const structuredError = ReservationErrorHandler.handleApiError(error, {
    action: 'input_validation',
    endpoint,
    method,
    source,
    timestamp: new Date().toISOString()
  });

  // Format validation errors for user-friendly display
  const validationErrors = error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code
  }));

  logger.warn('Input validation failed', {
    endpoint,
    method,
    source,
    validationErrors,
    structuredError
  });

  return NextResponse.json(
    {
      error: '입력 데이터가 올바르지 않습니다.',
      code: 'VALIDATION_ERROR',
      validation_errors: validationErrors,
      details: process.env.NODE_ENV === 'development' 
        ? structuredError.message 
        : undefined
    },
    { status: 400 }
  );
}

/**
 * Utility function to create common query parameter schemas
 */
// 기본 스키마들 (merge 가능)
const baseQuerySchemas = {
  pagination: z.object({
    limit: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined)
      .refine(val => val === undefined || (val > 0 && val <= 100), {
        message: 'limit은 1-100 사이의 숫자여야 합니다'
      }),
    offset: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined)
      .refine(val => val === undefined || val >= 0, {
        message: 'offset은 0 이상의 숫자여야 합니다'
      })
  }),

  dateRangeBase: z.object({
    startDate: z.string().datetime('올바른 날짜 형식이 아닙니다'),
    endDate: z.string().datetime('올바른 날짜 형식이 아닙니다')
  }),

  uuid: z.object({
    id: z.string().uuid('올바른 UUID 형식이 아닙니다')
  })
};

// Effects가 포함된 스키마들
export const commonQuerySchemas = {
  pagination: baseQuerySchemas.pagination.refine(data => {
    // Both limit and offset must be provided together or not at all
    return (data.limit === undefined) === (data.offset === undefined);
  }, {
    message: 'limit과 offset은 함께 제공되어야 합니다'
  }),

  dateRange: baseQuerySchemas.dateRangeBase.refine(data => {
    return new Date(data.endDate) > new Date(data.startDate);
  }, {
    message: '종료 날짜는 시작 날짜보다 늦어야 합니다',
    path: ['endDate']
  }),

  uuid: baseQuerySchemas.uuid,

  // merge 가능한 조합 스키마들
  dateRangeWithPagination: baseQuerySchemas.dateRangeBase.merge(baseQuerySchemas.pagination)
    .refine(data => {
      // 날짜 범위 검증
      return new Date(data.endDate) > new Date(data.startDate);
    }, {
      message: '종료 날짜는 시작 날짜보다 늦어야 합니다',
      path: ['endDate']
    })
    .refine(data => {
      // 페이지네이션 검증
      return (data.limit === undefined) === (data.offset === undefined);
    }, {
      message: 'limit과 offset은 함께 제공되어야 합니다'
    })
};

/**
 * Pre-configured validation schemas for common API patterns
 */
export const validationSchemas = {
  // GET /api/reservations/public-*
  publicReservations: {
    query: commonQuerySchemas.dateRangeWithPagination
  },

  // POST /api/reservations
  createReservation: {
    body: z.object({
      room_id: z.string().uuid('올바른 회의실 ID가 아닙니다'),
      title: z.string().min(1, '예약 제목을 입력해주세요').max(255, '제목이 너무 깁니다'),
      purpose: z.string().optional(),
      start_time: z.string().datetime('올바른 시작 시간 형식이 아닙니다'),
      end_time: z.string().datetime('올바른 종료 시간 형식이 아닙니다')
    }).refine(data => {
      return new Date(data.end_time) > new Date(data.start_time);
    }, {
      message: '종료 시간은 시작 시간보다 늦어야 합니다',
      path: ['end_time']
    })
  },

  // PUT /api/reservations/[id]
  updateReservation: {
    params: commonQuerySchemas.uuid,
    body: z.object({
      room_id: z.string().uuid('올바른 회의실 ID가 아닙니다').optional(),
      title: z.string().min(1, '예약 제목을 입력해주세요').max(255, '제목이 너무 깁니다').optional(),
      purpose: z.string().optional(),
      start_time: z.string().datetime('올바른 시작 시간 형식이 아닙니다').optional(),
      end_time: z.string().datetime('올바른 종료 시간 형식이 아닙니다').optional()
    }).refine(data => {
      if (data.start_time && data.end_time) {
        return new Date(data.end_time) > new Date(data.start_time);
      }
      return true;
    }, {
      message: '종료 시간은 시작 시간보다 늦어야 합니다',
      path: ['end_time']
    })
  },

  // DELETE /api/reservations/[id]
  deleteReservation: {
    params: commonQuerySchemas.uuid
  },

  // POST /api/auth/login
  login: {
    body: z.object({
      email: z.string().email('올바른 이메일 형식이 아닙니다').max(255, '이메일이 너무 깁니다'),
      password: z.string().min(1, '비밀번호를 입력해주세요')
    })
  },

  // POST /api/auth/signup
  signup: {
    body: z.object({
      email: z.string().email('올바른 이메일 형식이 아닙니다').max(255, '이메일이 너무 깁니다'),
      password: z.string()
        .min(8, '비밀번호는 최소 8자 이상이어야 합니다')
        .max(128, '비밀번호가 너무 깁니다')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, '비밀번호는 대문자, 소문자, 숫자를 포함해야 합니다'),
      name: z.string().min(1, '이름을 입력해주세요').max(100, '이름이 너무 깁니다'),
      department: z.string().min(1, '부서를 입력해주세요').max(100, '부서명이 너무 깁니다')
    })
  },

  // POST /api/rooms
  createRoom: {
    body: z.object({
      name: z.string().min(1, '회의실 이름을 입력해주세요').max(100, '이름이 너무 깁니다'),
      description: z.string().optional(),
      capacity: z.number().int().min(1, '최소 1명 이상이어야 합니다').default(1),
      location: z.string().optional(),
      amenities: z.record(z.string(), z.boolean()).default({})
    })
  },

  // PUT /api/rooms/[id]
  updateRoom: {
    params: commonQuerySchemas.uuid,
    body: z.object({
      name: z.string().min(1, '회의실 이름을 입력해주세요').max(100, '이름이 너무 깁니다').optional(),
      description: z.string().optional(),
      capacity: z.number().int().min(1, '최소 1명 이상이어야 합니다').optional(),
      location: z.string().optional(),
      amenities: z.record(z.string(), z.boolean()).optional()
    })
  },

  // DELETE /api/admin/users/[userId]
  deleteUser: {
    params: z.object({
      userId: z.string().uuid('올바른 사용자 ID가 아닙니다')
    })
  }
};