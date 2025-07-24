/**
 * Secure Environment Access Tests
 * Tests for centralized environment variable access with security context tracking
 * Requirements: 2.1, 2.5
 */

import {
  secureEnvironmentAccess,
  getPublicEnvVar,
  getServerEnvVar,
  getSecureServiceRoleKey,
  validateEnvironmentAtStartup
} from '@/lib/security/secure-environment-access';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('@/lib/monitoring/security-monitor', () => ({
  securityMonitor: {
    recordEvent: jest.fn()
  }
}));

jest.mock('@/lib/monitoring/performance-monitor', () => ({
  performanceMonitor: {
    measureDatabaseQuery: jest.fn((fn) => fn())
  }
}));

jest.mock('@/lib/security/environment-manager', () => ({
  getServiceRoleKey: jest.fn()
}));

describe('Secure Environment Access', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Public Environment Variable Access', () => {
    it('should successfully get public environment variable', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';

      const result = await secureEnvironmentAccess.getPublicVariable('NEXT_PUBLIC_SUPABASE_URL', {
        caller: 'test-caller'
      });

      expect(result.success).toBe(true);
      expect(result.value).toBe('https://test.supabase.co');
      expect(result.accessContext.caller).toBe('test-caller');
      expect(result.accessContext.purpose).toBe('public_access');
    });

    it('should fail for unregistered environment variable', async () => {
      const result = await secureEnvironmentAccess.getPublicVariable('UNREGISTERED_VAR', {
        caller: 'test-caller'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not registered in the secure access system');
    });

    it('should fail for missing required environment variable', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      const result = await secureEnvironmentAccess.getPublicVariable('NEXT_PUBLIC_SUPABASE_URL', {
        caller: 'test-caller'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Required environment variable');
    });

    it('should validate URL format for Supabase URL', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'invalid-url';

      const result = await secureEnvironmentAccess.getPublicVariable('NEXT_PUBLIC_SUPABASE_URL', {
        caller: 'test-caller'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });

    it('should require HTTPS in production for Supabase URL', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://test.supabase.co';

      const result = await secureEnvironmentAccess.getPublicVariable('NEXT_PUBLIC_SUPABASE_URL', {
        caller: 'test-caller'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTPS is required in production');

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should validate Supabase key length', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'short';

      const result = await secureEnvironmentAccess.getPublicVariable('NEXT_PUBLIC_SUPABASE_ANON_KEY', {
        caller: 'test-caller'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('too short');
    });

    it('should detect development default values', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://your_supabase_url_here.supabase.co';

      const result = await secureEnvironmentAccess.getPublicVariable('NEXT_PUBLIC_SUPABASE_URL', {
        caller: 'test-caller'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('development default value');
    });
  });

  describe('Server Environment Variable Access', () => {
    it('should successfully get server environment variable', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';

      const result = await secureEnvironmentAccess.getServerVariable('NEXT_PUBLIC_SUPABASE_URL', {
        caller: 'server-caller'
      });

      expect(result.success).toBe(true);
      expect(result.value).toBe('https://test.supabase.co');
      expect(result.accessContext.purpose).toBe('server_access');
    });
  });

  describe('Service Role Key Access', () => {
    it('should successfully get service role key with proper context', async () => {
      const mockGetServiceRoleKey = require('@/lib/security/environment-manager').getServiceRoleKey;
      mockGetServiceRoleKey.mockReturnValue('service-role-key');

      const result = await secureEnvironmentAccess.getServiceRoleKey({
        caller: 'createAdminClient',
        endpoint: '/api/admin/users'
      });

      expect(result.success).toBe(true);
      expect(result.value).toBe('service-role-key');
      expect(mockGetServiceRoleKey).toHaveBeenCalledWith({
        caller: 'createAdminClient',
        endpoint: '/api/admin/users',
        userId: undefined
      });
    });

    it('should handle service role key access failure', async () => {
      const mockGetServiceRoleKey = require('@/lib/security/environment-manager').getServiceRoleKey;
      mockGetServiceRoleKey.mockImplementation(() => {
        throw new Error('Access denied');
      });

      const result = await secureEnvironmentAccess.getServiceRoleKey({
        caller: 'unauthorized-caller'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Access denied');
    });
  });

  describe('Environment Variable Registry', () => {
    it('should return environment variable registry', () => {
      const registry = secureEnvironmentAccess.getEnvironmentRegistry();

      expect(registry.has('NEXT_PUBLIC_SUPABASE_URL')).toBe(true);
      expect(registry.has('NEXT_PUBLIC_SUPABASE_ANON_KEY')).toBe(true);
      expect(registry.has('SUPABASE_SERVICE_ROLE_KEY')).toBe(true);
      expect(registry.has('NODE_ENV')).toBe(true);

      const supabaseUrlConfig = registry.get('NEXT_PUBLIC_SUPABASE_URL');
      expect(supabaseUrlConfig?.required).toBe(true);
      expect(supabaseUrlConfig?.sensitive).toBe(false);
    });

    it('should validate caller permissions', async () => {
      const result = await secureEnvironmentAccess.getEnvironmentVariable('SUPABASE_SERVICE_ROLE_KEY', {
        caller: 'unauthorized-caller',
        purpose: 'test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not authorized to access');
    });

    it('should validate environment permissions', async () => {
      // This test would require mocking environment-specific restrictions
      // For now, we'll test the basic functionality
      const result = await secureEnvironmentAccess.getEnvironmentVariable('NODE_ENV', {
        caller: 'test-caller',
        purpose: 'test'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Validation Functions', () => {
    it('should validate all environment variables', async () => {
      // Set up valid environment variables
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'a'.repeat(100); // Valid length key
      process.env.NODE_ENV = 'test';

      const validation = await secureEnvironmentAccess.validateAllEnvironmentVariables();

      expect(validation.valid).toBe(true);
      expect(validation.summary.total).toBeGreaterThan(0);
      expect(validation.summary.valid).toBeGreaterThan(0);
    });

    it('should detect validation failures', async () => {
      // Set up invalid environment variables
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'invalid-url';
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const validation = await secureEnvironmentAccess.validateAllEnvironmentVariables();

      expect(validation.valid).toBe(false);
      expect(validation.summary.invalid).toBeGreaterThan(0);
    });
  });

  describe('Access Logging', () => {
    it('should log environment variable access', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';

      await secureEnvironmentAccess.getPublicVariable('NEXT_PUBLIC_SUPABASE_URL', {
        caller: 'test-caller',
        requestId: 'test-request-123'
      });

      const accessLog = secureEnvironmentAccess.getAccessLog();
      expect(accessLog.length).toBeGreaterThan(0);

      const lastAccess = accessLog[accessLog.length - 1];
      expect(lastAccess.caller).toBe('test-caller');
      expect(lastAccess.requestId).toBe('test-request-123');
      expect(lastAccess.operation).toBe('read');
    });

    it('should limit access log size', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';

      // Generate many access logs
      for (let i = 0; i < 1100; i++) {
        await secureEnvironmentAccess.getPublicVariable('NEXT_PUBLIC_SUPABASE_URL', {
          caller: `test-caller-${i}`
        });
      }

      const accessLog = secureEnvironmentAccess.getAccessLog();
      expect(accessLog.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Performance Metrics', () => {
    it('should record performance metrics for environment access', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';

      const result = await secureEnvironmentAccess.getPublicVariable('NEXT_PUBLIC_SUPABASE_URL', {
        caller: 'test-caller'
      });

      expect(result.success).toBe(true);
      expect(result.performanceMetrics).toBeDefined();
      expect(result.performanceMetrics?.operation).toBe('environment_check');
      expect(result.performanceMetrics?.success).toBe(true);
      expect(typeof result.performanceMetrics?.duration).toBe('number');
    });
  });

  describe('Security Event Recording', () => {
    it('should record security events for unauthorized access', async () => {
      const result = await secureEnvironmentAccess.getEnvironmentVariable('UNREGISTERED_VAR', {
        caller: 'test-caller',
        purpose: 'test'
      });

      expect(result.success).toBe(false);
      expect(result.securityEvents).toBeDefined();
      expect(result.securityEvents?.length).toBeGreaterThan(0);
      expect(result.securityEvents?.[0].eventType).toBe('unauthorized_operation');
    });
  });
});

describe('Convenience Functions', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getPublicEnvVar', () => {
    it('should successfully get public environment variable', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';

      const value = getPublicEnvVar('NEXT_PUBLIC_SUPABASE_URL', 'test-caller');

      expect(value).toBe('https://test.supabase.co');
    });

    it('should throw error for missing environment variable', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      expect(() => 
        getPublicEnvVar('NEXT_PUBLIC_SUPABASE_URL', 'test-caller')
      ).toThrow('Required public environment variable');
    });
  });

  describe('getServerEnvVar', () => {
    it('should successfully get server environment variable', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';

      const value = await getServerEnvVar('NEXT_PUBLIC_SUPABASE_URL', 'server-caller');

      expect(value).toBe('https://test.supabase.co');
    });
  });

  describe('getSecureServiceRoleKey', () => {
    it('should successfully get service role key', async () => {
      const mockGetServiceRoleKey = require('@/lib/security/environment-manager').getServiceRoleKey;
      mockGetServiceRoleKey.mockReturnValue('service-role-key');

      const value = await getSecureServiceRoleKey('createAdminClient', '/api/admin/users');

      expect(value).toBe('service-role-key');
    });

    it('should throw error for unauthorized access', async () => {
      const mockGetServiceRoleKey = require('@/lib/security/environment-manager').getServiceRoleKey;
      mockGetServiceRoleKey.mockImplementation(() => {
        throw new Error('Access denied');
      });

      await expect(
        getSecureServiceRoleKey('unauthorized-caller')
      ).rejects.toThrow('Access denied');
    });
  });

  describe('validateEnvironmentAtStartup', () => {
    it('should pass validation with valid environment variables', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'a'.repeat(100);
      process.env.NODE_ENV = 'test';

      await expect(validateEnvironmentAtStartup()).resolves.not.toThrow();
    });

    it('should throw error for invalid environment variables', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'invalid-url';
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      await expect(validateEnvironmentAtStartup()).rejects.toThrow('Environment validation failed');
    });
  });
});

describe('Environment Variable Validators', () => {
  describe('NODE_ENV Validation', () => {
    it('should accept valid NODE_ENV values', async () => {
      const validEnvs = ['development', 'test', 'production'];

      for (const env of validEnvs) {
        process.env.NODE_ENV = env;

        const result = await secureEnvironmentAccess.getEnvironmentVariable('NODE_ENV', {
          caller: 'test-caller',
          purpose: 'test'
        });

        expect(result.success).toBe(true);
        expect(result.value).toBe(env);
      }
    });

    it('should reject invalid NODE_ENV values', async () => {
      process.env.NODE_ENV = 'invalid-env';

      const result = await secureEnvironmentAccess.getEnvironmentVariable('NODE_ENV', {
        caller: 'test-caller',
        purpose: 'test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid NODE_ENV value');
    });
  });

  describe('Auth Secret Validation', () => {
    it('should require minimum length for auth secrets', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      process.env.NEXTAUTH_SECRET = 'short';

      const result = await secureEnvironmentAccess.getEnvironmentVariable('NEXTAUTH_SECRET', {
        caller: 'test-caller',
        purpose: 'test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('at least 32 characters long');
      
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should accept valid auth secrets', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      process.env.NEXTAUTH_SECRET = 'a'.repeat(32);

      const result = await secureEnvironmentAccess.getEnvironmentVariable('NEXTAUTH_SECRET', {
        caller: 'test-caller',
        purpose: 'test'
      });

      expect(result.success).toBe(true);
      
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('URL Validation', () => {
    it('should validate URL format', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      process.env.NEXTAUTH_URL = 'invalid-url';

      const result = await secureEnvironmentAccess.getEnvironmentVariable('NEXTAUTH_URL', {
        caller: 'test-caller',
        purpose: 'test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL format');
      
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should accept valid URLs', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      process.env.NEXTAUTH_URL = 'https://example.com';

      const result = await secureEnvironmentAccess.getEnvironmentVariable('NEXTAUTH_URL', {
        caller: 'test-caller',
        purpose: 'test'
      });

      expect(result.success).toBe(true);
      
      process.env.NODE_ENV = originalNodeEnv;
    });
  });
});