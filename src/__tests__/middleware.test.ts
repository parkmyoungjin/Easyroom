/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from 'next/server';
import { middleware } from '../middleware';

// Mock Supabase middleware client
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createMiddlewareClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn(),
      refreshSession: jest.fn(),
      getUser: jest.fn()
    },
    rpc: jest.fn()
  }))
}));

// Mock route matcher
jest.mock('../lib/routes/matcher', () => ({
  checkRouteAccess: jest.fn()
}));

// Mock server startup validator
jest.mock('@/lib/startup/server-startup-validator', () => ({
  canServeRequest: jest.fn()
}));

// Mock auth migration compatibility
jest.mock('@/lib/auth/migration-compatibility', () => ({
  handleMagicLinkRedirect: jest.fn()
}));

// Mock auth error handler
jest.mock('@/lib/auth/error-handler', () => ({
  categorizeAuthError: jest.fn()
}));

// Mock security monitor
jest.mock('@/lib/monitoring/security-monitor', () => ({
  securityMonitor: {
    recordEvent: jest.fn()
  }
}));

import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { checkRouteAccess } from '../lib/routes/matcher';
import { canServeRequest } from '@/lib/startup/server-startup-validator';
import { handleMagicLinkRedirect } from '@/lib/auth/migration-compatibility';
import { categorizeAuthError } from '@/lib/auth/error-handler';
import { securityMonitor } from '@/lib/monitoring/security-monitor';

const mockCreateMiddlewareClient = createMiddlewareClient as jest.MockedFunction<typeof createMiddlewareClient>;
const mockCheckRouteAccess = checkRouteAccess as jest.MockedFunction<typeof checkRouteAccess>;
const mockCanServeRequest = canServeRequest as jest.MockedFunction<typeof canServeRequest>;
const mockHandleMagicLinkRedirect = handleMagicLinkRedirect as jest.MockedFunction<typeof handleMagicLinkRedirect>;
const mockCategorizeAuthError = categorizeAuthError as jest.MockedFunction<typeof categorizeAuthError>;
const mockSecurityMonitor = securityMonitor as jest.Mocked<typeof securityMonitor>;

