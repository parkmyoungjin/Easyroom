/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET as getPublicAnonymous } from '@/app/api/reservations/public-anonymous/route';
import { GET as getPublicAuthenticated } from '@/app/api/reservations/public-authenticated/route';
import { GET as getPublicLegacy } from '@/app/api/reservations/public/route';

// Mock crypto for Node.js environment
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-123'
  }
});

// Mock server-only module to prevent import errors
jest.mock('server-only', () => ({}));

// Mock Supabase actions (server-only module)
jest.mock('@/lib/supabase/actions', () => ({
  createRouteClient: jest.fn(),
  createAdminRouteClient: jest.fn()
}));

// Mock Supabase server
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createAdminClient: jest.fn()
}));

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock date utils
jest.mock('@/lib/utils/date', () => ({
  normalizeDateForQuery: jest.fn((date: string, isEnd: boolean) => {
    return isEnd ? `${date}T23:59:59.999Z` : `${date}T00:00:00.000Z`;
  })
}));

// Mock error handler
jest.mock('@/lib/utils/error-handler', () => ({
  ReservationErrorHandler: {
    handleApiError: jest.fn((error: any, context: any) => ({
      userMessage: error.message || 'An error occurred',
      code: 'GENERIC_ERROR',
      message: error.message || 'An error occurred'
    }))
  }
}));

// Mock monitoring modules
jest.mock('@/lib/monitoring/security-monitor', () => ({
  securityMonitor: {
    recordEvent: jest.fn(),
    recordAuthFailure: jest.fn()
  }
}));

jest.mock('@/lib/monitoring/performance-monitor', () => ({
  performanceMonitor: {
    recordMetric: jest.fn(),
    measureAuthentication: jest.fn()
  }
}));

// Mock API pagination utilities
jest.mock('@/lib/utils/api-pagination', () => ({
  extractPaginationFromRequest: jest.fn(() => ({
    isValid: true,
    pagination: {
      limit: 20,
      offset: 0,
      sortBy: 'start_time',
      sortOrder: 'asc',
      search: null
    },
    errors: []
  })),
  createPaginatedApiResponse: jest.fn((data, totalCount, pagination, message, metadata) => ({
    data,
    pagination: {
      totalCount,
      limit: pagination.limit,
      offset: pagination.offset,
      hasMore: totalCount > pagination.offset + pagination.limit
    },
    message,
    ...metadata
  })),
  createPaginationErrorResponse: jest.fn((errors) => ({
    error: 'Pagination validation failed',
    details: errors
  })),
  executePaginatedRPC: jest.fn(),
  executePaginatedQuery: jest.fn()
}));

import { createClient } from '@/lib/supabase/server';
import { createRouteClient } from '@/lib/supabase/actions';
import { logger } from '@/lib/utils/logger';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockCreateRouteClient = createRouteClient as jest.MockedFunction<typeof createRouteClient>;

