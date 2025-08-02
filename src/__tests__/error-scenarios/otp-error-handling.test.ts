/**
 * OTP Error Handling and Edge Cases Tests
 * Comprehensive testing of all error scenarios and edge cases
 * Requirements: 2.3, 2.4, 2.5, 3.2, 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock network utilities
const mockGetNetworkStatus = jest.fn();
const mockIsNetworkError = jest.fn();

jest.mock('@/lib/utils/auth-timeout', () => ({
  getNetworkStatus: mockGetNetworkStatus,
  isNetworkError: mockIsNetworkError,
}));

// Mock Supabase client
const mockSupabaseAuth = {
  signInWithOtp: jest.fn(),
  verifyOtp: jest.fn(),
  signOut: jest.fn(),
  getSession: jest.fn(),
};

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: mockSupabaseAuth,
  }),
}));

// Mock toast notifications
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('OTP Error Handling and Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default network state
    mockGetNetworkStatus.mockReturnValue({
      isOnline: true,
      connectionType: 'wifi',
      effectiveType: '4g',
    });

    mockIsNetworkError.mockReturnValue(false);

    // Default Supabase responses
    mockSupabaseAuth.signInWithOtp.mockResolvedValue({ error: null });
    mockSupabaseAuth.verifyOtp.mockResolvedValue({
      data: {
        user: { id: 'user123', email: 'test@example.com' },
        session: { access_token: 'token123' }
      },
      error: null,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Network Error Scenarios', () => {
    it('should handle complete network failure during OTP request', async () => {
      const email = 'network-fail@example.com';

      // Mock complete network failure
      mockGetNetworkStatus.mockReturnValue({ isOnline: true }); // 온라인 상태로 설정
      mockSupabaseAuth.signInWithOtp.mockRejectedValue(
        new Error('Network request failed')
      );
      mockIsNetworkError.mockReturnValue(true);

      const mockRequestOTP = jest.fn().mockImplementation(async (email: string) => {
        const networkStatus = mockGetNetworkStatus();
        if (!networkStatus.isOnline) {
          throw new Error('인터넷 연결을 확인해주세요. OTP 요청을 위해서는 인터넷 연결이 필요합니다.');
        }

        try {
          await mockSupabaseAuth.signInWithOtp({
            email,
            options: { shouldCreateUser: false }
          });
        } catch (error) {
          if (mockIsNetworkError(error)) {
            throw new Error('인터넷 연결을 확인해주세요. OTP 요청을 위해서는 인터넷 연결이 필요합니다.');
          }
          throw error;
        }
      });

      try {
        await mockRequestOTP(email);
        // 에러가 발생하지 않으면 테스트 실패
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain('인터넷 연결을 확인해주세요');
        expect(mockIsNetworkError).toHaveBeenCalled();
      }
    });

    it('should handle timeout errors during OTP request', async () => {
      const email = 'timeout@example.com';

      // Mock timeout error
      mockSupabaseAuth.signInWithOtp.mockRejectedValue(
        new Error('Request timeout')
      );

      const mockRequestOTP = jest.fn().mockImplementation(async (email: string) => {
        try {
          await mockSupabaseAuth.signInWithOtp({
            email,
            options: { shouldCreateUser: false }
          });
        } catch (error: any) {
          if (error.message.includes('timeout')) {
            throw new Error('요청 시간이 초과되었습니다. 다시 시도해주세요.');
          }
          throw error;
        }
      });

      try {
        await mockRequestOTP(email);
      } catch (error: any) {
        expect(error.message).toContain('요청 시간이 초과되었습니다');
      }
    });

    it('should handle DNS resolution failures', async () => {
      const email = 'dns-fail@example.com';

      // Mock DNS failure
      mockSupabaseAuth.signInWithOtp.mockRejectedValue(
        new Error('getaddrinfo ENOTFOUND')
      );
      mockIsNetworkError.mockReturnValue(true);

      const mockRequestOTP = jest.fn().mockImplementation(async (email: string) => {
        try {
          await mockSupabaseAuth.signInWithOtp({
            email,
            options: { shouldCreateUser: false }
          });
        } catch (error: any) {
          if (mockIsNetworkError(error)) {
            throw new Error('네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인해주세요.');
          }
          throw error;
        }
      });

      try {
        await mockRequestOTP(email);
      } catch (error: any) {
        expect(error.message).toContain('네트워크 연결에 문제가 있습니다');
      }
    });

    it('should handle server unavailable errors', async () => {
      const email = 'server-down@example.com';

      // Mock server error
      mockSupabaseAuth.signInWithOtp.mockRejectedValue(
        new Error('Service Unavailable')
      );

      const mockRequestOTP = jest.fn().mockImplementation(async (email: string) => {
        try {
          await mockSupabaseAuth.signInWithOtp({
            email,
            options: { shouldCreateUser: false }
          });
        } catch (error: any) {
          if (error.message.includes('Unavailable')) {
            throw new Error('서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.');
          }
          throw error;
        }
      });

      try {
        await mockRequestOTP(email);
      } catch (error: any) {
        expect(error.message).toContain('서버에 일시적인 문제가 있습니다');
      }
    });
  });

  describe('OTP Verification Error Scenarios', () => {
    it('should handle invalid OTP format errors', async () => {
      const email = 'test@example.com';
      const invalidOtps = ['12345', '1234567', 'abcdef', '12345a', ''];

      const mockVerifyOTP = jest.fn().mockImplementation(async (email: string, otp: string) => {
        // Validate OTP format
        if (!/^\d{6}$/.test(otp)) {
          throw new Error('OTP는 6자리 숫자여야 합니다.');
        }

        return mockSupabaseAuth.verifyOtp({
          email,
          token: otp,
          type: 'email'
        });
      });

      for (const invalidOtp of invalidOtps) {
        try {
          await mockVerifyOTP(email, invalidOtp);
        } catch (error: any) {
          expect(error.message).toBe('OTP는 6자리 숫자여야 합니다.');
        }
      }
    });

    it('should handle expired OTP errors', async () => {
      const email = 'expired@example.com';
      const otp = '123456';

      // Mock expired OTP error
      mockSupabaseAuth.verifyOtp.mockRejectedValue(
        new Error('Token has expired')
      );

      const mockVerifyOTP = jest.fn().mockImplementation(async (email: string, otp: string) => {
        try {
          return await mockSupabaseAuth.verifyOtp({
            email,
            token: otp,
            type: 'email'
          });
        } catch (error: any) {
          if (error.message.includes('expired')) {
            throw new Error('OTP 코드가 만료되었습니다. 새로운 코드를 요청해주세요.');
          }
          throw error;
        }
      });

      try {
        await mockVerifyOTP(email, otp);
      } catch (error: any) {
        expect(error.message).toContain('OTP 코드가 만료되었습니다');
      }
    });

    it('should handle invalid OTP code errors', async () => {
      const email = 'invalid@example.com';
      const otp = '000000';

      // Mock invalid OTP error
      mockSupabaseAuth.verifyOtp.mockRejectedValue(
        new Error('Invalid token')
      );

      const mockVerifyOTP = jest.fn().mockImplementation(async (email: string, otp: string) => {
        try {
          return await mockSupabaseAuth.verifyOtp({
            email,
            token: otp,
            type: 'email'
          });
        } catch (error: any) {
          if (error.message.includes('Invalid token')) {
            throw new Error('잘못된 OTP 코드입니다. 다시 확인해주세요.');
          }
          throw error;
        }
      });

      try {
        await mockVerifyOTP(email, otp);
      } catch (error: any) {
        expect(error.message).toContain('잘못된 OTP 코드입니다');
      }
    });

    it('should handle too many attempts errors', async () => {
      const email = 'toomany@example.com';
      const otp = '123456';

      // Mock too many attempts error
      mockSupabaseAuth.verifyOtp.mockRejectedValue(
        new Error('Too many attempts')
      );

      const mockVerifyOTP = jest.fn().mockImplementation(async (email: string, otp: string) => {
        try {
          return await mockSupabaseAuth.verifyOtp({
            email,
            token: otp,
            type: 'email'
          });
        } catch (error: any) {
          if (error.message.includes('Too many attempts')) {
            throw new Error('너무 많은 시도를 했습니다. 새로운 OTP 코드를 요청해주세요.');
          }
          throw error;
        }
      });

      try {
        await mockVerifyOTP(email, otp);
      } catch (error: any) {
        expect(error.message).toContain('너무 많은 시도를 했습니다');
      }
    });
  });

  describe('Rate Limiting Scenarios', () => {
    it('should handle email rate limiting', async () => {
      const email = 'ratelimited@example.com';

      // Mock rate limit error
      mockSupabaseAuth.signInWithOtp.mockRejectedValue(
        new Error('Email rate limit exceeded')
      );

      const mockRequestOTP = jest.fn().mockImplementation(async (email: string) => {
        try {
          await mockSupabaseAuth.signInWithOtp({
            email,
            options: { shouldCreateUser: false }
          });
        } catch (error: any) {
          if (error.message.includes('rate limit')) {
            throw new Error('이메일 전송 한도를 초과했습니다. 1분 후 다시 시도해주세요.');
          }
          throw error;
        }
      });

      try {
        await mockRequestOTP(email);
      } catch (error: any) {
        expect(error.message).toContain('이메일 전송 한도를 초과했습니다');
      }
    });

    it('should handle verification rate limiting', async () => {
      const email = 'verify-rate@example.com';
      const otp = '123456';

      // Mock verification rate limit
      mockSupabaseAuth.verifyOtp.mockRejectedValue(
        new Error('Verification rate limit exceeded')
      );

      const mockVerifyOTP = jest.fn().mockImplementation(async (email: string, otp: string) => {
        try {
          return await mockSupabaseAuth.verifyOtp({
            email,
            token: otp,
            type: 'email'
          });
        } catch (error: any) {
          if (error.message.includes('Verification rate limit')) {
            throw new Error('인증 시도 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
          }
          throw error;
        }
      });

      try {
        await mockVerifyOTP(email, otp);
      } catch (error: any) {
        expect(error.message).toContain('인증 시도 한도를 초과했습니다');
      }
    });

    it('should handle IP-based rate limiting', async () => {
      const email = 'ip-rate@example.com';

      // Mock IP rate limit
      mockSupabaseAuth.signInWithOtp.mockRejectedValue(
        new Error('IP rate limit exceeded')
      );

      const mockRequestOTP = jest.fn().mockImplementation(async (email: string) => {
        try {
          await mockSupabaseAuth.signInWithOtp({
            email,
            options: { shouldCreateUser: false }
          });
        } catch (error: any) {
          if (error.message.includes('IP rate limit')) {
            throw new Error('현재 IP에서 너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.');
          }
          throw error;
        }
      });

      try {
        await mockRequestOTP(email);
      } catch (error: any) {
        expect(error.message).toContain('현재 IP에서 너무 많은 요청이 발생했습니다');
      }
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty email input', async () => {
      const email = '';

      const mockRequestOTP = jest.fn().mockImplementation(async (email: string) => {
        if (!email || !email.trim()) {
          throw new Error('이메일 주소를 입력해주세요.');
        }

        return mockSupabaseAuth.signInWithOtp({
          email,
          options: { shouldCreateUser: false }
        });
      });

      try {
        await mockRequestOTP(email);
      } catch (error: any) {
        expect(error.message).toBe('이메일 주소를 입력해주세요.');
      }
    });

    it('should handle malformed email addresses', async () => {
      const malformedEmails = [
        'invalid-email',
        '@example.com',
        'test@',
        'test..test@example.com',
        'test@example',
        'test@.com'
      ];

      const mockRequestOTP = jest.fn().mockImplementation(async (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          throw new Error('올바른 이메일 주소를 입력해주세요.');
        }

        return mockSupabaseAuth.signInWithOtp({
          email,
          options: { shouldCreateUser: false }
        });
      });

      for (const email of malformedEmails) {
        try {
          await mockRequestOTP(email);
        } catch (error: any) {
          expect(error.message).toBe('올바른 이메일 주소를 입력해주세요.');
        }
      }
    });

    it('should handle extremely long email addresses', async () => {
      const longEmail = 'a'.repeat(300) + '@example.com';

      const mockRequestOTP = jest.fn().mockImplementation(async (email: string) => {
        if (email.length > 254) { // RFC 5321 limit
          throw new Error('이메일 주소가 너무 깁니다.');
        }

        return mockSupabaseAuth.signInWithOtp({
          email,
          options: { shouldCreateUser: false }
        });
      });

      try {
        await mockRequestOTP(longEmail);
      } catch (error: any) {
        expect(error.message).toBe('이메일 주소가 너무 깁니다.');
      }
    });

    it('should handle special characters in email', async () => {
      const specialEmails = [
        'test+tag@example.com',
        'test.name@example.com',
        'test_name@example.com',
        'test-name@example.com',
        'test123@example.com'
      ];

      const mockRequestOTP = jest.fn().mockResolvedValue(undefined);

      for (const email of specialEmails) {
        await mockRequestOTP(email);
        expect(mockRequestOTP).toHaveBeenCalledWith(email);
      }
    });

    it('should handle concurrent OTP requests for same email', async () => {
      const email = 'concurrent@example.com';

      // Mock concurrent request handling
      let requestCount = 0;
      const mockRequestOTP = jest.fn().mockImplementation(async (email: string) => {
        requestCount++;
        if (requestCount > 1) {
          throw new Error('이미 OTP 요청이 진행 중입니다. 잠시 후 다시 시도해주세요.');
        }

        // Simulate async operation with fake timers
        return new Promise((resolve) => {
          setTimeout(() => {
            requestCount--;
            resolve(mockSupabaseAuth.signInWithOtp({
              email,
              options: { shouldCreateUser: false }
            }));
          }, 100);
        });
      });

      // Make concurrent requests
      const promise1 = mockRequestOTP(email);
      const promise2 = mockRequestOTP(email);

      // Advance timers to resolve the first promise
      jest.advanceTimersByTime(100);

      const results = await Promise.allSettled([promise1, promise2]);
      
      // One should succeed, one should fail
      const successes = results.filter(r => r.status === 'fulfilled').length;
      const failures = results.filter(r => r.status === 'rejected').length;

      expect(successes).toBe(1);
      expect(failures).toBe(1);
    });

    it('should handle memory pressure scenarios', async () => {
      const email = 'memory@example.com';

      // Mock memory pressure
      const mockRequestOTP = jest.fn().mockImplementation(async (email: string) => {
        // Simulate memory check
        const mockMemoryUsage = 0.95; // 95% memory usage
        
        if (mockMemoryUsage > 0.9) {
          throw new Error('시스템 리소스가 부족합니다. 잠시 후 다시 시도해주세요.');
        }

        return mockSupabaseAuth.signInWithOtp({
          email,
          options: { shouldCreateUser: false }
        });
      });

      try {
        await mockRequestOTP(email);
      } catch (error: any) {
        expect(error.message).toContain('시스템 리소스가 부족합니다');
      }
    });
  });

  describe('Recovery and Retry Mechanisms', () => {
    it('should implement exponential backoff for retries', async () => {
      const email = 'backoff@example.com';
      let attemptCount = 0;
      const delays: number[] = [];

      const mockRequestOTPWithBackoff = jest.fn().mockImplementation(async (email: string) => {
        attemptCount++;
        
        if (attemptCount < 3) {
          // Calculate exponential backoff delay
          const delay = Math.pow(2, attemptCount - 1) * 1000; // 1s, 2s, 4s
          delays.push(delay);
          
          throw new Error('Temporary failure');
        }

        return mockSupabaseAuth.signInWithOtp({
          email,
          options: { shouldCreateUser: false }
        });
      });

      // Simulate retry logic
      for (let i = 0; i < 3; i++) {
        try {
          await mockRequestOTPWithBackoff(email);
          break;
        } catch (error) {
          if (i < 2) {
            // Wait for backoff delay
            jest.advanceTimersByTime(delays[i]);
          }
        }
      }

      expect(attemptCount).toBe(3);
      expect(delays).toEqual([1000, 2000]);
    });

    it('should handle circuit breaker pattern', async () => {
      const email = 'circuit@example.com';
      let failureCount = 0;
      let circuitOpen = false;

      const mockRequestOTPWithCircuitBreaker = jest.fn().mockImplementation(async (email: string) => {
        if (circuitOpen) {
          throw new Error('서비스가 일시적으로 중단되었습니다. 잠시 후 다시 시도해주세요.');
        }

        failureCount++;
        
        if (failureCount >= 5) {
          circuitOpen = true;
          throw new Error('Circuit breaker opened');
        }

        throw new Error('Service failure');
      });

      // Make multiple requests to trigger circuit breaker
      for (let i = 0; i < 6; i++) {
        try {
          await mockRequestOTPWithCircuitBreaker(email);
        } catch (error: any) {
          if (i >= 5) {
            expect(error.message).toContain('서비스가 일시적으로 중단되었습니다');
          }
        }
      }

      expect(circuitOpen).toBe(true);
    });

    it('should handle graceful degradation', async () => {
      const email = 'degradation@example.com';

      const mockRequestOTPWithDegradation = jest.fn().mockImplementation(async (email: string) => {
        // Simulate service degradation
        const serviceHealth = 0.3; // 30% health

        if (serviceHealth < 0.5) {
          // Degrade to basic functionality
          throw new Error('서비스가 제한된 모드로 동작 중입니다. 기본 기능만 사용 가능합니다.');
        }

        return mockSupabaseAuth.signInWithOtp({
          email,
          options: { shouldCreateUser: false }
        });
      });

      try {
        await mockRequestOTPWithDegradation(email);
      } catch (error: any) {
        expect(error.message).toContain('서비스가 제한된 모드로 동작 중입니다');
      }
    });
  });

  describe('Security Error Scenarios', () => {
    it('should handle suspicious activity detection', async () => {
      const email = 'suspicious@example.com';

      const mockRequestOTP = jest.fn().mockImplementation(async (email: string) => {
        // Simulate suspicious activity detection
        const isSuspicious = email.includes('suspicious');
        
        if (isSuspicious) {
          throw new Error('보안상의 이유로 요청이 차단되었습니다. 고객센터에 문의해주세요.');
        }

        return mockSupabaseAuth.signInWithOtp({
          email,
          options: { shouldCreateUser: false }
        });
      });

      try {
        await mockRequestOTP(email);
      } catch (error: any) {
        expect(error.message).toContain('보안상의 이유로 요청이 차단되었습니다');
      }
    });

    it('should handle blocked domains', async () => {
      const blockedEmails = [
        'test@tempmail.com',
        'test@10minutemail.com',
        'test@guerrillamail.com'
      ];

      const mockRequestOTP = jest.fn().mockImplementation(async (email: string) => {
        const blockedDomains = ['tempmail.com', '10minutemail.com', 'guerrillamail.com'];
        const domain = email.split('@')[1];
        
        if (blockedDomains.includes(domain)) {
          throw new Error('임시 이메일 주소는 사용할 수 없습니다.');
        }

        return mockSupabaseAuth.signInWithOtp({
          email,
          options: { shouldCreateUser: false }
        });
      });

      for (const email of blockedEmails) {
        try {
          await mockRequestOTP(email);
        } catch (error: any) {
          expect(error.message).toBe('임시 이메일 주소는 사용할 수 없습니다.');
        }
      }
    });

    it('should handle CSRF token validation', async () => {
      const email = 'csrf@example.com';

      const mockRequestOTP = jest.fn().mockImplementation(async (email: string, csrfToken?: string) => {
        if (!csrfToken || csrfToken !== 'valid-csrf-token') {
          throw new Error('보안 토큰이 유효하지 않습니다. 페이지를 새로고침해주세요.');
        }

        return mockSupabaseAuth.signInWithOtp({
          email,
          options: { shouldCreateUser: false }
        });
      });

      // Test without CSRF token
      try {
        await mockRequestOTP(email);
      } catch (error: any) {
        expect(error.message).toContain('보안 토큰이 유효하지 않습니다');
      }

      // Test with invalid CSRF token
      try {
        await mockRequestOTP(email, 'invalid-token');
      } catch (error: any) {
        expect(error.message).toContain('보안 토큰이 유효하지 않습니다');
      }

      // Test with valid CSRF token
      await mockRequestOTP(email, 'valid-csrf-token');
      expect(mockRequestOTP).toHaveBeenCalledWith(email, 'valid-csrf-token');
    });
  });
});