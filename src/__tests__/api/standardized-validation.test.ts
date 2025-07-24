/**
 * Standardized API Validation Tests
 * Tests API validation patterns across all endpoints with consistent standards
 * Requirements: 6.1, 6.2, 6.5
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Mock validation schemas
const mockValidationSchemas = {
  publicReservations: z.object({
    start_date: z.string().datetime(),
    end_date: z.string().datetime(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional()
  }),
  
  createReservation: z.object({
    room_id: z.string().uuid(),
    user_id: z.string().uuid(),
    title: z.string().min(1).max(255),
    purpose: z.string().optional(),
    start_time: z.string().datetime(),
    end_time: z.string().datetime()
  }).refine(data => new Date(data.end_time) > new Date(data.start_time), {
    message: 'End time must be after start time',
    path: ['end_time']
  }),

  updateUser: z.object({
    name: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    department: z.string().min(1).max(100).optional(),
    role: z.enum(['employee', 'admin']).optional()
  }),

  createRoom: z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    capacity: z.number().int().min(1).default(1),
    location: z.string().optional(),
    amenities: z.record(z.string(), z.boolean()).default({})
  }),

  paginationParams: z.object({
    limit: z.number().int().min(1).max(100).optional().default(20),
    offset: z.number().int().min(0).optional().default(0),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional().default('asc')
  })
};

// Mock withValidation middleware
const mockWithValidation = <T>(
  schema: z.ZodSchema<T>,
  handler: (req: NextRequest, validatedData: T) => Promise<NextResponse>
) => {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // Parse request data based on method
      let requestData: any = {};
      
      if (req.method === 'GET') {
        const { searchParams } = new URL(req.url);
        requestData = Object.fromEntries(searchParams.entries());
        
        // Convert numeric strings to numbers for validation
        Object.keys(requestData).forEach(key => {
          if (key === 'limit' || key === 'offset') {
            const num = parseInt(requestData[key], 10);
            if (!isNaN(num)) {
              requestData[key] = num;
            }
          }
        });
      } else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        requestData = await req.json();
      }

      // Validate data against schema
      const validatedData = schema.parse(requestData);
      
      // Call the actual handler with validated data
      return await handler(req, validatedData);
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code
            }))
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
};

// Mock security and performance monitoring
jest.mock('@/lib/monitoring/security-monitor', () => ({
  securityMonitor: {
    recordEvent: jest.fn()
  }
}));

jest.mock('@/lib/monitoring/performance-monitor', () => ({
  performanceMonitor: {
    recordMetric: jest.fn()
  }
}));

describe('Standardized API Validation Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET Endpoint Validation', () => {
    it('should validate public reservations endpoint parameters', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ data: [], message: 'Success' })
      );

      const validatedHandler = mockWithValidation(
        mockValidationSchemas.publicReservations,
        mockHandler
      );

      // Test valid request
      const validRequest = new NextRequest(
        'http://localhost:3000/api/reservations/public-authenticated?start_date=2024-01-01T00:00:00Z&end_date=2024-01-01T23:59:59Z&limit=10&offset=0'
      );

      const response = await validatedHandler(validRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.message).toBe('Success');
      expect(mockHandler).toHaveBeenCalledWith(
        validRequest,
        expect.objectContaining({
          start_date: '2024-01-01T00:00:00Z',
          end_date: '2024-01-01T23:59:59Z',
          limit: 10,
          offset: 0
        })
      );
    });

    it('should reject invalid datetime format in GET parameters', async () => {
      const mockHandler = jest.fn();
      const validatedHandler = mockWithValidation(
        mockValidationSchemas.publicReservations,
        mockHandler
      );

      const invalidRequest = new NextRequest(
        'http://localhost:3000/api/reservations/public-authenticated?start_date=invalid-date&end_date=2024-01-01T23:59:59Z'
      );

      const response = await validatedHandler(invalidRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Validation failed');
      expect(responseData.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'start_date',
            message: expect.stringContaining('datetime'),
            code: expect.any(String)
          })
        ])
      );
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should validate pagination parameters with proper bounds', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ data: [] })
      );

      const validatedHandler = mockWithValidation(
        mockValidationSchemas.paginationParams,
        mockHandler
      );

      // Test limit exceeding maximum
      const invalidLimitRequest = new NextRequest(
        'http://localhost:3000/api/test?limit=150&offset=0'
      );

      const response1 = await validatedHandler(invalidLimitRequest);
      const responseData1 = await response1.json();

      expect(response1.status).toBe(400);
      expect(responseData1.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'limit',
            message: expect.stringContaining('100')
          })
        ])
      );

      // Test negative offset
      const invalidOffsetRequest = new NextRequest(
        'http://localhost:3000/api/test?limit=10&offset=-5'
      );

      const response2 = await validatedHandler(invalidOffsetRequest);
      const responseData2 = await response2.json();

      expect(response2.status).toBe(400);
      expect(responseData2.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'offset',
            message: expect.stringContaining('0')
          })
        ])
      );
    });
  });

  describe('POST Endpoint Validation', () => {
    it('should validate reservation creation data', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ id: 'new-reservation-id', message: 'Created' }, { status: 201 })
      );

      const validatedHandler = mockWithValidation(
        mockValidationSchemas.createReservation,
        mockHandler
      );

      const validReservationData = {
        room_id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Team Meeting',
        purpose: 'Weekly standup',
        start_time: '2024-01-01T10:00:00Z',
        end_time: '2024-01-01T11:00:00Z'
      };

      const validRequest = new NextRequest('http://localhost:3000/api/reservations', {
        method: 'POST',
        body: JSON.stringify(validReservationData),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await validatedHandler(validRequest);
      const responseData = await response.json();

      expect(response.status).toBe(201);
      expect(responseData.message).toBe('Created');
      expect(mockHandler).toHaveBeenCalledWith(
        validRequest,
        expect.objectContaining(validReservationData)
      );
    });

    it('should reject reservation with invalid UUID format', async () => {
      const mockHandler = jest.fn();
      const validatedHandler = mockWithValidation(
        mockValidationSchemas.createReservation,
        mockHandler
      );

      const invalidReservationData = {
        room_id: 'invalid-uuid',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Team Meeting',
        start_time: '2024-01-01T10:00:00Z',
        end_time: '2024-01-01T11:00:00Z'
      };

      const invalidRequest = new NextRequest('http://localhost:3000/api/reservations', {
        method: 'POST',
        body: JSON.stringify(invalidReservationData),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await validatedHandler(invalidRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Validation failed');
      expect(responseData.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'room_id',
            message: expect.stringContaining('uuid'),
            code: expect.any(String)
          })
        ])
      );
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should reject reservation with end time before start time', async () => {
      const mockHandler = jest.fn();
      const validatedHandler = mockWithValidation(
        mockValidationSchemas.createReservation,
        mockHandler
      );

      const invalidTimeReservation = {
        room_id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Invalid Time Meeting',
        start_time: '2024-01-01T11:00:00Z',
        end_time: '2024-01-01T10:00:00Z' // End before start
      };

      const invalidRequest = new NextRequest('http://localhost:3000/api/reservations', {
        method: 'POST',
        body: JSON.stringify(invalidTimeReservation),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await validatedHandler(invalidRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'end_time',
            message: 'End time must be after start time'
          })
        ])
      );
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should validate room creation with default values', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ id: 'new-room-id' }, { status: 201 })
      );

      const validatedHandler = mockWithValidation(
        mockValidationSchemas.createRoom,
        mockHandler
      );

      const minimalRoomData = {
        name: 'New Conference Room'
      };

      const validRequest = new NextRequest('http://localhost:3000/api/rooms', {
        method: 'POST',
        body: JSON.stringify(minimalRoomData),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await validatedHandler(validRequest);

      expect(response.status).toBe(201);
      expect(mockHandler).toHaveBeenCalledWith(
        validRequest,
        expect.objectContaining({
          name: 'New Conference Room',
          capacity: 1, // Default value
          amenities: {} // Default value
        })
      );
    });
  });

  describe('PUT/PATCH Endpoint Validation', () => {
    it('should validate partial user updates', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ message: 'Updated' })
      );

      const validatedHandler = mockWithValidation(
        mockValidationSchemas.updateUser,
        mockHandler
      );

      const partialUpdateData = {
        name: 'Updated Name',
        department: 'Updated Department'
        // email and role not provided (optional)
      };

      const validRequest = new NextRequest('http://localhost:3000/api/users/123', {
        method: 'PATCH',
        body: JSON.stringify(partialUpdateData),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await validatedHandler(validRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.message).toBe('Updated');
      expect(mockHandler).toHaveBeenCalledWith(
        validRequest,
        expect.objectContaining(partialUpdateData)
      );
    });

    it('should reject invalid email format in user update', async () => {
      const mockHandler = jest.fn();
      const validatedHandler = mockWithValidation(
        mockValidationSchemas.updateUser,
        mockHandler
      );

      const invalidUpdateData = {
        email: 'invalid-email-format'
      };

      const invalidRequest = new NextRequest('http://localhost:3000/api/users/123', {
        method: 'PATCH',
        body: JSON.stringify(invalidUpdateData),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await validatedHandler(invalidRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'email',
            message: expect.stringContaining('email'),
            code: expect.any(String)
          })
        ])
      );
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should reject invalid role enum value', async () => {
      const mockHandler = jest.fn();
      const validatedHandler = mockWithValidation(
        mockValidationSchemas.updateUser,
        mockHandler
      );

      const invalidRoleData = {
        role: 'super_admin' // Not in enum
      };

      const invalidRequest = new NextRequest('http://localhost:3000/api/users/123', {
        method: 'PATCH',
        body: JSON.stringify(invalidRoleData),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await validatedHandler(invalidRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'role',
            message: expect.stringContaining('employee'),
            code: expect.any(String)
          })
        ])
      );
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('Error Response Standardization', () => {
    it('should provide consistent error response format', async () => {
      const mockHandler = jest.fn();
      const validatedHandler = mockWithValidation(
        mockValidationSchemas.createReservation,
        mockHandler
      );

      const multipleErrorsData = {
        room_id: 'invalid-uuid',
        user_id: '', // Empty string
        title: '', // Empty string
        start_time: 'invalid-datetime',
        end_time: '2024-01-01T10:00:00Z'
      };

      const invalidRequest = new NextRequest('http://localhost:3000/api/reservations', {
        method: 'POST',
        body: JSON.stringify(multipleErrorsData),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await validatedHandler(invalidRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData).toHaveProperty('error', 'Validation failed');
      expect(responseData).toHaveProperty('details');
      expect(Array.isArray(responseData.details)).toBe(true);
      
      // Should have multiple validation errors
      expect(responseData.details.length).toBeGreaterThan(1);
      
      // Each error should have consistent structure
      responseData.details.forEach((detail: any) => {
        expect(detail).toHaveProperty('field');
        expect(detail).toHaveProperty('message');
        expect(detail).toHaveProperty('code');
        expect(typeof detail.field).toBe('string');
        expect(typeof detail.message).toBe('string');
        expect(typeof detail.code).toBe('string');
      });
    });

    it('should handle JSON parsing errors gracefully', async () => {
      const mockHandler = jest.fn();
      const validatedHandler = mockWithValidation(
        mockValidationSchemas.createReservation,
        mockHandler
      );

      // Create request with invalid JSON
      const invalidJsonRequest = new NextRequest('http://localhost:3000/api/reservations', {
        method: 'POST',
        body: '{ invalid json }',
        headers: { 'Content-Type': 'application/json' }
      });

      // Mock JSON parsing to throw error
      const originalJson = invalidJsonRequest.json;
      invalidJsonRequest.json = jest.fn().mockRejectedValue(new Error('Invalid JSON'));

      const response = await validatedHandler(invalidJsonRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toHaveProperty('error', 'Internal server error');
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('Content-Type Validation', () => {
    it('should handle missing Content-Type header', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ message: 'Success' })
      );

      const validatedHandler = mockWithValidation(
        mockValidationSchemas.createReservation,
        mockHandler
      );

      const validData = {
        room_id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Test Meeting',
        start_time: '2024-01-01T10:00:00Z',
        end_time: '2024-01-01T11:00:00Z'
      };

      const requestWithoutContentType = new NextRequest('http://localhost:3000/api/reservations', {
        method: 'POST',
        body: JSON.stringify(validData)
        // No Content-Type header
      });

      const response = await validatedHandler(requestWithoutContentType);

      // Should still work as JSON parsing is attempted regardless
      expect(response.status).toBe(200);
      expect(mockHandler).toHaveBeenCalled();
    });
  });

  describe('Field-Level Validation Messages', () => {
    it('should provide specific validation messages for different field types', async () => {
      const testCases = [
        {
          field: 'title',
          value: '',
          expectedMessage: expect.stringContaining('1')
        },
        {
          field: 'title',
          value: 'a'.repeat(256),
          expectedMessage: expect.stringContaining('255')
        },
        {
          field: 'room_id',
          value: 'not-a-uuid',
          expectedMessage: expect.stringContaining('uuid')
        },
        {
          field: 'start_time',
          value: 'not-a-datetime',
          expectedMessage: expect.stringContaining('datetime')
        }
      ];

      const mockHandler = jest.fn();
      const validatedHandler = mockWithValidation(
        mockValidationSchemas.createReservation,
        mockHandler
      );

      for (const testCase of testCases) {
        const invalidData = {
          room_id: '123e4567-e89b-12d3-a456-426614174000',
          user_id: '123e4567-e89b-12d3-a456-426614174001',
          title: 'Valid Title',
          start_time: '2024-01-01T10:00:00Z',
          end_time: '2024-01-01T11:00:00Z',
          [testCase.field]: testCase.value
        };

        const invalidRequest = new NextRequest('http://localhost:3000/api/reservations', {
          method: 'POST',
          body: JSON.stringify(invalidData),
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await validatedHandler(invalidRequest);
        const responseData = await response.json();

        expect(response.status).toBe(400);
        
        const fieldError = responseData.details.find((detail: any) => detail.field === testCase.field);
        expect(fieldError).toBeDefined();
        expect(fieldError.message).toEqual(testCase.expectedMessage);
      }
    });
  });

  describe('Cross-Field Validation', () => {
    it('should validate relationships between fields', async () => {
      const mockHandler = jest.fn();
      const validatedHandler = mockWithValidation(
        mockValidationSchemas.createReservation,
        mockHandler
      );

      // Test end_time before start_time
      const invalidTimeData = {
        room_id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Test Meeting',
        start_time: '2024-01-01T11:00:00Z',
        end_time: '2024-01-01T10:00:00Z'
      };

      const invalidRequest = new NextRequest('http://localhost:3000/api/reservations', {
        method: 'POST',
        body: JSON.stringify(invalidTimeData),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await validatedHandler(invalidRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'end_time',
            message: 'End time must be after start time'
          })
        ])
      );
    });
  });
});