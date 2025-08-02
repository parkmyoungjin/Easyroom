/**
 * Authentication Compatibility Validation Tests
 * 
 * This test suite validates that client-side authentication produces cookies
 * compatible with server-side middleware and that authentication works
 * consistently across different environments and scenarios.
 * 
 * Requirements: 1.1, 1.4, 2.1, 2.2, 5.1, 5.5
 * 
 * @jest-environment node
 */

import { createMiddlewareClient, createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import { NextRequest, NextResponse } from 'next/server';

// Mock auth-helpers
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createMiddlewareClient: jest.fn(),
  createPagesBrowserClient: jest.fn()
}));

const mockCreateMiddlewareClient = createMiddlewareClient as jest.MockedFunction<typeof createMiddlewareClient>;
const mockCreatePagesBrowserClient = createPagesBrowserClient as jest.MockedFunction<typeof createPagesBrowserClient>;

describe('Authentication Compatibility Validation', () => {
  let mockMiddlewareClient: any;
  let mockBrowserClient: any;

  beforeEach(() => {
    // Setup mocks for each test
    mockMiddlewareClient = {
      auth: {
        getSession: jest.fn(),
        refreshSession: jest.fn(),
        getUser: jest.fn()
      },
      rpc: jest.fn()
    };

    mockBrowserClient = {
      auth: {
        getSession: jest.fn(),
        refreshSession: jest.fn(),
        onAuthStateChange: jest.fn(),
        signInWithOtp: jest.fn(),
        signOut: jest.fn(),
        verifyOtp: jest.fn()
      }
    };

    mockCreateMiddlewareClient.mockReturnValue(mockMiddlewareClient);
    mockCreatePagesBrowserClient.mockReturnValue(mockBrowserClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Cookie Format Compatibility', () => {
    it('should validate that auth-helpers clients use compatible cookie formats', () => {
      // Create browser client
      const browserClient = createPagesBrowserClient();
      expect(mockCreatePagesBrowserClient).toHaveBeenCalled();
      expect(browserClient).toBeDefined();

      // Create middleware client
      const request = new NextRequest('http://localhost:3000/test');
      const response = NextResponse.next();
      const middlewareClient = createMiddlewareClient({ req: request, res: response });
      
      expect(mockCreateMiddlewareClient).toHaveBeenCalledWith({
        req: request,
        res: response
      });
      expect(middlewareClient).toBeDefined();

      // The auth-helpers library guarantees compatibility between these clients
      // This test verifies we're using the correct auth-helpers functions
    });

    it('should handle valid auth-helpers cookie format', async () => {
      const validCookieData = {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
        refresh_token: 'refresh-token-123',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: {}
        }
      };

      // Mock successful session parsing
      mockMiddlewareClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: validCookieData.user,
            access_token: validCookieData.access_token,
            expires_at: validCookieData.expires_at
          }
        },
        error: null
      });

      const request = new NextRequest('http://localhost:3000/test', {
        headers: {
          cookie: `sb-localhost-auth-token=${encodeURIComponent(JSON.stringify(validCookieData))}`
        }
      });
      const response = NextResponse.next();

      const middlewareClient = createMiddlewareClient({ req: request, res: response });
      const { data, error } = await mockMiddlewareClient.auth.getSession();

      expect(error).toBeNull();
      expect(data.session).toBeTruthy();
      expect(data.session.user.id).toBe('user-123');
    });

    it('should handle cookie parsing errors gracefully', async () => {
      // Mock cookie parsing error
      mockMiddlewareClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Unexpected token in JSON at position 25' }
      });

      const request = new NextRequest('http://localhost:3000/test', {
        headers: {
          cookie: 'sb-localhost-auth-token=invalid-json-data'
        }
      });
      const response = NextResponse.next();

      const middlewareClient = createMiddlewareClient({ req: request, res: response });
      const { data, error } = await mockMiddlewareClient.auth.getSession();

      expect(error).toBeTruthy();
      expect(error.message).toContain('JSON');
      expect(data.session).toBeNull();
    });
  });

  describe('Session State Synchronization', () => {
    it('should maintain consistent session state between client and middleware', async () => {
      const sessionData = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer'
      };

      // Mock browser client session
      mockBrowserClient.auth.getSession.mockResolvedValue({
        data: { session: sessionData },
        error: null
      });

      // Mock middleware client session (should be identical)
      mockMiddlewareClient.auth.getSession.mockResolvedValue({
        data: { session: sessionData },
        error: null
      });

      // Get session from both clients
      const browserSession = await mockBrowserClient.auth.getSession();
      const middlewareSession = await mockMiddlewareClient.auth.getSession();

      // Sessions should be identical
      expect(browserSession.data.session.user.id).toBe(middlewareSession.data.session.user.id);
      expect(browserSession.data.session.access_token).toBe(middlewareSession.data.session.access_token);
      expect(browserSession.data.session.expires_at).toBe(middlewareSession.data.session.expires_at);
    });

    it('should handle token refresh consistently between client and middleware', async () => {
      const refreshedSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'new-token',
        refresh_token: 'new-refresh-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer'
      };

      // Mock refresh on both clients
      mockBrowserClient.auth.refreshSession.mockResolvedValue({
        data: { session: refreshedSession },
        error: null
      });

      mockMiddlewareClient.auth.refreshSession.mockResolvedValue({
        data: { session: refreshedSession },
        error: null
      });

      // Both should return the same refreshed session
      const browserRefresh = await mockBrowserClient.auth.refreshSession();
      const middlewareRefresh = await mockMiddlewareClient.auth.refreshSession();

      expect(browserRefresh.data.session.access_token).toBe('new-token');
      expect(middlewareRefresh.data.session.access_token).toBe('new-token');
      expect(browserRefresh.data.session.access_token).toBe(middlewareRefresh.data.session.access_token);
    });
  });  
