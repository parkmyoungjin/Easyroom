/**
 * Tests for useNavigationController hook
 */

import { renderHook, act } from '@testing-library/react';
import { useNavigationController } from '../useNavigationController';
import { useAuth } from '../useAuth';
import { useToast } from '../use-toast';

// Mock dependencies
jest.mock('../useAuth', () => ({
  useAuth: jest.fn()
}));
jest.mock('../use-toast', () => ({
  useToast: jest.fn()
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn()
  })
}));

// Mock NavigationController
const mockNavigationController = {
  handlePostLoginRedirect: jest.fn(),
  handleAuthTimeout: jest.fn(),
  getRedirectPath: jest.fn(),
  clearRedirectState: jest.fn(),
  getNavigationState: jest.fn()
};

jest.mock('@/lib/navigation/NavigationController', () => ({
  getNavigationController: () => mockNavigationController
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;
const mockToast = jest.fn();

describe('useNavigationController', () => {
  const mockUserProfile = {
    id: '1',
    authId: '1',
    email: 'test@example.com',
    name: 'Test User',
    department: 'IT',
    role: 'employee' as const,
    createdAt: '2024-01-01T00:00:00Z'
  };

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      userProfile: mockUserProfile,
      user: null,
      loading: false,
      error: null,
      authStatus: 'authenticated',
      signIn: jest.fn(),
      signOut: jest.fn(),
      signUp: jest.fn(),
      updateProfile: jest.fn(),
      resendEmailConfirmation: jest.fn(),
      checkEmailConfirmation: jest.fn(),
      checkEmailExists: jest.fn(),
      signInWithEmployeeId: jest.fn(),
      signUpWithEmployeeId: jest.fn(),
      requireAuth: jest.fn(),
      hasPermission: jest.fn(),
      isAdmin: jest.fn(),
      isAuthenticated: jest.fn(() => true),
      isLoading: jest.fn(() => false),
      handlePostLoginRedirect: jest.fn(),
      redirectToLogin: jest.fn(),
      handlePostLogout: jest.fn()
    });

    mockUseToast.mockReturnValue({
      toast: mockToast,
      dismiss: jest.fn(),
      toasts: []
    });

    mockNavigationController.getNavigationState.mockReturnValue({
      isRedirecting: false,
      redirectPath: null,
      redirectReason: 'login',
      timestamp: 0
    });

    jest.clearAllMocks();
  });

  it('should provide navigation controller functions', () => {
    const { result } = renderHook(() => useNavigationController());

    expect(result.current).toHaveProperty('handlePostLoginRedirect');
    expect(result.current).toHaveProperty('handleAuthTimeout');
    expect(result.current).toHaveProperty('getRedirectPath');
    expect(result.current).toHaveProperty('clearRedirectState');
    expect(result.current).toHaveProperty('navigationState');
    expect(result.current).toHaveProperty('isRedirecting');
  });

  it('should handle post-login redirect successfully', async () => {
    mockNavigationController.handlePostLoginRedirect.mockResolvedValue(undefined);

    const { result } = renderHook(() => useNavigationController());

    await act(async () => {
      await result.current.handlePostLoginRedirect('/previous-path');
    });

    expect(mockNavigationController.handlePostLoginRedirect).toHaveBeenCalledWith({
      userProfile: mockUserProfile,
      previousPath: '/previous-path',
      fallbackPath: '/',
      timeout: 5000
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: '로그인 성공',
      description: '페이지를 이동하고 있습니다...'
    });
  });

  it('should handle post-login redirect failure', async () => {
    const error = new Error('Redirect failed');
    mockNavigationController.handlePostLoginRedirect.mockRejectedValue(error);
    mockNavigationController.getRedirectPath.mockReturnValue('/dashboard');

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true
    });

    const { result } = renderHook(() => useNavigationController());

    await act(async () => {
      await result.current.handlePostLoginRedirect('/previous-path');
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: '페이지 이동 실패',
      description: '자동 이동에 실패했습니다. 새로고침을 시도해주세요.',
      variant: 'destructive'
    });
  });

  it('should handle auth timeout', () => {
    const { result } = renderHook(() => useNavigationController());

    act(() => {
      result.current.handleAuthTimeout();
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: '인증 시간 초과',
      description: '로그인 페이지로 이동합니다.',
      variant: 'destructive'
    });

    expect(mockNavigationController.handleAuthTimeout).toHaveBeenCalled();
  });

  it('should get redirect path', () => {
    mockNavigationController.getRedirectPath.mockReturnValue('/dashboard');

    const { result } = renderHook(() => useNavigationController());

    const redirectPath = result.current.getRedirectPath(mockUserProfile, '/previous');

    expect(mockNavigationController.getRedirectPath).toHaveBeenCalledWith(
      mockUserProfile,
      '/previous'
    );
    expect(redirectPath).toBe('/dashboard');
  });

  it('should clear redirect state', () => {
    const { result } = renderHook(() => useNavigationController());

    act(() => {
      result.current.clearRedirectState();
    });

    expect(mockNavigationController.clearRedirectState).toHaveBeenCalled();
  });

  it('should update navigation state', () => {
    const mockState = {
      isRedirecting: true,
      redirectPath: '/dashboard',
      redirectReason: 'login' as const,
      timestamp: Date.now()
    };

    mockNavigationController.getNavigationState.mockReturnValue(mockState);

    const { result } = renderHook(() => useNavigationController());

    expect(result.current.navigationState).toEqual(mockState);
    expect(result.current.isRedirecting).toBe(true);
  });

  it('should warn when no user profile is available', async () => {
    mockUseAuth.mockReturnValue({
      userProfile: null,
      user: null,
      loading: false,
      error: null,
      authStatus: 'unauthenticated',
      signIn: jest.fn(),
      signOut: jest.fn(),
      signUp: jest.fn(),
      updateProfile: jest.fn(),
      resendEmailConfirmation: jest.fn(),
      checkEmailConfirmation: jest.fn(),
      checkEmailExists: jest.fn(),
      signInWithEmployeeId: jest.fn(),
      signUpWithEmployeeId: jest.fn(),
      requireAuth: jest.fn(),
      hasPermission: jest.fn(),
      isAdmin: jest.fn(),
      isAuthenticated: jest.fn(() => false),
      isLoading: jest.fn(() => false),
      handlePostLoginRedirect: jest.fn(),
      redirectToLogin: jest.fn(),
      handlePostLogout: jest.fn()
    });

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    const { result } = renderHook(() => useNavigationController());

    await act(async () => {
      await result.current.handlePostLoginRedirect('/previous-path');
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      '[useNavigationController] No user profile available for redirect'
    );

    expect(mockNavigationController.handlePostLoginRedirect).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useNavigationController());

    unmount();

    expect(mockNavigationController.clearRedirectState).toHaveBeenCalled();
  });
});