describe('Public Reservations API Endpoints', () => {
  let mockSupabase: any;
  let mockRequest: NextRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSupabase = {
      auth: {
        getUser: jest.fn(),
        getSession: jest.fn()
      },
      rpc: jest.fn(),
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              lte: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({ data: [], error: null }))
              }))
            }))
          }))
        }))
      }))
    };
    
    mockCreateClient.mockResolvedValue(mockSupabase);
    mockCreateRouteClient.mockReturnValue(mockSupabase);
    
    mockRequest = new NextRequest('http://localhost:3000/api/reservations/public?startDate=2025-01-20&endDate=2025-01-21');
  });

  describe('Anonymous Public Endpoint', () => {
    it('should return minimal reservation data for anonymous users', async () => {
      // Mock executePaginatedRPC for successful response
      const { executePaginatedRPC } = require('@/lib/utils/api-pagination');
      executePaginatedRPC.mockResolvedValue({
        data: [
          {
            id: 'reservation-1',
            room_id: 'room-1',
            title: 'Booked',
            start_time: '2025-01-20T10:00:00Z',
            end_time: '2025-01-20T11:00:00Z',
            room_name: 'Conference Room A',
            is_mine: false
          }
        ],
        totalCount: 1,
        hasMore: false
      });

      const response = await getPublicAnonymous(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.authenticated).toBe(false);
      expect(responseData.data).toHaveLength(1);
      expect(responseData.data[0].title).toBe('Booked');
      expect(responseData.data[0].is_mine).toBe(false);
      expect(executePaginatedRPC).toHaveBeenCalledWith(
        mockSupabase,
        'get_public_reservations_anonymous_paginated',
        {
          p_start_date: '2025-01-20T00:00:00.000Z',
          p_end_date: '2025-01-21T23:59:59.999Z'
        },
        {
          limit: 20,
          offset: 0
        }
      );
    });

    it('should handle missing date parameters', async () => {
      const invalidRequest = new NextRequest('http://localhost:3000/api/reservations/public-anonymous');
      
      const response = await getPublicAnonymous(invalidRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('startDate와 endDate가 필요합니다');
    });

    it('should fallback to direct query when RPC fails', async () => {
      // Mock executePaginatedRPC failure and executePaginatedQuery success
      const { executePaginatedRPC, executePaginatedQuery } = require('@/lib/utils/api-pagination');
      
      executePaginatedRPC.mockRejectedValue(new Error('RPC function not found'));
      executePaginatedQuery.mockResolvedValue({
        data: [
          {
            id: 'reservation-1',
            room_id: 'room-1',
            start_time: '2025-01-20T10:00:00Z',
            end_time: '2025-01-20T11:00:00Z',
            room: { name: 'Conference Room A' }
          }
        ],
        totalCount: 1,
        hasMore: false
      });

      const response = await getPublicAnonymous(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.data).toHaveLength(1);
      expect(responseData.data[0].title).toBe('Booked');
      expect(responseData.fallback).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith('RPC 함수 사용 불가, 직접 쿼리 시도', expect.objectContaining({ error: expect.any(String) }));
    });
  });

  describe('Authenticated Public Endpoint', () => {
    it('should return detailed reservation data for authenticated users', async () => {
      const mockUser = {
        id: 'auth-user-123',
        email: 'user@example.com'
      };

      // Mock measureAuthentication to return session data
      const { performanceMonitor } = require('@/lib/monitoring/performance-monitor');
      performanceMonitor.measureAuthentication.mockResolvedValue({
        data: { 
          session: { 
            user: mockUser 
          } 
        },
        error: null
      });

      // Mock executePaginatedRPC for successful response
      const { executePaginatedRPC } = require('@/lib/utils/api-pagination');
      executePaginatedRPC.mockResolvedValue({
        data: [
          {
            id: 'reservation-1',
            room_id: 'room-1',
            user_id: 'db-user-123',
            title: 'My Meeting',
            purpose: 'Team standup',
            start_time: '2025-01-20T10:00:00Z',
            end_time: '2025-01-20T11:00:00Z',
            department: 'Engineering',
            user_name: 'John Doe',
            is_mine: true
          },
          {
            id: 'reservation-2',
            room_id: 'room-1',
            user_id: 'db-user-456',
            title: 'Booked',
            purpose: null,
            start_time: '2025-01-20T14:00:00Z',
            end_time: '2025-01-20T15:00:00Z',
            department: 'Marketing',
            user_name: 'Jane Smith',
            is_mine: false
          }
        ],
        totalCount: 2,
        hasMore: false
      });

      const response = await getPublicAuthenticated(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.authenticated).toBe(true);
      expect(responseData.userId).toBe('auth-user-123');
      expect(responseData.data).toHaveLength(2);
      
      // Check own reservation has detailed info
      const myReservation = responseData.data.find((r: any) => r.is_mine);
      expect(myReservation.title).toBe('My Meeting');
      expect(myReservation.purpose).toBe('Team standup');
      
      // Check other reservation is masked
      const otherReservation = responseData.data.find((r: any) => !r.is_mine);
      expect(otherReservation.title).toBe('Booked');
      expect(otherReservation.purpose).toBeNull();
    });

    it('should return 401 for unauthenticated requests', async () => {
      // Mock measureAuthentication to return no session
      const { performanceMonitor } = require('@/lib/monitoring/performance-monitor');
      performanceMonitor.measureAuthentication.mockResolvedValue({
        data: { session: null },
        error: new Error('Not authenticated')
      });

      const response = await getPublicAuthenticated(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.error).toBe('인증이 필요합니다');
    });

    it('should handle RPC function errors gracefully', async () => {
      const mockUser = { id: 'auth-user-123' };
      
      // Mock measureAuthentication to return session data
      const { performanceMonitor } = require('@/lib/monitoring/performance-monitor');
      performanceMonitor.measureAuthentication.mockResolvedValue({
        data: { 
          session: { 
            user: mockUser 
          } 
        },
        error: null
      });

      // Mock both RPC and query failures
      const { executePaginatedRPC, executePaginatedQuery } = require('@/lib/utils/api-pagination');
      executePaginatedRPC.mockRejectedValue(new Error('RPC error'));
      executePaginatedQuery.mockRejectedValue(new Error('Database error'));

      const response = await getPublicAuthenticated(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toBe('Database error'); // 실제 구현에서는 ReservationErrorHandler가 원본 에러 메시지를 반환
    });
  });

  describe('Legacy Public Endpoint (Redirect)', () => {
    it('should redirect authenticated users to authenticated endpoint', async () => {
      const mockUser = { id: 'auth-user-123' };
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const response = await getPublicLegacy(mockRequest);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/api/reservations/public-authenticated');
      expect(response.headers.get('location')).toContain('startDate=2025-01-20&endDate=2025-01-21');
      expect(logger.info).toHaveBeenCalledWith('보안 엔드포인트로 리디렉션', {
        from: '/api/reservations/public',
        to: '/api/reservations/public-authenticated',
        authenticated: true,
        userId: 'auth-user-123'
      });
    });

    it('should redirect anonymous users to anonymous endpoint', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      });

      const response = await getPublicLegacy(mockRequest);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/api/reservations/public-anonymous');
      expect(response.headers.get('location')).toContain('startDate=2025-01-20&endDate=2025-01-21');
      expect(logger.info).toHaveBeenCalledWith('보안 엔드포인트로 리디렉션', {
        from: '/api/reservations/public',
        to: '/api/reservations/public-anonymous',
        authenticated: false,
        userId: 'anonymous'
      });
    });

    it('should handle redirect errors gracefully', async () => {
      mockSupabase.auth.getUser.mockRejectedValue(new Error('Auth service error'));

      const response = await getPublicLegacy(mockRequest);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/api/reservations/public-anonymous');
      expect(logger.error).toHaveBeenCalledWith('레거시 API 리디렉션 중 구조화된 오류', expect.objectContaining({
        error: expect.any(Object),
        originalError: 'Auth service error'
      }));
    });
  });

  describe('Security Validation', () => {
    it('should not expose sensitive information in anonymous endpoint', async () => {
      // Mock executePaginatedRPC failure and executePaginatedQuery success with sensitive data
      const { executePaginatedRPC, executePaginatedQuery } = require('@/lib/utils/api-pagination');
      
      executePaginatedRPC.mockRejectedValue(new Error('RPC not available'));
      executePaginatedQuery.mockResolvedValue({
        data: [
          {
            id: 'reservation-1',
            room_id: 'room-1',
            title: 'Confidential Meeting', // This should be masked
            purpose: 'Secret project discussion', // This should not be included
            start_time: '2025-01-20T10:00:00Z',
            end_time: '2025-01-20T11:00:00Z',
            room: { name: 'Conference Room A' }
          }
        ],
        totalCount: 1,
        hasMore: false
      });

      const response = await getPublicAnonymous(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.data[0].title).toBe('Booked'); // Masked
      expect(responseData.data[0].purpose).toBeUndefined(); // Not included
      expect(responseData.data[0].is_mine).toBe(false);
    });

    it('should validate date parameters properly', async () => {
      const invalidRequest = new NextRequest('http://localhost:3000/api/reservations/public-anonymous?startDate=invalid&endDate=2025-01-21');
      
      // Mock date normalization failure
      const { normalizeDateForQuery } = require('@/lib/utils/date');
      normalizeDateForQuery.mockImplementation(() => {
        throw new Error('Invalid date format');
      });

      const response = await getPublicAnonymous(invalidRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Invalid date format');
    });
  });
});