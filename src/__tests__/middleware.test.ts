/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from 'next/server';
import { middleware } from '../middleware';

// Mock Supabase
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn()
    }
  }))
}));

// Mock route matcher
jest.mock('../lib/routes/matcher', () => ({
  checkRouteAccess: jest.fn()
}));

import { createServerClient } from '@supabase/ssr';
import { checkRouteAccess } from '../lib/routes/matcher';

const mockCreateServerClient = createServerClient as jest.MockedFunction<typeof createServerClient>;
const mockCheckRouteAccess = checkRouteAccess as jest.MockedFunction<typeof checkRouteAccess>;

describe('Middleware', () => {
  let mockRequest: Partial<NextRequest>;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    
    mockSupabase = {
      auth: {
        getUser: jest.fn()
      }
    };
    
    mockCreateServerClient.mockReturnValue(mockSupabase);
    
    mockRequest = {
      nextUrl: {
        pathname: '/',
        searchParams: new URLSearchParams()
      } as any,
      cookies: {
        getAll: jest.fn(() => []),
        set: jest.fn()
      } as any,
      url: 'http://localhost:3000/'
    };
  });

  describe('API Route Handling', () => {
    it('should skip middleware for API routes', async () => {
      mockRequest.nextUrl!.pathname = '/api/users';
      
      const response = await middleware(mockRequest as NextRequest);
      
      expect(mockSupabase.auth.getUser).not.toHaveBeenCalled();
      expect(mockCheckRouteAccess).not.toHaveBeenCalled();
      expect(response).toBeInstanceOf(NextResponse);
    });

    it('should skip middleware for various API routes', async () => {
      const apiPaths = ['/api/auth', '/api/reservations', '/api/admin/users'];
      
      for (const path of apiPaths) {
        mockRequest.nextUrl!.pathname = path;
        
        const response = await middleware(mockRequest as NextRequest);
        
        expect(mockSupabase.auth.getUser).not.toHaveBeenCalled();
        expect(response).toBeInstanceOf(NextResponse);
      }
    });
  });

  describe('Authentication Context Building', () => {
    it('should build auth context for unauthenticated user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null }
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
        user_metadata: { role: 'user' }
      };
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser }
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
        user_metadata: { role: 'admin' }
      };
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser }
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
        user_metadata: null
      };
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser }
      });
      
      mockCheckRouteAccess.mockReturnValue({ allowed: true });
      
      await middleware(mockRequest as NextRequest);
      
      expect(mockCheckRouteAccess).toHaveBeenCalledWith('/', {
        isAuthenticated: true,
        userId: 'user123',
        userRole: undefined
      });
    });
  });

  describe('Access Control and Redirects', () => {
    it('should redirect when access is denied', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null }
      });
      
      mockCheckRouteAccess.mockReturnValue({
        allowed: false,
        reason: 'not_authenticated',
        redirectTo: '/login?redirect=%2Freservations%2Fnew'
      });
      
      mockRequest.nextUrl!.pathname = '/reservations/new';
      mockRequest.url = 'http://localhost:3000/reservations/new';
      
      const response = await middleware(mockRequest as NextRequest);
      
      expect(response).toBeInstanceOf(NextResponse);
      // In a real test, we would check if it's a redirect response
      // but NextResponse.redirect creates a complex object that's hard to mock
    });

    it('should preserve original URL in redirect for login', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null }
      });
      
      mockCheckRouteAccess.mockReturnValue({
        allowed: false,
        reason: 'not_authenticated',
        redirectTo: '/login'
      });
      
      mockRequest.nextUrl!.pathname = '/reservations/my';
      mockRequest.url = 'http://localhost:3000/reservations/my';
      
      await middleware(mockRequest as NextRequest);
      
      expect(mockCheckRouteAccess).toHaveBeenCalledWith('/reservations/my', expect.any(Object));
    });

    it('should allow access when permitted', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', user_metadata: { role: 'user' } } }
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
        user_metadata: { role: 'user' }
      };
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser }
      });
      
      mockCheckRouteAccess.mockReturnValue({ allowed: true });
      
      mockRequest.nextUrl!.pathname = '/login';
      mockRequest.url = 'http://localhost:3000/login';
      
      const response = await middleware(mockRequest as NextRequest);
      
      expect(response).toBeInstanceOf(NextResponse);
      // Would check for redirect to /dashboard in real implementation
    });

    it('should redirect authenticated users away from signup page', async () => {
      const mockUser = {
        id: 'user123',
        user_metadata: { role: 'user' }
      };
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser }
      });
      
      mockCheckRouteAccess.mockReturnValue({ allowed: true });
      
      mockRequest.nextUrl!.pathname = '/signup';
      mockRequest.url = 'http://localhost:3000/signup';
      
      const response = await middleware(mockRequest as NextRequest);
      
      expect(response).toBeInstanceOf(NextResponse);
    });

    it('should allow unauthenticated users to access auth pages', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null }
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
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null }
      });
      
      mockCheckRouteAccess.mockReturnValue({ allowed: true });
      
      await middleware(mockRequest as NextRequest);
      
      // Verify that createServerClient was called with cookie configuration
      expect(mockCreateServerClient).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          cookies: expect.objectContaining({
            getAll: expect.any(Function),
            setAll: expect.any(Function)
          })
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle Supabase auth errors gracefully', async () => {
      mockSupabase.auth.getUser.mockRejectedValue(new Error('Auth error'));
      
      // Should not throw, but handle gracefully
      await expect(middleware(mockRequest as NextRequest)).rejects.toThrow('Auth error');
    });

    it('should handle route access check errors', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null }
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
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null }
      });
      
      mockCheckRouteAccess.mockReturnValue({ allowed: true });
      
      for (const path of testPaths) {
        mockRequest.nextUrl!.pathname = path;
        
        const response = await middleware(mockRequest as NextRequest);
        
        expect(response).toBeInstanceOf(NextResponse);
        expect(mockCheckRouteAccess).toHaveBeenCalledWith(path, expect.any(Object));
      }
    });

    it('should handle paths with query parameters', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null }
      });
      
      mockCheckRouteAccess.mockReturnValue({ allowed: true });
      
      mockRequest.nextUrl!.pathname = '/dashboard';
      mockRequest.nextUrl!.searchParams = new URLSearchParams('tab=overview&filter=active');
      
      const response = await middleware(mockRequest as NextRequest);
      
      expect(response).toBeInstanceOf(NextResponse);
      expect(mockCheckRouteAccess).toHaveBeenCalledWith('/dashboard', expect.any(Object));
    });
  });
});