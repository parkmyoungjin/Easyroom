/**
 * @jest-environment jsdom
 */

import {
  getCurrentAuthPolicy,
  shouldAllowAutoRedirect,
  shouldDetectAuthStateChange,
  isAuthCallbackPage,
  isProtectedPage,
  isAuthPage,
  getRedirectPath,
  logAuthNavigationState,
  AUTH_NAVIGATION_POLICIES
} from '../auth-navigation';

// Mock console for testing logging
const mockConsoleGroup = jest.spyOn(console, 'group').mockImplementation();
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleGroupEnd = jest.spyOn(console, 'groupEnd').mockImplementation();

describe('auth-navigation utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/',
        origin: 'http://localhost:3000'
      },
      writable: true
    });
  });

  describe('getCurrentAuthPolicy', () => {
    it('should return correct policy for auth callback page', () => {
      const policy = getCurrentAuthPolicy('/auth/callback');
      
      expect(policy.allowAutoRedirect).toBe(false);
      expect(policy.detectAuthStateChange).toBe(false);
      expect(policy.description).toContain('Email verification callback');
    });

    it('should return correct policy for login page', () => {
      const policy = getCurrentAuthPolicy('/login');
      
      expect(policy.allowAutoRedirect).toBe(true);
      expect(policy.detectAuthStateChange).toBe(true);
      expect(policy.description).toContain('Login page');
    });

    it('should return correct policy for protected pages', () => {
      const adminPolicy = getCurrentAuthPolicy('/admin');
      expect(adminPolicy.allowAutoRedirect).toBe(true);
      expect(adminPolicy.detectAuthStateChange).toBe(true);

      const reservationPolicy = getCurrentAuthPolicy('/reservations/new');
      expect(reservationPolicy.allowAutoRedirect).toBe(true);
      expect(reservationPolicy.detectAuthStateChange).toBe(true);
    });

    it('should return correct policy for public pages', () => {
      const mainPolicy = getCurrentAuthPolicy('/');
      expect(mainPolicy.allowAutoRedirect).toBe(false);
      expect(mainPolicy.detectAuthStateChange).toBe(true);

      const dashboardPolicy = getCurrentAuthPolicy('/dashboard');
      expect(dashboardPolicy.allowAutoRedirect).toBe(false);
      expect(dashboardPolicy.detectAuthStateChange).toBe(true);
    });

    it('should return default policy for unknown pages', () => {
      const unknownPolicy = getCurrentAuthPolicy('unknown-page'); // '/'로 시작하지 않는 경로
      
      expect(unknownPolicy.allowAutoRedirect).toBe(false);
      expect(unknownPolicy.detectAuthStateChange).toBe(true);
      expect(unknownPolicy.description).toContain('Default policy');
    });

    it('should handle pattern matching for nested paths', () => {
      const nestedAdminPolicy = getCurrentAuthPolicy('/admin/users');
      expect(nestedAdminPolicy.allowAutoRedirect).toBe(true);

      const nestedReservationPolicy = getCurrentAuthPolicy('/reservations/new/room-1');
      expect(nestedReservationPolicy.allowAutoRedirect).toBe(true);
    });

    it('should use window.location.pathname when no pathname provided', () => {
      window.location.pathname = '/login';
      
      const policy = getCurrentAuthPolicy();
      expect(policy.allowAutoRedirect).toBe(true);
    });

    it('should handle SSR environment', () => {
      const originalWindow = global.window;
      delete (global as any).window;

      const policy = getCurrentAuthPolicy();
      expect(policy.allowAutoRedirect).toBe(false);
      expect(policy.detectAuthStateChange).toBe(false);
      expect(policy.description).toContain('SSR environment');

      global.window = originalWindow;
    });
  });

  describe('shouldAllowAutoRedirect', () => {
    it('should return true for pages that allow auto redirect', () => {
      expect(shouldAllowAutoRedirect('/login')).toBe(true);
      expect(shouldAllowAutoRedirect('/signup')).toBe(true);
      expect(shouldAllowAutoRedirect('/admin')).toBe(true);
      expect(shouldAllowAutoRedirect('/reservations/new')).toBe(true);
    });

    it('should return false for pages that do not allow auto redirect', () => {
      expect(shouldAllowAutoRedirect('/auth/callback')).toBe(false);
      expect(shouldAllowAutoRedirect('/')).toBe(false);
      expect(shouldAllowAutoRedirect('/dashboard')).toBe(false);
    });
  });

  describe('shouldDetectAuthStateChange', () => {
    it('should return true for most pages', () => {
      expect(shouldDetectAuthStateChange('/login')).toBe(true);
      expect(shouldDetectAuthStateChange('/signup')).toBe(true);
      expect(shouldDetectAuthStateChange('/')).toBe(true);
      expect(shouldDetectAuthStateChange('/dashboard')).toBe(true);
    });

    it('should return false for auth callback page', () => {
      expect(shouldDetectAuthStateChange('/auth/callback')).toBe(false);
    });
  });

  describe('isAuthCallbackPage', () => {
    it('should return true for auth callback page', () => {
      expect(isAuthCallbackPage('/auth/callback')).toBe(true);
    });

    it('should return false for other pages', () => {
      expect(isAuthCallbackPage('/login')).toBe(false);
      expect(isAuthCallbackPage('/auth/login')).toBe(false);
      expect(isAuthCallbackPage('/auth/callback/extra')).toBe(false);
    });

    it('should use window.location.pathname when no pathname provided', () => {
      window.location.pathname = '/auth/callback';
      expect(isAuthCallbackPage()).toBe(true);

      window.location.pathname = '/login';
      expect(isAuthCallbackPage()).toBe(false);
    });
  });

  describe('isProtectedPage', () => {
    it('should return true for protected pages', () => {
      expect(isProtectedPage('/admin')).toBe(true);
      expect(isProtectedPage('/admin/users')).toBe(true);
      expect(isProtectedPage('/reservations/new')).toBe(true);
      expect(isProtectedPage('/reservations/my')).toBe(true);
    });

    it('should return false for public pages', () => {
      expect(isProtectedPage('/')).toBe(false);
      expect(isProtectedPage('/login')).toBe(false);
      expect(isProtectedPage('/signup')).toBe(false);
      expect(isProtectedPage('/dashboard')).toBe(false);
    });
  });

  describe('isAuthPage', () => {
    it('should return true for auth pages', () => {
      expect(isAuthPage('/login')).toBe(true);
      expect(isAuthPage('/signup')).toBe(true);
    });

    it('should return false for non-auth pages', () => {
      expect(isAuthPage('/')).toBe(false);
      expect(isAuthPage('/dashboard')).toBe(false);
      expect(isAuthPage('/auth/callback')).toBe(false);
      expect(isAuthPage('/admin')).toBe(false);
    });
  });

  describe('getRedirectPath', () => {
    it('should return null for pages that do not allow auto redirect', () => {
      const result = getRedirectPath({
        isAuthenticated: true,
        currentPath: '/auth/callback'
      });
      
      expect(result).toBeNull();
    });

    it('should redirect authenticated users from auth pages to fallback', () => {
      const result = getRedirectPath({
        isAuthenticated: true,
        currentPath: '/login',
        fallbackPath: '/dashboard'
      });
      
      expect(result).toBe('/dashboard');
    });

    it('should redirect unauthenticated users from protected pages to login', () => {
      // Mock window.location.origin for URL construction
      Object.defineProperty(window.location, 'origin', {
        value: 'http://localhost:3000',
        writable: true
      });

      const result = getRedirectPath({
        isAuthenticated: false,
        currentPath: '/admin'
      });
      
      expect(result).toContain('/login');
      expect(result).toContain('redirect=%2Fadmin');
    });

    it('should redirect non-admin users from admin pages', () => {
      const result = getRedirectPath({
        isAuthenticated: true,
        isAdmin: false,
        currentPath: '/admin',
        fallbackPath: '/dashboard'
      });
      
      expect(result).toBe('/dashboard');
    });

    it('should return null when no redirect is needed', () => {
      const result = getRedirectPath({
        isAuthenticated: true,
        isAdmin: true,
        currentPath: '/admin'
      });
      
      expect(result).toBeNull();
    });

    it('should handle missing currentPath by using window.location', () => {
      window.location.pathname = '/login';
      
      const result = getRedirectPath({
        isAuthenticated: true
      });
      
      expect(result).toBe('/');
    });
  });

  describe('logAuthNavigationState', () => {
    beforeEach(() => {
      // Mock the secure environment access module
      jest.doMock('@/lib/security/secure-environment-access', () => ({
        getPublicEnvVar: jest.fn((key: string) => {
          if (key === 'NODE_ENV') {
            return process.env.NODE_ENV || 'development';
          }
          return undefined;
        })
      }));
    });

    afterEach(() => {
      jest.clearAllMocks();
      jest.resetModules();
    });

    it('should log navigation state in development', async () => {
      process.env.NODE_ENV = 'development';
      
      await logAuthNavigationState('/auth/callback');
      
      expect(mockConsoleGroup).toHaveBeenCalledWith('🔐 Auth Navigation State: /auth/callback');
      expect(mockConsoleLog).toHaveBeenCalledWith('Policy:', expect.any(Object));
      expect(mockConsoleLog).toHaveBeenCalledWith('Allow Auto Redirect:', false);
      expect(mockConsoleLog).toHaveBeenCalledWith('Detect Auth State Change:', false);
      expect(mockConsoleLog).toHaveBeenCalledWith('Is Auth Callback Page:', true);
      expect(mockConsoleLog).toHaveBeenCalledWith('Is Protected Page:', false);
      expect(mockConsoleLog).toHaveBeenCalledWith('Is Auth Page:', false);
      expect(mockConsoleGroupEnd).toHaveBeenCalled();
    });

    it('should not log in production', async () => {
      process.env.NODE_ENV = 'production';
      
      await logAuthNavigationState('/login');
      
      expect(mockConsoleGroup).not.toHaveBeenCalled();
      expect(mockConsoleLog).not.toHaveBeenCalled();
      expect(mockConsoleGroupEnd).not.toHaveBeenCalled();
    });

    it('should handle SSR environment', async () => {
      const originalWindow = global.window;
      delete (global as any).window;

      process.env.NODE_ENV = 'development';
      
      await logAuthNavigationState();
      
      expect(mockConsoleGroup).toHaveBeenCalledWith('🔐 Auth Navigation State: SSR');

      global.window = originalWindow;
    });
  });

  describe('AUTH_NAVIGATION_POLICIES constant', () => {
    beforeEach(() => {
      // Ensure window is available for these tests
      if (typeof window === 'undefined') {
        (global as any).window = {
          location: {
            pathname: '/',
            origin: 'http://localhost:3000'
          }
        };
      }
    });

    it('should have all required policies defined', () => {
      const requiredPaths = [
        '/auth/callback',
        '/login',
        '/signup',
        '/admin',
        '/reservations/new',
        '/reservations/my',
        '/',
        '/dashboard'
      ];

      requiredPaths.forEach(path => {
        expect(AUTH_NAVIGATION_POLICIES[path]).toBeDefined();
        expect(AUTH_NAVIGATION_POLICIES[path].allowAutoRedirect).toBeDefined();
        expect(AUTH_NAVIGATION_POLICIES[path].detectAuthStateChange).toBeDefined();
        expect(AUTH_NAVIGATION_POLICIES[path].description).toBeTruthy();
      });
    });

    it('should have consistent policy structure', () => {
      Object.entries(AUTH_NAVIGATION_POLICIES).forEach(([path, policy]) => {
        expect(typeof policy.allowAutoRedirect).toBe('boolean');
        expect(typeof policy.detectAuthStateChange).toBe('boolean');
        expect(typeof policy.description).toBe('string');
        expect(policy.description.length).toBeGreaterThan(0);
      });
    });
  });
});