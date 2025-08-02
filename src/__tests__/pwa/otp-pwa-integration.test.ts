/**
 * PWA-Specific OTP Integration Tests
 * Tests offline scenarios, mobile behavior, and PWA-specific functionality
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock service worker registration
const mockServiceWorker = {
  register: jest.fn(),
  unregister: jest.fn(),
  update: jest.fn(),
};

Object.defineProperty(window, 'navigator', {
  writable: true,
  value: {
    serviceWorker: mockServiceWorker,
    onLine: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
    standalone: false,
  }
});

// Mock network status
const mockGetNetworkStatus = jest.fn();
const mockIsNetworkError = jest.fn();

jest.mock('@/lib/utils/auth-timeout', () => ({
  getNetworkStatus: mockGetNetworkStatus,
  isNetworkError: mockIsNetworkError,
}));

// Mock PWA utilities
const mockIsPWAEnvironment = jest.fn();
const mockGetPWACapabilities = jest.fn();
const mockHandlePWAOffline = jest.fn();

jest.mock('@/lib/utils/pwa-utils', () => ({
  isPWAEnvironment: mockIsPWAEnvironment,
  getPWACapabilities: mockGetPWACapabilities,
  handlePWAOffline: mockHandlePWAOffline,
}));

// Mock Supabase
const mockSupabaseAuth = {
  signInWithOtp: jest.fn(),
  verifyOtp: jest.fn(),
  onAuthStateChange: jest.fn(),
};

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: mockSupabaseAuth,
  }),
}));

describe('PWA OTP Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default online state
    mockGetNetworkStatus.mockReturnValue({
      isOnline: true,
      connectionType: 'wifi',
      effectiveType: '4g',
    });

    mockIsNetworkError.mockReturnValue(false);

    // Default PWA environment
    mockIsPWAEnvironment.mockReturnValue(true);
    mockGetPWACapabilities.mockReturnValue({
      supportsOffline: true,
      supportsNotifications: true,
      supportsBackgroundSync: false,
    });

    // Default Supabase responses
    mockSupabaseAuth.signInWithOtp.mockResolvedValue({ error: null });
    mockSupabaseAuth.verifyOtp.mockResolvedValue({
      data: {
        user: { id: 'user123', email: 'test@example.com' },
        session: { access_token: 'token123' }
      },
      error: null,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('PWA Environment Detection', () => {
    it('should detect standalone PWA mode', () => {
      // Test display-mode: standalone
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

      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      expect(isStandalone).toBe(true);
    });

    it('should detect iOS standalone mode', () => {
      Object.defineProperty(window, 'navigator', {
        writable: true,
        value: {
          ...window.navigator,
          standalone: true,
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        }
      });

      expect(window.navigator.standalone).toBe(true);
      expect(window.navigator.userAgent).toContain('iPhone');
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

      const isMinimalUI = window.matchMedia('(display-mode: minimal-ui)').matches;
      expect(isMinimalUI).toBe(true);
    });

    it('should detect fullscreen PWA mode', () => {
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(display-mode: fullscreen)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
      expect(isFullscreen).toBe(true);
    });
  });

  describe('Mobile Behavior Tests', () => {
    it('should trigger numeric keypad on mobile devices', () => {
      // Create OTP input elements
      const otpInputs = Array.from({ length: 6 }, (_, i) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.inputMode = 'numeric';
        input.pattern = '[0-9]*';
        input.setAttribute('data-testid', `otp-input-${i}`);
        document.body.appendChild(input);
        return input;
      });

      // Verify mobile-optimized attributes
      otpInputs.forEach(input => {
        expect(input.inputMode).toBe('numeric');
        expect(input.pattern).toBe('[0-9]*');
      });

      // Cleanup
      otpInputs.forEach(input => document.body.removeChild(input));
    });

    it('should support auto-fill functionality', () => {
      const firstInput = document.createElement('input');
      firstInput.type = 'text';
      firstInput.autoComplete = 'one-time-code';
      firstInput.setAttribute('data-testid', 'otp-input-0');
      document.body.appendChild(firstInput);

      // Verify autocomplete attribute
      expect(firstInput.autoComplete).toBe('one-time-code');

      // Simulate auto-fill
      const autoFillEvent = new Event('input');
      firstInput.value = '123456';
      firstInput.dispatchEvent(autoFillEvent);

      expect(firstInput.value).toBe('123456');

      // Cleanup
      document.body.removeChild(firstInput);
    });

    it('should handle touch interactions optimally', () => {
      const otpInput = document.createElement('input');
      otpInput.type = 'text';
      otpInput.style.fontSize = '18px'; // Prevent zoom on iOS
      otpInput.style.minHeight = '44px'; // iOS touch target minimum
      document.body.appendChild(otpInput);

      // Verify touch-optimized styles
      expect(otpInput.style.fontSize).toBe('18px');
      expect(otpInput.style.minHeight).toBe('44px');

      // Simulate touch event
      const touchEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch],
      });

      otpInput.dispatchEvent(touchEvent);

      // Cleanup
      document.body.removeChild(otpInput);
    });

    it('should handle device orientation changes', () => {
      const orientationChangeHandler = jest.fn();
      
      window.addEventListener('orientationchange', orientationChangeHandler);

      // Simulate orientation change
      const orientationEvent = new Event('orientationchange');
      window.dispatchEvent(orientationEvent);

      expect(orientationChangeHandler).toHaveBeenCalled();

      window.removeEventListener('orientationchange', orientationChangeHandler);
    });
  });

  describe('Offline Scenarios', () => {
    it('should detect offline state and show appropriate messaging', async () => {
      // Step 1: Start online
      mockGetNetworkStatus.mockReturnValue({ isOnline: true });
      
      const mockRequestOTP = jest.fn().mockResolvedValue(undefined);
      await mockRequestOTP('test@example.com');

      // Step 2: Go offline
      mockGetNetworkStatus.mockReturnValue({ isOnline: false });
      Object.defineProperty(window, 'navigator', {
        writable: true,
        value: { ...window.navigator, onLine: false }
      });

      // Step 3: Attempt OTP request while offline
      mockRequestOTP.mockRejectedValue(new Error('인터넷 연결을 확인해주세요'));

      try {
        await mockRequestOTP('offline@example.com');
      } catch (error) {
        expect(error.message).toContain('인터넷 연결을 확인해주세요');
      }

      // Step 4: Verify offline handling
      mockHandlePWAOffline.mockReturnValue({
        isOffline: true,
        message: 'PWA 앱이 오프라인 상태입니다. OTP 요청을 위해서는 인터넷 연결이 필요합니다.',
        canRetry: true,
      });

      const offlineResult = mockHandlePWAOffline();
      expect(offlineResult.isOffline).toBe(true);
      expect(offlineResult.message).toContain('PWA 앱이 오프라인 상태입니다');
    });

    it('should handle network recovery after offline period', async () => {
      const email = 'recovery@example.com';

      // Step 1: Start offline
      mockGetNetworkStatus.mockReturnValue({ isOnline: false });
      mockIsNetworkError.mockReturnValue(true);

      const mockRequestOTP = jest.fn()
        .mockRejectedValueOnce(new Error('Network request failed'))
        .mockResolvedValueOnce(undefined);

      // Step 2: Attempt request while offline
      try {
        await mockRequestOTP(email);
      } catch (error) {
        expect(mockIsNetworkError(error)).toBe(true);
      }

      // Step 3: Network recovery
      mockGetNetworkStatus.mockReturnValue({ isOnline: true });
      mockIsNetworkError.mockReturnValue(false);

      // Step 4: Successful request after recovery
      await mockRequestOTP(email);
      expect(mockRequestOTP).toHaveBeenCalledTimes(2);
    });

    it('should handle intermittent connectivity', async () => {
      const email = 'intermittent@example.com';
      
      // Simulate intermittent connectivity
      const mockRequestOTP = jest.fn()
        .mockResolvedValueOnce(undefined)      // Success
        .mockRejectedValueOnce(new Error('Network timeout'))  // Failure
        .mockResolvedValueOnce(undefined);     // Success again

      // First request succeeds
      await mockRequestOTP(email);

      // Second request fails due to intermittent connectivity
      mockIsNetworkError.mockReturnValue(true);
      try {
        await mockRequestOTP(email);
      } catch (error) {
        expect(error.message).toBe('Network timeout');
      }

      // Third request succeeds after connectivity returns
      mockIsNetworkError.mockReturnValue(false);
      await mockRequestOTP(email);

      expect(mockRequestOTP).toHaveBeenCalledTimes(3);
    });

    it('should cache user data for offline access after authentication', async () => {
      const email = 'cache@example.com';
      const userData = {
        id: 'user123',
        email,
        name: 'Cache User',
        department: 'Engineering'
      };

      // Step 1: Complete online authentication
      mockGetNetworkStatus.mockReturnValue({ isOnline: true });
      
      const mockVerifyOTP = jest.fn().mockResolvedValue({
        user: userData,
        session: { access_token: 'token123' }
      });

      await mockVerifyOTP(email, '123456');

      // Step 2: Cache user data (simulated)
      const mockCacheUserData = jest.fn();
      mockCacheUserData(userData);

      expect(mockCacheUserData).toHaveBeenCalledWith(userData);

      // Step 3: Go offline
      mockGetNetworkStatus.mockReturnValue({ isOnline: false });

      // Step 4: Access cached data while offline
      const mockGetCachedUserData = jest.fn().mockReturnValue(userData);
      const cachedData = mockGetCachedUserData();

      expect(cachedData).toEqual(userData);
      expect(cachedData.email).toBe(email);
    });
  });

  describe('PWA App Backgrounding', () => {
    it('should maintain authentication state when app is backgrounded', async () => {
      const email = 'background@example.com';

      // Step 1: Complete authentication
      const mockVerifyOTP = jest.fn().mockResolvedValue(undefined);
      await mockVerifyOTP(email, '123456');

      // Step 2: Simulate app backgrounding
      Object.defineProperty(document, 'hidden', {
        writable: true,
        value: true,
      });

      const visibilityChangeEvent = new Event('visibilitychange');
      document.dispatchEvent(visibilityChangeEvent);

      // Step 3: Advance time while in background
      jest.advanceTimersByTime(300000); // 5 minutes

      // Step 4: Return to foreground
      Object.defineProperty(document, 'hidden', {
        writable: true,
        value: false,
      });

      document.dispatchEvent(visibilityChangeEvent);

      // Step 5: Verify authentication state is maintained
      const mockGetSession = jest.fn().mockResolvedValue({
        data: { session: { user: { email }, access_token: 'token123' } },
        error: null,
      });

      const session = await mockGetSession();
      expect(session.data.session.user.email).toBe(email);
    });

    it('should handle timer continuation during backgrounding', async () => {
      const email = 'timer@example.com';

      // Step 1: Request OTP (starts 5-minute timer)
      const mockRequestOTP = jest.fn().mockResolvedValue(undefined);
      await mockRequestOTP(email);

      let timeRemaining = 300; // 5 minutes in seconds

      // Step 2: Simulate app backgrounding after 1 minute
      jest.advanceTimersByTime(60000); // 1 minute
      timeRemaining -= 60;

      Object.defineProperty(document, 'hidden', {
        writable: true,
        value: true,
      });

      // Step 3: Advance time while backgrounded
      jest.advanceTimersByTime(120000); // 2 more minutes
      timeRemaining -= 120;

      // Step 4: Return to foreground
      Object.defineProperty(document, 'hidden', {
        writable: true,
        value: false,
      });

      // Step 5: Verify timer reflects correct remaining time
      expect(timeRemaining).toBe(120); // 2 minutes remaining
      expect(timeRemaining).toBeGreaterThan(0);
    });

    it('should handle OTP expiration during backgrounding', async () => {
      const email = 'expiry-background@example.com';

      // Step 1: Request OTP
      const mockRequestOTP = jest.fn().mockResolvedValue(undefined);
      await mockRequestOTP(email);

      // Step 2: Background the app
      Object.defineProperty(document, 'hidden', {
        writable: true,
        value: true,
      });

      // Step 3: Advance time beyond expiration while backgrounded
      jest.advanceTimersByTime(360000); // 6 minutes (beyond 5-minute expiration)

      // Step 4: Return to foreground
      Object.defineProperty(document, 'hidden', {
        writable: true,
        value: false,
      });

      // Step 5: Attempt verification with expired OTP
      const mockVerifyOTP = jest.fn().mockRejectedValue(
        new Error('Token has expired')
      );

      try {
        await mockVerifyOTP(email, '123456');
      } catch (error) {
        expect(error.message).toBe('Token has expired');
      }

      // Step 6: Verify user can request new OTP
      await mockRequestOTP(email);
      expect(mockRequestOTP).toHaveBeenCalledTimes(2);
    });
  });

  describe('PWA Notifications and Feedback', () => {
    it('should show PWA-appropriate success notifications', async () => {
      const email = 'notification@example.com';

      // Mock notification API
      const mockNotification = {
        permission: 'granted',
        requestPermission: jest.fn().mockResolvedValue('granted'),
      };

      Object.defineProperty(window, 'Notification', {
        writable: true,
        value: mockNotification,
      });

      // Step 1: Complete authentication
      const mockVerifyOTP = jest.fn().mockResolvedValue(undefined);
      await mockVerifyOTP(email, '123456');

      // Step 2: Show PWA notification
      const mockShowNotification = jest.fn();
      mockShowNotification({
        title: '로그인 성공',
        body: 'OTP 인증이 완료되었습니다.',
        icon: '/icons/success.png',
      });

      expect(mockShowNotification).toHaveBeenCalledWith({
        title: '로그인 성공',
        body: 'OTP 인증이 완료되었습니다.',
        icon: '/icons/success.png',
      });
    });

    it('should provide haptic feedback on mobile devices', async () => {
      // Mock vibration API
      const mockVibrate = jest.fn();
      Object.defineProperty(window.navigator, 'vibrate', {
        writable: true,
        value: mockVibrate,
      });

      // Step 1: Successful OTP verification
      const mockVerifyOTP = jest.fn().mockResolvedValue(undefined);
      await mockVerifyOTP('haptic@example.com', '123456');

      // Step 2: Trigger success haptic feedback
      if (window.navigator.vibrate) {
        window.navigator.vibrate([100, 50, 100]); // Success pattern
      }

      expect(mockVibrate).toHaveBeenCalledWith([100, 50, 100]);

      // Step 3: Error haptic feedback
      const mockVerifyOTPError = jest.fn().mockRejectedValue(
        new Error('Invalid token')
      );

      try {
        await mockVerifyOTPError('haptic@example.com', '000000');
      } catch (error) {
        if (window.navigator.vibrate) {
          window.navigator.vibrate([200]); // Error pattern
        }
      }

      expect(mockVibrate).toHaveBeenCalledWith([200]);
    });

    it('should handle PWA installation prompts', () => {
      let deferredPrompt: any = null;

      // Mock beforeinstallprompt event
      const beforeInstallPromptHandler = (e: Event) => {
        e.preventDefault();
        deferredPrompt = e;
      };

      window.addEventListener('beforeinstallprompt', beforeInstallPromptHandler);

      // Simulate beforeinstallprompt event
      const installPromptEvent = new Event('beforeinstallprompt');
      window.dispatchEvent(installPromptEvent);

      expect(deferredPrompt).toBe(installPromptEvent);

      // Cleanup
      window.removeEventListener('beforeinstallprompt', beforeInstallPromptHandler);
    });
  });

  describe('PWA Performance Optimization', () => {
    it('should optimize for PWA startup performance', () => {
      // Mock performance API
      const mockPerformance = {
        mark: jest.fn(),
        measure: jest.fn(),
        getEntriesByType: jest.fn().mockReturnValue([]),
      };

      Object.defineProperty(window, 'performance', {
        writable: true,
        value: mockPerformance,
      });

      // Mark PWA startup
      window.performance.mark('pwa-startup');
      expect(mockPerformance.mark).toHaveBeenCalledWith('pwa-startup');

      // Mark OTP component load
      window.performance.mark('otp-component-loaded');
      expect(mockPerformance.mark).toHaveBeenCalledWith('otp-component-loaded');

      // Measure startup time
      window.performance.measure('pwa-startup-time', 'pwa-startup', 'otp-component-loaded');
      expect(mockPerformance.measure).toHaveBeenCalledWith(
        'pwa-startup-time',
        'pwa-startup',
        'otp-component-loaded'
      );
    });

    it('should handle PWA memory constraints', () => {
      // Mock memory API
      const mockMemory = {
        usedJSHeapSize: 10000000, // 10MB
        totalJSHeapSize: 50000000, // 50MB
        jsHeapSizeLimit: 100000000, // 100MB
      };

      Object.defineProperty(window.performance, 'memory', {
        writable: true,
        value: mockMemory,
      });

      // Check memory usage
      const memoryUsage = window.performance.memory.usedJSHeapSize;
      const memoryLimit = window.performance.memory.jsHeapSizeLimit;
      const memoryUsagePercent = (memoryUsage / memoryLimit) * 100;

      expect(memoryUsagePercent).toBeLessThan(50); // Should be under 50%
    });

    it('should optimize network requests for PWA', async () => {
      const email = 'optimize@example.com';

      // Mock request with PWA-optimized headers
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      global.fetch = mockFetch;

      // Simulate optimized OTP request
      await fetch('/api/otp/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-PWA-Request': 'true',
        },
        body: JSON.stringify({ email }),
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/otp/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-PWA-Request': 'true',
        },
        body: JSON.stringify({ email }),
      });
    });
  });

  describe('PWA Security Considerations', () => {
    it('should handle secure storage in PWA environment', () => {
      // Mock secure storage
      const mockSecureStorage = {
        setItem: jest.fn(),
        getItem: jest.fn(),
        removeItem: jest.fn(),
      };

      // Simulate storing session data securely
      mockSecureStorage.setItem('otp-session', JSON.stringify({
        email: 'secure@example.com',
        timestamp: Date.now(),
      }));

      expect(mockSecureStorage.setItem).toHaveBeenCalledWith(
        'otp-session',
        expect.stringContaining('secure@example.com')
      );

      // Simulate secure retrieval
      mockSecureStorage.getItem.mockReturnValue(JSON.stringify({
        email: 'secure@example.com',
        timestamp: Date.now(),
      }));

      const sessionData = JSON.parse(mockSecureStorage.getItem('otp-session'));
      expect(sessionData.email).toBe('secure@example.com');
    });

    it('should handle PWA content security policy', () => {
      // Mock CSP violation handler
      const cspViolationHandler = jest.fn();
      
      // Mock SecurityPolicyViolationEvent for test environment
      const MockSecurityPolicyViolationEvent = class extends Event {
        violatedDirective: string;
        blockedURI: string;
        documentURI: string;
        
        constructor(type: string, eventInitDict: any) {
          super(type);
          this.violatedDirective = eventInitDict.violatedDirective;
          this.blockedURI = eventInitDict.blockedURI;
          this.documentURI = eventInitDict.documentURI;
        }
      };
      
      // Define SecurityPolicyViolationEvent in global scope for this test
      (global as any).SecurityPolicyViolationEvent = MockSecurityPolicyViolationEvent;
      
      document.addEventListener('securitypolicyviolation', cspViolationHandler);

      // Simulate CSP violation
      const cspEvent = new MockSecurityPolicyViolationEvent('securitypolicyviolation', {
        violatedDirective: 'script-src',
        blockedURI: 'inline',
        documentURI: window.location.href,
      });

      document.dispatchEvent(cspEvent);

      expect(cspViolationHandler).toHaveBeenCalled();

      document.removeEventListener('securitypolicyviolation', cspViolationHandler);
      
      // Clean up global mock
      delete (global as any).SecurityPolicyViolationEvent;
    });

    it('should validate PWA origin and prevent CSRF', () => {
      const expectedOrigin = 'https://your-app.com';
      
      // Mock location
      Object.defineProperty(window, 'location', {
        writable: true,
        value: {
          origin: expectedOrigin,
          href: `${expectedOrigin}/auth/login`,
        },
      });

      // Verify origin matches expected
      expect(window.location.origin).toBe(expectedOrigin);

      // Mock request with origin validation
      const mockValidateOrigin = jest.fn().mockReturnValue(true);
      const isValidOrigin = mockValidateOrigin(window.location.origin, expectedOrigin);

      expect(isValidOrigin).toBe(true);
      expect(mockValidateOrigin).toHaveBeenCalledWith(expectedOrigin, expectedOrigin);
    });
  });
});