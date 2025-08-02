import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import SmartVerifiedPage from '@/components/auth/SmartVerifiedPage';
import { UniversalAuthStateManager } from '@/lib/auth/universal-auth-state-manager';

// Mock the UniversalAuthStateManager
jest.mock('@/lib/auth/universal-auth-state-manager');

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: {
          session: {
            user: { id: 'test-user-id' },
            access_token: 'test-token'
          }
        }
      })
    }
  }))
}));

// Mock window.close
Object.defineProperty(window, 'close', {
  value: jest.fn(),
  writable: true
});

describe('SmartVerifiedPage', () => {
  let mockAuthStateManager: jest.Mocked<UniversalAuthStateManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockAuthStateManager = {
      setAuthState: jest.fn(),
      getAuthState: jest.fn(),
      clearAuthState: jest.fn(),
      onStateChange: jest.fn()
    } as any;
    
    (UniversalAuthStateManager as jest.Mock).mockImplementation(() => mockAuthStateManager);
    (UniversalAuthStateManager.getInstance as jest.Mock) = jest.fn(() => mockAuthStateManager);
    
    // Reset Supabase client mock to default successful state
    const { createClient } = require('@/lib/supabase/client');
    createClient.mockReturnValue({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: 'test-user-id' },
              access_token: 'test-token'
            }
          }
        })
      }
    });
    
    // Suppress console.log for all tests to keep output clean
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    // Restore all console methods
    jest.restoreAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders authentication complete message', async () => {
      await act(async () => {
        render(<SmartVerifiedPage />);
      });
      
      expect(screen.getByText('인증 완료!')).toBeInTheDocument();
      
      // Wait for auth state to be set
      await waitFor(() => {
        expect(screen.getByText(/\d+초 후 자동으로 창이 닫힙니다/)).toBeInTheDocument();
      });
    });

    it('shows close window button', async () => {
      await act(async () => {
        render(<SmartVerifiedPage />);
      });
      
      expect(screen.getByText('창 닫기')).toBeInTheDocument();
    });

    it('shows loading message initially', async () => {
      // Mock the Supabase client to return no session initially
      const { createClient } = require('@/lib/supabase/client');
      createClient.mockReturnValue({
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: null },
            error: null
          })
        }
      });
      
      // Suppress expected warning for this test
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      await act(async () => {
        render(<SmartVerifiedPage />);
      });
      
      // Initially should show loading message
      expect(screen.getByText('인증 상태를 설정하는 중입니다...')).toBeInTheDocument();
      
      // Restore console.warn
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Auto Close Functionality', () => {
    it('starts countdown and closes window after delay', async () => {
      await act(async () => {
        render(<SmartVerifiedPage autoCloseDelay={3000} />);
      });
      
      // Wait for auth state to be set first
      await waitFor(() => {
        expect(screen.getByText(/3초 후 자동으로 창이 닫힙니다/)).toBeInTheDocument();
      });
      
      // Advance timer by 1 second
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(screen.getByText(/2초 후 자동으로 창이 닫힙니다/)).toBeInTheDocument();
      
      // Advance timer by 1 more second
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(screen.getByText(/1초 후 자동으로 창이 닫힙니다/)).toBeInTheDocument();
      
      // Advance timer by 1 more second to trigger window close
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(window.close).toHaveBeenCalled();
    });

    it('uses custom auto close delay', async () => {
      await act(async () => {
        render(<SmartVerifiedPage autoCloseDelay={1000} />);
      });
      
      // Wait for auth state to be set
      await waitFor(() => {
        expect(screen.getByText(/1초 후 자동으로 창이 닫힙니다/)).toBeInTheDocument();
      });
      
      // Advance timer by 1 second
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(window.close).toHaveBeenCalled();
    });

    it('calls onAuthStateSet callback on success', async () => {
      const mockCallback = jest.fn();
      await act(async () => {
        render(<SmartVerifiedPage onAuthStateSet={mockCallback} />);
      });
      
      await waitFor(() => {
        expect(mockCallback).toHaveBeenCalledWith(true);
      });
    });
  });

  describe('Manual Close', () => {
    it('handles close window button click', async () => {
      await act(async () => {
        render(<SmartVerifiedPage />);
      });
      
      const closeButton = screen.getByText('창 닫기');
      
      await act(async () => {
        fireEvent.click(closeButton);
      });
      
      expect(window.close).toHaveBeenCalled();
    });
  });

  describe('Auth State Management', () => {
    it('sets auth state on mount', async () => {
      await act(async () => {
        render(<SmartVerifiedPage />);
      });
      
      await waitFor(() => {
        expect(mockAuthStateManager.setAuthState).toHaveBeenCalledWith({
          status: 'authenticated',
          timestamp: expect.any(Number),
          userId: 'test-user-id',
          sessionToken: 'test-token',
          source: 'external_app'
        });
      });
    });

    it('handles auth state setting errors gracefully', async () => {
      mockAuthStateManager.setAuthState.mockImplementation(() => {
        throw new Error('Auth state error');
      });
      
      // Suppress expected error for this test
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const mockCallback = jest.fn();
      await act(async () => {
        render(<SmartVerifiedPage onAuthStateSet={mockCallback} />);
      });
      
      await waitFor(() => {
        expect(mockCallback).toHaveBeenCalledWith(false);
      });
      
      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('handles supabase client errors gracefully', async () => {
      // Mock Supabase client to throw error
      const { createClient } = require('@/lib/supabase/client');
      createClient.mockImplementation(() => {
        throw new Error('Supabase client error');
      });
      
      // Suppress expected error for this test
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const mockCallback = jest.fn();
      await act(async () => {
        render(<SmartVerifiedPage onAuthStateSet={mockCallback} />);
      });
      
      await waitFor(() => {
        expect(mockCallback).toHaveBeenCalledWith(false);
      });
      
      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Restore console.error
      consoleErrorSpy.mockRestore();
    });

    it('handles session retrieval errors gracefully', async () => {
      // Mock Supabase client to return error
      const { createClient } = require('@/lib/supabase/client');
      createClient.mockReturnValue({
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: null },
            error: new Error('Session error')
          })
        }
      });
      
      // Suppress expected warning for this test
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      const mockCallback = jest.fn();
      await act(async () => {
        render(<SmartVerifiedPage onAuthStateSet={mockCallback} />);
      });
      
      await waitFor(() => {
        expect(mockCallback).toHaveBeenCalledWith(false);
      });
      
      // Verify warning was logged
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      // Restore console.warn
      consoleWarnSpy.mockRestore();
    });
  });
});