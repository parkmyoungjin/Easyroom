/**
 * Unit tests for Environment Error Handler Service
 * Tests error handling scenarios across different environments
 */

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

import {
  EnvironmentErrorHandler,
  environmentErrorHandler,
  handleEnvironmentError,
  getTroubleshootingGuide,
  formatErrorForEnvironment,
  shouldShowDetailedError,
  type ErrorContext,
  type UserFriendlyError,
  type TroubleshootingGuide
} from '../environment-error-handler';

describe('Environment Error Handler Service', () => {
  let handler: EnvironmentErrorHandler;
  
  beforeEach(() => {
    handler = EnvironmentErrorHandler.getInstance();
    jest.clearAllMocks();
  });

  describe('Error Categorization', () => {
    it('should categorize environment errors correctly', () => {
      const error = new Error('Required environment variable NEXT_PUBLIC_SUPABASE_URL is not set');
      const context: ErrorContext = {
        operation: 'startup',
        environment: 'development',
        timestamp: new Date()
      };

      const result = handler.handleEnvironmentError(error, context);

      expect(result.category).toBe('environment');
      expect(result.severity).toBe('critical');
      expect(result.canRetry).toBe(false);
    });

    it('should categorize network errors correctly', () => {
      const error = new Error('fetch failed - network timeout');
      const context: ErrorContext = {
        operation: 'email_check',
        environment: 'development',
        timestamp: new Date()
      };

      const result = handler.handleEnvironmentError(error, context);

      expect(result.category).toBe('network');
      expect(result.canRetry).toBe(true);
      expect(result.retryDelay).toBe(2000);
    });

    it('should categorize configuration errors correctly', () => {
      const error = new Error('Invalid Supabase configuration detected');
      const context: ErrorContext = {
        operation: 'client_init',
        environment: 'test',
        timestamp: new Date()
      };

      const result = handler.handleEnvironmentError(error, context);

      expect(result.category).toBe('configuration');
      expect(result.severity).toBe('medium');
      expect(result.canRetry).toBe(false);
    });

    it('should categorize database errors correctly', () => {
      const error = new Error('Database connection failed');
      const context: ErrorContext = {
        operation: 'database_query',
        environment: 'production',
        timestamp: new Date()
      };

      const result = handler.handleEnvironmentError(error, context);

      expect(result.category).toBe('database');
      expect(result.severity).toBe('high');
    });

    it('should categorize auth errors correctly', () => {
      const error = new Error('JWT token expired');
      const context: ErrorContext = {
        operation: 'auth_flow',
        environment: 'production',
        timestamp: new Date()
      };

      const result = handler.handleEnvironmentError(error, context);

      expect(result.category).toBe('auth');
      expect(result.severity).toBe('high');
    });
  });

  describe('Environment-Specific Error Messages', () => {
    const testError = new Error('Required environment variable not set');

    it('should provide detailed messages in development', () => {
      const context: ErrorContext = {
        operation: 'startup',
        environment: 'development',
        timestamp: new Date()
      };

      const result = handler.handleEnvironmentError(testError, context);

      expect(result.title).toBe('Environment Configuration Issue');
      expect(result.message).toContain('environment variables');
      expect(result.message).toContain('.env.local');
      expect(result.technicalDetails).toBeDefined();
      expect(result.actions).toContainEqual(
        expect.objectContaining({
          label: 'Check Environment Variables',
          action: 'check_config'
        })
      );
    });

    it('should provide moderate detail in test environment', () => {
      const context: ErrorContext = {
        operation: 'startup',
        environment: 'test',
        timestamp: new Date()
      };

      const result = handler.handleEnvironmentError(testError, context);

      expect(result.title).toBe('Test Environment Configuration Error');
      expect(result.message).toContain('test environment');
      expect(result.technicalDetails).toBeDefined();
    });

    it('should provide user-friendly messages in production', () => {
      const context: ErrorContext = {
        operation: 'startup',
        environment: 'production',
        timestamp: new Date()
      };

      const result = handler.handleEnvironmentError(testError, context);

      expect(result.title).toBe('Configuration Error');
      expect(result.message).toContain('configuration issue');
      expect(result.message).toContain('team has been notified');
      expect(result.technicalDetails).toBeUndefined();
      expect(result.actions).toContainEqual(
        expect.objectContaining({
          label: 'Contact Support',
          action: 'contact_support'
        })
      );
    });
  });

  describe('Error Actions Generation', () => {
    it('should generate appropriate actions for development environment', () => {
      const error = new Error('Environment variable missing');
      const context: ErrorContext = {
        operation: 'startup',
        environment: 'development',
        timestamp: new Date()
      };

      const result = handler.handleEnvironmentError(error, context);

      const actionLabels = result.actions.map(action => action.label);
      expect(actionLabels).toContain('Check Environment Variables');
      expect(actionLabels).toContain('View Troubleshooting Guide');
      expect(actionLabels).toContain('Reload Page');
    });

    it('should generate retry actions for retryable errors', () => {
      const error = new Error('Network timeout occurred');
      const context: ErrorContext = {
        operation: 'email_check',
        environment: 'development',
        timestamp: new Date()
      };

      const result = handler.handleEnvironmentError(error, context);

      expect(result.canRetry).toBe(true);
      expect(result.actions).toContainEqual(
        expect.objectContaining({
          label: 'Try Again',
          action: 'retry',
          priority: 'primary'
        })
      );
    });

    it('should generate support actions for production', () => {
      const error = new Error('Database error');
      const context: ErrorContext = {
        operation: 'database_query',
        environment: 'production',
        timestamp: new Date()
      };

      const result = handler.handleEnvironmentError(error, context);

      expect(result.actions).toContainEqual(
        expect.objectContaining({
          label: 'Contact Support',
          action: 'contact_support'
        })
      );
    });
  });

  describe('Troubleshooting Guide Generation', () => {
    it('should generate environment troubleshooting guide', () => {
      const error = new Error('Environment variable not found');
      const guide = handler.generateTroubleshootingSteps(error, 'development');

      expect(guide.steps).toBeDefined();
      expect(guide.steps.length).toBeGreaterThan(0);
      expect(guide.estimatedTime).toBeDefined();
      expect(guide.difficulty).toBe('easy');
      expect(guide.requiresRestart).toBe(true);

      const stepTitles = guide.steps.map(step => step.title);
      expect(stepTitles).toContain('Check Environment File');
      expect(stepTitles).toContain('Verify Variable Names');
      expect(stepTitles).toContain('Restart Development Server');
    });

    it('should generate network troubleshooting guide', () => {
      const error = new Error('Network connection failed');
      const guide = handler.generateTroubleshootingSteps(error, 'development');

      expect(guide.difficulty).toBe('easy');
      expect(guide.requiresRestart).toBe(false);

      const stepTitles = guide.steps.map(step => step.title);
      expect(stepTitles).toContain('Check Internet Connection');
      expect(stepTitles).toContain('Test Supabase URL');
    });

    it('should generate configuration troubleshooting guide', () => {
      const error = new Error('Invalid configuration detected');
      const guide = handler.generateTroubleshootingSteps(error, 'development');

      expect(guide.difficulty).toBe('medium');
      expect(guide.requiresRestart).toBe(true);

      const stepTitles = guide.steps.map(step => step.title);
      expect(stepTitles).toContain('Verify Supabase Project Settings');
      expect(stepTitles).toContain('Check Project Status');
    });
  });

  describe('Environment Configuration', () => {
    it('should provide correct configuration for development', () => {
      const config = handler.getErrorConfiguration('development');

      expect(config.showTechnicalDetails).toBe(true);
      expect(config.showStackTrace).toBe(true);
      expect(config.logLevel).toBe('debug');
      expect(config.includeMetadata).toBe(true);
    });

    it('should provide correct configuration for test', () => {
      const config = handler.getErrorConfiguration('test');

      expect(config.showTechnicalDetails).toBe(true);
      expect(config.showStackTrace).toBe(false);
      expect(config.logLevel).toBe('info');
      expect(config.includeMetadata).toBe(true);
    });

    it('should provide correct configuration for production', () => {
      const config = handler.getErrorConfiguration('production');

      expect(config.showTechnicalDetails).toBe(false);
      expect(config.showStackTrace).toBe(false);
      expect(config.logLevel).toBe('error');
      expect(config.includeMetadata).toBe(false);
    });
  });

  describe('Retry Logic', () => {
    it('should allow retry for network errors', () => {
      const error = new Error('Network timeout');
      const context: ErrorContext = {
        operation: 'email_check',
        environment: 'development',
        timestamp: new Date()
      };

      const result = handler.handleEnvironmentError(error, context);

      expect(result.canRetry).toBe(true);
      expect(result.retryDelay).toBe(2000);
    });

    it('should allow retry for temporary database errors', () => {
      const error = new Error('Database temporary connection issue');
      const context: ErrorContext = {
        operation: 'database_query',
        environment: 'development',
        timestamp: new Date()
      };

      const result = handler.handleEnvironmentError(error, context);

      expect(result.canRetry).toBe(true);
      expect(result.retryDelay).toBe(5000);
    });

    it('should not allow retry for environment errors', () => {
      const error = new Error('Required environment variable not set');
      const context: ErrorContext = {
        operation: 'startup',
        environment: 'development',
        timestamp: new Date()
      };

      const result = handler.handleEnvironmentError(error, context);

      expect(result.canRetry).toBe(false);
    });

    it('should not allow retry for configuration errors', () => {
      const error = new Error('Invalid configuration');
      const context: ErrorContext = {
        operation: 'client_init',
        environment: 'development',
        timestamp: new Date()
      };

      const result = handler.handleEnvironmentError(error, context);

      expect(result.canRetry).toBe(false);
    });
  });

  describe('Singleton Pattern', () => {
    it('should maintain singleton instance', () => {
      const instance1 = EnvironmentErrorHandler.getInstance();
      const instance2 = EnvironmentErrorHandler.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Convenience Functions', () => {
    it('should handle environment error through convenience function', () => {
      const error = new Error('Test error');
      const result = handleEnvironmentError(error, {
        operation: 'startup',
        environment: 'development'
      });

      expect(result).toBeDefined();
      expect(result.title).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.actions).toBeDefined();
    });

    it('should get troubleshooting guide through convenience function', () => {
      const error = new Error('Environment error');
      const guide = getTroubleshootingGuide(error, 'development');

      expect(guide).toBeDefined();
      expect(guide.steps).toBeDefined();
      expect(guide.estimatedTime).toBeDefined();
    });

    it('should format error for specific environment', () => {
      const error = new Error('Test error');
      const result = formatErrorForEnvironment(error, 'startup', 'production');

      expect(result).toBeDefined();
      expect(result.technicalDetails).toBeUndefined(); // Production shouldn't show technical details
    });

    it('should determine if detailed errors should be shown', () => {
      expect(shouldShowDetailedError('development')).toBe(true);
      expect(shouldShowDetailedError('test')).toBe(true);
      expect(shouldShowDetailedError('production')).toBe(false);
    });
  });

  describe('Technical Details Formatting', () => {
    it('should include technical details in development', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace here';
      
      const context: ErrorContext = {
        operation: 'startup',
        environment: 'development',
        timestamp: new Date(),
        userId: 'user123',
        sessionId: 'session456',
        endpoint: '/api/test',
        metadata: { key: 'value' }
      };

      const result = handler.handleEnvironmentError(error, context);

      expect(result.technicalDetails).toBeDefined();
      expect(result.technicalDetails).toContain('Test error');
      expect(result.technicalDetails).toContain('startup');
      expect(result.technicalDetails).toContain('development');
      expect(result.technicalDetails).toContain('user123');
      expect(result.technicalDetails).toContain('session456');
      expect(result.technicalDetails).toContain('/api/test');
      expect(result.technicalDetails).toContain('Error stack trace here');
      expect(result.technicalDetails).toContain('key');
    });

    it('should not include technical details in production', () => {
      const error = new Error('Test error');
      const context: ErrorContext = {
        operation: 'startup',
        environment: 'production',
        timestamp: new Date()
      };

      const result = handler.handleEnvironmentError(error, context);

      expect(result.technicalDetails).toBeUndefined();
    });
  });
});