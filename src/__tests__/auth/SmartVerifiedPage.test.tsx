import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import SmartVerifiedPage from '@/components/auth/SmartVerifiedPage';
import { UniversalAuthStateManager } from '@/lib/auth/universal-auth-state-manager';

// Mock the UniversalAuthStateManager
jest.mock('@/lib/auth/universal-auth-state-manager');

// Mock window.location
const mockLocation = {
  href: '',
  assign: jest.fn(),
  replace: jest.fn()
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
});

// Mock window.close
Object.defineProperty(window, 'close', {
  value: jest.fn(),
  writable: true
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
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
    
    mockLocation.href = '';
    localStorageMock.getItem.mockReturnValue('[]');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('renders authentication complete message', () => {
      render(<SmartVerifiedPage />);
      
      expect(screen.getByText('Authentication Complete!')).toBeInTheDocument();
      expect(screen.getByText(/Redirecting to app in \d+ seconds/)).toBeInTheDocument();
    });

    it('shows manual return button by default', () => {
      render(<SmartVerifiedPage />);
      
      expect(screen.getByText('Return to App')).toBeInTheDocument();
    });

    it('shows close window button', () => {
      render(<SmartVerifiedPage />);
      
      expect(screen.getByText('Close Window')).toBeInTheDocument();
    });

    it('hides manual button when showManualButton is false', () => {
      render(<SmartVerifiedPage showManualButton={false} />);
      
      expect(screen.queryByText('Return to App')).not.toBeInTheDocument();
    });
  });

  describe('Automatic Redirection', () => {
    it('starts countdown and redirects after delay', async () => {
      render(<SmartVerifiedPage autoRedirectDelay={3000} />);
      
      // Initial countdown
      expect(screen.getByText('Redirecting to app in 3 seconds...')).toBeInTheDocument();
      
      // Advance timer by 1 second
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(screen.getByText('Redirecting to app in 2 seconds...')).toBeInTheDocument();
      
      // Advance timer by 2 more seconds to trigger redirect
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      
      // Wait for the redirect attempt to complete
      await waitFor(() => {
        expect(mockAuthStateManager.setAuthState).toHaveBeenCalledWith({
          status: 'authenticated',
          timestamp: expect.any(Number),
          source: 'external_app'
        });
      });
      
      expect(mockLocation.href).toBe('/');
    });

    it('uses custom return URL for redirection', async () => {
      render(<SmartVerifiedPage autoRedirectDelay={1000} returnUrl="/dashboard" />);
      
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(mockLocation.href).toBe('/dashboard');
    });

    it('calls onRedirectAttempt callback', async () => {
      const mockCallback = jest.fn();
      render(<SmartVerifiedPage autoRedirectDelay={1000} onRedirectAttempt={mockCallback} />);
      
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      // Wait for timeout to trigger fallback
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(mockCallback).toHaveBeenCalledWith(false);
    });
  });

  describe('Manual Return', () => {
    it('handles manual return button click', () => {
      render(<SmartVerifiedPage />);
      
      const returnButton = screen.getByText('Return to App');
      fireEvent.click(returnButton);
      
      expect(mockAuthStateManager.setAuthState).toHaveBeenCalledWith({
        status: 'authenticated',
        timestamp: expect.any(Number),
        source: 'external_app'
      });
      
      expect(mockLocation.href).toBe('/');
    });

    it('uses custom return URL for manual return', () => {
      render(<SmartVerifiedPage returnUrl="/custom" />);
      
      const returnButton = screen.getByText('Return to App');
      fireEvent.click(returnButton);
      
      expect(mockLocation.href).toBe('/custom');
    });

    it('handles close window button click', () => {
      render(<SmartVerifiedPage />);
      
      const closeButton = screen.getByText('Close Window');
      fireEvent.click(closeButton);
      
      expect(window.close).toHaveBeenCalled();
    });
  });

  describe('Fallback Mechanisms', () => {
    it('shows fallback message when redirection fails', async () => {
      render(<SmartVerifiedPage autoRedirectDelay={1000} />);
      
      // Trigger automatic redirection
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      // Wait for fallback timeout
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Automatic redirect failed/)).toBeInTheDocument();
      });
      
      // Manual button should be highlighted
      const returnButton = screen.getByText('Return to App');
      expect(returnButton).toHaveClass('bg-primary'); // Default variant styling
    });

    it('shows fallback after auto-redirect delay plus buffer', async () => {
      render(<SmartVerifiedPage autoRedirectDelay={2000} />);
      
      // Advance past auto-redirect delay
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      
      // Advance past fallback buffer (1000ms)
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Automatic redirect failed/)).toBeInTheDocument();
      });
    });
  });

  describe('Logging', () => {
    it('logs redirection attempts to localStorage', () => {
      render(<SmartVerifiedPage />);
      
      const returnButton = screen.getByText('Return to App');
      fireEvent.click(returnButton);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'easyroom_redirection_logs',
        expect.stringContaining('"method":"manual"')
      );
    });

    it('logs automatic redirection attempts', async () => {
      render(<SmartVerifiedPage autoRedirectDelay={1000} />);
      
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      // Wait for timeout to trigger logging
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'easyroom_redirection_logs',
        expect.stringContaining('"method":"automatic"')
      );
    });

    it('handles localStorage errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      render(<SmartVerifiedPage />);
      
      const returnButton = screen.getByText('Return to App');
      
      // Should not throw error
      expect(() => {
        fireEvent.click(returnButton);
      }).not.toThrow();
    });

    it('maintains log size limit', () => {
      // Mock existing logs
      const existingLogs = Array(15).fill(0).map((_, i) => ({ id: i }));
      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingLogs));
      
      render(<SmartVerifiedPage />);
      
      const returnButton = screen.getByText('Return to App');
      fireEvent.click(returnButton);
      
      // Should trim to 10 logs
      const setItemCall = localStorageMock.setItem.mock.calls.find(
        call => call[0] === 'easyroom_redirection_logs'
      );
      
      if (setItemCall) {
        const savedLogs = JSON.parse(setItemCall[1]);
        expect(savedLogs.length).toBeLessThanOrEqual(10);
      }
    });
  });

  describe('Error Handling', () => {
    it('handles auth state manager errors gracefully', () => {
      mockAuthStateManager.setAuthState.mockImplementation(() => {
        throw new Error('Auth state error');
      });
      
      render(<SmartVerifiedPage />);
      
      const returnButton = screen.getByText('Return to App');
      
      // Should not crash the component
      expect(() => {
        fireEvent.click(returnButton);
      }).not.toThrow();
    });

    it('handles window.location assignment errors', () => {
      Object.defineProperty(window, 'location', {
        value: {
          href: {
            set: () => {
              throw new Error('Navigation blocked');
            }
          }
        },
        writable: true
      });
      
      render(<SmartVerifiedPage />);
      
      const returnButton = screen.getByText('Return to App');
      
      expect(() => {
        fireEvent.click(returnButton);
      }).not.toThrow();
    });
  });

  describe('Component State Management', () => {
    it('prevents multiple redirect attempts', async () => {
      render(<SmartVerifiedPage autoRedirectDelay={1000} />);
      
      // Trigger first redirect
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      const firstCallCount = mockAuthStateManager.setAuthState.mock.calls.length;
      
      // Try to trigger again (should be prevented)
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(mockAuthStateManager.setAuthState.mock.calls.length).toBe(firstCallCount);
    });

    it('updates state correctly through the flow', async () => {
      render(<SmartVerifiedPage autoRedirectDelay={1000} />);
      
      // Initial state - countdown visible
      expect(screen.getByText('Redirecting to app in 1 seconds...')).toBeInTheDocument();
      
      // After redirect attempt
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(screen.getByText('Redirecting to app...')).toBeInTheDocument();
      
      // After fallback timeout
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Automatic redirect failed/)).toBeInTheDocument();
      });
    });
  });
});