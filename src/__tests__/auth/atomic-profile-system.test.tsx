/**
 * Comprehensive Test Suite for Atomic Profile System
 * 작전명: Operation Atomic Profile - Task 5 Implementation
 * 
 * Tests the complete atomic profile management system including:
 * - AuthProvider with onAuthStateChange integration
 * - getOrCreateProfile function with single RPC call
 * - Error scenarios and edge cases
 * - Profile data consistency and completeness
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

// Mock single function that will be returned by rpc()
let mockSingle: jest.Mock;

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    onAuthStateChange: jest.fn(),
    getUser: jest.fn(),
  },
  rpc: jest.fn(),
};

// Mock SupabaseProvider to return our mock client
jest.mock('@/contexts/SupabaseProvider', () => ({
  SupabaseProvider: ({ children }: { children: React.ReactNode }) => children,
  useSupabaseClient: jest.fn(),
}));

// Import the mocked hook
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
const mockUseSupabaseClient = useSupabaseClient as jest.MockedFunction<typeof useSupabaseClient>;

// Test component to access auth context
const TestComponent = () => {
  const { user, userProfile, authStatus } = useAuth();
  
  return (
    <div>
      <div data-testid="auth-status">{authStatus}</div>
      <div data-testid="user-id">{user?.id || 'no-user'}</div>
      <div data-testid="profile-name">{userProfile?.name || 'no-profile'}</div>
      <div data-testid="profile-email">{userProfile?.email || 'no-email'}</div>
      <div data-testid="profile-department">{userProfile?.department || 'no-department'}</div>
      <div data-testid="profile-role">{userProfile?.role || 'no-role'}</div>
    </div>
  );
};

// Wrapper component that provides both contexts
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('Atomic Profile System - Core Integration Tests', () => {
  let mockAuthStateChangeCallback: (event: string, session: any) => void;
  let mockSubscription: { unsubscribe: jest.Mock };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock subscription
    mockSubscription = { unsubscribe: jest.fn() };
    
    // Setup mock single function
    mockSingle = jest.fn();
    mockSupabaseClient.rpc.mockReturnValue({
      single: mockSingle,
    });
    
    // Mock useSupabaseClient to return our mock client
    mockUseSupabaseClient.mockReturnValue(mockSupabaseClient);
    
    // Mock onAuthStateChange to capture the callback
    mockSupabaseClient.auth.onAuthStateChange.mockImplementation((callback) => {
      mockAuthStateChangeCallback = callback;
      return { data: { subscription: mockSubscription } };
    });

    // Suppress console logs for cleaner test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Task 5.1: AuthProvider onAuthStateChange Integration', () => {
    it('should transition from loading to authenticated when RPC succeeds', async () => {
      // Mock successful RPC response
      const mockProfileData = {
        authId: 'auth-123',
        dbId: 'db-456',
        employeeId: 'EMP001',
        email: 'test@example.com',
        name: 'Test User',
        department: 'Engineering',
        role: 'employee',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };

      mockSingle.mockResolvedValue({
        data: mockProfileData,
        error: null,
      });

      // Render AuthProvider with test component
      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      // Initially should be loading
      expect(screen.getByTestId('auth-status')).toHaveTextContent('loading');

      // Simulate successful authentication event
      const mockUser = { id: 'auth-123', email: 'test@example.com' };
      const mockSession = { user: mockUser };

      // Trigger the auth state change
      act(() => {
        mockAuthStateChangeCallback('SIGNED_IN', mockSession);
      });

      // Wait for async operations to complete
      await waitFor(
        () => {
          expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
        },
        { timeout: 5000 }
      );

      // Verify RPC was called correctly
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('get_or_create_user_profile');

      // Verify user and profile data are set correctly
      expect(screen.getByTestId('user-id')).toHaveTextContent('auth-123');
      expect(screen.getByTestId('profile-name')).toHaveTextContent('Test User');
      expect(screen.getByTestId('profile-email')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('profile-department')).toHaveTextContent('Engineering');
      expect(screen.getByTestId('profile-role')).toHaveTextContent('employee');
    });

    it('should handle RPC failure and transition to unauthenticated', async () => {
      // Mock RPC failure
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Authentication required: User is not logged in.' },
      });

      render(
        <SupabaseProvider>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </SupabaseProvider>
      );

      // Initially should be loading
      expect(screen.getByTestId('auth-status')).toHaveTextContent('loading');

      // Simulate authentication event with RPC failure
      const mockUser = { id: 'auth-123', email: 'test@example.com' };
      const mockSession = { user: mockUser };

      await act(async () => {
        mockAuthStateChangeCallback('SIGNED_IN', mockSession);
      });

      // Should transition to unauthenticated due to RPC failure
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
      }, { timeout: 3000 });

      // Verify user and profile are cleared
      expect(screen.getByTestId('user-id')).toHaveTextContent('no-user');
      expect(screen.getByTestId('profile-name')).toHaveTextContent('no-profile');
    });

    it('should handle null session and transition to unauthenticated', async () => {
      render(
        <SupabaseProvider>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </SupabaseProvider>
      );

      // Simulate sign out event
      await act(async () => {
        mockAuthStateChangeCallback('SIGNED_OUT', null);
      });

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
      }, { timeout: 3000 });

      // Verify RPC was not called for null session
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();

      // Verify user and profile are cleared
      expect(screen.getByTestId('user-id')).toHaveTextContent('no-user');
      expect(screen.getByTestId('profile-name')).toHaveTextContent('no-profile');
    });
  });

  describe('Task 5.2: getOrCreateProfile Function Unit Tests', () => {
    it('should make single RPC call and return complete profile', async () => {
      const mockProfileData = {
        authId: 'auth-789',
        dbId: 'db-101',
        employeeId: null, // Test null employeeId handling
        email: 'new@example.com',
        name: 'New User',
        department: 'Marketing',
        role: 'admin',
        createdAt: '2025-01-02T00:00:00Z',
        updatedAt: null, // Test null updatedAt handling
      };

      mockSingle.mockResolvedValue({
        data: mockProfileData,
        error: null,
      });

      render(
        <SupabaseProvider>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </SupabaseProvider>
      );

      const mockUser = { id: 'auth-789', email: 'new@example.com' };
      const mockSession = { user: mockUser };

      await act(async () => {
        await mockAuthStateChangeCallback('SIGNED_IN', mockSession);
      });

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      });

      // Verify single RPC call
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('get_or_create_user_profile');
      expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(1);

      // Verify profile data transformation
      expect(screen.getByTestId('profile-name')).toHaveTextContent('New User');
      expect(screen.getByTestId('profile-email')).toHaveTextContent('new@example.com');
      expect(screen.getByTestId('profile-department')).toHaveTextContent('Marketing');
      expect(screen.getByTestId('profile-role')).toHaveTextContent('admin');
    });

    it('should handle RPC returning no data despite success status', async () => {
      // Mock RPC returning null data but no error
      mockSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      render(
        <SupabaseProvider>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </SupabaseProvider>
      );

      const mockUser = { id: 'auth-123', email: 'test@example.com' };
      const mockSession = { user: mockUser };

      await act(async () => {
        await mockAuthStateChangeCallback('SIGNED_IN', mockSession);
      });

      // Should transition to unauthenticated due to missing data
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
      });

      expect(screen.getByTestId('user-id')).toHaveTextContent('no-user');
      expect(screen.getByTestId('profile-name')).toHaveTextContent('no-profile');
    });
  });

  describe('Task 5.3: Data Validation and Safety Defaults', () => {
    it('should apply safety defaults for missing or invalid data', async () => {
      // Mock RPC with incomplete/invalid data
      const mockIncompleteData = {
        authId: 'auth-123',
        dbId: 'db-456',
        employeeId: null,
        email: '', // Empty email
        name: '   ', // Whitespace-only name
        department: null, // Null department
        role: 'invalid_role', // Invalid role
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: null,
      };

      mockSingle.mockResolvedValue({
        data: mockIncompleteData,
        error: null,
      });

      render(
        <SupabaseProvider>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </SupabaseProvider>
      );

      const mockUser = { id: 'auth-123', email: 'test@example.com' };
      const mockSession = { user: mockUser };

      await act(async () => {
        await mockAuthStateChangeCallback('SIGNED_IN', mockSession);
      });

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      });

      // Verify safety defaults are applied
      expect(screen.getByTestId('profile-email')).toHaveTextContent('unknown@example.com');
      expect(screen.getByTestId('profile-name')).toHaveTextContent('알 수 없는 사용자');
      expect(screen.getByTestId('profile-department')).toHaveTextContent('소속 없음');
      expect(screen.getByTestId('profile-role')).toHaveTextContent('employee'); // Default role
    });

    it('should preserve valid data and only apply defaults where needed', async () => {
      const mockMixedData = {
        authId: 'auth-123',
        dbId: 'db-456',
        employeeId: 'EMP001',
        email: 'valid@example.com', // Valid email
        name: 'Valid User', // Valid name
        department: '', // Empty department - should get default
        role: 'admin', // Valid role
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T12:00:00Z',
      };

      mockSingle.mockResolvedValue({
        data: mockMixedData,
        error: null,
      });

      render(
        <SupabaseProvider>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </SupabaseProvider>
      );

      const mockUser = { id: 'auth-123', email: 'valid@example.com' };
      const mockSession = { user: mockUser };

      await act(async () => {
        await mockAuthStateChangeCallback('SIGNED_IN', mockSession);
      });

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      });

      // Verify valid data is preserved
      expect(screen.getByTestId('profile-email')).toHaveTextContent('valid@example.com');
      expect(screen.getByTestId('profile-name')).toHaveTextContent('Valid User');
      expect(screen.getByTestId('profile-role')).toHaveTextContent('admin');
      
      // Verify default is applied only where needed
      expect(screen.getByTestId('profile-department')).toHaveTextContent('소속 없음');
    });
  });

  describe('Task 5.4: Error Scenarios and Network Failures', () => {
    it('should handle network timeout errors', async () => {
      // Mock network timeout
      mockSingle.mockRejectedValue(new Error('Network timeout'));

      render(
        <SupabaseProvider>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </SupabaseProvider>
      );

      const mockUser = { id: 'auth-123', email: 'test@example.com' };
      const mockSession = { user: mockUser };

      await act(async () => {
        await mockAuthStateChangeCallback('SIGNED_IN', mockSession);
      });

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
      });

      expect(screen.getByTestId('user-id')).toHaveTextContent('no-user');
      expect(screen.getByTestId('profile-name')).toHaveTextContent('no-profile');
    });

    it('should handle database connection errors', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed', code: 'CONNECTION_ERROR' },
      });

      render(
        <SupabaseProvider>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </SupabaseProvider>
      );

      const mockUser = { id: 'auth-123', email: 'test@example.com' };
      const mockSession = { user: mockUser };

      await act(async () => {
        await mockAuthStateChangeCallback('SIGNED_IN', mockSession);
      });

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
      });
    });

    it('should handle authentication errors from RPC', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Authentication required: User is not logged in.', code: 'AUTH_ERROR' },
      });

      render(
        <SupabaseProvider>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </SupabaseProvider>
      );

      const mockUser = { id: 'auth-123', email: 'test@example.com' };
      const mockSession = { user: mockUser };

      await act(async () => {
        await mockAuthStateChangeCallback('SIGNED_IN', mockSession);
      });

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
      });
    });
  });

  describe('Task 5.5: Concurrent Authentication Scenarios', () => {
    it('should handle concurrent authentication events safely', async () => {
      let resolveFirstRpc: (value: any) => void;
      let resolveSecondRpc: (value: any) => void;

      // Create promises that we can control
      const firstRpcPromise = new Promise((resolve) => {
        resolveFirstRpc = resolve;
      });
      const secondRpcPromise = new Promise((resolve) => {
        resolveSecondRpc = resolve;
      });

      // Mock RPC to return controlled promises
      mockSupabaseClient.rpc
        .mockReturnValueOnce({ single: () => firstRpcPromise })
        .mockReturnValueOnce({ single: () => secondRpcPromise });

      render(
        <SupabaseProvider>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </SupabaseProvider>
      );

      const mockUser1 = { id: 'auth-123', email: 'user1@example.com' };
      const mockUser2 = { id: 'auth-456', email: 'user2@example.com' };

      // Trigger two concurrent authentication events
      act(() => {
        mockAuthStateChangeCallback('SIGNED_IN', { user: mockUser1 });
        mockAuthStateChangeCallback('SIGNED_IN', { user: mockUser2 });
      });

      // Resolve second RPC first (simulating race condition)
      resolveSecondRpc!({
        data: {
          authId: 'auth-456',
          dbId: 'db-456',
          employeeId: 'EMP002',
          email: 'user2@example.com',
          name: 'User Two',
          department: 'Sales',
          role: 'employee',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: null,
        },
        error: null,
      });

      // Then resolve first RPC
      resolveFirstRpc!({
        data: {
          authId: 'auth-123',
          dbId: 'db-123',
          employeeId: 'EMP001',
          email: 'user1@example.com',
          name: 'User One',
          department: 'Engineering',
          role: 'admin',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: null,
        },
        error: null,
      });

      // Wait for state to settle
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      });

      // Should have the profile from the last completed authentication
      // Due to the execution lock, only one should process
      const profileName = screen.getByTestId('profile-name').textContent;
      expect(profileName).toMatch(/User (One|Two)/);
    });

    it('should prevent race conditions with execution lock', async () => {
      const mockProfileData = {
        authId: 'auth-123',
        dbId: 'db-456',
        employeeId: 'EMP001',
        email: 'test@example.com',
        name: 'Test User',
        department: 'Engineering',
        role: 'employee',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: null,
      };

      mockSingle.mockResolvedValue({
        data: mockProfileData,
        error: null,
      });

      render(
        <SupabaseProvider>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </SupabaseProvider>
      );

      const mockUser = { id: 'auth-123', email: 'test@example.com' };
      const mockSession = { user: mockUser };

      // Trigger multiple rapid authentication events
      await act(async () => {
        mockAuthStateChangeCallback('SIGNED_IN', mockSession);
        mockAuthStateChangeCallback('SIGNED_IN', mockSession);
        mockAuthStateChangeCallback('SIGNED_IN', mockSession);
      });

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      });

      // Should only call RPC once due to execution lock
      expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(1);
    });
  });

  describe('Task 5.6: Component Unmounting Safety', () => {
    it('should handle component unmounting during async operations', async () => {
      let resolveRpc: (value: any) => void;
      const rpcPromise = new Promise((resolve) => {
        resolveRpc = resolve;
      });

      mockSupabaseClient.rpc.mockReturnValue({
        single: () => rpcPromise,
      });

      const { unmount } = render(
        <SupabaseProvider>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </SupabaseProvider>
      );

      const mockUser = { id: 'auth-123', email: 'test@example.com' };
      const mockSession = { user: mockUser };

      // Start authentication process
      act(() => {
        mockAuthStateChangeCallback('SIGNED_IN', mockSession);
      });

      // Unmount component before RPC resolves
      unmount();

      // Resolve RPC after unmounting
      resolveRpc!({
        data: {
          authId: 'auth-123',
          dbId: 'db-456',
          email: 'test@example.com',
          name: 'Test User',
          department: 'Engineering',
          role: 'employee',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: null,
        },
        error: null,
      });

      // Should not throw any errors
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should properly clean up subscription on unmount', () => {
      const { unmount } = render(
        <SupabaseProvider>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </SupabaseProvider>
      );

      // Verify subscription was created
      expect(mockSupabaseClient.auth.onAuthStateChange).toHaveBeenCalled();

      // Unmount component
      unmount();

      // Verify subscription was cleaned up
      expect(mockSubscription.unsubscribe).toHaveBeenCalled();
    });
  });
});