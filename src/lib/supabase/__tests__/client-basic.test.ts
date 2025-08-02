/**
 * Basic tests for Supabase Client
 * Tests core client creation functionality using auth-helpers
 */

// Mock the auth-helpers dependency
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createPagesBrowserClient: jest.fn()
}));

import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '../client';

// Mock implementations
const mockCreatePagesBrowserClient = createPagesBrowserClient as jest.MockedFunction<typeof createPagesBrowserClient>;

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    signInWithPassword: jest.fn(),
    signOut: jest.fn(),
    getSession: jest.fn()
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
    }))
  }))
};

describe('Supabase Client - Basic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key-12345678901234567890123456789012345678901234567890';
    
    mockCreatePagesBrowserClient.mockReturnValue(mockSupabaseClient as any);
  });

  describe('Client Creation', () => {
    it('should create client with valid environment variables', () => {
      const client = createClient();

      expect(client).toBeDefined();
      expect(mockCreatePagesBrowserClient).toHaveBeenCalledTimes(1);
      expect(client.auth).toBeDefined();
      expect(client.from).toBeDefined();
    });

    it('should handle missing environment variables gracefully', () => {
      // Remove environment variables
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Mock auth-helpers to throw error for missing env vars
      mockCreatePagesBrowserClient.mockImplementation(() => {
        throw new Error('either NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY env variables or supabaseUrl and supabaseKey are required!');
      });

      expect(() => createClient()).toThrow('either NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY env variables or supabaseUrl and supabaseKey are required!');
    });

    it('should return typed client instance', () => {
      const client = createClient();

      // Verify the client has the expected TypeScript interface
      expect(typeof client.auth.signInWithPassword).toBe('function');
      expect(typeof client.auth.signOut).toBe('function');
      expect(typeof client.from).toBe('function');
    });

    it('should use createPagesBrowserClient from auth-helpers', () => {
      createClient();

      expect(mockCreatePagesBrowserClient).toHaveBeenCalledWith();
    });
  });

  describe('Client Functionality', () => {
    it('should provide auth methods', () => {
      const client = createClient();

      expect(client.auth).toBeDefined();
      expect(typeof client.auth.signInWithPassword).toBe('function');
      expect(typeof client.auth.signOut).toBe('function');
      expect(typeof client.auth.getSession).toBe('function');
    });

    it('should provide database access methods', () => {
      const client = createClient();

      expect(typeof client.from).toBe('function');
      
      // Test that from() returns a query builder
      const queryBuilder = client.from('test_table');
      expect(queryBuilder).toBeDefined();
    });

    it('should handle client creation errors', () => {
      mockCreatePagesBrowserClient.mockImplementation(() => {
        throw new Error('Client creation failed');
      });

      expect(() => createClient()).toThrow('Client creation failed');
    });
  });

  describe('Environment Integration', () => {
    it('should work with standard Next.js environment variables', () => {
      // Ensure environment variables are set
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';

      const client = createClient();

      expect(client).toBeDefined();
      expect(mockCreatePagesBrowserClient).toHaveBeenCalled();
    });

    it('should be callable multiple times safely', () => {
      const client1 = createClient();
      const client2 = createClient();

      expect(client1).toBeDefined();
      expect(client2).toBeDefined();
      expect(mockCreatePagesBrowserClient).toHaveBeenCalledTimes(2);
    });
  });
});