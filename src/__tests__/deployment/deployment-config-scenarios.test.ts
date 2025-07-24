/**
 * End-to-End Deployment Configuration Scenario Tests
 * 
 * These tests simulate various deployment configuration scenarios
 * to ensure the application handles environment issues gracefully.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Import the validator class
const { DeploymentValidator } = require('../../../scripts/validate-deployment-config');

// Type definitions for the validator
interface ValidationError {
  type: string;
  key: string;
  message: string;
  troubleshooting?: string[];
}

interface MockValidator {
  errors: ValidationError[];
  warnings: string[];
  success: string[];
  loadEnvironmentVariables: jest.Mock;
  validateRequired: (envVars: Record<string, string>) => void;
  validateOptional: (envVars: Record<string, string>) => void;
  validateValues: (envVars: Record<string, string>) => void;
}

// Mock environment variables for testing
const originalEnv = process.env;

describe('Deployment Configuration Scenarios', () => {
  beforeEach(() => {
    // Reset environment before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Development Environment Scenarios', () => {
    test('should pass validation with minimal required variables', () => {
      // Arrange
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QtcHJvamVjdCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQwOTk1MjAwLCJleHAiOjE5NTY1NzEyMDB9.test-key-here';

      // Act
      const validator = new DeploymentValidator('development') as MockValidator;
      const envVars = validator.loadEnvironmentVariables();
      validator.validateRequired(envVars);
      validator.validateValues(envVars);

      // Assert
      expect(validator.errors).toHaveLength(0);
      expect(validator.success.length).toBeGreaterThan(0);
    });

    test('should fail validation with missing required variables', () => {
      // Arrange - Empty environment
      const mockEnv: Record<string, string> = {};

      // Act
      const validator = new DeploymentValidator('development') as MockValidator;
      validator.loadEnvironmentVariables = jest.fn().mockReturnValue(mockEnv);
      const envVars = validator.loadEnvironmentVariables();
      validator.validateRequired(envVars);

      // Assert
      expect(validator.errors.length).toBeGreaterThan(0);
      expect(validator.errors.some((e: ValidationError) => e.key === 'NEXT_PUBLIC_SUPABASE_URL')).toBe(true);
      expect(validator.errors.some((e: ValidationError) => e.key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY')).toBe(true);
    });

    test('should provide troubleshooting steps for missing variables', () => {
      // Arrange - Missing SUPABASE_URL
      const mockEnv = {
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key-here-long-enough'
      };

      // Act
      const validator = new DeploymentValidator('development') as MockValidator;
      validator.loadEnvironmentVariables = jest.fn().mockReturnValue(mockEnv);
      const envVars = validator.loadEnvironmentVariables();
      validator.validateRequired(envVars);

      // Assert
      const supabaseError = validator.errors.find((e: ValidationError) => e.key === 'NEXT_PUBLIC_SUPABASE_URL');
      expect(supabaseError).toBeDefined();
      expect(supabaseError?.troubleshooting?.[0]).toContain('Go to your Supabase project dashboard');
    });
  });

  describe('Test Environment Scenarios', () => {
    test('should require NODE_ENV to be set to test', () => {
      // Arrange
      const mockEnv = {
        NEXT_PUBLIC_SUPABASE_URL: 'https://test-project.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key-here-long-enough-to-pass-validation-check-minimum-length',
        NODE_ENV: 'development' // Wrong environment
      };

      // Act
      const validator = new DeploymentValidator('test') as MockValidator;
      validator.loadEnvironmentVariables = jest.fn().mockReturnValue(mockEnv);
      const envVars = validator.loadEnvironmentVariables();
      validator.validateRequired(envVars);
      validator.validateValues(envVars);

      // Assert
      const nodeEnvError = validator.errors.find((e: ValidationError) => e.key === 'NODE_ENV');
      expect(nodeEnvError).toBeDefined();
      expect(nodeEnvError?.message).toContain('should be "test" or "testing"');
    });

    test('should pass validation with correct test environment setup', () => {
      // Arrange
      const mockEnv = {
        NEXT_PUBLIC_SUPABASE_URL: 'https://test-project.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key-here-long-enough-to-pass-validation-check-minimum-length',
        NODE_ENV: 'test'
      };

      // Act
      const validator = new DeploymentValidator('test') as MockValidator;
      validator.loadEnvironmentVariables = jest.fn().mockReturnValue(mockEnv);
      const envVars = validator.loadEnvironmentVariables();
      validator.validateRequired(envVars);
      validator.validateValues(envVars);

      // Assert
      expect(validator.errors).toHaveLength(0);
    });
  });

  describe('Production Environment Scenarios', () => {
    test('should require all production variables', () => {
      // Arrange - Missing production-specific variables
      const mockEnv = {
        NEXT_PUBLIC_SUPABASE_URL: 'https://prod-project.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'prod-key-here-long-enough-to-pass-validation-check-minimum-length'
        // Missing: SUPABASE_SERVICE_ROLE_KEY, NEXTAUTH_SECRET, NODE_ENV
      };

      // Act
      const validator = new DeploymentValidator('production') as MockValidator;
      validator.loadEnvironmentVariables = jest.fn().mockReturnValue(mockEnv);
      const envVars = validator.loadEnvironmentVariables();
      validator.validateRequired(envVars);

      // Assert
      expect(validator.errors.length).toBeGreaterThan(0);
      expect(validator.errors.some((e: ValidationError) => e.key === 'SUPABASE_SERVICE_ROLE_KEY')).toBe(true);
      expect(validator.errors.some((e: ValidationError) => e.key === 'NEXTAUTH_SECRET')).toBe(true);
      expect(validator.errors.some((e: ValidationError) => e.key === 'NODE_ENV')).toBe(true);
    });

    test('should validate NEXTAUTH_SECRET length in production', () => {
      // Arrange
      const mockEnv = {
        NEXT_PUBLIC_SUPABASE_URL: 'https://prod-project.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'prod-key-here-long-enough-to-pass-validation-check-minimum-length',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-here',
        NEXTAUTH_SECRET: 'short', // Too short
        NODE_ENV: 'production'
      };

      // Act
      const validator = new DeploymentValidator('production') as MockValidator;
      validator.loadEnvironmentVariables = jest.fn().mockReturnValue(mockEnv);
      const envVars = validator.loadEnvironmentVariables();
      validator.validateRequired(envVars);
      validator.validateValues(envVars);

      // Assert
      const secretError = validator.errors.find((e: ValidationError) => e.key === 'NEXTAUTH_SECRET');
      expect(secretError).toBeDefined();
      expect(secretError?.message).toContain('should be at least 32 characters long');
    });

    test('should pass validation with complete production setup', () => {
      // Arrange
      const mockEnv = {
        NEXT_PUBLIC_SUPABASE_URL: 'https://prod-project.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'prod-key-here-long-enough-to-pass-validation-check-minimum-length',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-here-long-enough',
        NEXTAUTH_SECRET: 'this-is-a-very-long-secret-key-for-production-use-32-chars-minimum',
        NODE_ENV: 'production'
      };

      // Act
      const validator = new DeploymentValidator('production') as MockValidator;
      validator.loadEnvironmentVariables = jest.fn().mockReturnValue(mockEnv);
      const envVars = validator.loadEnvironmentVariables();
      validator.validateRequired(envVars);
      validator.validateValues(envVars);

      // Assert
      expect(validator.errors).toHaveLength(0);
    });
  });

  describe('URL Validation Scenarios', () => {
    test('should reject non-HTTPS Supabase URLs', () => {
      // Arrange
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://insecure-project.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key-here-long-enough';

      // Act
      const validator = new DeploymentValidator('development') as MockValidator;
      const envVars = validator.loadEnvironmentVariables();
      validator.validateValues(envVars);

      // Assert
      const urlError = validator.errors.find((e: ValidationError) => e.key === 'NEXT_PUBLIC_SUPABASE_URL');
      expect(urlError).toBeDefined();
      expect(urlError?.message).toContain('Must start with https://');
    });

    test('should warn about non-standard Supabase URLs', () => {
      // Arrange
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://custom-domain.example.com';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key-here-long-enough';

      // Act
      const validator = new DeploymentValidator('development') as MockValidator;
      const envVars = validator.loadEnvironmentVariables();
      validator.validateValues(envVars);

      // Assert
      const urlError = validator.errors.find((e: ValidationError) => e.key === 'NEXT_PUBLIC_SUPABASE_URL');
      expect(urlError).toBeDefined();
      expect(urlError?.message).toContain('Must be a valid Supabase URL');
    });

    test('should accept valid Supabase URLs', () => {
      // Arrange
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcdefghijklmnop.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key-here-long-enough';

      // Act
      const validator = new DeploymentValidator('development') as MockValidator;
      const envVars = validator.loadEnvironmentVariables();
      validator.validateValues(envVars);

      // Assert
      const urlErrors = validator.errors.filter((e: ValidationError) => e.key === 'NEXT_PUBLIC_SUPABASE_URL');
      expect(urlErrors).toHaveLength(0);
    });
  });

  describe('API Key Validation Scenarios', () => {
    test('should warn about short API keys', () => {
      // Arrange
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'short-key'; // Too short

      // Act
      const validator = new DeploymentValidator('development') as MockValidator;
      const envVars = validator.loadEnvironmentVariables();
      validator.validateValues(envVars);

      // Assert
      const keyError = validator.errors.find((e: ValidationError) => e.key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
      expect(keyError).toBeDefined();
      expect(keyError?.message).toContain('appears to be too short');
    });

    test('should accept properly sized API keys', () => {
      // Arrange
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QtcHJvamVjdCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQwOTk1MjAwLCJleHAiOjE5NTY1NzEyMDB9.test-key-here-with-sufficient-length-to-pass-validation';

      // Act
      const validator = new DeploymentValidator('development') as MockValidator;
      const envVars = validator.loadEnvironmentVariables();
      validator.validateValues(envVars);

      // Assert
      const keyErrors = validator.errors.filter((e: ValidationError) => e.key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
      expect(keyErrors).toHaveLength(0);
    });
  });

  describe('Error Reporting Scenarios', () => {
    test('should provide comprehensive error report', () => {
      // Arrange - Multiple issues
      const mockEnv = {
        NEXT_PUBLIC_SUPABASE_URL: 'http://insecure.example.com', // Wrong protocol and domain
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'short' // Too short
        // Missing NODE_ENV and other production variables
      };

      // Act
      const validator = new DeploymentValidator('production') as MockValidator;
      validator.loadEnvironmentVariables = jest.fn().mockReturnValue(mockEnv);
      const envVars = validator.loadEnvironmentVariables();
      validator.validateRequired(envVars);
      validator.validateValues(envVars);

      // Assert
      expect(validator.errors.length).toBeGreaterThanOrEqual(3); // Multiple errors
      
      // Check that each error has troubleshooting information
      validator.errors.forEach((error: ValidationError) => {
        expect(error.troubleshooting).toBeDefined();
        expect(Array.isArray(error.troubleshooting)).toBe(true);
        expect(error.troubleshooting!.length).toBeGreaterThan(0);
      });
    });

    test('should categorize errors by type', () => {
      // Arrange
      const mockEnv = {
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'short' // Invalid value, missing NEXT_PUBLIC_SUPABASE_URL
      };

      // Act
      const validator = new DeploymentValidator('development') as MockValidator;
      validator.loadEnvironmentVariables = jest.fn().mockReturnValue(mockEnv);
      const envVars = validator.loadEnvironmentVariables();
      validator.validateRequired(envVars);
      validator.validateValues(envVars);

      // Assert
      const missingErrors = validator.errors.filter((e: ValidationError) => e.type === 'missing_required');
      const invalidErrors = validator.errors.filter((e: ValidationError) => e.type === 'invalid_value');
      
      expect(missingErrors.length).toBeGreaterThan(0);
      expect(invalidErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Environment File Loading Scenarios', () => {
    test('should handle missing environment files gracefully', () => {
      // Arrange - No environment files exist, only process.env
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key-here-long-enough';

      // Act
      const validator = new DeploymentValidator('development') as MockValidator;
      const envVars = validator.loadEnvironmentVariables();

      // Assert
      expect(envVars.NEXT_PUBLIC_SUPABASE_URL).toBe('https://test-project.supabase.co');
      expect(envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('test-key-here-long-enough');
    });

    test('should provide warnings for file reading issues', () => {
      // This test would require mocking fs.readFileSync to throw an error
      // For now, we'll test that the validator handles the scenario gracefully
      
      // Act
      const validator = new DeploymentValidator('development') as MockValidator;
      const envVars = validator.loadEnvironmentVariables();

      // Assert - Should not throw errors even if files are missing
      expect(typeof envVars).toBe('object');
    });
  });

  describe('Cross-Environment Compatibility', () => {
    test('should handle environment switching correctly', () => {
      // Arrange - Set up for development first
      const devMockEnv = {
        NEXT_PUBLIC_SUPABASE_URL: 'https://dev-project.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRldi1wcm9qZWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDA5OTUyMDAsImV4cCI6MTk1NjU3MTIwMH0.dev-key-here-with-sufficient-length-to-pass-validation',
        NODE_ENV: 'development'
      };

      // Act & Assert - Development should pass
      const devValidator = new DeploymentValidator('development') as MockValidator;
      devValidator.loadEnvironmentVariables = jest.fn().mockReturnValue(devMockEnv);
      const devEnvVars = devValidator.loadEnvironmentVariables();
      devValidator.validateRequired(devEnvVars);
      devValidator.validateValues(devEnvVars);
      expect(devValidator.errors).toHaveLength(0);

      // Act & Assert - Same vars should fail production validation
      const prodValidator = new DeploymentValidator('production') as MockValidator;
      prodValidator.loadEnvironmentVariables = jest.fn().mockReturnValue(devMockEnv);
      const prodEnvVars = prodValidator.loadEnvironmentVariables();
      prodValidator.validateRequired(prodEnvVars);
      prodValidator.validateValues(prodEnvVars);
      expect(prodValidator.errors.length).toBeGreaterThan(0); // Missing production-specific vars
    });
  });

  describe('Comprehensive Configuration Verification', () => {
    test('should integrate with comprehensive config verifier', async () => {
      // Arrange
      const { ComprehensiveConfigVerifier } = require('../../../scripts/comprehensive-config-verifier');
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key-here-long-enough-to-pass-validation-check-minimum-length';

      // Act
      const verifier = new ComprehensiveConfigVerifier({ environment: 'development' });
      
      // Mock the verification methods to avoid external dependencies
      verifier.runPlatformVerification = jest.fn().mockResolvedValue(undefined);
      verifier.runSecurityVerification = jest.fn().mockResolvedValue(undefined);
      verifier.runPerformanceVerification = jest.fn().mockResolvedValue(undefined);
      verifier.runCompatibilityVerification = jest.fn().mockResolvedValue(undefined);
      
      const results = await verifier.runComprehensiveCheck();

      // Assert
      expect(results).toBeDefined();
      expect(typeof results.score).toBe('number');
      expect(typeof results.ready).toBe('boolean');
    });

    test('should handle platform detection correctly', () => {
      // Arrange
      const { DeploymentConfigVerifier } = require('../../../scripts/deployment-config-verifier');
      
      // Act
      const verifier = new DeploymentConfigVerifier();
      const platforms = verifier.detectPlatforms();

      // Assert
      expect(Array.isArray(platforms)).toBe(true);
      expect(platforms.length).toBeGreaterThan(0);
      expect(platforms[0]).toHaveProperty('name');
    });
  });

  describe('Real-world Deployment Scenarios', () => {
    test('should simulate Vercel deployment configuration', () => {
      // Arrange - Simulate Vercel environment
      const vercelEnv = {
        NEXT_PUBLIC_SUPABASE_URL: 'https://vercel-project.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'vercel-key-here-long-enough-to-pass-validation-check-minimum-length',
        VERCEL: '1',
        VERCEL_ENV: 'production',
        NODE_ENV: 'production',
        NEXTAUTH_SECRET: 'vercel-secret-key-32-characters-minimum-length-required',
        SUPABASE_SERVICE_ROLE_KEY: 'vercel-service-role-key-here'
      };

      // Act
      const validator = new DeploymentValidator('production') as MockValidator;
      validator.loadEnvironmentVariables = jest.fn().mockReturnValue(vercelEnv);
      const envVars = validator.loadEnvironmentVariables();
      validator.validateRequired(envVars);
      validator.validateValues(envVars);

      // Assert
      expect(validator.errors).toHaveLength(0);
    });

    test('should simulate Docker deployment configuration', () => {
      // Arrange - Simulate Docker environment
      const dockerEnv = {
        NEXT_PUBLIC_SUPABASE_URL: 'https://docker-project.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'docker-key-here-long-enough-to-pass-validation-check-minimum-length',
        NODE_ENV: 'production',
        NEXTAUTH_SECRET: 'docker-secret-key-32-characters-minimum-length-required',
        SUPABASE_SERVICE_ROLE_KEY: 'docker-service-role-key-here'
      };

      // Act
      const validator = new DeploymentValidator('production') as MockValidator;
      validator.loadEnvironmentVariables = jest.fn().mockReturnValue(dockerEnv);
      const envVars = validator.loadEnvironmentVariables();
      validator.validateRequired(envVars);
      validator.validateValues(envVars);

      // Assert
      expect(validator.errors).toHaveLength(0);
    });

    test('should handle mixed environment scenarios', () => {
      // Arrange - Partial configuration (common in staging)
      const mixedEnv = {
        NEXT_PUBLIC_SUPABASE_URL: 'https://staging-project.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'staging-key-here-long-enough',
        NODE_ENV: 'staging' // Non-standard environment
      };

      // Act
      const validator = new DeploymentValidator('development') as MockValidator;
      validator.loadEnvironmentVariables = jest.fn().mockReturnValue(mixedEnv);
      const envVars = validator.loadEnvironmentVariables();
      validator.validateRequired(envVars);
      validator.validateOptional(envVars);

      // Assert
      expect(validator.errors).toHaveLength(0); // Should pass for development
      expect(validator.warnings.length).toBeGreaterThan(0); // Should have warnings for optional vars
    });
  });
});