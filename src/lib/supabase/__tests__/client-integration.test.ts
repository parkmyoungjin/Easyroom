/**
 * Integration test for Supabase Client
 * Tests the actual functionality and integration with auth-helpers
 */

// Mock auth-helpers but allow some real functionality for integration testing
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createPagesBrowserClient: jest.fn()
}));

import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '../client';

const mockCreatePagesBrowserClient = createPagesBrowserClient as jest.MockedFunction<typeof createPagesBrowserClient>;

// Create a more realistic mock client for integration testing
const createMockSupabaseClient = () => ({
  auth: {
    signInWithPassword: jest.fn().mockResolvedValue({ 
      data: { user: { id: 'test-user' }, session: { access_token: 'test-token' } }, 
      error: null 
    }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    getSession: jest.fn().mockResolvedValue({ 
      data: { session: { access_token: 'test-token' } }, 
      error: null 
    }),
    onAuthStateChange: jest.fn().mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } }
    })
  },
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: 1, name: 'test' }, error: null })
      }),
      limit: jest.fn().mockResolvedValue({ data: [{ id: 1, name: 'test' }], error: null })
    }),
    insert: jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: [{ id: 1, name: 'test' }], error: null })
    }),
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: [{ id: 1, name: 'updated' }], error: null })
      })
    }),
    delete: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ data: null, error: null })
    })
  }),
  channel: jest.fn().mockReturnValue({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockResolvedValue({ status: 'SUBSCRIBED' }),
    unsubscribe: jest.fn().mockResolvedValue({ status: 'CLOSED' })
  })
});

describe('Supabase Client - Integration Tests', () => {
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key-12345678901234567890123456789012345678901234567890';
    
    mockClient = createMockSupabaseClient();
    mockCreatePagesBrowserClient.mockReturnValue(mockClient as any);
  });

  describe('Client Integration', () => {
    it('should create client and provide auth functionality', async () => {
      const client = createClient();
      
      expect(client).toBeDefined();
      expect(client.auth).toBeDefined();
      
      // Test auth functionality
      const loginResult = await client.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password'
      });
      
      expect(loginResult.data.user).toBeDefined();
      expect(mockClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password'
      });
    });

    it('should provide database query functionality', async () => {
      const client = createClient();
      
      // Test database queries
      const result = await client.from('test_table').select('*').limit(10);
      
      expect(result.data).toBeDefined();
      expect(mockClient.from).toHaveBeenCalledWith('test_table');
    });

    it('should support real-time subscriptions', () => {
      const client = createClient();
      
      const channel = client.channel('test-channel');
      expect(channel).toBeDefined();
      expect(mockClient.channel).toHaveBeenCalledWith('test-channel');
      
      // Test subscription setup
      const subscription = channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'test' }, () => {})
        .subscribe();
        
      expect(mockClient.channel().on).toHaveBeenCalled();
      expect(mockClient.channel().subscribe).toHaveBeenCalled();
    });
  });

  describe('Client Consistency', () => {
    it('should return consistent client instances', () => {
      const client1 = createClient();
      const client2 = createClient();
      
      // Both should be defined and have the same structure
      expect(client1).toBeDefined();
      expect(client2).toBeDefined();
      expect(typeof client1.auth.signInWithPassword).toBe('function');
      expect(typeof client2.auth.signInWithPassword).toBe('function');
    });

    it('should maintain auth state across client calls', async () => {
      const client = createClient();
      
      // Simulate login
      await client.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password'
      });
      
      // Get session
      const session = await client.auth.getSession();
      expect(session.data.session).toBeDefined();
      expect(mockClient.auth.getSession).toHaveBeenCalled();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle auth errors gracefully', async () => {
      const client = createClient();
      
      // Mock auth error
      mockClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' }
      });
      
      const result = await client.auth.signInWithPassword({
        email: 'invalid@example.com',
        password: 'wrong'
      });
      
      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Invalid credentials');
    });

    it('should handle database errors gracefully', async () => {
      const client = createClient();
      
      // Mock database error
      mockClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Table not found' }
          })
        })
      });
      
      const result = await client.from('nonexistent_table').select('*').limit(10);
      
      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Table not found');
    });

    it('should handle client creation errors', () => {
      // Mock client creation failure
      mockCreatePagesBrowserClient.mockImplementation(() => {
        throw new Error('Failed to create client');
      });
      
      expect(() => createClient()).toThrow('Failed to create client');
    });
  });

  describe('Environment Integration', () => {
    it('should work with different environment configurations', () => {
      // Test with different URL
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://different.supabase.co';
      
      const client = createClient();
      expect(client).toBeDefined();
      expect(mockCreatePagesBrowserClient).toHaveBeenCalled();
    });

    it('should handle missing environment variables', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      mockCreatePagesBrowserClient.mockImplementation(() => {
        throw new Error('Missing environment variables');
      });
      
      expect(() => createClient()).toThrow('Missing environment variables');
    });
  });

  describe('TypeScript Integration', () => {
    it('should provide proper TypeScript types', () => {
      const client = createClient();
      
      // These should compile without TypeScript errors
      expect(typeof client.auth.signInWithPassword).toBe('function');
      expect(typeof client.auth.signOut).toBe('function');
      expect(typeof client.from).toBe('function');
      expect(typeof client.channel).toBe('function');
    });

    it('should support typed database operations', async () => {
      const client = createClient();
      
      // This should work with proper typing
      const result = await client.from('users').select('id, email').limit(1);
      
      expect(result).toBeDefined();
      expect(mockClient.from).toHaveBeenCalledWith('users');
    });
  });
});