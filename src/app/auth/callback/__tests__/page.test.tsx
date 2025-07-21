/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthCallbackPage from '../page';
import { createClient } from '@/lib/supabase/client';
import * as windowCloseUtils from '@/lib/utils/window-close';

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn()
}));
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

// Mock window close utilities
jest.mock('@/lib/utils/window-close');
const mockCloseWindow = windowCloseUtils.closeWindow as jest.MockedFunction<typeof windowCloseUtils.closeWindow>;
const mockNotifyParentWindow = windowCloseUtils.notifyParentWindow as jest.MockedFunction<typeof windowCloseUtils.notifyParentWindow>;
const mockCleanupBeforeClose = windowCloseUtils.cleanupBeforeClose as jest.MockedFunction<typeof windowCloseUtils.cleanupBeforeClose>;

// Mock window methods
const mockWindowClose = jest.fn();
const mockWindowReload = jest.fn();

Object.defineProperty(window, 'close', {
  value: mockWindowClose,
  writable: true
});

// Mock window.location.reload
Object.defineProperty(window, 'location', {
  value: {
    ...window.location,
    reload: mockWindowReload,
  },
  writable: true,
});

describe('AuthCallbackPage Integration Tests', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup mock Supabase client with proper method chaining
    const mockSingle = jest.fn();
    const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

    mockSupabase = {
      auth: {
        getSession: jest.fn(),
        signOut: jest.fn()
      },
      from: mockFrom,
      rpc: jest.fn(),
      // Store references for easier access in tests
      _mockSingle: mockSingle,
      _mockEq: mockEq,
      _mockSelect: mockSelect,
      _mockFrom: mockFrom
    };

    mockCreateClient.mockReturnValue(mockSupabase);
    mockNotifyParentWindow.mockReturnValue(true);
    mockCleanupBeforeClose.mockImplementation(() => { });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Successful Email Verification Flow', () => {
    it('should complete email verification and attempt window close', async () => {
      // Setup successful verification scenario
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        email_confirmed_at: '2023-01-01T00:00:00Z',
        user_metadata: {
          fullName: 'Test User',
          department: 'Engineering'
        }
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      mockSupabase._mockSingle.mockResolvedValue({
        data: { id: 'db-user-123' },
        error: null
      });

      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      mockCloseWindow.mockResolvedValue({
        success: true,
        method: 'auto',
        windowClosed: true
      });

      render(<AuthCallbackPage />);

      // Should show loading initially
      expect(screen.getByText('이메일 인증을 처리하고 있습니다...')).toBeInTheDocument();

      // Wait for processing to complete
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(screen.getByText('이메일 인증이 완료되었습니다! 이제 로그인할 수 있습니다.')).toBeInTheDocument();
      });

      // Should attempt window close after success
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(mockCloseWindow).toHaveBeenCalledWith({
          delay: 1500,
          maxRetries: 3,
          retryInterval: 500
        });
      });

      // Should notify parent window
      expect(mockNotifyParentWindow).toHaveBeenCalledWith({
        type: 'EMAIL_VERIFICATION_COMPLETE',
        success: true,
        timestamp: expect.any(String)
      });
    });

    it('should handle window close failure gracefully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        email_confirmed_at: '2023-01-01T00:00:00Z',
        user_metadata: {
          fullName: 'Test User',
          department: 'Engineering'
        }
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      mockSupabase._mockSingle.mockResolvedValue({
        data: { id: 'db-user-123' },
        error: null
      });

      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      // Mock window close failure
      mockCloseWindow.mockResolvedValue({
        success: false,
        method: 'failed',
        error: 'Cannot close window: Not opened by script',
        windowClosed: false
      });

      render(<AuthCallbackPage />);

      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(screen.getByText(/자동으로 창을 닫을 수 없습니다/)).toBeInTheDocument();
      });

      // Should show manual close button
      const manualCloseButton = screen.getByText('수동으로 창 닫기');
      expect(manualCloseButton).toBeInTheDocument();

      // Test manual close
      await userEvent.click(manualCloseButton);
      expect(mockCleanupBeforeClose).toHaveBeenCalled();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle session error', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session error', code: 'SESSION_ERROR' }
      });

      render(<AuthCallbackPage />);

      await waitFor(() => {
        expect(screen.getByText(/인증 세션 처리 중 오류가 발생했습니다/)).toBeInTheDocument();
      });

      expect(mockNotifyParentWindow).toHaveBeenCalledWith({
        type: 'EMAIL_VERIFICATION_ERROR',
        error: 'Session error',
        errorType: expect.any(String),
        timestamp: expect.any(String)
      });
    });

    it('should handle unconfirmed email', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        email_confirmed_at: null, // Not confirmed
        user_metadata: {
          fullName: 'Test User',
          department: 'Engineering'
        }
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      render(<AuthCallbackPage />);

      await waitFor(() => {
        expect(screen.getByText('이메일 인증이 아직 완료되지 않았습니다.')).toBeInTheDocument();
      });

      expect(mockNotifyParentWindow).toHaveBeenCalledWith({
        type: 'EMAIL_VERIFICATION_INCOMPLETE',
        timestamp: expect.any(String)
      });
    });

    it('should handle missing user session', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      render(<AuthCallbackPage />);

      await waitFor(() => {
        expect(screen.getByText('인증 세션을 찾을 수 없습니다.')).toBeInTheDocument();
      });

      expect(mockNotifyParentWindow).toHaveBeenCalledWith({
        type: 'EMAIL_VERIFICATION_NO_SESSION',
        timestamp: expect.any(String)
      });
    });
  });

  describe('User Interactions', () => {
    it('should allow manual retry on error', async () => {
      mockSupabase.auth.getSession.mockRejectedValue(new Error('Network error'));

      render(<AuthCallbackPage />);

      await waitFor(() => {
        expect(screen.getByText(/인증 처리 중 예상치 못한 오류가 발생했습니다/)).toBeInTheDocument();
      });

      const retryButton = screen.getByText('다시 시도');
      expect(retryButton).toBeInTheDocument();

      await userEvent.click(retryButton);
      expect(mockWindowReload).toHaveBeenCalled();
    });

    it('should provide manual close option on error', async () => {
      mockSupabase.auth.getSession.mockRejectedValue(new Error('Network error'));

      render(<AuthCallbackPage />);

      await waitFor(() => {
        expect(screen.getByText('창 닫기')).toBeInTheDocument();
      });

      const closeButton = screen.getByText('창 닫기');
      await userEvent.click(closeButton);

      expect(mockCleanupBeforeClose).toHaveBeenCalled();
    });
  });
});