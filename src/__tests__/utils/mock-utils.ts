/**
 * 공통 Mock 유틸리티
 * 테스트에서 자주 사용되는 mock 함수들을 중앙화
 */

import type { SupabaseClient, User, Session } from '@supabase/supabase-js';
import type { UserProfile } from '@/types/auth';

/**
 * 공통 Mock User 생성
 */
export const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'test-user-id',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'test@example.com',
  email_confirmed_at: new Date().toISOString(),
  phone: '',
  confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {
    fullName: 'Test User',
    department: 'Test Department'
  },
  identities: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides
});

/**
 * 공통 Mock UserProfile 생성
 */
export const createMockUserProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  authId: 'test-auth-id' as any,
  dbId: 'test-db-id' as any,
  email: 'test@example.com',
  name: 'Test User',
  department: 'Test Department',
  role: 'employee',
  createdAt: new Date().toISOString(),
  ...overrides
});

/**
 * 공통 Mock Session 생성
 */
export const createMockSession = (overrides: Partial<Session> = {}): Session => ({
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  expires_at: Date.now() / 1000 + 3600,
  token_type: 'bearer',
  user: createMockUser(),
  ...overrides
});

/**
 * 공통 Mock Supabase Client 생성
 */
export const createMockSupabaseClient = (): Partial<SupabaseClient> => ({
  auth: {
    getSession: jest.fn().mockResolvedValue({ data: { session: createMockSession() }, error: null }),
    getUser: jest.fn().mockResolvedValue({ data: { user: createMockUser() }, error: null }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } })
  } as any,
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null })
} as any);
// Add a simple test to satisfy Jest requirements
describe('Mock Utils', () => {
  it('should create mock user', () => {
    const user = createMockUser();
    expect(user.id).toBe('test-user-id');
    expect(user.email).toBe('test@example.com');
  });

  it('should create mock user profile', () => {
    const profile = createMockUserProfile();
    expect(profile.authId).toBe('test-auth-id');
    expect(profile.email).toBe('test@example.com');
  });

  it('should create mock session', () => {
    const session = createMockSession();
    expect(session.access_token).toBe('mock-access-token');
    expect(session.user).toBeDefined();
  });
});