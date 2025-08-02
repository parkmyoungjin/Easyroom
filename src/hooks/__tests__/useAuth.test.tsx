import React, { ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { useAuth } from '../useAuth';

// STERILE FIELD PROTOCOL: Complete isolation of all external dependencies
jest.mock('@/contexts/AuthContext', () => ({
  useAuthContext: jest.fn(),
}));

jest.mock('@/contexts/SupabaseProvider', () => ({
  useSupabaseClient: jest.fn(),
}));

// Mock global objects
const mockWindowLocation = {
  origin: 'http://localhost'
};

Object.defineProperty(window, 'location', {
  value: mockWindowLocation,
  writable: true
});

// Mock fetch globally
global.fetch = jest.fn();

// Import mocked functions for type safety
import { useAuthContext } from '@/contexts/AuthContext';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';

const mockUseAuthContext = useAuthContext as jest.Mock;
const mockUseSupabaseClient = useSupabaseClient as jest.Mock;

// Sterile wrapper - no external providers needed
const SterileWrapper = ({ children }: { children: ReactNode }) => (
  <>{children}</>
);



describe('useAuth', () => {
  // STERILE FIELD: Complete mock setup for all dependencies
  const mockSupabaseClient = {
    auth: {
      signInWithOtp: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      verifyOtp: jest.fn(),
    },
  };

  const mockAuthContext = {
    user: null,
    userProfile: null,
    authStatus: 'loading' as const,
    error: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // COMPLETE STERILE FIELD: Suppress all console output from unit under test
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Reset all mocks to sterile state
    mockUseSupabaseClient.mockReturnValue(mockSupabaseClient);
    mockUseAuthContext.mockReturnValue(mockAuthContext);
    
    // Reset fetch mock
    (global.fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    // Restore console methods after each test
    jest.restoreAllMocks();
  });

  describe('Basic functionality', () => {
    it('should return correct initial state', () => {
      const { result } = renderHook(() => useAuth(), { wrapper: SterileWrapper });

      expect(result.current.user).toBeNull();
      expect(result.current.userProfile).toBeNull();
      expect(result.current.authStatus).toBe('loading');
      expect(result.current.loading).toBe(true);
      expect(result.current.isAuthenticated()).toBe(false);
      expect(result.current.isAdmin()).toBe(false);
    });

    it('should return authenticated state when user is logged in', () => {
      const authenticatedContext = {
        ...mockAuthContext,
        user: { id: 'user-123', email: 'test@example.com' },
        userProfile: { id: 'profile-123', role: 'employee' as const },
        authStatus: 'authenticated' as const,
      };
      
      mockUseAuthContext.mockReturnValue(authenticatedContext);

      const { result } = renderHook(() => useAuth(), { wrapper: SterileWrapper });

      expect(result.current.authStatus).toBe('authenticated');
      expect(result.current.isAuthenticated()).toBe(true);
      expect(result.current.loading).toBe(false);
    });

    it('should return admin status for admin users', () => {
      const adminContext = {
        ...mockAuthContext,
        user: { id: 'admin-123', email: 'admin@example.com' },
        userProfile: { id: 'admin-profile-123', role: 'admin' as const },
        authStatus: 'authenticated' as const,
      };
      
      mockUseAuthContext.mockReturnValue(adminContext);

      const { result } = renderHook(() => useAuth(), { wrapper: SterileWrapper });

      expect(result.current.isAdmin()).toBe(true);
    });
  });

  describe('signInWithMagicLink', () => {
    it('should send magic link successfully', async () => {
      mockSupabaseClient.auth.signInWithOtp.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth(), { wrapper: SterileWrapper });

      await act(async () => {
        await result.current.signInWithMagicLink('test@example.com');
      });

      expect(mockSupabaseClient.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        options: {
          emailRedirectTo: 'http://localhost/auth/callback',
          shouldCreateUser: false
        }
      });
    });

    it('should throw error when magic link fails', async () => {
      const error = new Error('Magic link failed');
      mockSupabaseClient.auth.signInWithOtp.mockResolvedValue({ error });

      const { result } = renderHook(() => useAuth(), { wrapper: SterileWrapper });

      await expect(
        act(async () => {
          await result.current.signInWithMagicLink('test@example.com');
        })
      ).rejects.toThrow('Magic link failed');
    });

    it('should throw error when supabase client is not available', async () => {
      mockUseSupabaseClient.mockReturnValue(null);

      const { result } = renderHook(() => useAuth(), { wrapper: SterileWrapper });

      await expect(
        act(async () => {
          await result.current.signInWithMagicLink('test@example.com');
        })
      ).rejects.toThrow('인증 서비스가 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    });
  });

  describe('signUpDirectly', () => {
    it('should sign up user successfully', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ exists: false })
      });

      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: null },
        error: null
      });

      mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth(), { wrapper: SterileWrapper });

      await act(async () => {
        const response = await result.current.signUpDirectly(
          'test@example.com',
          'Test User',
          'Engineering'
        );
        expect(response.user).toEqual(mockUser);
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' })
      });

      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: expect.any(String),
        options: {
          data: {
            fullName: 'Test User',
            department: 'Engineering',
            role: 'employee'
          },
          emailRedirectTo: 'http://localhost/auth/callback'
        }
      });

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
    });

    it('should handle signup error from Supabase', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ exists: false })
      });

      const error = new Error('User already registered');
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: null,
        error
      });

      const { result } = renderHook(() => useAuth(), { wrapper: SterileWrapper });

      await expect(
        act(async () => {
          await result.current.signUpDirectly(
            'test@example.com',
            'Test User',
            'Engineering'
          );
        })
      ).rejects.toThrow('이미 가입된 이메일입니다');
    });
  });

  describe('requestOTP', () => {
    it('should request OTP successfully', async () => {
      mockSupabaseClient.auth.signInWithOtp.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth(), { wrapper: SterileWrapper });

      await act(async () => {
        await result.current.requestOTP('test@example.com');
      });

      expect(mockSupabaseClient.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        options: {
          shouldCreateUser: false
        }
      });
    });

    it('should handle network offline error', async () => {
      const error = new Error('network error');
      mockSupabaseClient.auth.signInWithOtp.mockResolvedValue({ error });

      const { result } = renderHook(() => useAuth(), { wrapper: SterileWrapper });

      await expect(
        act(async () => {
          await result.current.requestOTP('test@example.com');
        })
      ).rejects.toThrow('network error');
    });

    it('should handle user not found error', async () => {
      const error = new Error('User not found');
      mockSupabaseClient.auth.signInWithOtp.mockResolvedValue({ error });

      const { result } = renderHook(() => useAuth(), { wrapper: SterileWrapper });

      await expect(
        act(async () => {
          await result.current.requestOTP('test@example.com');
        })
      ).rejects.toThrow('등록되지 않은 이메일입니다');
    });

    it('should handle rate limit error', async () => {
      const error = new Error('Email rate limit exceeded');
      mockSupabaseClient.auth.signInWithOtp.mockResolvedValue({ error });

      const { result } = renderHook(() => useAuth(), { wrapper: SterileWrapper });

      await expect(
        act(async () => {
          await result.current.requestOTP('test@example.com');
        })
      ).rejects.toThrow('너무 많은 요청이 발생했습니다');
    });
  });

  describe('verifyOTP', () => {
    it('should call supabase.auth.verifyOtp with correct parameters on success', async () => {
      const mockData = { user: { id: 'user-123' }, session: { access_token: 'abc' } };
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({ data: mockData, error: null });

      const { result } = renderHook(() => useAuth(), { wrapper: SterileWrapper });

      const response = await act(async () => {
        return await result.current.verifyOTP('test@example.com', '123456');
      });

      expect(mockSupabaseClient.auth.verifyOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        token: '123456',
        type: 'email',
      });
      expect(response).toEqual(mockData);
    });

    it('should throw the correct error message when OTP is invalid', async () => {
      const error = new Error('Invalid token');
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({ data: null, error });

      const { result } = renderHook(() => useAuth(), { wrapper: SterileWrapper });

      await expect(
        act(async () => {
          await result.current.verifyOTP('test@example.com', '654321');
        })
      ).rejects.toThrow('잘못된 OTP 코드이거나 만료된 코드입니다. 새로운 코드를 요청해주세요.');
    });

    it('should throw an error for an invalid OTP format (e.g., not 6 digits)', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: SterileWrapper });

      await expect(
        result.current.verifyOTP('test@example.com', '12345')
      ).rejects.toThrow('OTP 코드는 6자리 숫자여야 합니다.');
    });
  });

  describe('signOut', () => {
    it('should call supabase.auth.signOut successfully', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth(), { wrapper: SterileWrapper });

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalledTimes(1);
    });

    it('should throw an error when signOut fails', async () => {
      const signOutError = new Error('Sign out failed');
      mockSupabaseClient.auth.signOut.mockResolvedValue({ error: signOutError });

      const { result } = renderHook(() => useAuth(), { wrapper: SterileWrapper });

      await expect(
        act(async () => {
          await result.current.signOut();
        })
      ).rejects.toThrow('Sign out failed');
    });
  });

  describe('resendMagicLink', () => {
    it('should resend magic link successfully', async () => {
      mockSupabaseClient.auth.signInWithOtp.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth(), { wrapper: SterileWrapper });

      await act(async () => {
        await result.current.resendMagicLink('test@example.com');
      });

      expect(mockSupabaseClient.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        options: {
          emailRedirectTo: 'http://localhost/auth/callback',
          shouldCreateUser: false
        }
      });
    });

    it('should handle resend error', async () => {
      const error = new Error('Resend failed');
      mockSupabaseClient.auth.signInWithOtp.mockResolvedValue({ error });

      const { result } = renderHook(() => useAuth(), { wrapper: SterileWrapper });

      await expect(
        act(async () => {
          await result.current.resendMagicLink('test@example.com');
        })
      ).rejects.toThrow('Resend failed');
    });
  });
});