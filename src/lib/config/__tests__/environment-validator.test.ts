/**
 * Unit Tests for Environment Configuration Validator Service
 * Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { 
  environmentValidator,
  validateEnvironment,
  validateEnvironmentOrThrow,
  quickEnvironmentCheck,
  logEnvironmentValidationReport
} from '../environment-validator';
import type { ValidationOptions } from '../environment-validator';

// Mock dependencies
jest.mock('@/lib/utils/logger');
jest.mock('@/lib/monitoring/security-monitor');
jest.mock('@/lib/security/secure-environment-access');

describe('EnvironmentConfigurationValidator', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Reset environment to clean state
    delete process.env.NODE_ENV;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('validateEnvironmentConfiguration', () => {
    it('should validate environment configuration successfully with valid variables', async () => {
      // Setup valid environment
      process.env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.key';

      // Mock secure environment access
      const mockSecureAccess = require('../../security/secure-environment-access');
      mockSecureAccess.secureEnvironmentAccess = {
        getEnvironmentRegistry: jest.fn().mockReturnValue(new Map([
          ['NEXT_PUBLIC_SUPABASE_URL', {
            key: 'NEXT_PUBLIC_SUPABASE_URL',
            required: true,
            sensitive: false,
            validator: jest.fn().mockReturnValue({ valid: true })
          }],
          ['NEXT_PUBLIC_SUPABASE_ANON_KEY', {
            key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
            required: true,
            sensitive: true,
            validator: jest.fn().mockReturnValue({ valid: true })
          }]
        ])),
        getEnvironmentVariable: jest.fn().mockResolvedValue({
          success: true,
          value: 'test-value'
        })
      };

      const result = await environmentValidator.validateEnvironmentConfiguration();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.summary.total).toBeGreaterThan(0);
      expect(result.summary.valid).toBeGreaterThan(0);
    });

    it('should detect missing required environment variables', async () => {
      process.env.NODE_ENV = 'production';
      
      // Mock secure environment access with missing required variable
      const mockSecureAccess = require('../../security/secure-environment-access');
      mockSecureAccess.secureEnvironmentAccess = {
        getEnvironmentRegistry: jest.fn().mockReturnValue(new Map([
          ['NEXT_PUBLIC_SUPABASE_URL', {
            key: 'NEXT_PUBLIC_SUPABASE_URL',
            required: true,
            sensitive: false
          }]
        ])),
        getEnvironmentVariable: jest.fn().mockResolvedValue({
          success: false,
          error: 'Required environment variable NEXT_PUBLIC_SUPABASE_URL is not set'
        })
      };

      const result = await environmentValidator.validateEnvironmentConfiguration();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.summary.criticalErrors).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Critical:');
    });

    it('should handle validation options correctly', async () => {
      const options: ValidationOptions = {
        includeOptional: false,
        strictMode: true,
        environment: 'production',
        caller: 'test-caller'
      };

      // Mock secure environment access
      const mockSecureAccess = require('../../security/secure-environment-access');
      mockSecureAccess.secureEnvironmentAccess = {
        getEnvironmentRegistry: jest.fn().mockReturnValue(new Map([
          ['REQUIRED_VAR', {
            key: 'REQUIRED_VAR',
            required: true,
            sensitive: false
          }],
          ['OPTIONAL_VAR', {
            key: 'OPTIONAL_VAR',
            required: false,
            sensitive: false
          }]
        ])),
        getEnvironmentVariable: jest.fn().mockResolvedValue({
          success: true,
          value: 'test-value'
        })
      };

      const result = await environmentValidator.validateEnvironmentConfiguration(options);

      // Should only validate required variables when includeOptional is false
      expect(mockSecureAccess.secureEnvironmentAccess.getEnvironmentVariable)
        .toHaveBeenCalledWith('REQUIRED_VAR', expect.objectContaining({
          caller: 'test-caller',
          purpose: 'validation'
        }));
    });

    it('should perform production-specific validations', async () => {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://insecure.supabase.co'; // HTTP instead of HTTPS

      // Mock secure environment access
      const mockSecureAccess = require('../../security/secure-environment-access');
      mockSecureAccess.secureEnvironmentAccess = {
        getEnvironmentRegistry: jest.fn().mockReturnValue(new Map([
          ['NEXT_PUBLIC_SUPABASE_URL', {
            key: 'NEXT_PUBLIC_SUPABASE_URL',
            required: true,
            sensitive: false
          }]
        ])),
        getEnvironmentVariable: jest.fn().mockResolvedValue({
          success: true,
          value: 'http://insecure.supabase.co'
        })
      };

      const result = await environmentValidator.validateEnvironmentConfiguration({
        environment: 'production'
      });

      expect(result.errors.some(error => 
        error.includes('Production environment requires HTTPS')
      )).toBe(true);
    });

    it('should handle validation system errors gracefully', async () => {
      // Mock secure environment access to throw error
      const mockSecureAccess = require('../../security/secure-environment-access');
      mockSecureAccess.secureEnvironmentAccess = {
        getEnvironmentRegistry: jest.fn().mockImplementation(() => {
          throw new Error('System error');
        })
      };

      const result = await environmentValidator.validateEnvironmentConfiguration();

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Validation system error');
      expect(result.summary.criticalErrors).toBe(1);
    });
  });

  describe('validateSpecificVariable', () => {
    it('should validate a specific environment variable', async () => {
      // Mock secure environment access
      const mockSecureAccess = require('../../security/secure-environment-access');
      mockSecureAccess.secureEnvironmentAccess = {
        getEnvironmentRegistry: jest.fn().mockReturnValue(new Map([
          ['TEST_VAR', {
            key: 'TEST_VAR',
            required: true,
            sensitive: false
          }]
        ])),
        getEnvironmentVariable: jest.fn().mockResolvedValue({
          success: true,
          value: 'test-value'
        })
      };

      const result = await environmentValidator.validateSpecificVariable('TEST_VAR');

      expect(result.status).toBe('valid');
      expect(result.key).toBe('TEST_VAR');
      expect(result.value).toBe('test-value');
    });

    it('should handle unregistered environment variables', async () => {
      // Mock secure environment access with empty registry
      const mockSecureAccess = require('../../security/secure-environment-access');
      mockSecureAccess.secureEnvironmentAccess = {
        getEnvironmentRegistry: jest.fn().mockReturnValue(new Map())
      };

      const result = await environmentValidator.validateSpecificVariable('UNKNOWN_VAR');

      expect(result.status).toBe('invalid');
      expect(result.error).toContain('not registered');
    });
  });

  describe('generateValidationReport', () => {
    it('should generate a human-readable validation report', () => {
      const mockResult = {
        valid: false,
        errors: ['Critical: Missing required variable', 'Error: Invalid format'],
        warnings: ['Warning: Optional variable missing'],
        summary: {
          total: 3,
          valid: 1,
          invalid: 1,
          missing: 1,
          warnings: 1,
          criticalErrors: 1
        },
        details: new Map([
          ['TEST_VAR', {
            key: 'TEST_VAR',
            status: 'valid' as const,
            required: true,
            sensitive: false,
            environment: 'test'
          }],
          ['MISSING_VAR', {
            key: 'MISSING_VAR',
            status: 'missing' as const,
            required: true,
            sensitive: true,
            environment: 'test',
            error: 'Variable is missing'
          }]
        ])
      };

      const report = environmentValidator.generateValidationReport(mockResult);

      expect(report).toContain('ENVIRONMENT CONFIGURATION VALIDATION REPORT');
      expect(report).toContain('❌ INVALID');
      expect(report).toContain('🚨 CRITICAL ERRORS:');
      expect(report).toContain('❌ ERRORS:');
      expect(report).toContain('⚠️  WARNINGS:');
      expect(report).toContain('✅ TEST_VAR [REQUIRED]');
      expect(report).toContain('🚫 MISSING_VAR [REQUIRED] [SENSITIVE]');
    });

    it('should generate a positive report for valid configuration', () => {
      const mockResult = {
        valid: true,
        errors: [],
        warnings: [],
        summary: {
          total: 2,
          valid: 2,
          invalid: 0,
          missing: 0,
          warnings: 0,
          criticalErrors: 0
        },
        details: new Map([
          ['VAR1', {
            key: 'VAR1',
            status: 'valid' as const,
            required: true,
            sensitive: false,
            environment: 'test'
          }],
          ['VAR2', {
            key: 'VAR2',
            status: 'valid' as const,
            required: false,
            sensitive: true,
            environment: 'test'
          }]
        ])
      };

      const report = environmentValidator.generateValidationReport(mockResult);

      expect(report).toContain('✅ VALID');
      expect(report).toContain('✅ VAR1 [REQUIRED]');
      expect(report).toContain('✅ VAR2 [OPTIONAL] [SENSITIVE]');
      expect(report).not.toContain('🚨 CRITICAL ERRORS:');
    });
  });

  describe('Convenience Functions', () => {
    beforeEach(() => {
      // Mock secure environment access for convenience function tests
      const mockSecureAccess = require('../../security/secure-environment-access');
      mockSecureAccess.secureEnvironmentAccess = {
        getEnvironmentRegistry: jest.fn().mockReturnValue(new Map([
          ['TEST_VAR', {
            key: 'TEST_VAR',
            required: true,
            sensitive: false
          }]
        ])),
        getEnvironmentVariable: jest.fn().mockResolvedValue({
          success: true,
          value: 'test-value'
        })
      };
    });

    describe('validateEnvironment', () => {
      it('should validate environment with default options', async () => {
        const result = await validateEnvironment();
        expect(result.valid).toBe(true);
      });

      it('should accept custom options', async () => {
        const result = await validateEnvironment({
          strictMode: true,
          includeOptional: false
        });
        expect(result.valid).toBe(true);
      });
    });

    describe('validateEnvironmentOrThrow', () => {
      it('should not throw for valid environment', async () => {
        await expect(validateEnvironmentOrThrow()).resolves.not.toThrow();
      });

      it('should throw for invalid environment', async () => {
        // Mock invalid environment
        const mockSecureAccess = require('../../security/secure-environment-access');
        mockSecureAccess.secureEnvironmentAccess.getEnvironmentVariable = jest.fn()
          .mockResolvedValue({
            success: false,
            error: 'Test error'
          });

        await expect(validateEnvironmentOrThrow()).rejects.toThrow('Environment validation failed');
      });
    });

    describe('quickEnvironmentCheck', () => {
      it('should return true for valid environment', async () => {
        const result = await quickEnvironmentCheck();
        expect(result).toBe(true);
      });

      it('should return false for invalid environment', async () => {
        // Mock invalid environment
        const mockSecureAccess = require('../../security/secure-environment-access');
        mockSecureAccess.secureEnvironmentAccess.getEnvironmentVariable = jest.fn()
          .mockResolvedValue({
            success: false,
            error: 'Test error'
          });

        const result = await quickEnvironmentCheck();
        expect(result).toBe(false);
      });

      it('should return false when validation throws', async () => {
        // Mock system error
        const mockSecureAccess = require('../../security/secure-environment-access');
        mockSecureAccess.secureEnvironmentAccess.getEnvironmentRegistry = jest.fn()
          .mockImplementation(() => {
            throw new Error('System error');
          });

        const result = await quickEnvironmentCheck();
        expect(result).toBe(false);
      });
    });

    describe('logEnvironmentValidationReport', () => {
      it('should log successful validation', async () => {
        const mockLogger = require('../../utils/logger');
        
        await logEnvironmentValidationReport();

        expect(mockLogger.logger.info).toHaveBeenCalledWith(
          'Environment validation report',
          expect.objectContaining({ report: expect.any(String) })
        );
      });

      it('should log failed validation as error', async () => {
        // Mock invalid environment
        const mockSecureAccess = require('../../security/secure-environment-access');
        mockSecureAccess.secureEnvironmentAccess.getEnvironmentVariable = jest.fn()
          .mockResolvedValue({
            success: false,
            error: 'Test error'
          });

        const mockLogger = require('../../utils/logger');
        
        await logEnvironmentValidationReport();

        expect(mockLogger.logger.error).toHaveBeenCalledWith(
          'Environment validation report',
          expect.objectContaining({ report: expect.any(String) })
        );
      });
    });
  });

  describe('Strict Mode Validation', () => {
    it('should detect placeholder values in strict mode', async () => {
      // Mock secure environment access with placeholder value
      const mockSecureAccess = require('../../security/secure-environment-access');
      mockSecureAccess.secureEnvironmentAccess = {
        getEnvironmentRegistry: jest.fn().mockReturnValue(new Map([
          ['TEST_VAR', {
            key: 'TEST_VAR',
            required: true,
            sensitive: true
          }]
        ])),
        getEnvironmentVariable: jest.fn().mockResolvedValue({
          success: true,
          value: 'your_test_value_here'
        })
      };

      const result = await environmentValidator.validateEnvironmentConfiguration({
        strictMode: true
      });

      expect(result.warnings.some(warning => 
        warning.includes('placeholder value')
      )).toBe(true);
    });

    it('should detect suspiciously short sensitive values', async () => {
      // Mock secure environment access with short sensitive value
      const mockSecureAccess = require('../../security/secure-environment-access');
      mockSecureAccess.secureEnvironmentAccess = {
        getEnvironmentRegistry: jest.fn().mockReturnValue(new Map([
          ['SECRET_KEY', {
            key: 'SECRET_KEY',
            required: true,
            sensitive: true
          }]
        ])),
        getEnvironmentVariable: jest.fn().mockResolvedValue({
          success: true,
          value: 'short'
        })
      };

      const result = await environmentValidator.validateEnvironmentConfiguration({
        strictMode: true
      });

      expect(result.warnings.some(warning => 
        warning.includes('unusually short')
      )).toBe(true);
    });
  });
});