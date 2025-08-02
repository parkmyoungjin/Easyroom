/**
 * Environment Startup Validator Tests
 * Tests for the startup validation integration
 * Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4
 */

import {
  environmentStartupValidator,
  validateStartup,
  quickStartupCheck,
  validateStartupRequirements,
  clearStartupValidationCache
} from '../environment-startup-validator';

// Mock dependencies
jest.mock('@/lib/config/environment-validator', () => ({
  validateEnvironment: jest.fn(),
  quickEnvironmentCheck: jest.fn()
}));

jest.mock('@/lib/error-handling/environment-error-handler', () => ({
  handleEnvironmentError: jest.fn()
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

import { validateEnvironment, quickEnvironmentCheck } from '../../config/environment-validator';
import { handleEnvironmentError } from '../../error-handling/environment-error-handler';

const mockValidateEnvironment = validateEnvironment as jest.MockedFunction<typeof validateEnvironment>;
const mockQuickEnvironmentCheck = quickEnvironmentCheck as jest.MockedFunction<typeof quickEnvironmentCheck>;
const mockHandleEnvironmentError = handleEnvironmentError as jest.MockedFunction<typeof handleEnvironmentError>;

describe('EnvironmentStartupValidator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearStartupValidationCache();
  });

  describe('performStartupValidation', () => {
    it('should return success result when validation passes', async () => {
      // Arrange
      const mockValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
        summary: {
          total: 5,
          valid: 5,
          invalid: 0,
          missing: 0,
          warnings: 0,
          criticalErrors: 0
        },
        details: new Map()
      };

      mockValidateEnvironment.mockResolvedValue(mockValidationResult);

      // Act
      const result = await validateStartup({
        strictMode: false,
        includeOptional: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.canContinue).toBe(true);
      expect(result.requiresUserAction).toBe(false);
      expect(result.validationResult).toEqual(mockValidationResult);
      expect(result.startupTime).toBeGreaterThan(0);
    });

    it('should return failure result when validation fails', async () => {
      // Arrange
      const mockValidationResult = {
        valid: false,
        errors: ['Critical: Required environment variable SUPABASE_URL is missing'],
        warnings: [],
        summary: {
          total: 5,
          valid: 3,
          invalid: 1,
          missing: 1,
          warnings: 0,
          criticalErrors: 1
        },
        details: new Map()
      };

      const mockUserFriendlyError = {
        title: 'Environment Configuration Issue',
        message: 'Required environment variables are missing',
        actions: [],
        severity: 'critical' as const,
        category: 'environment' as const,
        canRetry: false
      };

      mockValidateEnvironment.mockResolvedValue(mockValidationResult);
      mockHandleEnvironmentError.mockReturnValue(mockUserFriendlyError);

      // Act
      const result = await validateStartup({
        strictMode: true,
        includeOptional: false,
        environment: 'production' // Ensure production environment for strict behavior
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.canContinue).toBe(false);
      expect(result.requiresUserAction).toBe(true);
      expect(result.userFriendlyError).toEqual(mockUserFriendlyError);
      expect(result.validationResult).toEqual(mockValidationResult);
    });

    it('should use quick check when failFast is enabled', async () => {
      // Arrange
      mockQuickEnvironmentCheck.mockResolvedValue(false);
      
      const mockValidationResult = {
        valid: false,
        errors: ['Quick check failed'],
        warnings: [],
        summary: {
          total: 0,
          valid: 0,
          invalid: 0,
          missing: 0,
          warnings: 0,
          criticalErrors: 1
        },
        details: new Map()
      };

      mockValidateEnvironment.mockResolvedValue(mockValidationResult);
      mockHandleEnvironmentError.mockReturnValue({
        title: 'Quick Check Failed',
        message: 'Environment quick check failed',
        actions: [],
        severity: 'high' as const,
        category: 'environment' as const,
        canRetry: true
      });

      // Act
      const result = await validateStartup({
        failFast: true
      });

      // Assert
      expect(mockQuickEnvironmentCheck).toHaveBeenCalled();
      expect(result.success).toBe(false);
    });

    it('should cache validation results', async () => {
      // Arrange
      const mockValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
        summary: {
          total: 5,
          valid: 5,
          invalid: 0,
          missing: 0,
          warnings: 0,
          criticalErrors: 0
        },
        details: new Map()
      };

      mockValidateEnvironment.mockResolvedValue(mockValidationResult);

      // Act
      const result1 = await validateStartup();
      const result2 = await validateStartup();

      // Assert
      expect(mockValidateEnvironment).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });

    it('should handle validation errors gracefully', async () => {
      // Arrange
      const error = new Error('Validation system error');
      mockValidateEnvironment.mockRejectedValue(error);
      mockHandleEnvironmentError.mockReturnValue({
        title: 'Validation Error',
        message: 'System error occurred',
        actions: [],
        severity: 'critical' as const,
        category: 'environment' as const,
        canRetry: true
      });

      // Act
      const result = await validateStartup({
        environment: 'production' // Ensure production environment for strict behavior
      });

      // Assert
      expect(result.success).toBe(false);
      // When validationResult is undefined, canContinue returns true in the actual implementation
      expect(result.canContinue).toBe(true);
      expect(result.userFriendlyError?.title).toBe('Validation Error');
    });
  });

  describe('quickStartupCheck', () => {
    it('should return true when quick check passes', async () => {
      // Arrange
      mockQuickEnvironmentCheck.mockResolvedValue(true);

      // Act
      const result = await quickStartupCheck();

      // Assert
      expect(result).toBe(true);
      expect(mockQuickEnvironmentCheck).toHaveBeenCalled();
    });

    it('should return false when quick check fails', async () => {
      // Arrange
      mockQuickEnvironmentCheck.mockResolvedValue(false);

      // Act
      const result = await quickStartupCheck();

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when quick check throws error', async () => {
      // Arrange
      mockQuickEnvironmentCheck.mockRejectedValue(new Error('Check failed'));

      // Act
      const result = await quickStartupCheck();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('validateStartupRequirements', () => {
    it('should return service status when validation passes', async () => {
      // Arrange
      const mockValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
        summary: {
          total: 5,
          valid: 5,
          invalid: 0,
          missing: 0,
          warnings: 0,
          criticalErrors: 0
        },
        details: new Map([
          ['NEXT_PUBLIC_SUPABASE_URL', { status: 'valid' }],
          ['NEXT_PUBLIC_SUPABASE_ANON_KEY', { status: 'valid' }],
          ['NEXTAUTH_SECRET', { status: 'valid' }]
        ])
      };

      mockValidateEnvironment.mockResolvedValue(mockValidationResult);

      // Act
      const result = await validateStartupRequirements();

      // Assert
      expect(result.database).toBe(true);
      expect(result.auth).toBe(true);
      expect(result.storage).toBe(true);
      expect(result.monitoring).toBe(true);
    });

    it('should return false for services with missing variables', async () => {
      // Arrange
      const mockValidationResult = {
        valid: false,
        errors: ['Missing SUPABASE_URL'],
        warnings: [],
        summary: {
          total: 3,
          valid: 2,
          invalid: 0,
          missing: 1,
          warnings: 0,
          criticalErrors: 1
        },
        details: new Map([
          ['NEXT_PUBLIC_SUPABASE_ANON_KEY', { status: 'valid' }],
          ['NEXTAUTH_SECRET', { status: 'valid' }]
        ])
      };

      mockValidateEnvironment.mockResolvedValue(mockValidationResult);

      // Act
      const result = await validateStartupRequirements();

      // Assert
      expect(result.database).toBe(false);
      expect(result.auth).toBe(false);
      expect(result.storage).toBe(false);
      expect(result.monitoring).toBe(false); // False when validation fails
    });

    it('should handle validation errors gracefully', async () => {
      // Arrange
      mockValidateEnvironment.mockRejectedValue(new Error('Validation failed'));

      // Act
      const result = await validateStartupRequirements();

      // Assert
      expect(result.database).toBe(false);
      expect(result.auth).toBe(false);
      expect(result.storage).toBe(false);
      expect(result.monitoring).toBe(false);
    });
  });

  describe('environment-specific behavior', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should be more lenient in development environment', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      
      const mockValidationResult = {
        valid: false,
        errors: ['Non-critical error'],
        warnings: [],
        summary: {
          total: 5,
          valid: 4,
          invalid: 1,
          missing: 0,
          warnings: 0,
          criticalErrors: 0 // No critical errors
        },
        details: new Map()
      };

      mockValidateEnvironment.mockResolvedValue(mockValidationResult);
      mockHandleEnvironmentError.mockReturnValue({
        title: 'Non-critical Issue',
        message: 'Non-critical configuration issue',
        actions: [],
        severity: 'medium' as const,
        category: 'environment' as const,
        canRetry: true
      });

      // Act
      const result = await validateStartup();

      // Assert
      expect(result.canContinue).toBe(true); // Should allow continuation in development
    });

    it('should be strict in production environment', async () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      
      const mockValidationResult = {
        valid: false,
        errors: ['Critical: Missing required variable'],
        warnings: [],
        summary: {
          total: 5,
          valid: 4,
          invalid: 1,
          missing: 0,
          warnings: 0,
          criticalErrors: 1
        },
        details: new Map()
      };

      mockValidateEnvironment.mockResolvedValue(mockValidationResult);
      mockHandleEnvironmentError.mockReturnValue({
        title: 'Critical Issue',
        message: 'Critical configuration issue',
        actions: [],
        severity: 'critical' as const,
        category: 'environment' as const,
        canRetry: false
      });

      // Act
      const result = await validateStartup();

      // Assert
      expect(result.canContinue).toBe(false); // Should not allow continuation in production
    });
  });
});