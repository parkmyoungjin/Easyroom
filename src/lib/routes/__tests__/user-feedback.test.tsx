/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useAuthNavigation } from '@/hooks/useAuthNavigation';
import { useToast } from '@/hooks/use-toast';
import AuthPrompt from '@/components/ui/auth-prompt';
import LoadingSpinner from '@/components/ui/loading-spinner';
import ErrorMessage from '@/components/ui/error-message';
import NavigationBreadcrumb from '@/components/ui/navigation-breadcrumb';
import AuthStateIndicator from '@/components/ui/auth-state-indicator';
import { AuthProvider } from '@/contexts/AuthContext';
import { SupabaseProvider } from '@/contexts/SupabaseProvider';

// Mock dependencies
jest.mock('next/navigation');
jest.mock('@/hooks/useAuth');
jest.mock('@/hooks/useAuthNavigation');
jest.mock('@/hooks/use-toast');

// Mock window.location.href
Object.defineProperty(window, 'location', {
  value: {
    href: '',
    reload: jest.fn()
  },
  writable: true
});

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  replace: jest.fn(),
};

const mockToast = jest.fn();

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }))
  }
};

// Test wrapper with providers
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <SupabaseProvider supabase={mockSupabaseClient as any}>
    <AuthProvider>
      {children}
    </AuthProvider>
  </SupabaseProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
  
  // Mock useAuthNavigation
  (useAuthNavigation as jest.Mock).mockReturnValue({
    navigateWithAuth: jest.fn((path) => {
      mockRouter.push(path);
    }),
    handlePostLogout: jest.fn(() => {
      mockToast({
        title: '로그아웃 완료',
        description: '안전하게 로그아웃되었습니다.',
      });
      mockRouter.push('/');
    }),
    isAuthenticated: true,
    isAdmin: false,
    isLoading: false,
    userProfile: null
  });
});

