/**
 * @jest-environment jsdom
 */

import { SimplifiedRedirectionHandler } from '@/lib/auth/simplified-redirection-handler';
import { AuthResult } from '@/types/auth-optimization';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock window.location
const mockLocation = {
  origin: 'https://example.com',
  href: '',
  assign: jest.fn(),
  replace: jest.fn()
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
});

describe('SimplifiedRedirectionHandler', () => {
  let handler: SimplifiedRedirectionHandler;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
    mockLocation.href = '';
    
    // Suppress console logs and errors for all tests
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    handler = new SimplifiedRedirectionHandler({
      baseUrl: 'https://example.com',
      verifiedPagePath: '/auth/callback/verified',
      autoRedirectDelay: 2000,
      fallbackEnabled: true
    });
  });

  afterEach(() => {
    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('URL Building', () => {
    it('should build return URL correctly', () => {
      const returnUrl = handler.buildReturnUrl('https://example.com');
      const url = new URL(returnUrl);
      
      expect(url.pathname).toBe('/auth/callback/verified');
      expect(url.searchParams.get('source')).toBe('external_app');
      expect(url.searchParams.has('t')).toBe(true);
    });

    it('should handle URL building errors', () => {
      expect(() => {
        handler.buildReturnUrl('invalid-url');
      }).toThrow('Failed to build return URL');
    });
  });

  describe('URL Parsing', () => {
    it('should parse successful return URL', () => {
      const url = 'https://example.com/auth/callback/verified?success=true&user_id=123&session_token=abc';
      const result = handler.parseReturnUrl(url);
      
      expect(result).toEqual({
        success: true,
        userId: '123',
        sessionToken: 'abc',
        error: undefined
      });
    });

    it('should parse failed return URL', () => {
      const url = 'https://example.com/auth/callback/verified?success=false&error=auth_failed';
      const result = handler.parseReturnUrl(url);
      
      expect(result).toEqual({
        success: false,
        userId: undefined,
        sessionToken: undefined,
        error: 'auth_failed'
      });
    });

    it('should handle URL parsing errors', () => {
      const result = handler.parseReturnUrl('invalid-url');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse return URL');
    });
  });

  describe('Authentication Redirection', () => {
    it('should redirect to Google auth', () => {
      const returnUrl = 'https://example.com/auth/callback/verified';
      
      handler.redirectToAuth('google', returnUrl);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'easyroom_auth_return_url',
        returnUrl
      );
      expect(mockLocation.href).toBe('/auth/google?return_url=' + encodeURIComponent(returnUrl));
    });

    it('should redirect to Microsoft auth', () => {
      handler.redirectToAuth('microsoft');
      
      expect(mockLocation.href).toContain('/auth/microsoft?return_url=');
    });

    it('should redirect to email auth', () => {
      handler.redirectToAuth('email');
      
      expect(mockLocation.href).toContain('/auth/email?return_url=');
    });

    it('should handle unknown provider', () => {
      handler.redirectToAuth('unknown');
      
      expect(mockLocation.href).toContain('/auth/unknown?return_url=');
    });

    it('should handle redirection errors', () => {
      // Mock location.href setter to throw error
      Object.defineProperty(window, 'location', {
        value: {
          ...mockLocation,
          set href(value) {
            throw new Error('Navigation error');
          }
        },
        writable: true
      });

      expect(() => {
        handler.redirectToAuth('google');
      }).toThrow('Failed to redirect to google authentication');
    });
  });

  describe('Authentication Return Handling', () => {
    it('should handle successful authentication', () => {
      // Reset location mock to allow successful redirection
      Object.defineProperty(window, 'location', {
        value: {
          ...mockLocation,
          set href(value) {
            mockLocation.href = value;
          }
        },
        writable: true
      });

      const authResult: AuthResult = {
        success: true,
        userId: 'user123',
        sessionToken: 'token123',
        timestamp: Date.now()
      };

      handler.handleAuthReturn(authResult);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'easyroom_auth_result',
        JSON.stringify(authResult)
      );
      expect(mockLocation.href).toContain('/auth/callback/verified?success=true');
      expect(mockLocation.href).toContain('user_id=user123');
    });

    it('should handle failed authentication', () => {
      // Reset location mock to allow successful redirection
      Object.defineProperty(window, 'location', {
        value: {
          ...mockLocation,
          set href(value) {
            mockLocation.href = value;
          }
        },
        writable: true
      });

      const authResult: AuthResult = {
        success: false,
        error: 'Authentication failed',
        timestamp: Date.now()
      };

      handler.handleAuthReturn(authResult);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'easyroom_auth_result',
        JSON.stringify(authResult)
      );
      expect(mockLocation.href).toContain('/auth/callback/verified?success=false');
      expect(mockLocation.href).toContain('error=Authentication+failed');
    });

    it('should handle auth return processing errors', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock JSON.stringify to throw error
      const originalStringify = JSON.stringify;
      JSON.stringify = jest.fn(() => {
        throw new Error('Stringify error');
      });

      const authResult: AuthResult = {
        success: true,
        userId: 'user123',
        timestamp: Date.now()
      };

      expect(() => handler.handleAuthReturn(authResult)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();

      // Restore
      JSON.stringify = originalStringify;
      consoleSpy.mockRestore();
    });
  });

  describe('Storage Management', () => {
    it('should store and retrieve return URL', () => {
      // Reset location mock to allow successful redirection
      Object.defineProperty(window, 'location', {
        value: {
          ...mockLocation,
          set href(value) {
            mockLocation.href = value;
          }
        },
        writable: true
      });

      const returnUrl = 'https://example.com/return';
      
      handler.redirectToAuth('google', returnUrl);
      const storedUrl = handler.getStoredReturnUrl();
      
      expect(storedUrl).toBe(returnUrl);
    });

    it('should clear stored return URL', () => {
      // Reset location mock to allow successful redirection
      Object.defineProperty(window, 'location', {
        value: {
          ...mockLocation,
          set href(value) {
            mockLocation.href = value;
          }
        },
        writable: true
      });

      const returnUrl = 'https://example.com/return';
      
      handler.redirectToAuth('google', returnUrl);
      handler.clearStoredReturnUrl();
      
      const storedUrl = handler.getStoredReturnUrl();
      expect(storedUrl).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('easyroom_auth_return_url');
    });

    it('should handle storage errors when getting return URL', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      localStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      const result = handler.getStoredReturnUrl();
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should store and retrieve auth result', () => {
      const authResult: AuthResult = {
        success: true,
        userId: 'user123',
        sessionToken: 'token123',
        timestamp: Date.now()
      };

      handler.handleAuthReturn(authResult);
      const storedResult = handler.getStoredAuthResult();
      
      expect(storedResult).toEqual(authResult);
    });

    it('should clear stored auth result', () => {
      const authResult: AuthResult = {
        success: true,
        userId: 'user123',
        timestamp: Date.now()
      };

      handler.handleAuthReturn(authResult);
      handler.clearStoredAuthResult();
      
      const storedResult = handler.getStoredAuthResult();
      expect(storedResult).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('easyroom_auth_result');
    });

    it('should handle storage errors when getting auth result', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      localStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      const result = handler.getStoredAuthResult();
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle invalid JSON when getting auth result', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      localStorageMock.setItem('easyroom_auth_result', 'invalid json');

      const result = handler.getStoredAuthResult();
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Configuration', () => {
    it('should return current configuration', () => {
      const config = handler.getConfig();
      
      expect(config).toEqual({
        baseUrl: 'https://example.com',
        verifiedPagePath: '/auth/callback/verified',
        autoRedirectDelay: 2000,
        fallbackEnabled: true
      });
    });

    it('should update configuration', () => {
      handler.updateConfig({
        autoRedirectDelay: 3000,
        fallbackEnabled: false
      });
      
      const config = handler.getConfig();
      
      expect(config.autoRedirectDelay).toBe(3000);
      expect(config.fallbackEnabled).toBe(false);
      expect(config.baseUrl).toBe('https://example.com'); // Should keep existing values
    });

    it('should use default baseUrl when window is available', () => {
      const handlerWithDefaults = new SimplifiedRedirectionHandler();
      const config = handlerWithDefaults.getConfig();
      
      expect(config.baseUrl).toBe('http://localhost'); // From actual window.location.origin in test environment
    });
  });
});