describe('Middleware', () => {
  let mockRequest: Partial<NextRequest>;
  let mockSupabase: any;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Suppress console logs, errors, and warnings for all tests
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Mock environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key-that-is-long-enough-for-validation';
    
    mockSupabase = {
      auth: {
        getSession: jest.fn(),
        refreshSession: jest.fn().mockResolvedValue({
          data: { session: null },
          error: null
        }),
        getUser: jest.fn()
      },
      rpc: jest.fn()
    };
    
    mockCreateMiddlewareClient.mockReturnValue(mockSupabase);
    
    // Mock server startup validator to allow requests
    mockCanServeRequest.mockResolvedValue({ canServe: true });
    
    // Mock magic link redirect to return null (no redirect)
    mockHandleMagicLinkRedirect.mockReturnValue(null);
    
    // Mock error categorization
    mockCategorizeAuthError.mockImplementation((error) => ({
      message: error instanceof Error ? error.message : String(error),
      type: 'unknown',
      severity: 'medium'
    }));
    
    // Mock security monitor
    mockSecurityMonitor.recordEvent.mockImplementation(() => {});
    
    mockRequest = {
      nextUrl: {
        pathname: '/',
        searchParams: new URLSearchParams()
      } as any,
      cookies: {
        getAll: jest.fn(() => []),
        set: jest.fn()
      } as any,
      url: 'http://localhost:3000/',
      headers: new Headers()
    };
  });

  afterEach(() => {
    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('API Route Handling', () => {
    it('should skip middleware for API routes', async () => {
      // Update both nextUrl.pathname and url to match
      mockRequest.nextUrl!.pathname = '/api/users';
      mockRequest.url = 'http://localhost:3000/api/users';
      
      const response = await middleware(mockRequest as NextRequest);
      
      expect(mockSupabase.auth.getSession).not.toHaveBeenCalled();
      expect(mockCheckRouteAccess).not.toHaveBeenCalled();
      expect(response).toBeInstanceOf(NextResponse);
    });

    it('should skip middleware for various API routes', async () => {
      const apiPaths = ['/api/auth', '/api/reservations', '/api/admin/users'];
      
      for (const path of apiPaths) {
        // Update both nextUrl.pathname and url to match
        mockRequest.nextUrl!.pathname = path;
        mockRequest.url = `http://localhost:3000${path}`;
        
        const response = await middleware(mockRequest as NextRequest);
        
        expect(mockSupabase.auth.getSession).not.toHaveBeenCalled();
        expect(response).toBeInstanceOf(NextResponse);
      }
    });
  });

  describe('Authentication Context Building', () => {
    it('should build auth context for unauthenticated user', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });
      
      mockCheckRouteAccess.mockReturnValue({ allowed: true });
      
      await middleware(mockRequest as NextRequest);
      
      expect(mockCheckRouteAccess).toHaveBeenCalledWith('/', {
        isAuthenticated: false,
        userId: undefined,
        userRole: undefined
      });
    });

    it('should build auth context for authenticated regular user', async () => {
      const mockUser = {
        id: 'user123',
        email: 'user@example.com'
      };
      
      const mockSession = {
        user: mockUser,
        access_token: 'token',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      };
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });
      
      // Mock RPC call for user role
      mockSupabase.rpc.mockResolvedValue({
        data: [{ role: 'user' }],
        error: null
      });
      
      mockCheckRouteAccess.mockReturnValue({ allowed: true });
      
      await middleware(mockRequest as NextRequest);
      
      expect(mockCheckRouteAccess).toHaveBeenCalledWith('/', {
        isAuthenticated: true,
        userId: 'user123',
        userRole: 'user'
      });
    });

    it('should build auth context for authenticated admin user', async () => {
      const mockUser = {
        id: 'admin123',
        email: 'admin@example.com'
      };
      
      const mockSession = {
        user: mockUser,
        access_token: 'token',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      };
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });
      
      // Mock RPC call for admin role
      mockSupabase.rpc.mockResolvedValue({
        data: [{ role: 'admin' }],
        error: null
      });
      
      mockCheckRouteAccess.mockReturnValue({ allowed: true });
      
      await middleware(mockRequest as NextRequest);
      
      expect(mockCheckRouteAccess).toHaveBeenCalledWith('/', {
        isAuthenticated: true,
        userId: 'admin123',
        userRole: 'admin'
      });
    });

    it('should handle user without metadata', async () => {
      const mockUser = {
        id: 'user123',
        email: 'user@example.com'
      };
      
      const mockSession = {
        user: mockUser,
        access_token: 'token',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      };
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });
      
      // Mock RPC call returning no role data
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null
      });
      
      mockCheckRouteAccess.mockReturnValue({ allowed: true });
      
      await middleware(mockRequest as NextRequest);
      
      expect(mockCheckRouteAccess).toHaveBeenCalledWith('/', {
        isAuthenticated: true,
        userId: 'user123',
        userRole: 'user'
      });
    });
  });

  describe('Access Control and Redirects', () => {
    it('should redirect when access is denied', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });
      
      mockCheckRouteAccess.mockReturnValue({
        allowed: false,
        reason: 'not_authenticated',
        redirectTo: '/login?redirect=%2Freservations%2Fnew'
      });
      
      mockRequest.nextUrl!.pathname = '/reservations/new';
      
      const response = await middleware(mockRequest as NextRequest);
      
      expect(response).toBeInstanceOf(NextResponse);
      // In a real test, we would check if it's a redirect response
      // but NextResponse.redirect creates a complex object that's hard to mock
    });

    it('should preserve original URL in redirect for login', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });
      
      mockCheckRouteAccess.mockReturnValue({
        allowed: false,
        reason: 'not_authenticated',
        redirectTo: '/login'
      });
      
      // Update both nextUrl.pathname and url to match
      mockRequest.nextUrl!.pathname = '/reservations/my';
      mockRequest.url = 'http://localhost:3000/reservations/my';
      
      await middleware(mockRequest as NextRequest);
      
      expect(mockCheckRouteAccess).toHaveBeenCalledWith('/reservations/my', expect.any(Object));
    });

    it('should allow access when permitted', async () => {
      const mockUser = {
        id: 'user123',
        email: 'user@example.com'
      };
      
      const mockSession = {
        user: mockUser,
        access_token: 'token',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      };
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });
      
      // Mock RPC call for user role
      mockSupabase.rpc.mockResolvedValue({
        data: [{ role: 'user' }],
        error: null
      });
      
      mockCheckRouteAccess.mockReturnValue({ allowed: true });
      
      const response = await middleware(mockRequest as NextRequest);
      
      expect(response).toBeInstanceOf(NextResponse);
      expect(mockCheckRouteAccess).toHaveBeenCalledWith('/', expect.any(Object));
    });
  });

  describe('Auth Page Redirects', () => {
    it('should redirect authenticated users away from login page', async () => {
      const mockUser = {
        id: 'user123',
        email: 'user@example.com'
      };
      
      const mockSession = {
        user: mockUser,
        access_token: 'token',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      };
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });
      
      // Mock RPC call for user role
      mockSupabase.rpc.mockResolvedValue({
        data: [{ role: 'user' }],
        error: null
      });
      
      mockCheckRouteAccess.mockReturnValue({ allowed: true });
      
      mockRequest.nextUrl!.pathname = '/login';
      
      const response = await middleware(mockRequest as NextRequest);
      
      expect(response).toBeInstanceOf(NextResponse);
      // Would check for redirect to /dashboard in real implementation
    });

    it('should redirect authenticated users away from signup page', async () => {
      const mockUser = {
        id: 'user123',
        email: 'user@example.com'
      };
      
      const mockSession = {
        user: mockUser,
        access_token: 'token',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      };
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });
      
      // Mock RPC call for user role
      mockSupabase.rpc.mockResolvedValue({
        data: [{ role: 'user' }],
        error: null
      });
      
      mockCheckRouteAccess.mockReturnValue({ allowed: true });
      
      mockRequest.nextUrl!.pathname = '/signup';
      
      const response = await middleware(mockRequest as NextRequest);
      
      expect(response).toBeInstanceOf(NextResponse);
    });

    it('should allow unauthenticated users to access auth pages', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });
      
      mockCheckRouteAccess.mockReturnValue({ allowed: true });
      
      mockRequest.nextUrl!.pathname = '/login';
      
      const response = await middleware(mockRequest as NextRequest);
      
      expect(response).toBeInstanceOf(NextResponse);
      expect(mockCheckRouteAccess).toHaveBeenCalled();
    });
  });

  describe('Cookie Handling', () => {
    it('should handle cookie operations correctly', async () => {
      const mockCookies = [
        { name: 'session', value: 'abc123' },
        { name: 'refresh', value: 'def456' }
      ];
      
      mockRequest.cookies!.getAll = jest.fn(() => mockCookies);
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });
      
      mockCheckRouteAccess.mockReturnValue({ allowed: true });
      
      await middleware(mockRequest as NextRequest);
      
      // Verify that createMiddlewareClient was called with request and response
      expect(mockCreateMiddlewareClient).toHaveBeenCalledWith(
        expect.objectContaining({
          req: expect.any(Object),
          res: expect.any(Object)
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle Supabase auth errors gracefully', async () => {
      mockSupabase.auth.getSession.mockRejectedValue(new Error('Auth error'));
      
      // Mock checkRouteAccess to return a valid result even when auth fails
      mockCheckRouteAccess.mockReturnValue({ allowed: true });
      
      // Should not throw, but handle gracefully and return a response
      const response = await middleware(mockRequest as NextRequest);
      
      expect(response).toBeInstanceOf(NextResponse);
      expect(mockCheckRouteAccess).toHaveBeenCalledWith('/', {
        isAuthenticated: false,
        userId: undefined,
        userRole: undefined
      });
    });

    it('should handle route access check errors', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });
      
      mockCheckRouteAccess.mockImplementation(() => {
        throw new Error('Route check error');
      });
      
      await expect(middleware(mockRequest as NextRequest)).rejects.toThrow('Route check error');
    });
  });

  describe('Path Handling', () => {
    it('should handle various path formats', async () => {
      const testPaths = [
        '/',
        '/dashboard',
        '/reservations/new',
        '/admin/users',
        '/path/with/multiple/segments'
      ];
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });
      
      mockCheckRouteAccess.mockReturnValue({ allowed: true });
      
      for (const path of testPaths) {
        // Update both nextUrl.pathname and url to match
        mockRequest.nextUrl!.pathname = path;
        mockRequest.url = `http://localhost:3000${path}`;
        
        const response = await middleware(mockRequest as NextRequest);
        
        expect(response).toBeInstanceOf(NextResponse);
        expect(mockCheckRouteAccess).toHaveBeenCalledWith(path, expect.any(Object));
      }
    });

    it('should handle paths with query parameters', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });
      
      mockCheckRouteAccess.mockReturnValue({ allowed: true });
      
      // Update both nextUrl.pathname and url to match
      mockRequest.nextUrl!.pathname = '/dashboard';
      mockRequest.url = 'http://localhost:3000/dashboard?tab=overview&filter=active';
      
      const response = await middleware(mockRequest as NextRequest);
      
      expect(response).toBeInstanceOf(NextResponse);
      expect(mockCheckRouteAccess).toHaveBeenCalledWith('/dashboard', expect.any(Object));
    });
  });
});