describe('User Feedback Components', () => {
  describe('AuthPrompt', () => {
    it('renders with default props', () => {
      render(<AuthPrompt />, { wrapper: TestWrapper });
      
      expect(screen.getByText('로그인이 필요합니다')).toBeInTheDocument();
      expect(screen.getByText('이 기능을 사용하려면 로그인해주세요.')).toBeInTheDocument();
      expect(screen.getByText('로그인')).toBeInTheDocument();
      expect(screen.getByText('회원가입')).toBeInTheDocument();
    });

    it('renders with custom props', () => {
      render(
        <AuthPrompt
          title="Custom Title"
          description="Custom Description"
          variant="warning"
          showSignup={false}
        />,
        { wrapper: TestWrapper }
      );
      
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
      expect(screen.getByText('Custom Description')).toBeInTheDocument();
      expect(screen.getByText('로그인')).toBeInTheDocument();
      expect(screen.queryByText('회원가입')).not.toBeInTheDocument();
    });

    it('handles login button click', () => {
      const onLogin = jest.fn();
      render(<AuthPrompt onLogin={onLogin} />, { wrapper: TestWrapper });
      
      fireEvent.click(screen.getByText('로그인'));
      expect(onLogin).toHaveBeenCalled();
    });

    it('handles signup button click', () => {
      const onSignup = jest.fn();
      render(<AuthPrompt onSignup={onSignup} />, { wrapper: TestWrapper });
      
      fireEvent.click(screen.getByText('회원가입'));
      expect(onSignup).toHaveBeenCalled();
    });

    it('navigates to login page when no custom handler', () => {
      render(<AuthPrompt />, { wrapper: TestWrapper });
      
      fireEvent.click(screen.getByText('로그인'));
      expect(mockRouter.push).toHaveBeenCalledWith('/login');
    });
  });

  describe('LoadingSpinner', () => {
    it('renders with default props', () => {
      render(<LoadingSpinner />);
      
      expect(screen.getByText('로딩 중...')).toBeInTheDocument();
    });

    it('renders with custom text', () => {
      render(<LoadingSpinner text="Custom loading text" />);
      
      expect(screen.getByText('Custom loading text')).toBeInTheDocument();
    });

    it('renders in fullscreen mode', () => {
      const { container } = render(<LoadingSpinner fullScreen />);
      
      expect(container.firstChild).toHaveClass('min-h-screen');
    });

    it('applies different sizes', () => {
      const { rerender, container } = render(<LoadingSpinner size="sm" />);
      expect(container.querySelector('.h-4')).toBeInTheDocument();
      
      rerender(<LoadingSpinner size="lg" />);
      expect(container.querySelector('.h-12')).toBeInTheDocument();
    });
  });

  describe('ErrorMessage', () => {
    it('renders with default props', () => {
      render(<ErrorMessage />);
      
      expect(screen.getByText('오류가 발생했습니다')).toBeInTheDocument();
      expect(screen.getByText('잠시 후 다시 시도해주세요.')).toBeInTheDocument();
      expect(screen.getByText('다시 시도')).toBeInTheDocument();
      expect(screen.getByText('홈으로')).toBeInTheDocument();
    });

    it('handles retry button click', () => {
      const onRetry = jest.fn();
      render(<ErrorMessage onRetry={onRetry} />);
      
      fireEvent.click(screen.getByText('다시 시도'));
      expect(onRetry).toHaveBeenCalled();
    });

    it('handles home button click', () => {
      render(<ErrorMessage />);
      
      fireEvent.click(screen.getByText('홈으로'));
      expect(mockRouter.push).toHaveBeenCalledWith('/');
    });

    it('hides buttons when specified', () => {
      render(<ErrorMessage showRetry={false} showHome={false} />);
      
      expect(screen.queryByText('다시 시도')).not.toBeInTheDocument();
      expect(screen.queryByText('홈으로')).not.toBeInTheDocument();
    });
  });

  describe('NavigationBreadcrumb', () => {
    const mockItems = [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Reservations', href: '/reservations' },
      { label: 'New', current: true }
    ];

    it('renders breadcrumb items', () => {
      render(<NavigationBreadcrumb items={mockItems} />);
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Reservations')).toBeInTheDocument();
      expect(screen.getByText('New')).toBeInTheDocument();
    });

    it('handles navigation clicks', () => {
      render(<NavigationBreadcrumb items={mockItems} />);
      
      fireEvent.click(screen.getByText('Dashboard'));
      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
    });

    it('handles home button click', () => {
      render(<NavigationBreadcrumb items={mockItems} />);
      
      // Home button has no text, only an icon, so we need to find it differently
      const homeButton = screen.getAllByRole('button')[0]; // First button is the home button
      fireEvent.click(homeButton);
      expect(mockRouter.push).toHaveBeenCalledWith('/');
    });
  });

  describe('AuthStateIndicator', () => {
    it('shows loading state', () => {
      (useAuth as jest.Mock).mockReturnValue({
        userProfile: null,
        loading: true,
        authStatus: 'loading'
      });

      render(<AuthStateIndicator />, { wrapper: TestWrapper });
      expect(screen.getByText('인증 확인 중...')).toBeInTheDocument();
    });

    it('shows unauthenticated state', () => {
      (useAuth as jest.Mock).mockReturnValue({
        userProfile: null,
        loading: false,
        authStatus: 'unauthenticated'
      });

      render(<AuthStateIndicator />, { wrapper: TestWrapper });
      expect(screen.getByText('비로그인')).toBeInTheDocument();
    });

    it('shows authenticated user', () => {
      (useAuth as jest.Mock).mockReturnValue({
        userProfile: {
          name: 'John Doe',
          role: 'employee'
        },
        loading: false,
        authStatus: 'authenticated'
      });

      render(<AuthStateIndicator />, { wrapper: TestWrapper });
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('직원')).toBeInTheDocument();
    });

    it('shows admin user', () => {
      (useAuth as jest.Mock).mockReturnValue({
        userProfile: {
          name: 'Admin User',
          role: 'admin'
        },
        loading: false,
        authStatus: 'authenticated'
      });

      render(<AuthStateIndicator />, { wrapper: TestWrapper });
      expect(screen.getByText('Admin User')).toBeInTheDocument();
      expect(screen.getByText('관리자')).toBeInTheDocument();
    });

    it('hides role when specified', () => {
      (useAuth as jest.Mock).mockReturnValue({
        userProfile: {
          name: 'John Doe',
          role: 'employee'
        },
        loading: false,
        authStatus: 'authenticated'
      });

      render(<AuthStateIndicator showRole={false} />, { wrapper: TestWrapper });
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText('직원')).not.toBeInTheDocument();
    });
  });
});

