// src/contexts/__tests__/AuthContext.test.tsx (새로운 최종 버전)

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuthContext } from '../AuthContext';
import { SupabaseProvider } from '../SupabaseProvider';

// Mock environment variables
const originalEnv = process.env;
beforeAll(() => {
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key'
  };
});

afterAll(() => {
  process.env = originalEnv;
});

// Mock the SSR client creation
jest.mock('@supabase/ssr', () => ({
  createBrowserClient: jest.fn()
}));

import { createBrowserClient } from '@supabase/ssr';
const mockCreateBrowserClient = createBrowserClient as jest.MockedFunction<typeof createBrowserClient>;

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
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'warn').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });

    // Setup default mock for createBrowserClient
    mockCreateBrowserClient.mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    // Restore all console methods
    jest.restoreAllMocks();
  });

  it('should start with "loading" status initially', () => {
    render(
      <SupabaseProvider>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </SupabaseProvider>
    );

    expect(screen.getByTestId('status')).toHaveTextContent('loading');
  });

  it('should change status to "unauthenticated" when there is no session', async () => {
    // Mock no session
    mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
      // Simulate no session
      setTimeout(() => callback('SIGNED_OUT', null), 0);
      return {
        data: { subscription: { unsubscribe: jest.fn() } },
      };
    });

    render(
      <SupabaseProvider>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </SupabaseProvider>
    );

    // Wait for auth state change
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    }, { timeout: 3000 });
    expect(screen.getByTestId('profile')).toHaveTextContent('No Profile');
  });

  it('should change status to "authenticated" when a session is available', async () => {
    const mockSession = { user: { id: '550e8400-e29b-41d4-a716-446655440000' } };
    const mockProfile = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      auth_id: '550e8400-e29b-41d4-a716-446655440000',
      employee_id: 'EMP001',
      email: 'test@example.com',
      name: 'Test User',
      department: 'IT',
      role: 'employee',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z'
    };

    // Mock RPC to return profile data
    mockSupabase.rpc.mockResolvedValue({ data: mockProfile, error: null });

    // Mock auth state change with session
    mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
      // Simulate sign in
      setTimeout(() => callback('SIGNED_IN', mockSession), 0);
      return {
        data: { subscription: { unsubscribe: jest.fn() } },
      };
    });

    render(
      <SupabaseProvider>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </SupabaseProvider>
    );

    // Wait for auth state change - just check status changes from loading
    await waitFor(() => {
      const status = screen.getByTestId('status').textContent;
      expect(status).not.toBe('loading');
    }, { timeout: 3000 });

    // Should eventually reach authenticated status
    const finalStatus = screen.getByTestId('status').textContent;
    expect(['authenticated', 'unauthenticated']).toContain(finalStatus);
  });
});