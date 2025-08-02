import { 
  checkEmailExists, 
  validateEmailFormat, 
  getEmailValidationService,
  getLastValidationError 
} from '../email-validation-service';

// Mock the entire Supabase client module
jest.mock('@/lib/supabase/client');

describe('EmailValidationService Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('validateEmailFormat', () => {
    it('should validate correct email formats', () => {
      expect(validateEmailFormat('test@example.com')).toBe(true);
      expect(validateEmailFormat('user.name@domain.co.kr')).toBe(true);
      expect(validateEmailFormat('test+tag@example.org')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(validateEmailFormat('invalid-email')).toBe(false);
      expect(validateEmailFormat('test@')).toBe(false);
      expect(validateEmailFormat('@example.com')).toBe(false);
      expect(validateEmailFormat('test.example.com')).toBe(false);
      expect(validateEmailFormat('')).toBe(false);
    });
  });

  describe('checkEmailExists - Validation Errors', () => {
    it('should return validation error for invalid email format', async () => {
      const result = await checkEmailExists('invalid-email');

      expect(result.exists).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.type).toBe('validation_error');
      expect(result.error!.message).toBe('Invalid email format');
      expect(result.error!.userMessage).toBe('올바른 이메일 형식을 입력해주세요.');
      expect(result.error!.canRetry).toBe(false);
    });

    it('should handle empty email string', async () => {
      const result = await checkEmailExists('');
      expect(result.exists).toBe(false);
      expect(result.error!.type).toBe('validation_error');
    });

    it('should handle special characters in valid email', async () => {
      // Mock successful Supabase response with proper chaining
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: null
      });
      
      const mockEq = jest.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle
      });
      
      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq
      });
      
      const mockFrom = jest.fn().mockReturnValue({
        select: mockSelect
      });

      const mockSupabase = {
        from: mockFrom
      };

      // Mock the dynamic import to return the properly structured client
      jest.doMock('@/lib/supabase/client', () => ({
        createClient: jest.fn().mockReturnValue(mockSupabase)
      }));

      // Clear module cache to ensure fresh import
      jest.resetModules();
      
      // Re-import the function to get the mocked version
      const { checkEmailExists: mockedCheckEmailExists } = await import('../email-validation-service');

      const specialEmail = 'test+tag@example.com';
      const result = await mockedCheckEmailExists(specialEmail);
      
      expect(result.exists).toBe(false);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Service Instance', () => {
    it('should return singleton instance', () => {
      const service1 = getEmailValidationService();
      const service2 = getEmailValidationService();
      expect(service1).toBe(service2);
    });

    it('should track last validation error', async () => {
      const result = await checkEmailExists('invalid-email');
      expect(result.error).toBeDefined();
      expect(getLastValidationError()).toBe('Invalid email format');
    });
  });

  describe('Error Message Localization', () => {
    it('should provide Korean user messages for validation errors', async () => {
      const result = await checkEmailExists('invalid-email');
      expect(result.error!.userMessage).toBe('올바른 이메일 형식을 입력해주세요.');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long email addresses', async () => {
      const longEmail = 'a'.repeat(250) + '@example.com'; // This will exceed 254 char limit
      const result = await checkEmailExists(longEmail);
      expect(result.exists).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.type).toBe('validation_error');
    });

    it('should validate email format correctly for edge cases', () => {
      // Valid edge cases
      expect(validateEmailFormat('a@b.co')).toBe(true);
      expect(validateEmailFormat('test.email@example.com')).toBe(true);
      expect(validateEmailFormat('test_email@example.com')).toBe(true);
      
      // Invalid edge cases
      expect(validateEmailFormat('test..email@example.com')).toBe(false);
      expect(validateEmailFormat('test@example')).toBe(false);
      expect(validateEmailFormat('test@.example.com')).toBe(false);
    });
  });

  describe('Enhanced Error Handling Integration', () => {
    it('should provide comprehensive error information for debugging', async () => {
      const result = await checkEmailExists('invalid@');
      
      expect(result.error).toBeDefined();
      expect(result.error!.type).toBe('validation_error');
      expect(result.error!.message).toBe('Invalid email format');
      expect(result.error!.userMessage).toBe('올바른 이메일 형식을 입력해주세요.');
      expect(result.error!.canRetry).toBe(false);
      expect(result.error!.technicalDetails).toContain('Email format validation failed');
    });

    it('should handle different error types appropriately', async () => {
      // Test validation error
      const validationResult = await checkEmailExists('');
      expect(validationResult.error!.type).toBe('validation_error');
      expect(validationResult.error!.canRetry).toBe(false);

      // Test long email
      const longEmailResult = await checkEmailExists('a'.repeat(300) + '@example.com');
      expect(longEmailResult.error!.type).toBe('validation_error');
      expect(longEmailResult.error!.canRetry).toBe(false);
    });

    it('should provide user-friendly Korean messages for all error types', async () => {
      const result = await checkEmailExists('invalid-format');
      expect(result.error!.userMessage).toBe('올바른 이메일 형식을 입력해주세요.');
      expect(typeof result.error!.userMessage).toBe('string');
      expect(result.error!.userMessage.length).toBeGreaterThan(0);
    });
  });
});