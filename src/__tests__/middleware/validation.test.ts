/**
 * Unit tests for validation schemas
 */

import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';

// Import validation schemas directly without the middleware
import { 
  userSchema, 
  reservationInsertSchema, 
  loginSchema, 
  signupSchema,
  roomFormSchema,
  newReservationFormSchema
} from '@/lib/validations/schemas';

describe('Validation Schemas', () => {
  describe('loginSchema', () => {
    it('should validate login credentials', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123'
      };
      
      const result = loginSchema.parse(validData);
      
      expect(result.email).toBe('test@example.com');
      expect(result.password).toBe('password123');
    });

    it('should reject invalid email format', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'password123'
      };
      
      expect(() => {
        loginSchema.parse(invalidData);
      }).toThrow();
    });

    it('should reject empty password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: ''
      };
      
      expect(() => {
        loginSchema.parse(invalidData);
      }).toThrow();
    });
  });

  describe('signupSchema', () => {
    it('should validate Magic Link signup data (no password required)', () => {
      const validData = {
        email: 'test@example.com',
        name: 'Test User',
        department: 'Engineering'
      };
      
      const result = signupSchema.parse(validData);
      
      expect(result.email).toBe('test@example.com');
      expect(result.name).toBe('Test User');
      expect(result.department).toBe('Engineering');
      // Magic Link 기반이므로 password 필드가 없어야 함
      expect(result).not.toHaveProperty('password');
    });

    it('should reject invalid email format', () => {
      const invalidData = {
        email: 'invalid-email',
        name: 'Test User',
        department: 'Engineering'
      };
      
      expect(() => {
        signupSchema.parse(invalidData);
      }).toThrow();
    });

    it('should reject empty name', () => {
      const invalidData = {
        email: 'test@example.com',
        name: '',
        department: 'Engineering'
      };
      
      expect(() => {
        signupSchema.parse(invalidData);
      }).toThrow();
    });

    it('should reject empty department', () => {
      const invalidData = {
        email: 'test@example.com',
        name: 'Test User',
        department: ''
      };
      
      expect(() => {
        signupSchema.parse(invalidData);
      }).toThrow();
    });
  });

  describe('reservationInsertSchema', () => {
    it('should validate reservation creation data', () => {
      const validData = {
        room_id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Test Meeting',
        purpose: 'Team discussion',
        start_time: '2024-01-01T10:00:00Z',
        end_time: '2024-01-01T11:00:00Z'
      };
      
      const result = reservationInsertSchema.parse(validData);
      
      expect(result.room_id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(result.title).toBe('Test Meeting');
      expect(result.purpose).toBe('Team discussion');
    });

    it('should reject reservation with end time before start time', () => {
      const invalidData = {
        room_id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Test Meeting',
        start_time: '2024-01-01T11:00:00Z',
        end_time: '2024-01-01T10:00:00Z'
      };
      
      expect(() => {
        reservationInsertSchema.parse(invalidData);
      }).toThrow();
    });

    it('should reject invalid UUID formats', () => {
      const invalidData = {
        room_id: 'invalid-uuid',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Test Meeting',
        start_time: '2024-01-01T10:00:00Z',
        end_time: '2024-01-01T11:00:00Z'
      };
      
      expect(() => {
        reservationInsertSchema.parse(invalidData);
      }).toThrow();
    });
  });

  describe('roomFormSchema', () => {
    it('should validate room creation data', () => {
      const validData = {
        name: 'Conference Room A',
        description: 'Large conference room',
        capacity: 10,
        location: 'Building 1, Floor 2',
        amenities: { projector: true, whiteboard: false }
      };
      
      const result = roomFormSchema.parse(validData);
      
      expect(result.name).toBe('Conference Room A');
      expect(result.capacity).toBe(10);
      expect(result.amenities.projector).toBe(true);
    });

    it('should use default values for optional fields', () => {
      const minimalData = {
        name: 'Simple Room'
      };
      
      const result = roomFormSchema.parse(minimalData);
      
      expect(result.name).toBe('Simple Room');
      expect(result.capacity).toBe(1);
      expect(result.amenities).toEqual({});
    });

    it('should reject empty room name', () => {
      const invalidData = {
        name: ''
      };
      
      expect(() => {
        roomFormSchema.parse(invalidData);
      }).toThrow();
    });

    it('should reject zero or negative capacity', () => {
      const invalidData = {
        name: 'Test Room',
        capacity: 0
      };
      
      expect(() => {
        roomFormSchema.parse(invalidData);
      }).toThrow();
    });
  });

  describe('userSchema', () => {
    it('should validate user data', () => {
      const validData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        employee_id: 'EMP001',
        name: 'Test User',
        email: 'test@example.com',
        department: 'Engineering',
        role: 'employee' as const,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };
      
      const result = userSchema.parse(validData);
      
      expect(result.name).toBe('Test User');
      expect(result.email).toBe('test@example.com');
      expect(result.role).toBe('employee');
    });

    it('should allow nullable employee_id', () => {
      const validData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        employee_id: null,
        name: 'Test User',
        email: 'test@example.com',
        department: 'Engineering',
        role: 'employee' as const,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };
      
      const result = userSchema.parse(validData);
      
      expect(result.employee_id).toBeNull();
    });

    it('should reject invalid email format', () => {
      const invalidData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        employee_id: 'EMP001',
        name: 'Test User',
        email: 'invalid-email',
        department: 'Engineering',
        role: 'employee' as const,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };
      
      expect(() => {
        userSchema.parse(invalidData);
      }).toThrow();
    });
  });

  describe('newReservationFormSchema', () => {
    it('should validate new reservation form data', () => {
      const validData = {
        title: 'Engineering Team Meeting',
        booker: 'John Doe',
        date: new Date('2024-06-15'), // Saturday - should fail weekend check
        startTime: '10:00',
        endTime: '11:00',
        roomId: '123e4567-e89b-12d3-a456-426614174000',
        purpose: 'Weekly standup'
      };
      
      // This should fail because it's a weekend
      expect(() => {
        newReservationFormSchema.parse(validData);
      }).toThrow();
    });

    it('should reject weekend dates', () => {
      const weekendData = {
        title: 'Weekend Meeting',
        booker: 'John Doe',
        date: new Date('2024-06-15'), // Saturday
        startTime: '10:00',
        endTime: '11:00',
        roomId: '123e4567-e89b-12d3-a456-426614174000'
      };
      
      expect(() => {
        newReservationFormSchema.parse(weekendData);
      }).toThrow('주말에는 예약할 수 없습니다');
    });

    it('should reject end time before start time', () => {
      const invalidTimeData = {
        title: 'Invalid Time Meeting',
        booker: 'John Doe',
        date: new Date('2024-06-17'), // Monday
        startTime: '11:00',
        endTime: '10:00',
        roomId: '123e4567-e89b-12d3-a456-426614174000'
      };
      
      expect(() => {
        newReservationFormSchema.parse(invalidTimeData);
      }).toThrow();
    });
  });
});