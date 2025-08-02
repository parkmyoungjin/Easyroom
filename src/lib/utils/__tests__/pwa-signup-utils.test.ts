/**
 * PWA Signup Utilities Tests
 * Tests PWA-specific functionality for signup process including offline detection
 * Requirements: 1.4, 1.5, 3.1, 3.2, 3.4
 */

import {
  isPWAEnvironment,
  getPWASignupState,
  checkSignupCompatibility,
  validateSignupToOtpTransition,
  handleSignupError,
  getSignupToOtpGuidance,
  createSignupNetworkMonitor
} from '../pwa-signup-utils';

// Mock auth-timeout utilities
jest.mock('../auth-timeout', () => ({
  getNetworkStatus: jest.fn(() => ({ isOnline: true })),
  isNetworkError: jest.fn(() => false)
}));

import { getNetworkStatus, isNetworkError } from '../auth-timeout';

const mockGetNetworkStatus = getNetworkStatus as jest.MockedFunction<typeof getNetworkStatus>;
const mockIsNetworkError = isNetworkError as jest.MockedFunction<typeof isNetworkError>;

describe('PWA Signup Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset window object
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    // Reset navigator
    Object.defineProperty(window, 'navigator', {
      writable: true,
      value: {
        onLine: true,
        standalone: false
      }
    });

    // Reset default network status
    mockGetNetworkStatus.mockReturnValue({ isOnline: true });
    mockIsNetworkError.mockReturnValue(false);
  });

  describe('isPWAEnvironment', () => {
    it('should detect standalone PWA mode', () => {
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      expect(isPWAEnvironment()).toBe(true);
    });

    it('should detect iOS standalone mode', () => {
      Object.defineProperty(window, 'navigator', {
        writable: true,
        value: { standalone: true }
      });

      expect(isPWAEnvironment()).toBe(true);
    });

    it('should detect minimal-ui PWA mode', () => {
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(display-mode: minimal-ui)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      expect(isPWAEnvironment()).toBe(true);
    });

    it('should return false for regular browser mode', () => {
      expect(isPWAEnvironment()).toBe(false);
    });

    it('should return false in SSR environment', () => {
      const originalWindow = global.window;
      delete (global as any).window;

      expect(isPWAEnvironment()).toBe(false);

      global.window = originalWindow;
    });
  });

  describe('getPWASignupState', () => {
    it('should return online state for regular browser', () => {
      const state = getPWASignupState();

      expect(state).toEqual({
        isOnline: true,
        isPWA: false,
        canSignup: true
      });
    });

    it('should return PWA state when in PWA environment', () => {
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      const state = getPWASignupState();

      expect(state).toEqual({
        isOnline: true,
        isPWA: true,
        canSignup: true
      });
    });

    it('should return offline state with appropriate message', () => {
      mockGetNetworkStatus.mockReturnValue({ isOnline: false });

      const state = getPWASignupState();

      expect(state).toEqual({
        isOnline: false,
        isPWA: false,
        canSignup: false,
        offlineMessage: '회원가입을 하려면 인터넷 연결이 필요합니다. 연결을 확인하고 다시 시도해주세요.'
      });
    });

    it('should return PWA-specific offline message', () => {
      mockGetNetworkStatus.mockReturnValue({ isOnline: false });
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      const state = getPWASignupState();

      expect(state.offlineMessage).toBe('PWA 앱에서 회원가입을 하려면 인터넷 연결이 필요합니다. 연결을 확인하고 다시 시도해주세요.');
    });
  });

  describe('checkSignupCompatibility', () => {
    it('should allow signup when online', () => {
      const result = checkSignupCompatibility();

      expect(result).toEqual({
        canProceed: true
      });
    });

    it('should prevent signup when offline', () => {
      mockGetNetworkStatus.mockReturnValue({ isOnline: false });

      const result = checkSignupCompatibility();

      expect(result).toEqual({
        canProceed: false,
        reason: 'offline',
        suggestedAction: '인터넷 연결을 확인하고 다시 시도해주세요.'
      });
    });
  });

  describe('validateSignupToOtpTransition', () => {
    it('should validate correct email format', () => {
      const result = validateSignupToOtpTransition('test@example.com');

      expect(result).toEqual({
        canProceed: true
      });
    });

    it('should reject invalid email format', () => {
      const result = validateSignupToOtpTransition('invalid-email');

      expect(result).toEqual({
        canProceed: false,
        reason: 'invalid_email',
        suggestedAction: '올바른 이메일 주소를 입력해주세요.'
      });
    });

    it('should reject when offline for OTP', () => {
      mockGetNetworkStatus.mockReturnValue({ isOnline: false });

      const result = validateSignupToOtpTransition('test@example.com');

      expect(result).toEqual({
        canProceed: false,
        reason: 'offline_otp',
        suggestedAction: 'OTP 로그인을 위해서는 인터넷 연결이 필요합니다.'
      });
    });
  });

  describe('handleSignupError', () => {
    it('should handle network errors in regular browser', () => {
      const networkError = new Error('Failed to fetch');
      mockIsNetworkError.mockReturnValue(true);

      const result = handleSignupError(networkError);

      expect(result).toEqual({
        message: '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인하고 다시 시도해주세요.',
        canRetry: true,
        isPWASpecific: false
      });
    });

    it('should handle network errors in PWA environment', () => {
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      const networkError = new Error('Failed to fetch');
      mockIsNetworkError.mockReturnValue(true);

      const result = handleSignupError(networkError);

      expect(result).toEqual({
        message: 'PWA 환경에서 네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인하고 다시 시도해주세요.',
        canRetry: true,
        isPWASpecific: true
      });
    });

    it('should handle duplicate email error', () => {
      const duplicateError = new Error('User already registered');

      const result = handleSignupError(duplicateError);

      expect(result).toEqual({
        message: '이미 가입된 이메일입니다. 로그인 페이지에서 OTP 로그인을 시도해주세요.',
        canRetry: false,
        isPWASpecific: false
      });
    });

    it('should handle invalid email error', () => {
      const invalidEmailError = new Error('Invalid email format');

      const result = handleSignupError(invalidEmailError);

      expect(result).toEqual({
        message: '올바른 이메일 주소를 입력해주세요.',
        canRetry: true,
        isPWASpecific: false
      });
    });

    it('should handle generic errors in PWA', () => {
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      const genericError = new Error('Something went wrong');

      const result = handleSignupError(genericError);

      expect(result).toEqual({
        message: 'PWA 환경에서 회원가입 중 오류가 발생했습니다. 다시 시도해주세요.',
        canRetry: true,
        isPWASpecific: true
      });
    });
  });

  describe('getSignupToOtpGuidance', () => {
    it('should provide guidance for regular browser', () => {
      const guidance = getSignupToOtpGuidance('test@example.com');

      expect(guidance).toEqual({
        title: '회원가입 완료!',
        message: 'test@example.com로 회원가입이 완료되었습니다. 이제 OTP 코드로 로그인할 수 있습니다.',
        nextSteps: [
          '로그인 페이지에서 가입한 이메일을 입력하세요',
          '이메일로 전송된 6자리 OTP 코드를 입력하세요',
          'OTP 코드는 5분간 유효합니다',
          '로그인 후 모든 기능을 이용할 수 있습니다'
        ]
      });
    });

    it('should provide PWA-specific guidance', () => {
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      const guidance = getSignupToOtpGuidance('test@example.com');

      expect(guidance.nextSteps).toContain('PWA 환경에서도 동일하게 OTP 로그인이 가능합니다');
    });
  });

  describe('createSignupNetworkMonitor', () => {
    it('should create network monitor with event listeners', () => {
      const onOnline = jest.fn();
      const onOffline = jest.fn();
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

      const cleanup = createSignupNetworkMonitor(onOnline, onOffline);

      expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

      cleanup();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('should return no-op function in SSR environment', () => {
      const originalWindow = global.window;
      delete (global as any).window;

      const onOnline = jest.fn();
      const onOffline = jest.fn();

      const cleanup = createSignupNetworkMonitor(onOnline, onOffline);

      expect(typeof cleanup).toBe('function');
      cleanup(); // Should not throw

      global.window = originalWindow;
    });

    it('should call onOnline when network comes back and signup is possible', () => {
      const onOnline = jest.fn();
      const onOffline = jest.fn();

      createSignupNetworkMonitor(onOnline, onOffline);

      // Simulate online event
      const onlineEvent = new Event('online');
      window.dispatchEvent(onlineEvent);

      expect(onOnline).toHaveBeenCalled();
    });

    it('should call onOffline when network goes down', () => {
      const onOnline = jest.fn();
      const onOffline = jest.fn();

      createSignupNetworkMonitor(onOnline, onOffline);

      // Simulate offline event
      const offlineEvent = new Event('offline');
      window.dispatchEvent(offlineEvent);

      expect(onOffline).toHaveBeenCalled();
    });
  });
});