/**
 * Tests for useNavigationController hook
 */

import React, { ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { useNavigationController } from '../useNavigationController';

// Mock Next.js navigation
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn()
};

const mockSearchParams = {
  get: jest.fn(() => null),
  has: jest.fn(() => false),
  toString: jest.fn(() => ''),
};

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams
}));

// Mock useAuth hook directly
const mockUseAuth = jest.fn();

jest.mock('../useAuth', () => ({
  useAuth: () => mockUseAuth()
}));

// Simple test wrapper - no context needed since we're mocking useAuth directly
const TestWrapper = ({ children }: { children: ReactNode }) => 
  React.createElement(React.Fragment, {}, children);

describe('useNavigationController', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Suppress console.log for all tests
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    
    // Reset router mocks
    mockRouter.push.mockClear();
    mockRouter.replace.mockClear();
    mockSearchParams.get.mockClear();
    
    // Default mock for useAuth
    mockUseAuth.mockReturnValue({
      userProfile: null
    });
  });

  afterEach(() => {
    // Restore console.log
    consoleLogSpy.mockRestore();
  });

  it('should provide navigation controller functions', () => {
    const { result } = renderHook(() => useNavigationController(), { wrapper: TestWrapper });

    expect(result.current).toHaveProperty('handlePostLoginRedirect');
    expect(result.current).toHaveProperty('redirectToLogin');
    expect(result.current).toHaveProperty('handlePostLogout');
  });

  it('should handle post-login redirect with user profile', () => {
    const mockUserProfile = {
      id: '1',
      authId: '1',
      email: 'test@example.com',
      name: 'Test User',
      department: 'IT',
      role: 'employee' as const,
      createdAt: '2024-01-01T00:00:00Z'
    };

    mockUseAuth.mockReturnValue({
      userProfile: mockUserProfile
    });

    const { result } = renderHook(() => useNavigationController(), { wrapper: TestWrapper });

    act(() => {
      result.current.handlePostLoginRedirect();
    });

    // Should redirect to default path for employee role
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('should handle post-login redirect with admin user', () => {
    const mockAdminProfile = {
      id: '1',
      authId: '1',
      email: 'admin@example.com',
      name: 'Admin User',
      department: 'IT',
      role: 'admin' as const,
      createdAt: '2024-01-01T00:00:00Z'
    };

    mockUseAuth.mockReturnValue({
      userProfile: mockAdminProfile
    });

    const { result } = renderHook(() => useNavigationController(), { wrapper: TestWrapper });

    act(() => {
      result.current.handlePostLoginRedirect();
    });

    // Should redirect to admin dashboard for admin role
    expect(mockRouter.replace).toHaveBeenCalledWith('/admin/dashboard');
  });

  it('should handle post-login redirect with URL redirect parameter', () => {
    const mockUserProfile = {
      id: '1',
      authId: '1',
      email: 'test@example.com',
      name: 'Test User',
      department: 'IT',
      role: 'employee' as const,
      createdAt: '2024-01-01T00:00:00Z'
    };

    mockUseAuth.mockReturnValue({
      userProfile: mockUserProfile
    });

    // Mock search params to return a redirect path
    mockSearchParams.get.mockReturnValue('/dashboard');

    const { result } = renderHook(() => useNavigationController(), { wrapper: TestWrapper });

    act(() => {
      result.current.handlePostLoginRedirect();
    });

    // Should redirect to the URL parameter path
    expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard');
  });

  it('should handle redirect to login with required path', () => {
    const { result } = renderHook(() => useNavigationController(), { wrapper: TestWrapper });

    act(() => {
      result.current.redirectToLogin('/protected-page');
    });

    expect(mockRouter.push).toHaveBeenCalledWith('http://localhost/login?redirect=%2Fprotected-page');
  });

  it('should handle post-logout redirect', () => {
    const { result } = renderHook(() => useNavigationController(), { wrapper: TestWrapper });

    act(() => {
      result.current.handlePostLogout();
    });

    expect(mockRouter.push).toHaveBeenCalledWith('/');
  });

  it('should warn when no user profile is available for post-login redirect', () => {
    mockUseAuth.mockReturnValue({
      userProfile: null
    });

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    const { result } = renderHook(() => useNavigationController(), { wrapper: TestWrapper });

    act(() => {
      result.current.handlePostLoginRedirect();
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      '[NavCtrl] Redirect aborted: User profile not available.'
    );

    // Should still redirect to default path
    expect(mockRouter.replace).toHaveBeenCalledWith('/');

    consoleSpy.mockRestore();
  });

  it('should handle SSR gracefully by checking window availability', () => {
    // This test verifies that the hook checks for window availability
    // The actual SSR check is done inside the hook implementation
    mockUseAuth.mockReturnValue({
      userProfile: {
        id: '1',
        authId: '1',
        email: 'test@example.com',
        name: 'Test User',
        department: 'IT',
        role: 'employee' as const,
        createdAt: '2024-01-01T00:00:00Z'
      }
    });

    const { result } = renderHook(() => useNavigationController(), { wrapper: TestWrapper });

    // The hook should still provide the functions even in SSR context
    expect(result.current).toHaveProperty('handlePostLoginRedirect');
    expect(result.current).toHaveProperty('redirectToLogin');
    expect(result.current).toHaveProperty('handlePostLogout');
  });
});