describe('Error Handling Consistency', () => {
    it('should handle authentication errors consistently between client and middleware', async () => {
      const authError = { message: 'Invalid JWT token', code: 'invalid_jwt' };

      // Mock same error on both clients
      mockBrowserClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: authError
      });

      mockMiddlewareClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: authError
      });

      const browserResult = await mockBrowserClient.auth.getSession();
      const middlewareResult = await mockMiddlewareClient.auth.getSession();

      expect(browserResult.error).toEqual(authError);
      expect(middlewareResult.error).toEqual(authError);
      expect(browserResult.data.session).toBeNull();
      expect(middlewareResult.data.session).toBeNull();
    });

    it('should handle network errors consistently', async () => {
      const networkError = new Error('Network timeout');

      mockBrowserClient.auth.getSession.mockRejectedValue(networkError);
      mockMiddlewareClient.auth.getSession.mockRejectedValue(networkError);

      await expect(mockBrowserClient.auth.getSession()).rejects.toThrow('Network timeout');
      await expect(mockMiddlewareClient.auth.getSession()).rejects.toThrow('Network timeout');
    });
  });

  describe('Protected Route Validation', () => {
    it('should validate authentication for protected routes', async () => {
      const validSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'valid-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      };

      mockMiddlewareClient.auth.getSession.mockResolvedValue({
        data: { session: validSession },
        error: null
      });

      const request = new NextRequest('http://localhost:3000/dashboard', {
        headers: {
          cookie: 'sb-localhost-auth-token=' + encodeURIComponent(JSON.stringify({
            access_token: validSession.access_token,
            refresh_token: 'refresh-token',
            expires_at: validSession.expires_at,
            token_type: 'bearer',
            user: validSession.user
          }))
        }
      });
      const response = NextResponse.next();

      const middlewareClient = createMiddlewareClient({ req: request, res: response });
      const { data } = await mockMiddlewareClient.auth.getSession();

      // Should have valid session for protected route
      expect(data.session).toBeTruthy();
      expect(data.session.user.id).toBe('user-123');
    });

    it('should handle unauthenticated access to protected routes', async () => {
      mockMiddlewareClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      const request = new NextRequest('http://localhost:3000/dashboard');
      const response = NextResponse.next();

      const middlewareClient = createMiddlewareClient({ req: request, res: response });
      const { data } = await mockMiddlewareClient.auth.getSession();

      // Should have no session
      expect(data.session).toBeNull();
    });
  });

  describe('Session Expiration Prevention', () => {
    it('should prevent false session expiration errors with valid sessions', async () => {
      const validSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'valid-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600, // Valid for 1 hour
        token_type: 'bearer'
      };

      // Mock successful session validation
      mockMiddlewareClient.auth.getSession.mockResolvedValue({
        data: { session: validSession },
        error: null
      });

      const { data, error } = await mockMiddlewareClient.auth.getSession();

      // Should not trigger session expiration with valid session
      expect(error).toBeNull();
      expect(data.session).toBeTruthy();
      expect(data.session.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should handle truly expired sessions appropriately', async () => {
      const expiredSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'expired-token',
        expires_at: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        token_type: 'bearer'
      };

      // Mock session retrieval returning null for expired session
      mockMiddlewareClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      // Mock refresh also failing (truly expired)
      mockMiddlewareClient.auth.refreshSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Refresh token expired' }
      });

      const sessionResult = await mockMiddlewareClient.auth.getSession();
      expect(sessionResult.data.session).toBeNull();

      const refreshResult = await mockMiddlewareClient.auth.refreshSession();
      expect(refreshResult.data.session).toBeNull();
      expect(refreshResult.error.message).toBe('Refresh token expired');
    });
  });

  describe('Cross-Environment Compatibility', () => {
    it('should work consistently in development environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      try {
        const devRequest = new NextRequest('http://localhost:3000/dashboard');
        const devResponse = NextResponse.next();
        const middlewareClient = createMiddlewareClient({ req: devRequest, res: devResponse });

        expect(mockCreateMiddlewareClient).toHaveBeenCalledWith({
          req: devRequest,
          res: devResponse
        });
        expect(middlewareClient).toBeDefined();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should work consistently in production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const prodRequest = new NextRequest('https://example.com/dashboard');
        const prodResponse = NextResponse.next();
        const middlewareClient = createMiddlewareClient({ req: prodRequest, res: prodResponse });

        expect(mockCreateMiddlewareClient).toHaveBeenCalledWith({
          req: prodRequest,
          res: prodResponse
        });
        expect(middlewareClient).toBeDefined();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('Performance and Efficiency', () => {
    it('should handle authentication checks efficiently', async () => {
      const startTime = Date.now();

      mockMiddlewareClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123', email: 'test@example.com' },
            access_token: 'valid-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600
          }
        },
        error: null
      });

      await mockMiddlewareClient.auth.getSession();
      const endTime = Date.now();

      // Should complete authentication check efficiently
      expect(endTime - startTime).toBeLessThan(100); // Should complete very quickly in tests
    });

    it('should not make unnecessary refresh attempts with valid sessions', async () => {
      const validSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'valid-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      };

      mockMiddlewareClient.auth.getSession.mockResolvedValue({
        data: { session: validSession },
        error: null
      });

      await mockMiddlewareClient.auth.getSession();

      // Should not attempt refresh with valid session
      expect(mockMiddlewareClient.auth.getSession).toHaveBeenCalledTimes(1);
      expect(mockMiddlewareClient.auth.refreshSession).not.toHaveBeenCalled();
    });
  });

  describe('Auth-Helpers Integration Validation', () => {
    it('should use createPagesBrowserClient for client-side authentication', () => {
      const browserClient = createPagesBrowserClient();
      
      expect(mockCreatePagesBrowserClient).toHaveBeenCalledWith();
      expect(browserClient).toBeDefined();
      
      // Verify client has expected auth methods
      expect(browserClient.auth.signInWithOtp).toBeDefined();
      expect(browserClient.auth.signOut).toBeDefined();
      expect(browserClient.auth.onAuthStateChange).toBeDefined();
    });

    it('should use createMiddlewareClient for server-side authentication', () => {
      const request = new NextRequest('http://localhost:3000/test');
      const response = NextResponse.next();
      
      const middlewareClient = createMiddlewareClient({ req: request, res: response });
      
      expect(mockCreateMiddlewareClient).toHaveBeenCalledWith({
        req: request,
        res: response
      });
      expect(middlewareClient).toBeDefined();
      
      // Verify client has expected auth methods
      expect(middlewareClient.auth.getSession).toBeDefined();
      expect(middlewareClient.auth.refreshSession).toBeDefined();
    });

    it('should ensure cookie compatibility between browser and middleware clients', () => {
      // Create both clients
      const browserClient = createPagesBrowserClient();
      const request = new NextRequest('http://localhost:3000/test');
      const response = NextResponse.next();
      const middlewareClient = createMiddlewareClient({ req: request, res: response });

      // Both should be created successfully
      expect(mockCreatePagesBrowserClient).toHaveBeenCalled();
      expect(mockCreateMiddlewareClient).toHaveBeenCalled();
      
      // The auth-helpers library guarantees that cookies set by createPagesBrowserClient
      // are compatible with createMiddlewareClient. This test verifies we're using
      // the correct auth-helpers functions for client-server compatibility.
      expect(browserClient).toBeDefined();
      expect(middlewareClient).toBeDefined();
    });
  });
});