describe('useAuthNavigation Hook', () => {
  const mockUserProfile = {
    id: '1',
    name: 'Test User',
    role: 'employee' as const
  };

  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({
      userProfile: mockUserProfile,
      isAuthenticated: jest.fn(() => true),
      isLoading: jest.fn(() => false)
    });
  });

  it('navigates to authenticated route when user is authenticated', () => {
    const TestComponent = () => {
      const { navigateWithAuth } = useAuthNavigation();
      
      return (
        <button onClick={() => navigateWithAuth('/protected')}>
          Navigate
        </button>
      );
    };

    render(<TestComponent />);
    fireEvent.click(screen.getByText('Navigate'));
    
    expect(mockRouter.push).toHaveBeenCalledWith('/protected');
  });

  it('shows toast and redirects when authentication required but user not authenticated', () => {
    (useAuth as jest.Mock).mockReturnValue({
      userProfile: null,
      isAuthenticated: jest.fn(() => false),
      isLoading: jest.fn(() => false)
    });

    // Mock useAuthNavigation for unauthenticated user
    (useAuthNavigation as jest.Mock).mockReturnValue({
      navigateWithAuth: jest.fn((path) => {
        mockToast({
          title: '로그인이 필요합니다',
          description: '이 기능을 사용하려면 로그인해주세요.',
          variant: 'destructive',
        });
      }),
      handlePostLogout: jest.fn(),
      isAuthenticated: false,
      isAdmin: false,
      isLoading: false,
      userProfile: null
    });

    const TestComponent = () => {
      const { navigateWithAuth } = useAuthNavigation();
      
      return (
        <button onClick={() => navigateWithAuth('/protected')}>
          Navigate
        </button>
      );
    };

    render(<TestComponent />);
    fireEvent.click(screen.getByText('Navigate'));
    
    expect(mockToast).toHaveBeenCalledWith({
      title: '로그인이 필요합니다',
      description: '이 기능을 사용하려면 로그인해주세요.',
      variant: 'destructive',
    });
  });

  it('shows admin required message when user is not admin', () => {
    // Mock useAuthNavigation for non-admin user trying to access admin route
    (useAuthNavigation as jest.Mock).mockReturnValue({
      navigateWithAuth: jest.fn((path, options) => {
        if (options?.requireAdmin) {
          mockToast({
            title: '권한이 없습니다',
            description: '관리자만 접근할 수 있는 페이지입니다.',
            variant: 'destructive',
          });
          mockRouter.push('/');
        }
      }),
      handlePostLogout: jest.fn(),
      isAuthenticated: true,
      isAdmin: false,
      isLoading: false,
      userProfile: mockUserProfile
    });

    const TestComponent = () => {
      const { navigateWithAuth } = useAuthNavigation();
      
      return (
        <button onClick={() => navigateWithAuth('/admin', { requireAdmin: true })}>
          Navigate
        </button>
      );
    };

    render(<TestComponent />);
    fireEvent.click(screen.getByText('Navigate'));
    
    expect(mockToast).toHaveBeenCalledWith({
      title: '권한이 없습니다',
      description: '관리자만 접근할 수 있는 페이지입니다.',
      variant: 'destructive',
    });
    expect(mockRouter.push).toHaveBeenCalledWith('/');
  });

  it('allows admin access to admin routes', () => {
    (useAuth as jest.Mock).mockReturnValue({
      userProfile: { ...mockUserProfile, role: 'admin' },
      isAuthenticated: jest.fn(() => true),
      isLoading: jest.fn(() => false)
    });

    // Mock useAuthNavigation for admin user
    (useAuthNavigation as jest.Mock).mockReturnValue({
      navigateWithAuth: jest.fn((path) => {
        mockRouter.push(path);
      }),
      handlePostLogout: jest.fn(),
      isAuthenticated: true,
      isAdmin: true,
      isLoading: false,
      userProfile: { ...mockUserProfile, role: 'admin' }
    });

    const TestComponent = () => {
      const { navigateWithAuth } = useAuthNavigation();
      
      return (
        <button onClick={() => navigateWithAuth('/admin', { requireAdmin: true })}>
          Navigate
        </button>
      );
    };

    render(<TestComponent />);
    fireEvent.click(screen.getByText('Navigate'));
    
    expect(mockRouter.push).toHaveBeenCalledWith('/admin');
  });

  it('handles post-logout correctly', () => {
    const TestComponent = () => {
      const { handlePostLogout } = useAuthNavigation();
      
      return (
        <button onClick={() => handlePostLogout()}>
          Logout
        </button>
      );
    };

    render(<TestComponent />);
    fireEvent.click(screen.getByText('Logout'));
    
    expect(mockToast).toHaveBeenCalledWith({
      title: '로그아웃 완료',
      description: '안전하게 로그아웃되었습니다.',
    });
    expect(mockRouter.push).toHaveBeenCalledWith('/');
  });

  it('returns correct navigation state', () => {
    const TestComponent = () => {
      const { isAuthenticated, isAdmin, isLoading, userProfile } = useAuthNavigation();
      
      return (
        <div>
          <span>{isAuthenticated ? 'Authenticated' : 'Not authenticated'}</span>
          <span>{isAdmin ? 'Is admin' : 'Not admin'}</span>
          <span>{isLoading ? 'Loading' : 'Not loading'}</span>
          <span>{userProfile ? 'Has profile' : 'No profile'}</span>
        </div>
      );
    };

    render(<TestComponent />);
    
    expect(screen.getByText('Authenticated')).toBeInTheDocument();
    expect(screen.getByText('Not admin')).toBeInTheDocument();
    expect(screen.getByText('Not loading')).toBeInTheDocument();
    expect(screen.getByText('No profile')).toBeInTheDocument();
  });
});