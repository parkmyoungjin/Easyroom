/**
 * @jest-environment node
 */

import { environmentManager, getServiceRoleKey, validateEnvironmentVariables } from '@/lib/security/environment-manager';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

import { logger } from '@/lib/utils/logger';

describe('Environment Security Manager', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Public Key Access', () => {
    it('should allow access to public environment variables', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      
      const url = environmentManager.getPublicKey('NEXT_PUBLIC_SUPABASE_URL');
      expect(url).toBe('https://test.supabase.co');
    });

    it('should reject access to non-public environment variables', () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'secret-key';
      
      expect(() => {
        environmentManager.getPublicKey('SUPABASE_SERVICE_ROLE_KEY');
      }).toThrow('SUPABASE_SERVICE_ROLE_KEY는 공개 환경 변수가 아닙니다');
      
      expect(logger.warn).toHaveBeenCalledWith('비공개 환경 변수 접근 시도', expect.any(Object));
    });

    it('should throw error for missing public environment variables', () => {
      expect(() => {
        environmentManager.getPublicKey('NEXT_PUBLIC_SUPABASE_URL');
      }).toThrow('환경 변수 NEXT_PUBLIC_SUPABASE_URL가 설정되지 않았습니다');
    });
  });

  describe('Server Key Access', () => {
    it('should allow access to server environment variables', () => {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
      
      const key = environmentManager.getServerKey('NEXT_PUBLIC_SUPABASE_ANON_KEY');
      expect(key).toBe('anon-key');
    });

    it('should reject access to unauthorized server environment variables', () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'secret-key';
      
      expect(() => {
        environmentManager.getServerKey('SUPABASE_SERVICE_ROLE_KEY');
      }).toThrow('SUPABASE_SERVICE_ROLE_KEY는 허용된 서버 환경 변수가 아닙니다');
      
      expect(logger.warn).toHaveBeenCalledWith('허용되지 않은 서버 환경 변수 접근', expect.any(Object));
    });
  });

  describe('Service Role Key Access', () => {
    beforeEach(() => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    });

    it('should allow access from authorized callers with admin endpoints', () => {
      const context = {
        caller: 'createAdminClient',
        endpoint: '/api/admin/users',
        userId: 'user123'
      };
      
      const key = environmentManager.getServiceRoleKey(context);
      expect(key).toBe('service-role-key');
      
      expect(logger.info).toHaveBeenCalledWith('서비스 역할 키 접근', expect.objectContaining({
        caller: 'createAdminClient',
        endpoint: '/api/admin/users'
      }));
    });

    it('should reject access from unauthorized callers', () => {
      const context = {
        caller: 'unauthorized-caller',
        endpoint: '/api/admin/users',
        userId: 'user123'
      };
      
      expect(() => {
        environmentManager.getServiceRoleKey(context);
      }).toThrow('서비스 역할 키에 대한 접근 권한이 없습니다');
      
      expect(logger.error).toHaveBeenCalledWith('서비스 역할 키 무단 접근 시도', expect.any(Object));
    });

    it('should reject access from non-admin endpoints', () => {
      const context = {
        caller: 'createAdminClient',
        endpoint: '/api/reservations/public',
        userId: 'user123'
      };
      
      expect(() => {
        environmentManager.getServiceRoleKey(context);
      }).toThrow('관리자 엔드포인트에서만 서비스 역할 키를 사용할 수 있습니다');
      
      expect(logger.error).toHaveBeenCalledWith('비관리자 엔드포인트에서 서비스 역할 키 접근 시도', expect.any(Object));
    });

    it('should throw error when service role key is not set', () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      const context = {
        caller: 'createAdminClient',
        endpoint: '/api/admin/users',
        userId: 'user123'
      };
      
      expect(() => {
        environmentManager.getServiceRoleKey(context);
      }).toThrow('SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다');
    });

    it('should maintain access log', () => {
      const initialLogLength = environmentManager.getServiceRoleAccessLog().length;
      
      const context1 = {
        caller: 'createAdminClient',
        endpoint: '/api/admin/users',
        userId: 'user123'
      };
      
      const context2 = {
        caller: 'admin-api',
        endpoint: '/api/admin/settings',
        userId: 'user456'
      };
      
      environmentManager.getServiceRoleKey(context1);
      environmentManager.getServiceRoleKey(context2);
      
      const accessLog = environmentManager.getServiceRoleAccessLog();
      expect(accessLog).toHaveLength(initialLogLength + 2);
      
      // Check the last two entries
      const lastTwoEntries = accessLog.slice(-2);
      expect(lastTwoEntries[0].caller).toBe('createAdminClient');
      expect(lastTwoEntries[1].caller).toBe('admin-api');
    });
  });

  describe('Environment Validation', () => {
    it('should pass validation with all required variables', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
      
      const result = environmentManager.validateEnvironment();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toBeDefined();
    });

    it('should fail validation with missing required variables', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      const result = environmentManager.validateEnvironment();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('필수 환경 변수 NEXT_PUBLIC_SUPABASE_URL가 설정되지 않았습니다');
      expect(result.errors).toContain('필수 환경 변수 NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다');
    });

    it('should fail validation with invalid URL format', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'invalid-url';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
      
      const result = environmentManager.validateEnvironment();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('NEXT_PUBLIC_SUPABASE_URL이 유효한 URL 형식이 아닙니다');
    });

    it('should warn about missing optional variables', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      const result = environmentManager.validateEnvironment();
      expect(result.valid).toBe(true); // Still valid, just warning
      expect(result.warnings).toContain('선택적 환경 변수 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다');
    });

    it('should validate HTTPS requirement in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://test.supabase.co'; // HTTP instead of HTTPS
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
      
      const result = environmentManager.validateEnvironment();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('프로덕션 환경에서는 HTTPS URL이 필요합니다');
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should detect development default values in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://your_supabase_url_here';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
      
      const result = environmentManager.validateEnvironment();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('NEXT_PUBLIC_SUPABASE_URL에 개발용 기본값이 설정되어 있습니다. 프로덕션 값으로 변경하세요');
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should validate key formats', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'short'; // Too short
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'short'; // Too short
      
      const result = environmentManager.validateEnvironment();
      expect(result.valid).toBe(true); // Still valid, but with warnings
      expect(result.warnings).toContain('SUPABASE_ANON_KEY가 예상보다 짧습니다. 올바른 키인지 확인하세요');
      expect(result.warnings).toContain('SUPABASE_SERVICE_ROLE_KEY가 예상보다 짧습니다. 올바른 키인지 확인하세요');
    });

    it('should detect identical service and anon keys in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'same-key';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'same-key'; // Same as anon key
      
      const result = environmentManager.validateEnvironment();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('서비스 역할 키와 익명 키가 동일합니다. 보안상 위험합니다');
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Helper Functions', () => {
    beforeEach(() => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    });

    it('should provide service role key through helper function', () => {
      const key = getServiceRoleKey({
        caller: 'createAdminClient',
        endpoint: '/api/admin/users',
        userId: 'user123'
      });
      
      expect(key).toBe('service-role-key');
    });

    it('should validate environment variables through helper function', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
      
      expect(() => {
        validateEnvironmentVariables();
      }).not.toThrow();
    });

    it('should throw error for invalid environment through helper function', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      
      expect(() => {
        validateEnvironmentVariables();
      }).toThrow('환경 변수 검증 실패');
    });
  });

  describe('Security Features', () => {
    beforeEach(() => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    });

    it('should limit access log size to prevent memory leaks', () => {
      // Fill access log beyond limit
      for (let i = 0; i < 105; i++) {
        environmentManager.getServiceRoleKey({
          caller: 'createAdminClient',
          endpoint: '/api/admin/test',
          userId: `user${i}`
        });
      }
      
      const accessLog = environmentManager.getServiceRoleAccessLog();
      expect(accessLog.length).toBe(100); // Should be capped at 100
    });

    it('should redact sensitive information in logs', () => {
      environmentManager.getServiceRoleKey({
        caller: 'createAdminClient',
        endpoint: '/api/admin/users',
        userId: 'sensitive-user-id'
      });
      
      expect(logger.info).toHaveBeenCalledWith('서비스 역할 키 접근', expect.objectContaining({
        userId: '[REDACTED]'
      }));
    });
  });
});