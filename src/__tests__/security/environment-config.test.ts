/**
 * @jest-environment node
 */

import {
  getEnvironmentConfig,
  validateEnvironmentConfig,
  developmentConfig,
  testConfig,
  productionConfig,
  logEnvironmentConfig
} from '@/lib/security/environment-config';

describe('Environment Security Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Environment Config Selection', () => {
    it('should return development config for development environment', () => {
      process.env.NODE_ENV = 'development';
      const config = getEnvironmentConfig();
      expect(config).toEqual(developmentConfig);
    });

    it('should return test config for test environment', () => {
      process.env.NODE_ENV = 'test';
      const config = getEnvironmentConfig();
      expect(config).toEqual(testConfig);
    });

    it('should return production config for production environment', () => {
      process.env.NODE_ENV = 'production';
      const config = getEnvironmentConfig();
      expect(config).toEqual(productionConfig);
    });

    it('should return development config as default', () => {
      delete process.env.NODE_ENV;
      const config = getEnvironmentConfig();
      expect(config).toEqual(developmentConfig);
    });
  });

  describe('Development Config', () => {
    it('should have correct development settings', () => {
      expect(developmentConfig.requiredVariables).toContain('NEXT_PUBLIC_SUPABASE_URL');
      expect(developmentConfig.requiredVariables).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
      expect(developmentConfig.optionalVariables).toContain('SUPABASE_SERVICE_ROLE_KEY');
      
      expect(developmentConfig.securityChecks.requireHttps).toBe(false);
      expect(developmentConfig.securityChecks.requireServiceRoleKey).toBe(false);
      expect(developmentConfig.errorHandling.exitOnValidationFailure).toBe(false);
      expect(developmentConfig.logging.logLevel).toBe('debug');
    });
  });

  describe('Test Config', () => {
    it('should have correct test settings', () => {
      expect(testConfig.requiredVariables).toContain('NEXT_PUBLIC_SUPABASE_URL');
      expect(testConfig.requiredVariables).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
      
      expect(testConfig.securityChecks.requireHttps).toBe(false);
      expect(testConfig.securityChecks.validateKeyFormats).toBe(false);
      expect(testConfig.logging.auditServiceRoleAccess).toBe(false);
      expect(testConfig.errorHandling.throwOnMissingRequired).toBe(true);
    });
  });

  describe('Production Config', () => {
    it('should have correct production settings', () => {
      expect(productionConfig.requiredVariables).toContain('NEXT_PUBLIC_SUPABASE_URL');
      expect(productionConfig.requiredVariables).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
      expect(productionConfig.requiredVariables).toContain('SUPABASE_SERVICE_ROLE_KEY');
      
      expect(productionConfig.securityChecks.requireHttps).toBe(true);
      expect(productionConfig.securityChecks.requireServiceRoleKey).toBe(true);
      expect(productionConfig.securityChecks.checkDefaultValues).toBe(true);
      expect(productionConfig.errorHandling.exitOnValidationFailure).toBe(true);
      expect(productionConfig.logging.logLevel).toBe('info');
    });
  });

  describe('Config Validation', () => {
    it('should validate valid development config', () => {
      const result = validateEnvironmentConfig(developmentConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate valid test config', () => {
      const result = validateEnvironmentConfig(testConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate valid production config', () => {
      process.env.NODE_ENV = 'production';
      const result = validateEnvironmentConfig(productionConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for config with empty required variables', () => {
      const invalidConfig = {
        ...developmentConfig,
        requiredVariables: []
      };
      
      const result = validateEnvironmentConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('필수 환경 변수 목록이 비어있습니다');
    });

    it('should fail validation for invalid log level', () => {
      const invalidConfig = {
        ...developmentConfig,
        logging: {
          ...developmentConfig.logging,
          logLevel: 'invalid' as any
        }
      };
      
      const result = validateEnvironmentConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('유효하지 않은 로그 레벨: invalid');
    });

    it('should fail validation for production config without HTTPS requirement', () => {
      process.env.NODE_ENV = 'production';
      const invalidConfig = {
        ...productionConfig,
        securityChecks: {
          ...productionConfig.securityChecks,
          requireHttps: false
        }
      };
      
      const result = validateEnvironmentConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('프로덕션 환경에서는 HTTPS가 필수입니다');
    });

    it('should fail validation for production config without service role key requirement', () => {
      process.env.NODE_ENV = 'production';
      const invalidConfig = {
        ...productionConfig,
        securityChecks: {
          ...productionConfig.securityChecks,
          requireServiceRoleKey: false
        }
      };
      
      const result = validateEnvironmentConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('프로덕션 환경에서는 서비스 역할 키가 필수입니다');
    });

    it('should fail validation for production config without exit on validation failure', () => {
      process.env.NODE_ENV = 'production';
      const invalidConfig = {
        ...productionConfig,
        errorHandling: {
          ...productionConfig.errorHandling,
          exitOnValidationFailure: false
        }
      };
      
      const result = validateEnvironmentConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('프로덕션 환경에서는 검증 실패 시 프로세스 종료가 필요합니다');
    });
  });

  describe('Environment Config Logging', () => {
    it('should log environment config without throwing errors', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      expect(() => {
        logEnvironmentConfig();
      }).not.toThrow();
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log correct environment name', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      process.env.NODE_ENV = 'test';
      
      logEnvironmentConfig();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('TEST')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Config Properties', () => {
    it('should have all required properties in development config', () => {
      expect(developmentConfig).toHaveProperty('requiredVariables');
      expect(developmentConfig).toHaveProperty('optionalVariables');
      expect(developmentConfig).toHaveProperty('securityChecks');
      expect(developmentConfig).toHaveProperty('logging');
      expect(developmentConfig).toHaveProperty('errorHandling');
      
      expect(developmentConfig.securityChecks).toHaveProperty('requireHttps');
      expect(developmentConfig.securityChecks).toHaveProperty('requireServiceRoleKey');
      expect(developmentConfig.securityChecks).toHaveProperty('validateKeyFormats');
      expect(developmentConfig.securityChecks).toHaveProperty('checkDefaultValues');
      
      expect(developmentConfig.logging).toHaveProperty('logLevel');
      expect(developmentConfig.logging).toHaveProperty('auditServiceRoleAccess');
      expect(developmentConfig.logging).toHaveProperty('redactSensitiveData');
      
      expect(developmentConfig.errorHandling).toHaveProperty('exitOnValidationFailure');
      expect(developmentConfig.errorHandling).toHaveProperty('throwOnMissingRequired');
    });

    it('should have consistent structure across all configs', () => {
      const configs = [developmentConfig, testConfig, productionConfig];
      
      configs.forEach(config => {
        expect(Array.isArray(config.requiredVariables)).toBe(true);
        expect(Array.isArray(config.optionalVariables)).toBe(true);
        expect(typeof config.securityChecks).toBe('object');
        expect(typeof config.logging).toBe('object');
        expect(typeof config.errorHandling).toBe('object');
      });
    });
  });

  describe('Security Settings Progression', () => {
    it('should have increasingly strict security from dev to prod', () => {
      // Development should be most permissive
      expect(developmentConfig.securityChecks.requireHttps).toBe(false);
      expect(developmentConfig.errorHandling.exitOnValidationFailure).toBe(false);
      
      // Production should be most strict
      expect(productionConfig.securityChecks.requireHttps).toBe(true);
      expect(productionConfig.errorHandling.exitOnValidationFailure).toBe(true);
      expect(productionConfig.requiredVariables).toContain('SUPABASE_SERVICE_ROLE_KEY');
    });

    it('should have appropriate logging levels', () => {
      expect(developmentConfig.logging.logLevel).toBe('debug');
      expect(testConfig.logging.logLevel).toBe('warn');
      expect(productionConfig.logging.logLevel).toBe('info');
    });
  });
});