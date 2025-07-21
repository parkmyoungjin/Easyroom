/**
 * @jest-environment jsdom
 */

import {
  analyzeSupabaseError,
  getErrorInfo,
  getErrorMessage,
  getBrowserSpecificCloseMessage,
  AuthErrorType,
  ERROR_MESSAGES
} from '../error-messages';

describe('error-messages utilities', () => {
  describe('analyzeSupabaseError', () => {
    it('should detect network errors', () => {
      const networkError = { message: 'Network request failed' };
      expect(analyzeSupabaseError(networkError)).toBe('NETWORK_ERROR');

      const fetchError = { message: 'fetch error occurred' };
      expect(analyzeSupabaseError(fetchError)).toBe('NETWORK_ERROR');

      const codeError = { code: 'NETWORK_ERROR' };
      expect(analyzeSupabaseError(codeError)).toBe('NETWORK_ERROR');
    });

    it('should detect token expiration errors', () => {
      const expiredError = { message: 'JWT token has expired' };
      expect(analyzeSupabaseError(expiredError)).toBe('TOKEN_EXPIRED');

      const tokenExpiredError = { message: 'Token expired, please refresh' };
      expect(analyzeSupabaseError(tokenExpiredError)).toBe('TOKEN_EXPIRED');
    });

    it('should detect invalid token errors', () => {
      const invalidTokenError = { message: 'Invalid JWT token' };
      expect(analyzeSupabaseError(invalidTokenError)).toBe('TOKEN_INVALID');

      const invalidJwtError = { message: 'JWT is invalid' };
      expect(analyzeSupabaseError(invalidJwtError)).toBe('TOKEN_INVALID');
    });

    it('should detect email confirmation errors', () => {
      const emailError = { message: 'Email not confirmed' };
      expect(analyzeSupabaseError(emailError)).toBe('EMAIL_NOT_CONFIRMED');

      const confirmedAtError = { message: 'email_confirmed_at is null' };
      expect(analyzeSupabaseError(confirmedAtError)).toBe('EMAIL_NOT_CONFIRMED');
    });

    it('should detect user not found errors', () => {
      const userError = { message: 'User not found' };
      expect(analyzeSupabaseError(userError)).toBe('USER_NOT_FOUND');

      const codeError = { code: 'USER_NOT_FOUND' };
      expect(analyzeSupabaseError(codeError)).toBe('USER_NOT_FOUND');
    });

    it('should detect session errors', () => {
      const sessionError = { message: 'Session invalid' };
      expect(analyzeSupabaseError(sessionError)).toBe('SESSION_ERROR');

      const authError = { message: 'Auth error occurred' };
      expect(analyzeSupabaseError(authError)).toBe('SESSION_ERROR');

      const pgError = { code: 'PGRST301' };
      expect(analyzeSupabaseError(pgError)).toBe('SESSION_ERROR');
    });

    it('should return unknown error for unrecognized errors', () => {
      const unknownError = { message: 'Something weird happened' };
      expect(analyzeSupabaseError(unknownError)).toBe('UNKNOWN_ERROR');

      expect(analyzeSupabaseError(null)).toBe('UNKNOWN_ERROR');
      expect(analyzeSupabaseError(undefined)).toBe('UNKNOWN_ERROR');
    });
  });

  describe('getErrorInfo', () => {
    it('should return correct error info for each error type', () => {
      const networkInfo = getErrorInfo('NETWORK_ERROR');
      expect(networkInfo.title).toBe('네트워크 연결 오류');
      expect(networkInfo.severity).toBe('error');
      expect(networkInfo.action).toBeDefined();

      const tokenInfo = getErrorInfo('TOKEN_EXPIRED');
      expect(tokenInfo.title).toBe('인증 링크 만료');
      expect(tokenInfo.severity).toBe('warning');

      const unknownInfo = getErrorInfo('UNKNOWN_ERROR');
      expect(unknownInfo.title).toBe('알 수 없는 오류');
      expect(unknownInfo.severity).toBe('error');
    });

    it('should have all error types defined', () => {
      const errorTypes: AuthErrorType[] = [
        'NETWORK_ERROR',
        'TOKEN_EXPIRED',
        'TOKEN_INVALID',
        'EMAIL_NOT_CONFIRMED',
        'USER_NOT_FOUND',
        'SESSION_ERROR',
        'PROFILE_CREATION_FAILED',
        'UNKNOWN_ERROR',
        'WINDOW_CLOSE_FAILED'
      ];

      errorTypes.forEach(errorType => {
        const info = getErrorInfo(errorType);
        expect(info).toBeDefined();
        expect(info.title).toBeTruthy();
        expect(info.message).toBeTruthy();
        expect(['error', 'warning', 'info']).toContain(info.severity);
      });
    });
  });

  describe('getErrorMessage', () => {
    it('should analyze error and return appropriate message', () => {
      const networkError = { message: 'Network request failed' };
      const errorInfo = getErrorMessage(networkError);
      
      expect(errorInfo.title).toBe('네트워크 연결 오류');
      expect(errorInfo.message).toContain('인터넷 연결을 확인');
    });

    it('should handle complex error objects', () => {
      const complexError = {
        message: 'JWT token has expired',
        code: 'TOKEN_EXPIRED',
        details: 'Additional details'
      };
      
      const errorInfo = getErrorMessage(complexError);
      expect(errorInfo.title).toBe('인증 링크 만료');
    });
  });

  describe('getBrowserSpecificCloseMessage', () => {
    beforeEach(() => {
      // Reset navigator mock
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: ''
      });
    });

    it('should return Chrome-specific message', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      });

      const message = getBrowserSpecificCloseMessage();
      expect(message).toContain('Chrome');
      expect(message).toContain('Ctrl+W');
    });

    it('should return Firefox-specific message', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:91.0) Gecko/20100101 Firefox/91.0'
      });

      const message = getBrowserSpecificCloseMessage();
      expect(message).toContain('Firefox');
      expect(message).toContain('Ctrl+W');
    });

    it('should return Safari-specific message', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15'
      });

      const message = getBrowserSpecificCloseMessage();
      expect(message).toContain('Safari');
      expect(message).toContain('Cmd+W');
    });

    it('should return Edge-specific message', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59'
      });

      const message = getBrowserSpecificCloseMessage();
      expect(message).toContain('Edge');
      expect(message).toContain('Ctrl+W');
    });

    it('should return iOS-specific message', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
      });

      const message = getBrowserSpecificCloseMessage();
      expect(message).toContain('iOS');
      expect(message).toContain('탭 관리');
    });

    it('should return Android-specific message', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36'
      });

      const message = getBrowserSpecificCloseMessage();
      expect(message).toContain('Android');
      expect(message).toContain('뒤로가기');
    });

    it('should return generic message for unknown browsers', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'UnknownBrowser/1.0'
      });

      const message = getBrowserSpecificCloseMessage();
      expect(message).toContain('브라우저의 탭 닫기 버튼');
      expect(message).toContain('키보드 단축키');
    });

    it('should handle SSR environment', () => {
      // Mock SSR environment
      const originalWindow = global.window;
      delete (global as any).window;

      const message = getBrowserSpecificCloseMessage();
      expect(message).toBe('');

      // Restore window
      global.window = originalWindow;
    });
  });

  describe('ERROR_MESSAGES constant', () => {
    it('should have consistent structure for all error types', () => {
      Object.entries(ERROR_MESSAGES).forEach(([errorType, errorInfo]) => {
        expect(errorInfo.title).toBeTruthy();
        expect(errorInfo.message).toBeTruthy();
        expect(['error', 'warning', 'info']).toContain(errorInfo.severity);
        
        // Action is optional but should be string if present
        if (errorInfo.action) {
          expect(typeof errorInfo.action).toBe('string');
        }
      });
    });

    it('should have Korean messages', () => {
      Object.values(ERROR_MESSAGES).forEach(errorInfo => {
        // Check if messages contain Korean characters
        const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(errorInfo.title) || 
                         /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(errorInfo.message);
        expect(hasKorean).toBe(true);
      });
    });
  });
});