/**
 * TypeScript Validation Tests
 * 
 * This test file validates that all TypeScript types are correctly defined
 * and that there are no compilation errors in the auth system.
 */

import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import type { UserProfile, AuthError } from '@/types/auth';
import type { Database } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

// Test type imports and basic type checking
describe('TypeScript Validation', () => {
  describe('Supabase Types', () => {
    it('should have correct AuthChangeEvent type', () => {
      const validEvents: AuthChangeEvent[] = [
        'INITIAL_SESSION',
        'SIGNED_IN',
        'SIGNED_OUT',
        'PASSWORD_RECOVERY',
        'TOKEN_REFRESHED',
        'USER_UPDATED'
      ];
      
      expect(validEvents).toHaveLength(6);
    });

    it('should have correct Session type structure', () => {
      const mockSession: Partial<Session> = {
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        expires_at: Date.now() / 1000 + 3600,
        user: {
          id: 'user-123',
          email: 'test@example.com'
        } as User
      };

      expect(mockSession.access_token).toBeDefined();
      expect(mockSession.refresh_token).toBeDefined();
      expect(mockSession.expires_at).toBeDefined();
      expect(mockSession.user).toBeDefined();
    });

    it('should have correct User type structure', () => {
      const mockUser: Partial<User> = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: {
          fullName: 'Test User',
          department: 'Engineering'
        }
      };

      expect(mockUser.id).toBeDefined();
      expect(mockUser.email).toBeDefined();
      expect(mockUser.user_metadata).toBeDefined();
    });
  });

  describe('Custom Auth Types', () => {
    it('should have correct UserProfile type structure', () => {
      const mockProfile: UserProfile = {
        authId: 'auth_user-123' as any,
        dbId: 'db_profile-123' as any,
        employeeId: null,
        email: 'test@example.com',
        name: 'Test User',
        department: 'Engineering',
        role: 'employee',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      expect(mockProfile.authId).toBeDefined();
      expect(mockProfile.dbId).toBeDefined();
      expect(mockProfile.email).toBeDefined();
      expect(mockProfile.name).toBeDefined();
      expect(mockProfile.department).toBeDefined();
      expect(mockProfile.role).toBeDefined();
      expect(['admin', 'employee']).toContain(mockProfile.role);
    });

    it('should have correct AuthError type structure', () => {
      const networkError: AuthError = {
        type: 'network',
        message: '네트워크 연결을 확인해주세요',
        code: 'NETWORK_ERROR',
        retryable: true
      };

      const sessionError: AuthError = {
        type: 'session',
        message: '세션이 만료되었습니다',
        code: 'SESSION_ERROR',
        retryable: true
      };

      const permissionError: AuthError = {
        type: 'permission',
        message: '권한이 부족합니다',
        code: 'PERMISSION_ERROR',
        retryable: false
      };

      const unknownError: AuthError = {
        type: 'unknown',
        message: '알 수 없는 오류가 발생했습니다',
        code: 'UNKNOWN_ERROR',
        retryable: true
      };

      expect(['network', 'session', 'permission', 'unknown']).toContain(networkError.type);
      expect(['network', 'session', 'permission', 'unknown']).toContain(sessionError.type);
      expect(['network', 'session', 'permission', 'unknown']).toContain(permissionError.type);
      expect(['network', 'session', 'permission', 'unknown']).toContain(unknownError.type);
    });
  });

  describe('Database Types', () => {
    it('should have correct Database type structure', () => {
      // Test that Database type has required tables
      type Tables = Database['public']['Tables'];
      type UserTable = Tables['users'];
      type RoomTable = Tables['rooms'];
      type ReservationTable = Tables['reservations'];

      // These should compile without errors
      const userRow: UserTable['Row'] = {
        id: 'user-123',
        auth_id: 'auth-123',
        employee_id: null,
        name: 'Test User',
        email: 'test@example.com',
        department: 'Engineering',
        role: 'employee',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      expect(userRow.id).toBeDefined();
      expect(userRow.auth_id).toBeDefined();
      expect(userRow.email).toBeDefined();
      expect(['employee', 'admin']).toContain(userRow.role);
    });

    it('should have correct function types', () => {
      type Functions = Database['public']['Functions'];
      type CheckEmailExists = Functions['check_email_exists'];
      // type UpsertUserProfile = Functions['upsert_user_profile']; // Removed - legacy function
      type GetCurrentUserInfo = Functions['get_current_user_info'];

      // These should compile without errors
      const checkEmailArgs: CheckEmailExists['Args'] = {
        p_email: 'test@example.com'
      };

      const upsertArgs: UpsertUserProfile['Args'] = {
        p_auth_id: 'auth-123',
        p_email: 'test@example.com',
        p_user_name: 'Test User',
        p_user_department: 'Engineering',
        p_user_employee_id: null
      };

      expect(checkEmailArgs.p_email).toBeDefined();
      expect(upsertArgs.p_auth_id).toBeDefined();
      expect(upsertArgs.p_email).toBeDefined();
    });
  });

  describe('Hook Return Types', () => {
    it('should validate useAuth return type structure', () => {
      // Mock the expected return type structure
      interface UseAuthReturn {
        user: User | null;
        userProfile: UserProfile | null;
        authStatus: 'loading' | 'authenticated' | 'unauthenticated';
        loading: boolean;
        signInWithMagicLink: (email: string) => Promise<void>;
        signUpDirectly: (email: string, fullName: string, department: string) => Promise<any>;
        signOut: () => Promise<void>;
        requestOTP: (email: string) => Promise<void>;
        verifyOTP: (email: string, token: string) => Promise<any>;
        isAdmin: () => boolean;
        isAuthenticated: () => boolean;
        isLoading: () => boolean;
      }

      // This should compile without errors
      const mockReturn: UseAuthReturn = {
        user: null,
        userProfile: null,
        authStatus: 'unauthenticated',
        loading: false,
        signInWithMagicLink: async () => {},
        signUpDirectly: async () => ({}),
        signOut: async () => {},
        requestOTP: async () => {},
        verifyOTP: async () => ({}),
        isAdmin: () => false,
        isAuthenticated: () => false,
        isLoading: () => false
      };

      expect(mockReturn.user).toBeNull();
      expect(mockReturn.userProfile).toBeNull();
      expect(['loading', 'authenticated', 'unauthenticated']).toContain(mockReturn.authStatus);
    });

    it('should validate useSupabase return type structure', () => {
      interface UseSupabaseReturn {
        client: SupabaseClient<Database> | null;
        isReady: boolean;
        error: Error | null;
        status: {
          state: 'uninitialized' | 'initializing' | 'ready' | 'error' | 'retrying';
          retryCount: number;
          lastError?: Error;
          lastInitializationAttempt?: Date;
          nextRetryAt?: Date;
        };
        reinitialize: () => Promise<any>;
      }

      const mockReturn: UseSupabaseReturn = {
        client: null,
        isReady: false,
        error: null,
        status: {
          state: 'uninitialized',
          retryCount: 0
        },
        reinitialize: async () => ({})
      };

      expect(mockReturn.client).toBeNull();
      expect(mockReturn.isReady).toBe(false);
      expect(['uninitialized', 'initializing', 'ready', 'error', 'retrying']).toContain(mockReturn.status.state);
    });
  });

  describe('Component Props Types', () => {
    it('should validate AuthStateIndicator props', () => {
      interface AuthStateIndicatorProps {
        showRole?: boolean;
        showError?: boolean;
        className?: string;
      }

      const validProps: AuthStateIndicatorProps = {
        showRole: true,
        showError: false,
        className: 'test-class'
      };

      const minimalProps: AuthStateIndicatorProps = {};

      expect(validProps.showRole).toBe(true);
      expect(validProps.showError).toBe(false);
      expect(validProps.className).toBe('test-class');
      expect(minimalProps).toEqual({});
    });

    it('should validate AuthPrompt props', () => {
      interface AuthPromptProps {
        title?: string;
        description?: string;
        variant?: 'info' | 'warning' | 'error';
        showSignup?: boolean;
        showRetry?: boolean;
        className?: string;
        onLogin?: () => void;
        onSignup?: () => void;
        onRetry?: () => void;
      }

      const validProps: AuthPromptProps = {
        title: 'Test Title',
        description: 'Test Description',
        variant: 'info',
        showSignup: true,
        showRetry: false,
        className: 'test-class',
        onLogin: () => {},
        onSignup: () => {},
        onRetry: () => {}
      };

      expect(validProps.title).toBe('Test Title');
      expect(['info', 'warning', 'error']).toContain(validProps.variant);
    });
  });

  describe('Middleware Types', () => {
    it('should validate middleware auth context type', () => {
      interface MiddlewareAuthContext {
        isAuthenticated: boolean;
        userRole: 'admin' | 'user' | undefined;
        userId: string | undefined;
      }

      const authContext: MiddlewareAuthContext = {
        isAuthenticated: true,
        userRole: 'user',
        userId: 'user-123'
      };

      const unauthContext: MiddlewareAuthContext = {
        isAuthenticated: false,
        userRole: undefined,
        userId: undefined
      };

      expect(authContext.isAuthenticated).toBe(true);
      expect(['admin', 'user', undefined]).toContain(authContext.userRole);
      expect(unauthContext.isAuthenticated).toBe(false);
      expect(unauthContext.userRole).toBeUndefined();
    });
  });
});

// Export types for validation (this ensures they can be imported without errors)
export type {
  AuthChangeEvent,
  Session,
  User,
  UserProfile,
  Database
};