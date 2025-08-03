import { 
  checkEmailExists, 
  validateEmailFormat, 
  getEmailValidationService,
  getLastValidationError 
} from '../email-validation-service';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Create a mock SupabaseClient for testing
const createMockSupabaseClient = (): jest.Mocked<SupabaseClient<Database>> => {
  return {
    rpc: jest.fn(),
    from: jest.fn(),
    auth: {} as any,
    storage: {} as any,
    realtime: {} as any,
    rest: {} as any,
    functions: {} as any,
    channel: jest.fn(),
    getChannels: jest.fn(),
    removeChannel: jest.fn(),
    removeAllChannels: jest.fn(),
  } as jest.Mocked<SupabaseClient<Database>>;
};

describe('EmailValidationService Integration Tests', () => {
  let mockSupabase: jest.Mocked<SupabaseClient<Database>>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
    mockSupabase = createMockSupabaseClient();
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
      const result = await checkEmailExists(mockSupabase, 'invalid-email');

      expect(result.exists).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.type).toBe('validation_error');
      expect(result.error!.message).toBe('Invalid email format');
      expect(result.error!.userMessage).toBe('올바른 이메일 형식을 입력해주세요.');
      expect(result.error!.canRetry).toBe(false);
    });

    it('should handle empty email string', async () => {
      const result = await checkEmailExists(mockSupabase, '');
      expect(result.exists).toBe(false);
      expect(result.error!.type).toBe('validation_error');
    });

    it('should handle null client gracefully', async () => {
      const result = await checkEmailExists(null as any, 'test@example.com');
      expect(result.exists).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.type).toBe('client_not_ready');
      expect(result.error!.message).toBe('Supabase client not provided');
      expect(result.error!.userMessage).toBe('서비스 연결에 문제가 있습니다.');
      expect(result.error!.canRetry).toBe(false);
    });

    it('should handle special characters in valid email', async () => {
      // Mock successful RPC response
      mockSupabase.rpc.mockResolvedValue({
        data: false,
        error: null
      });

      const specialEmail = 'test+tag@example.com';
      const result = await checkEmailExists(mockSupabase, specialEmail);
      
      expect(result.exists).toBe(false);
      expect(result.error).toBeUndefined();
      expect(mockSupabase.rpc).toHaveBeenCalledWith('check_email_exists', { p_email: specialEmail });
    });

    it('should work with mocked successful database response', async () => {
      // Mock RPC to return true (email exists)
      mockSupabase.rpc.mockResolvedValue({
        data: true,
        error: null
      });

      const result = await checkEmailExists(mockSupabase, 'existing@example.com');
      
      expect(result.exists).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockSupabase.rpc).toHaveBeenCalledWith('check_email_exists', { p_email: 'existing@example.com' });
    });

    it('should handle database errors properly', async () => {
      // Mock RPC to return a non-retryable database error
      const dbError = { message: 'Invalid query syntax', code: 'SYNTAX_ERROR' };
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: dbError
      });

      const result = await checkEmailExists(mockSupabase, 'test@example.com');
      
      expect(result.exists).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.type).toBe('database_error');
      expect(result.error!.message).toBe('Invalid query syntax');
      expect(result.error!.canRetry).toBe(false);
    });
  });

  describe('Service Instance', () => {
    it('should return singleton instance', () => {
      const service1 = getEmailValidationService();
      const service2 = getEmailValidationService();
      expect(service1).toBe(service2);
    });

    it('should track last validation error', async () => {
      const result = await checkEmailExists(mockSupabase, 'invalid-email');
      expect(result.error).toBeDefined();
      expect(getLastValidationError()).toBe('Invalid email format');
    });
  });

  describe('Error Message Localization', () => {
    it('should provide Korean user messages for validation errors', async () => {
      const result = await checkEmailExists(mockSupabase, 'invalid-email');
      expect(result.error!.userMessage).toBe('올바른 이메일 형식을 입력해주세요.');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long email addresses', async () => {
      const longEmail = 'a'.repeat(250) + '@example.com'; // This will exceed 254 char limit
      const result = await checkEmailExists(mockSupabase, longEmail);
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
      const result = await checkEmailExists(mockSupabase, 'invalid@');
      
      expect(result.error).toBeDefined();
      expect(result.error!.type).toBe('validation_error');
      expect(result.error!.message).toBe('Invalid email format');
      expect(result.error!.userMessage).toBe('올바른 이메일 형식을 입력해주세요.');
      expect(result.error!.canRetry).toBe(false);
      expect(result.error!.technicalDetails).toContain('Email format validation failed');
    });

    it('should handle different error types appropriately', async () => {
      // Test validation error
      const validationResult = await checkEmailExists(mockSupabase, '');
      expect(validationResult.error!.type).toBe('validation_error');
      expect(validationResult.error!.canRetry).toBe(false);

      // Test long email
      const longEmailResult = await checkEmailExists(mockSupabase, 'a'.repeat(300) + '@example.com');
      expect(longEmailResult.error!.type).toBe('validation_error');
      expect(longEmailResult.error!.canRetry).toBe(false);
    });

    it('should provide user-friendly Korean messages for all error types', async () => {
      const result = await checkEmailExists(mockSupabase, 'invalid-format');
      expect(result.error!.userMessage).toBe('올바른 이메일 형식을 입력해주세요.');
      expect(typeof result.error!.userMessage).toBe('string');
      expect(result.error!.userMessage.length).toBeGreaterThan(0);
    });

    it('should categorize network errors correctly', async () => {
      // Mock network error that should be categorized as network_error
      const networkError = { message: 'fetch failed due to network issue', code: 'NETWORK_ERROR' };
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: networkError
      });

      // Mock the retry logic to avoid actual delays in tests
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((callback) => {
        callback();
        return 1 as any;
      });

      const result = await checkEmailExists(mockSupabase, 'test@example.com');
      
      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
      
      expect(result.exists).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.type).toBe('network_error');
      expect(result.error!.canRetry).toBe(true);
      expect(result.error!.userMessage).toBe('네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인하고 다시 시도해주세요.');
    });
  });
});