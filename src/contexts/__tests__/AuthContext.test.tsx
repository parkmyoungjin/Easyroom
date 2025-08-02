// src/contexts/__tests__/AuthContext.test.tsx (새로운 최종 버전)

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuthContext } from '../AuthContext';
import { useSupabaseClient, useSupabaseStatus } from '../SupabaseProvider';

// 1. AuthProvider가 의존하는 모든 외부 훅을 모킹합니다.
jest.mock('../SupabaseProvider', () => ({
  useSupabaseClient: jest.fn(),
  useSupabaseStatus: jest.fn(),
}));

// 모킹된 훅들을 타입스크립트가 인식할 수 있도록 캐스팅합니다.
const mockUseSupabaseClient = useSupabaseClient as jest.Mock;
const mockUseSupabaseStatus = useSupabaseStatus as jest.Mock;

// 테스트에서 사용할 가짜 Supabase 클라이언트를 설정합니다.
const mockSupabase = {
  auth: {
    // Trust Sync: getSession 메서드 추가
    getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    // onAuthStateChange는 구독 해제 함수를 반환해야 합니다.
    onAuthStateChange: jest.fn().mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    }),
  },
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  })),
  rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
};

// 테스트용 자식 컴포넌트
const TestComponent = () => {
  const { authStatus, userProfile } = useAuthContext();
  return (
    <div>
      <div data-testid="status">{authStatus}</div>
      <div data-testid="profile">{userProfile?.name ?? 'No Profile'}</div>
    </div>
  );
};

describe('AuthProvider', () => {
  let consoleLogSpy: jest.SpyInstance;

  // 각 테스트 실행 전에 모든 mock을 초기화합니다.
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress all console methods for all tests
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    // 기본적으로 Supabase 클라이언트를 반환하도록 설정합니다.
    mockUseSupabaseClient.mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    // Restore all console methods
    jest.restoreAllMocks();
  });

  it('should start with "loading" status when Supabase is not ready', () => {
    // SupabaseProvider가 아직 준비되지 않은 상황을 시뮬레이션합니다.
    mockUseSupabaseStatus.mockReturnValue({ isReady: false, error: null });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('status')).toHaveTextContent('loading');
  });

  it('should change status to "unauthenticated" when Supabase is ready but there is no session', async () => {
    // Trust Sync: SupabaseProvider는 준비되었지만, getSession이 null을 반환하는 상황을 시뮬레이션합니다.
    mockUseSupabaseStatus.mockReturnValue({ isReady: true, error: null });
    
    // Trust Sync: getSession이 null 세션을 반환하도록 설정
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    
    mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
      // 이후 변경사항을 위한 리스너 설정
      return {
        data: { subscription: { unsubscribe: jest.fn() } },
      };
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // 상태가 'unauthenticated'로 변경될 때까지 기다립니다.
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    });
    expect(screen.getByTestId('profile')).toHaveTextContent('No Profile');
  });

  it('should change status to "authenticated" and fetch profile when a session is available', async () => {
    // Trust Sync: SupabaseProvider가 준비되었고, getSession이 유효한 세션을 반환하는 상황을 시뮬레이션합니다.
    mockUseSupabaseStatus.mockReturnValue({ isReady: true, error: null });
    const mockSession = { user: { id: '550e8400-e29b-41d4-a716-446655440000' } };
    const mockProfile = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      auth_id: '550e8400-e29b-41d4-a716-446655440000',
      employee_id: 'EMP001',
      email: 'test@example.com',
      name: 'Test User',
      department: 'IT',
      role: 'user',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z'
    };

    // Trust Sync: getSession이 유효한 세션을 반환하도록 설정
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: mockSession }, error: null });

    // onAuthStateChange는 이후 변경사항을 위한 리스너로만 사용
    mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
      return {
        data: { subscription: { unsubscribe: jest.fn() } },
      };
    });

    // rpc 함수가 성공적으로 실행되도록 설정합니다.
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    // from 메서드가 반환하는 체인 객체를 직접 mock합니다.
    const mockSingle = jest.fn().mockResolvedValue({ data: mockProfile, error: null });
    const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // 상태가 'authenticated'로 변경되고 프로필이 표시될 때까지 기다립니다.
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    });
    expect(screen.getByTestId('profile')).toHaveTextContent('Test User');
  });
});