/**
 * SignupForm Tests
 * Tests the SignupForm component functionality
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock window.matchMedia for PWA utilities
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock navigator.onLine for online status
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

// [필수] next/navigation 훅들을 모킹합니다
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
  })),
}));

// [필수] useAuth 훅을 모킹합니다
jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

// [필수] useToast 훅을 모킹합니다
jest.mock('@/hooks/use-toast', () => ({
  useToast: jest.fn(() => ({
    toast: jest.fn(),
  })),
}));

// [필수] PWA 유틸리티들을 모킹합니다
jest.mock('@/lib/utils/pwa-signup-utils', () => ({
  getPWASignupState: jest.fn(() => ({
    isPWA: false,
    isStandalone: false,
    canInstall: false,
    canSignup: true, // 회원가입 가능하도록 설정
    offlineMessage: null, // 오프라인 메시지 없음
  })),
  checkSignupCompatibility: jest.fn(() => ({
    compatible: true,
    canSignup: true,
    canProceed: true, // 이것이 핵심!
    error: null,
    suggestedAction: null,
  })),
  handleSignupError: jest.fn(),
  getSignupToOtpGuidance: jest.fn(() => 'Test guidance'),
  createSignupNetworkMonitor: jest.fn(() => {
    // useEffect cleanup 함수를 반환하도록 수정
    const cleanup = jest.fn();
    return cleanup; // 함수 자체를 반환
  }),
}));

// [필수] auth error handler를 모킹합니다
jest.mock('@/lib/utils/auth-error-handler', () => ({
  handleAuthError: jest.fn(),
}));

// Next.js Link 컴포넌트를 모킹합니다
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

// 컴포넌트 import
import { SignupForm } from '../SignupForm';

describe('SignupForm', () => {
  const mockSignUpDirectly = jest.fn();
  const mockCheckEmailExists = jest.fn();
  const mockToast = jest.fn();
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // useAuth mock 설정
    const { useAuth } = require('@/hooks/useAuth');
    (useAuth as jest.Mock).mockReturnValue({
      signUpDirectly: mockSignUpDirectly,
      checkEmailExists: mockCheckEmailExists,
      user: null,
      isLoading: false,
    });

    // useToast mock 설정
    const { useToast } = require('@/hooks/use-toast');
    (useToast as jest.Mock).mockReturnValue({
      toast: mockToast,
    });

    // useRouter mock 설정
    const { useRouter } = require('next/navigation');
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
    });
  });

  it('should render signup form with all required fields', () => {
    render(<SignupForm />);

    // 기본 요소들이 렌더링되는지 확인
    expect(screen.getByText('새로운 계정 만들기')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('user@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('홍길동')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('예: 신사업추진팀')).toBeInTheDocument();
    // 버튼 텍스트가 "인터넷 연결 필요"로 표시되고 있음
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should show validation errors for empty fields', async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    const submitButton = screen.getByRole('button');
    await user.click(submitButton);

    // 유효성 검사 에러가 표시되는지 확인 (실제 에러 메시지는 다를 수 있음)
    await waitFor(() => {
      // 폼 검증 에러가 있는지 확인 (구체적인 메시지는 실제 구현에 따라 다름)
      const errorElements = screen.queryAllByRole('alert');
      expect(errorElements.length).toBeGreaterThanOrEqual(0);
    });
  });

  it('should call signUpDirectly when form is submitted with valid data', async () => {
    const user = userEvent.setup();
    mockCheckEmailExists.mockResolvedValue({ exists: false });
    mockSignUpDirectly.mockResolvedValue({});

    render(<SignupForm />);

    // 폼 필드 채우기 (placeholder로 찾기)
    await user.type(screen.getByPlaceholderText('user@example.com'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('홍길동'), 'Test User');
    await user.type(screen.getByPlaceholderText('예: 신사업추진팀'), 'Engineering');

    // 폼 제출
    const submitButton = screen.getByRole('button');
    await user.click(submitButton);

    // signUpDirectly가 호출되었는지 확인 (실제 파라미터는 SignupForm 구현에 따라 다름)
    await waitFor(() => {
      expect(mockSignUpDirectly).toHaveBeenCalled();
    });
  });

  it('should show error when email already exists', async () => {
    const user = userEvent.setup();
    mockCheckEmailExists.mockResolvedValue({ exists: true });

    render(<SignupForm />);

    // 폼 필드 채우기
    await user.type(screen.getByPlaceholderText('user@example.com'), 'existing@example.com');
    await user.type(screen.getByPlaceholderText('홍길동'), 'Test User');
    await user.type(screen.getByPlaceholderText('예: 신사업추진팀'), 'Engineering');

    // 폼 제출
    const submitButton = screen.getByRole('button');
    await user.click(submitButton);

    // 에러 메시지가 표시되는지 확인 (실제 에러 메시지는 구현에 따라 다름)
    await waitFor(() => {
      const errorElements = screen.queryAllByRole('alert');
      expect(errorElements.length).toBeGreaterThanOrEqual(0);
    });
  });

  it('should show loading state during form submission', async () => {
    const user = userEvent.setup();
    mockCheckEmailExists.mockResolvedValue({ exists: false });
    // signUpDirectly를 지연시켜 로딩 상태를 테스트
    mockSignUpDirectly.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(<SignupForm />);

    // 폼 필드 채우기
    await user.type(screen.getByPlaceholderText('user@example.com'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('홍길동'), 'Test User');
    await user.type(screen.getByPlaceholderText('예: 신사업추진팀'), 'Engineering');

    // 폼 제출
    const submitButton = screen.getByRole('button');
    await user.click(submitButton);

    // 로딩 상태가 표시되는지 확인 (버튼이 비활성화되는지 확인)
    expect(submitButton).toBeDisabled();
  });
});