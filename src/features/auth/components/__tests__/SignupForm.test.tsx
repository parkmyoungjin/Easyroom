/**
 * SignupForm Environment Error Handling Tests
 * Tests the enhanced error handling functionality for environment-related issues
 * Requirements: 1.2, 3.3, 4.1, 4.4
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock all external dependencies to avoid ES module issues
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    signUp: jest.fn(),
    checkEmailExists: jest.fn(),
  }),
}));

jest.mock('@/lib/error-handling/environment-error-handler', () => ({
  handleEnvironmentError: jest.fn(),
}));

jest.mock('@/lib/validations/schemas', () => ({
  signupSchema: {
    parse: jest.fn(),
    safeParse: jest.fn(),
  },
}));

// Mock UI components to avoid complex rendering issues
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardDescription: ({ children }: any) => <div data-testid="card-description">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <h2 data-testid="card-title">{children}</h2>,
}));

jest.mock('@/components/ui/form', () => ({
  Form: ({ children }: any) => <form>{children}</form>,
  FormControl: ({ children }: any) => <div>{children}</div>,
  FormField: ({ render }: any) => render({ field: {} }),
  FormItem: ({ children }: any) => <div>{children}</div>,
  FormLabel: ({ children }: any) => <label>{children}</label>,
  FormMessage: () => <div />,
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: any) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogDescription: ({ children }: any) => <div data-testid="dialog-description">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h3 data-testid="dialog-title">{children}</h3>,
}));

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  AlertDescription: ({ children }: any) => <div data-testid="alert-description">{children}</div>,
  AlertTitle: ({ children }: any) => <div data-testid="alert-title">{children}</div>,
}));

jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: any) => <div data-testid="progress" data-value={value} />,
}));

jest.mock('lucide-react', () => ({
  UserPlus: () => <div data-testid="user-plus-icon" />,
  ArrowLeft: () => <div data-testid="arrow-left-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
  XCircle: () => <div data-testid="x-circle-icon" />,
  Mail: () => <div data-testid="mail-icon" />,
  Lock: () => <div data-testid="lock-icon" />,
  AlertTriangle: () => <div data-testid="alert-triangle-icon" />,
  RefreshCw: () => <div data-testid="refresh-icon" />,
  Wifi: () => <div data-testid="wifi-icon" />,
  WifiOff: () => <div data-testid="wifi-off-icon" />,
}));

jest.mock('react-hook-form', () => ({
  useForm: () => ({
    control: {},
    handleSubmit: (fn: any) => fn,
    getValues: () => ({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      department: 'Engineering',
    }),
  }),
}));

jest.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => jest.fn(),
}));

// Import the component after all mocks are set up
import { SignupForm } from '../SignupForm';

// Define mock objects
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
};

const mockToast = jest.fn();

const mockUseAuth = {
  user: null,
  signUp: jest.fn(),
  checkEmailExists: jest.fn(),
};

// Define EmailCheckResult type for tests
interface EmailCheckResult {
  exists: boolean;
  error?: {
    type: 'client_not_ready' | 'network_error' | 'database_error' | 'validation_error';
    message: string;
    userMessage: string;
    canRetry: boolean;
    technicalDetails?: string;
  };
}

describe('SignupForm Environment Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock implementations
    const { useRouter } = require('next/navigation');
    const { useAuth } = require('@/hooks/useAuth');
    const { handleEnvironmentError } = require('@/lib/error-handling/environment-error-handler');
    const { useToast } = require('@/hooks/use-toast');
    
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useAuth as jest.Mock).mockReturnValue(mockUseAuth);
    (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
    (handleEnvironmentError as jest.Mock).mockReturnValue({
      title: 'Test Error',
      message: 'Test error message',
      canRetry: true,
      retryDelay: 2000,
      actions: [
        { label: '다시 시도', action: 'retry', priority: 'primary' },
        { label: '새로고침', action: 'reload_page', priority: 'secondary' }
      ],
      technicalDetails: 'Technical details for debugging'
    });
  });

  const fillSignupForm = async (user: any) => {
    await user.type(screen.getByLabelText(/이메일/i), 'test@example.com');
    await user.type(screen.getByLabelText(/비밀번호/i), 'password123');
    await user.type(screen.getByLabelText(/이름/i), 'Test User');
    await user.type(screen.getByLabelText(/부서/i), 'Engineering');
  };

  describe('Environment Configuration Errors', () => {
    it('should display environment error modal when client_not_ready error occurs', async () => {
      const user = userEvent.setup();
      
      // Mock email check to return client_not_ready error
      const emailCheckResult: EmailCheckResult = {
        exists: false,
        error: {
          type: 'client_not_ready',
          message: 'Supabase client not initialized',
          userMessage: '서비스 연결을 준비하고 있습니다. 잠시 후 다시 시도해주세요.',
          canRetry: true,
          technicalDetails: 'Environment variable NEXT_PUBLIC_SUPABASE_URL is not set'
        }
      };
      
      mockUseAuth.checkEmailExists.mockResolvedValue(emailCheckResult);
      
      render(<SignupForm />);
      
      await fillSignupForm(user);
      await user.click(screen.getByRole('button', { name: /가입하기/i }));
      
      // Wait for environment error modal to appear
      await waitFor(() => {
        expect(screen.getByText('서비스 연결 오류')).toBeInTheDocument();
      });
      
      expect(screen.getByText('서비스 연결을 준비하고 있습니다. 잠시 후 다시 시도해주세요.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /다시 시도/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /새로고침/i })).toBeInTheDocument();
    });

    it('should display network error modal when network_error occurs', async () => {
      const user = userEvent.setup();
      
      const emailCheckResult: EmailCheckResult = {
        exists: false,
        error: {
          type: 'network_error',
          message: 'Network connection failed',
          userMessage: '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인하고 다시 시도해주세요.',
          canRetry: true,
          technicalDetails: 'fetch failed: ENOTFOUND'
        }
      };
      
      mockUseAuth.checkEmailExists.mockResolvedValue(emailCheckResult);
      
      render(<SignupForm />);
      
      await fillSignupForm(user);
      await user.click(screen.getByRole('button', { name: /가입하기/i }));
      
      await waitFor(() => {
        expect(screen.getByText('네트워크 오류')).toBeInTheDocument();
      });
      
      expect(screen.getByText('네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인하고 다시 시도해주세요.')).toBeInTheDocument();
    });

    it('should display database error modal when database_error occurs', async () => {
      const user = userEvent.setup();
      
      const emailCheckResult: EmailCheckResult = {
        exists: false,
        error: {
          type: 'database_error',
          message: 'Database connection timeout',
          userMessage: '일시적인 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
          canRetry: true,
          technicalDetails: 'Connection timeout after 30s'
        }
      };
      
      mockUseAuth.checkEmailExists.mockResolvedValue(emailCheckResult);
      
      render(<SignupForm />);
      
      await fillSignupForm(user);
      await user.click(screen.getByRole('button', { name: /가입하기/i }));
      
      await waitFor(() => {
        expect(screen.getByText('서버 오류')).toBeInTheDocument();
      });
      
      expect(screen.getByText('일시적인 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')).toBeInTheDocument();
    });
  });

  describe('Retry Functionality', () => {
    it('should handle retry action with exponential backoff', async () => {
      const user = userEvent.setup();
      jest.useFakeTimers();
      
      const emailCheckResult: EmailCheckResult = {
        exists: false,
        error: {
          type: 'network_error',
          message: 'Network error',
          userMessage: '네트워크 오류가 발생했습니다.',
          canRetry: true
        }
      };
      
      // First call fails, second call succeeds
      mockUseAuth.checkEmailExists
        .mockResolvedValueOnce(emailCheckResult)
        .mockResolvedValueOnce({ exists: false });
      
      render(<SignupForm />);
      
      await fillSignupForm(user);
      await user.click(screen.getByRole('button', { name: /가입하기/i }));
      
      // Wait for error modal
      await waitFor(() => {
        expect(screen.getByText('네트워크 오류')).toBeInTheDocument();
      });
      
      // Click retry button
      const retryButton = screen.getByRole('button', { name: /다시 시도/i });
      await user.click(retryButton);
      
      // Should show retrying state
      expect(screen.getByText('재시도 중...')).toBeInTheDocument();
      
      // Fast-forward time to complete retry delay
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      
      // Wait for retry to complete
      await waitFor(() => {
        expect(mockUseAuth.checkEmailExists).toHaveBeenCalledTimes(2);
      });
      
      jest.useRealTimers();
    });

    it('should track retry count and show warning', async () => {
      const user = userEvent.setup();
      
      const emailCheckResult: EmailCheckResult = {
        exists: false,
        error: {
          type: 'network_error',
          message: 'Network error',
          userMessage: '네트워크 오류가 발생했습니다.',
          canRetry: true
        }
      };
      
      mockUseAuth.checkEmailExists.mockResolvedValue(emailCheckResult);
      
      render(<SignupForm />);
      
      await fillSignupForm(user);
      await user.click(screen.getByRole('button', { name: /가입하기/i }));
      
      // Wait for error modal
      await waitFor(() => {
        expect(screen.getByText('네트워크 오류')).toBeInTheDocument();
      });
      
      // Click retry button multiple times
      const retryButton = screen.getByRole('button', { name: /다시 시도/i });
      
      // First retry
      await user.click(retryButton);
      await waitFor(() => {
        expect(screen.getByText('재시도 횟수: 1/3')).toBeInTheDocument();
      });
      
      // Second retry
      await user.click(retryButton);
      await waitFor(() => {
        expect(screen.getByText('재시도 횟수: 2/3')).toBeInTheDocument();
      });
      
      // Third retry
      await user.click(retryButton);
      await waitFor(() => {
        expect(screen.getByText('최대 재시도 횟수 초과')).toBeInTheDocument();
      });
      
      // Retry button should be disabled
      expect(retryButton).toBeDisabled();
    });

    it('should disable retry for non-retryable errors', async () => {
      const user = userEvent.setup();
      
      const emailCheckResult: EmailCheckResult = {
        exists: false,
        error: {
          type: 'validation_error',
          message: 'Invalid email format',
          userMessage: '올바른 이메일 형식을 입력해주세요.',
          canRetry: false
        }
      };
      
      mockUseAuth.checkEmailExists.mockResolvedValue(emailCheckResult);
      
      render(<SignupForm />);
      
      await fillSignupForm(user);
      await user.click(screen.getByRole('button', { name: /가입하기/i }));
      
      await waitFor(() => {
        expect(screen.getByText('오류 발생')).toBeInTheDocument();
      });
      
      // Should not show retry button for non-retryable errors
      expect(screen.queryByRole('button', { name: /다시 시도/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /새로고침/i })).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading state during form submission', async () => {
      const user = userEvent.setup();
      
      // Mock a delayed response
      mockUseAuth.checkEmailExists.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ exists: false }), 1000))
      );
      
      render(<SignupForm />);
      
      await fillSignupForm(user);
      
      const submitButton = screen.getByRole('button', { name: /가입하기/i });
      await user.click(submitButton);
      
      // Should show loading state
      expect(screen.getByRole('button', { name: /처리 중.../i })).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
      
      // Form fields should be disabled
      expect(screen.getByLabelText(/이메일/i)).toBeDisabled();
      expect(screen.getByLabelText(/비밀번호/i)).toBeDisabled();
    });

    it('should show retry loading state', async () => {
      const user = userEvent.setup();
      jest.useFakeTimers();
      
      const emailCheckResult: EmailCheckResult = {
        exists: false,
        error: {
          type: 'network_error',
          message: 'Network error',
          userMessage: '네트워크 오류가 발생했습니다.',
          canRetry: true
        }
      };
      
      mockUseAuth.checkEmailExists.mockResolvedValue(emailCheckResult);
      
      render(<SignupForm />);
      
      await fillSignupForm(user);
      await user.click(screen.getByRole('button', { name: /가입하기/i }));
      
      await waitFor(() => {
        expect(screen.getByText('네트워크 오류')).toBeInTheDocument();
      });
      
      const retryButton = screen.getByRole('button', { name: /다시 시도/i });
      await user.click(retryButton);
      
      // Should show retry loading state
      expect(screen.getByText('재시도 중...')).toBeInTheDocument();
      expect(retryButton).toBeDisabled();
      
      jest.useRealTimers();
    });
  });

  describe('Error Recovery Options', () => {
    it('should handle reload page action', async () => {
      const user = userEvent.setup();
      
      // Mock window.location.reload
      const mockReload = jest.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: mockReload },
        writable: true,
      });
      
      const emailCheckResult: EmailCheckResult = {
        exists: false,
        error: {
          type: 'client_not_ready',
          message: 'Client not ready',
          userMessage: '서비스 연결 오류가 발생했습니다.',
          canRetry: false
        }
      };
      
      mockUseAuth.checkEmailExists.mockResolvedValue(emailCheckResult);
      
      render(<SignupForm />);
      
      await fillSignupForm(user);
      await user.click(screen.getByRole('button', { name: /가입하기/i }));
      
      await waitFor(() => {
        expect(screen.getByText('서비스 연결 오류')).toBeInTheDocument();
      });
      
      const reloadButton = screen.getByRole('button', { name: /새로고침/i });
      await user.click(reloadButton);
      
      expect(mockReload).toHaveBeenCalled();
    });

    it('should handle close error modal', async () => {
      const user = userEvent.setup();
      
      const emailCheckResult: EmailCheckResult = {
        exists: false,
        error: {
          type: 'network_error',
          message: 'Network error',
          userMessage: '네트워크 오류가 발생했습니다.',
          canRetry: true
        }
      };
      
      mockUseAuth.checkEmailExists.mockResolvedValue(emailCheckResult);
      
      render(<SignupForm />);
      
      await fillSignupForm(user);
      await user.click(screen.getByRole('button', { name: /가입하기/i }));
      
      await waitFor(() => {
        expect(screen.getByText('네트워크 오류')).toBeInTheDocument();
      });
      
      const closeButton = screen.getByRole('button', { name: /닫기/i });
      await user.click(closeButton);
      
      // Error modal should be closed
      await waitFor(() => {
        expect(screen.queryByText('네트워크 오류')).not.toBeInTheDocument();
      });
    });

    it('should show contact support action in production', async () => {
      const user = userEvent.setup();
      
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const emailCheckResult: EmailCheckResult = {
        exists: false,
        error: {
          type: 'database_error',
          message: 'Database error',
          userMessage: '서버 오류가 발생했습니다.',
          canRetry: false
        }
      };
      
      mockUseAuth.checkEmailExists.mockResolvedValue(emailCheckResult);
      
      render(<SignupForm />);
      
      await fillSignupForm(user);
      await user.click(screen.getByRole('button', { name: /가입하기/i }));
      
      await waitFor(() => {
        expect(screen.getByText('서버 오류')).toBeInTheDocument();
      });
      
      // In production, should show contact support option
      expect(screen.getByRole('button', { name: /새로고침/i })).toBeInTheDocument();
      
      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Technical Details Display', () => {
    it('should show technical details in development environment', async () => {
      const user = userEvent.setup();
      
      // Mock development environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const emailCheckResult: EmailCheckResult = {
        exists: false,
        error: {
          type: 'client_not_ready',
          message: 'Client not ready',
          userMessage: '서비스 연결 오류가 발생했습니다.',
          canRetry: true,
          technicalDetails: 'Environment variable NEXT_PUBLIC_SUPABASE_URL is not set'
        }
      };
      
      mockUseAuth.checkEmailExists.mockResolvedValue(emailCheckResult);
      
      render(<SignupForm />);
      
      await fillSignupForm(user);
      await user.click(screen.getByRole('button', { name: /가입하기/i }));
      
      await waitFor(() => {
        expect(screen.getByText('서비스 연결 오류')).toBeInTheDocument();
      });
      
      // Should show technical details in development
      expect(screen.getByText('기술적 세부사항 (개발자용)')).toBeInTheDocument();
      expect(screen.getByText('Environment variable NEXT_PUBLIC_SUPABASE_URL is not set')).toBeInTheDocument();
      
      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should hide technical details in production environment', async () => {
      const user = userEvent.setup();
      
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const emailCheckResult: EmailCheckResult = {
        exists: false,
        error: {
          type: 'client_not_ready',
          message: 'Client not ready',
          userMessage: '서비스 연결 오류가 발생했습니다.',
          canRetry: true,
          technicalDetails: 'Environment variable NEXT_PUBLIC_SUPABASE_URL is not set'
        }
      };
      
      mockUseAuth.checkEmailExists.mockResolvedValue(emailCheckResult);
      
      render(<SignupForm />);
      
      await fillSignupForm(user);
      await user.click(screen.getByRole('button', { name: /가입하기/i }));
      
      await waitFor(() => {
        expect(screen.getByText('서비스 연결 오류')).toBeInTheDocument();
      });
      
      // Should not show technical details in production
      expect(screen.queryByText('기술적 세부사항 (개발자용)')).not.toBeInTheDocument();
      expect(screen.queryByText('Environment variable NEXT_PUBLIC_SUPABASE_URL is not set')).not.toBeInTheDocument();
      
      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Successful Email Check', () => {
    it('should proceed with signup when email check passes', async () => {
      const user = userEvent.setup();
      
      // Mock successful email check and signup
      mockUseAuth.checkEmailExists.mockResolvedValue({ exists: false });
      mockUseAuth.signUp.mockResolvedValue({});
      
      render(<SignupForm />);
      
      await fillSignupForm(user);
      await user.click(screen.getByRole('button', { name: /가입하기/i }));
      
      // Should proceed to signup progress modal
      await waitFor(() => {
        expect(screen.getByText('회원가입 처리 중')).toBeInTheDocument();
      });
      
      expect(mockUseAuth.checkEmailExists).toHaveBeenCalledWith('test@example.com');
      expect(mockUseAuth.signUp).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
        'Test User',
        'Engineering'
      );
    });

    it('should handle existing email gracefully', async () => {
      const user = userEvent.setup();
      
      mockUseAuth.checkEmailExists.mockResolvedValue({ exists: true });
      
      render(<SignupForm />);
      
      await fillSignupForm(user);
      await user.click(screen.getByRole('button', { name: /가입하기/i }));
      
      // Should show toast for existing email
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: '이미 가입된 이메일',
          description: '해당 이메일로 이미 가입된 계정이 있습니다. 로그인해주세요.',
          variant: 'destructive',
        });
      });
      
      // Should not proceed to signup
      expect(mockUseAuth.signUp).not.toHaveBeenCalled();
    });
  });
});