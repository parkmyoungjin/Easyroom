/**
 * Signup and OTP Validation Schema Tests
 * Tests the validation schemas for signup process and OTP authentication
 * Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3
 */

import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';

import {
  signupSchema,
  otpVerificationSchema,
  otpRequestSchema,
  signupToOtpTransitionSchema,
  type SignupFormData,
  type OTPVerificationFormData,
  type OTPRequestFormData,
  type SignupToOtpTransitionData
} from '../schemas';

describe('Signup and OTP Validation Schemas', () => {
  describe('signupSchema', () => {
    it('should validate valid signup data', () => {
      const validData = {
        email: 'test@example.com',
        name: 'Test User',
        department: 'Engineering'
      };

      const result = signupSchema.parse(validData);

      expect(result).toEqual(validData);
      expect(result.email).toBe('test@example.com');
      expect(result.name).toBe('Test User');
      expect(result.department).toBe('Engineering');
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

    it('should reject name that is too long', () => {
      const invalidData = {
        email: 'test@example.com',
        name: 'a'.repeat(101), // 101 characters
        department: 'Engineering'
      };

      expect(() => {
        signupSchema.parse(invalidData);
      }).toThrow();
    });

    it('should reject department that is too long', () => {
      const invalidData = {
        email: 'test@example.com',
        name: 'Test User',
        department: 'a'.repeat(101) // 101 characters
      };

      expect(() => {
        signupSchema.parse(invalidData);
      }).toThrow();
    });

    it('should accept maximum length name and department', () => {
      const validData = {
        email: 'test@example.com',
        name: 'a'.repeat(100), // 100 characters
        department: 'b'.repeat(100) // 100 characters
      };

      const result = signupSchema.parse(validData);
      expect(result.name).toBe('a'.repeat(100));
      expect(result.department).toBe('b'.repeat(100));
    });

    it('should handle Korean characters in name and department', () => {
      const validData = {
        email: 'test@example.com',
        name: '홍길동',
        department: '신사업추진팀'
      };

      const result = signupSchema.parse(validData);
      expect(result.name).toBe('홍길동');
      expect(result.department).toBe('신사업추진팀');
    });
  });

  describe('otpVerificationSchema', () => {
    it('should validate valid OTP verification data', () => {
      const validData = {
        email: 'test@example.com',
        otp: '123456'
      };

      const result = otpVerificationSchema.parse(validData);

      expect(result).toEqual(validData);
      expect(result.email).toBe('test@example.com');
      expect(result.otp).toBe('123456');
    });

    it('should reject invalid email format', () => {
      const invalidData = {
        email: 'invalid-email',
        otp: '123456'
      };

      expect(() => {
        otpVerificationSchema.parse(invalidData);
      }).toThrow();
    });

    it('should reject OTP that is not 6 digits', () => {
      const invalidData = {
        email: 'test@example.com',
        otp: '12345' // 5 digits
      };

      expect(() => {
        otpVerificationSchema.parse(invalidData);
      }).toThrow();
    });

    it('should reject OTP that is too long', () => {
      const invalidData = {
        email: 'test@example.com',
        otp: '1234567' // 7 digits
      };

      expect(() => {
        otpVerificationSchema.parse(invalidData);
      }).toThrow();
    });

    it('should reject OTP with non-numeric characters', () => {
      const invalidData = {
        email: 'test@example.com',
        otp: '12345a'
      };

      expect(() => {
        otpVerificationSchema.parse(invalidData);
      }).toThrow();
    });

    it('should reject OTP with spaces', () => {
      const invalidData = {
        email: 'test@example.com',
        otp: '123 456'
      };

      expect(() => {
        otpVerificationSchema.parse(invalidData);
      }).toThrow();
    });

    it('should reject empty OTP', () => {
      const invalidData = {
        email: 'test@example.com',
        otp: ''
      };

      expect(() => {
        otpVerificationSchema.parse(invalidData);
      }).toThrow();
    });

    it('should accept all numeric OTP codes', () => {
      const testCodes = ['000000', '123456', '999999', '000001'];

      testCodes.forEach(otp => {
        const validData = {
          email: 'test@example.com',
          otp
        };

        const result = otpVerificationSchema.parse(validData);
        expect(result.otp).toBe(otp);
      });
    });
  });

  describe('otpRequestSchema', () => {
    it('should validate valid OTP request data', () => {
      const validData = {
        email: 'test@example.com'
      };

      const result = otpRequestSchema.parse(validData);

      expect(result).toEqual(validData);
      expect(result.email).toBe('test@example.com');
    });

    it('should reject invalid email format', () => {
      const invalidData = {
        email: 'invalid-email'
      };

      expect(() => {
        otpRequestSchema.parse(invalidData);
      }).toThrow();
    });

    it('should reject empty email', () => {
      const invalidData = {
        email: ''
      };

      expect(() => {
        otpRequestSchema.parse(invalidData);
      }).toThrow();
    });

    it('should handle various valid email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.kr',
        'test+tag@example.org',
        'user123@test-domain.com'
      ];

      validEmails.forEach(email => {
        const validData = { email };
        const result = otpRequestSchema.parse(validData);
        expect(result.email).toBe(email);
      });
    });
  });

  describe('signupToOtpTransitionSchema', () => {
    it('should validate valid transition data', () => {
      const validData = {
        email: 'test@example.com',
        signupCompleted: true,
        transitionMessage: 'Signup completed successfully'
      };

      const result = signupToOtpTransitionSchema.parse(validData);

      expect(result).toEqual(validData);
      expect(result.email).toBe('test@example.com');
      expect(result.signupCompleted).toBe(true);
      expect(result.transitionMessage).toBe('Signup completed successfully');
    });

    it('should use default value for signupCompleted', () => {
      const validData = {
        email: 'test@example.com'
      };

      const result = signupToOtpTransitionSchema.parse(validData);

      expect(result.email).toBe('test@example.com');
      expect(result.signupCompleted).toBe(true);
      expect(result.transitionMessage).toBeUndefined();
    });

    it('should accept optional transitionMessage', () => {
      const validData = {
        email: 'test@example.com',
        signupCompleted: false
      };

      const result = signupToOtpTransitionSchema.parse(validData);

      expect(result.email).toBe('test@example.com');
      expect(result.signupCompleted).toBe(false);
      expect(result.transitionMessage).toBeUndefined();
    });

    it('should reject invalid email format', () => {
      const invalidData = {
        email: 'invalid-email',
        signupCompleted: true
      };

      expect(() => {
        signupToOtpTransitionSchema.parse(invalidData);
      }).toThrow();
    });

    it('should handle boolean signupCompleted values', () => {
      const testData = [
        { email: 'test@example.com', signupCompleted: true },
        { email: 'test@example.com', signupCompleted: false }
      ];

      testData.forEach(data => {
        const result = signupToOtpTransitionSchema.parse(data);
        expect(result.signupCompleted).toBe(data.signupCompleted);
      });
    });
  });

  describe('Type inference', () => {
    it('should infer correct types for SignupFormData', () => {
      const data: SignupFormData = {
        email: 'test@example.com',
        name: 'Test User',
        department: 'Engineering'
      };

      // Type check - should compile without errors
      expect(data.email).toBe('test@example.com');
      expect(data.name).toBe('Test User');
      expect(data.department).toBe('Engineering');
    });

    it('should infer correct types for OTPVerificationFormData', () => {
      const data: OTPVerificationFormData = {
        email: 'test@example.com',
        otp: '123456'
      };

      // Type check - should compile without errors
      expect(data.email).toBe('test@example.com');
      expect(data.otp).toBe('123456');
    });

    it('should infer correct types for OTPRequestFormData', () => {
      const data: OTPRequestFormData = {
        email: 'test@example.com'
      };

      // Type check - should compile without errors
      expect(data.email).toBe('test@example.com');
    });

    it('should infer correct types for SignupToOtpTransitionData', () => {
      const data: SignupToOtpTransitionData = {
        email: 'test@example.com',
        signupCompleted: true,
        transitionMessage: 'Success'
      };

      // Type check - should compile without errors
      expect(data.email).toBe('test@example.com');
      expect(data.signupCompleted).toBe(true);
      expect(data.transitionMessage).toBe('Success');
    });
  });

  describe('Schema integration', () => {
    it('should work with form validation libraries', () => {
      // Test that schemas can be used with form libraries like react-hook-form
      const signupData = {
        email: 'test@example.com',
        name: 'Test User',
        department: 'Engineering'
      };

      const otpData = {
        email: 'test@example.com',
        otp: '123456'
      };

      // Should not throw
      expect(() => signupSchema.parse(signupData)).not.toThrow();
      expect(() => otpVerificationSchema.parse(otpData)).not.toThrow();
    });

    it('should provide meaningful error messages', () => {
      try {
        signupSchema.parse({
          email: 'invalid-email',
          name: '',
          department: ''
        });
      } catch (error) {
        expect(error).toBeInstanceOf(z.ZodError);
        const zodError = error as z.ZodError;
        expect(zodError.issues.length).toBeGreaterThan(0);
        expect(zodError.issues.some(issue => issue.message.includes('이메일'))).toBe(true);
      }
    });
  });
});