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
  generateTroubleshootingSteps,
  shouldShowDetailedError,
  getEnvironmentSpecificMessage,
  type ErrorContext,
  type UserFriendlyError
} from '../environment-error-handler';

describe('Environment Error Handler Service', () => {
  let handler: EnvironmentErrorHandler;
  
  beforeEach(() => {
    handler = EnvironmentErrorHandler.getInstance();
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should handle environment errors', () => {
      const error = new Error('Required environment variable NEXT_PUBLIC_SUPABASE_URL is not set');
      const context: ErrorContext = {
        operation: 'startup',
        environment: 'development',
        timestamp: new Date()
      };

      const result = handler.handleEnvironmentError(error, context);

      expect(result).toBeDefined();
      expect(result.title).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.actions).toBeDefined();
      expect(result.severity).toBeDefined();
      expect(typeof result.canRetry).toBe('boolean');
    });

    it('should generate troubleshooting steps', () => {
      const error = new Error('Environment variable not found');
      const steps = handler.generateTroubleshootingSteps(error, 'development');

      expect(steps).toBeDefined();
      expect(Array.isArray(steps)).toBe(true);
    });

    it('should determine if detailed errors should be shown', () => {
      expect(handler.shouldShowDetailedError('development')).toBe(true);
      expect(handler.shouldShowDetailedError('test')).toBe(true);
      expect(handler.shouldShowDetailedError('production')).toBe(false);
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

      expect(result.title).toBe('환경 설정 오류');
      expect(result.message).toContain('개발 환경 오류');
      expect(result.message).toContain('.env.local');
      expect(result.technicalDetails).toBeDefined();
      expect(result.actions).toContainEqual(
        expect.objectContaining({
          label: '환경 설정 확인',
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

      expect(result.title).toBe('환경 설정 오류');
      expect(result.message).toContain('테스트 환경 오류');
      expect(result.technicalDetails).toBeDefined();
    });

    it('should provide user-friendly messages in production', () => {
      const context: ErrorContext = {
        operation: 'startup',
        environment: 'production',
        timestamp: new Date()
      };

      const result = handler.handleEnvironmentError(testError, context);

      expect(result.title).toBe('서비스 연결 오류');
      expect(result.message).toContain('서비스 연결에 문제가 발생했습니다');
      expect(result.technicalDetails).toBeUndefined();
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
      expect(actionLabels).toContain('환경 설정 확인');
      expect(actionLabels).toContain('개발 서버 재시작');
      expect(actionLabels).toContain('페이지 새로고침');
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
          label: '다시 시도',
          action: 'retry'
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
          label: '지원팀 문의',
          action: 'contact_support'
        })
      );
    });
  });

  describe('Troubleshooting Guide Generation', () => {
    it('should generate environment troubleshooting guide', () => {
      const error = new Error('Environment variable not set');
      const steps = handler.generateTroubleshootingSteps(error, 'development');

      expect(steps).toBeDefined();
      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThan(0);

      const stepTitles = steps.map(step => step.title);
      expect(stepTitles).toContain('.env.local 파일 확인');
      expect(stepTitles).toContain('개발 서버 완전 재시작');
    });

    it('should generate network troubleshooting guide', () => {
      const error = new Error('Network connection failed');
      const steps = handler.generateTroubleshootingSteps(error, 'development');

      expect(steps).toBeDefined();
      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThan(0);

      const stepTitles = steps.map(step => step.title);
      expect(stepTitles).toContain('인터넷 연결 확인');
    });

    it('should generate configuration troubleshooting guide', () => {
      const error = new Error('Invalid configuration detected');
      const steps = handler.generateTroubleshootingSteps(error, 'development');

      expect(steps).toBeDefined();
      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThan(0);

      const stepTitles = steps.map(step => step.title);
      expect(stepTitles).toContain('브라우저 새로고침');
    });
  });

  describe('Environment Configuration', () => {
    it('should determine if detailed errors should be shown in development', () => {
      expect(handler.shouldShowDetailedError('development')).toBe(true);
    });

    it('should determine if detailed errors should be shown in test', () => {
      expect(handler.shouldShowDetailedError('test')).toBe(true);
    });

    it('should determine if detailed errors should be shown in production', () => {
      expect(handler.shouldShowDetailedError('production')).toBe(false);
    });

    it('should provide environment-specific messages', () => {
      const error = new Error('Test error');
      
      const devMessage = handler.getEnvironmentSpecificMessage(error, 'development');
      expect(devMessage).toContain('개발 환경 오류');
      
      const testMessage = handler.getEnvironmentSpecificMessage(error, 'test');
      expect(testMessage).toContain('테스트 환경 오류');
      
      const prodMessage = handler.getEnvironmentSpecificMessage(error, 'production');
      expect(prodMessage).toContain('서비스 연결에 문제가 발생했습니다');
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
      // retryDelay is not implemented in the actual code, so we don't test for it
    });

    it('should allow retry for client initialization errors', () => {
      const error = new Error('client initialization failed');
      const context: ErrorContext = {
        operation: 'client_init',
        environment: 'development',
        timestamp: new Date()
      };

      const result = handler.handleEnvironmentError(error, context);

      expect(result.canRetry).toBe(true);
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

    it('should not allow retry for validation errors', () => {
      const error = new Error('validation failed');
      const context: ErrorContext = {
        operation: 'validation',
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
        environment: 'development',
        timestamp: new Date()
      });

      expect(result).toBeDefined();
      expect(result.title).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.actions).toBeDefined();
    });

    it('should get troubleshooting guide through convenience function', () => {
      const error = new Error('Environment error');
      const steps = generateTroubleshootingSteps(error, 'development');

      expect(steps).toBeDefined();
      expect(Array.isArray(steps)).toBe(true);
    });

    it('should get environment-specific message through convenience function', () => {
      const error = new Error('Test error');
      const message = getEnvironmentSpecificMessage(error, 'production');

      expect(message).toBeDefined();
      expect(message).toContain('서비스 연결에 문제가 발생했습니다');
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
      
      const context: ErrorContext = {
        operation: 'startup',
        environment: 'development',
        timestamp: new Date(),
        userId: 'user123',
        sessionId: 'session456',
        endpoint: '/api/test'
      };

      const result = handler.handleEnvironmentError(error, context);

      expect(result.technicalDetails).toBeDefined();
      expect(result.technicalDetails).toBe('Test error');
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