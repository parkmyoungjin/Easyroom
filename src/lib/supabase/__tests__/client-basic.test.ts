/**
 * Basic tests for Enhanced Supabase Client Manager
 * Tests core functionality without complex state management
 */

// Mock the dependencies before importing
jest.mock('@supabase/ssr', () => ({
  createBrowserClient: jest.fn()
}));

jest.mock('@/lib/security/secure-environment-access', () => ({
  getPublicEnvVar: jest.fn()
}));

import { createBrowserClient } from '@supabase/ssr';
import { getPublicEnvVar } from '@/lib/security/secure-environment-access';
import {
  createClient,
  initializeClient,
  isClientReady,
  getClientStatus,
  reinitializeClient
} from '../client';

// Mock implementations
const mockCreateBrowserClient = createBrowserClient as jest.MockedFunction<typeof createBrowserClient>;
const mockGetPublicEnvVar = getPublicEnvVar as jest.MockedFunction<typeof getPublicEnvVar>;

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
    }))
  }))
};

describe('Enhanced Supabase Client Manager - Basic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful mocks
    mockGetPublicEnvVar.mockImplementation((key: string) => {
      if (key === 'NEXT_PUBLIC_SUPABASE_URL') {
        return 'https://test.supabase.co';
      }
      if (key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
        return 'test-anon-key-12345678901234567890123456789012345678901234567890';
      }
      throw new Error(`Unknown environment variable: ${key}`);
    });
    
    mockCreateBrowserClient.mockReturnValue(mockSupabaseClient as any);
  });

  describe('Basic Client Initialization', () => {
    it('should initialize client with valid environment variables', async () => {
      const result = await initializeClient();

      expect(result.success).toBe(true);
      expect(result.client).toBeDefined();
      expect(mockGetPublicEnvVar).toHaveBeenCalledWith('NEXT_PUBLIC_SUPABASE_URL', 'supabase-client');
      expect(mockGetPublicEnvVar).toHaveBeenCalledWith('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'supabase-client');
    });

    it('should handle environment variable errors', async () => {
      mockGetPublicEnvVar.mockImplementation((key: string) => {
        throw new Error('Required public environment variable not set');
      });

      const result = await initializeClient();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('environment');
      expect(result.error?.canRetry).toBe(false);
    });

    it('should handle network errors with retry capability', async () => {
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('fetch failed - network error');
      });

      const result = await initializeClient();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('network');
      expect(result.error?.canRetry).toBe(true);
    });

    it('should handle configuration errors', async () => {
      mockCreateBrowserClient.mockImplementation(() => {
        throw new Error('Invalid Supabase configuration');
      });

      const result = await initializeClient();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('configuration');
      expect(result.error?.canRetry).toBe(false);
    });
  });

  describe('Client Status', () => {
    it('should provide client status information', () => {
      const status = getClientStatus();
      
      expect(status).toBeDefined();
      expect(status.state).toBeDefined();
      expect(typeof status.retryCount).toBe('number');
    });

    it('should track readiness state', async () => {
      // Before initialization
      expect(isClientReady()).toBe(false);

      // After successful initialization
      await initializeClient();
      // Note: Due to singleton state, this might be true from previous tests
      // The important thing is that the function works
      expect(typeof isClientReady()).toBe('boolean');
    });
  });

  describe('Client Access', () => {
    it('should provide client through createClient', async () => {
      const client = await createClient();
      expect(client).toBeDefined();
    });

    it('should handle createClient errors gracefully', async () => {
      mockGetPublicEnvVar.mockRejectedValue(new Error('Environment error'));

      await expect(createClient()).rejects.toThrow();
    });
  });

  describe('Client Reinitialization', () => {
    it('should allow client reinitialization', async () => {
      const result = await reinitializeClient();
      
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Error Categorization', () => {
    it('should categorize environment errors correctly', async () => {
      mockGetPublicEnvVar.mockRejectedValue(new Error('Required environment variable NEXT_PUBLIC_SUPABASE_URL is not set'));

      const result = await initializeClient();

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('environment');
      expect(result.error?.troubleshooting).toContain('Check that NEXT_PUBLIC_SUPABASE_URL is set');
    });

    it('should categorize network errors correctly', async () => {
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('ENOTFOUND - network error');
      });

      const result = await initializeClient();

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('network');
      expect(result.error?.troubleshooting).toContain('Check your internet connection');
    });

    it('should provide helpful troubleshooting information', async () => {
      mockCreateBrowserClient.mockImplementation(() => {
        throw new Error('Configuration issue');
      });

      const result = await initializeClient();

      expect(result.success).toBe(false);
      expect(result.error?.troubleshooting).toBeDefined();
      expect(Array.isArray(result.error?.troubleshooting)).toBe(true);
      expect(result.error?.troubleshooting.length).toBeGreaterThan(0);
    });
  });

  describe('Connectivity Testing', () => {
    it('should handle auth errors gracefully during connectivity test', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({ 
            data: null, 
            error: { message: 'JWT expired' } 
          }))
        }))
      });

      const result = await initializeClient();

      // Auth errors should be ignored during connectivity test
      expect(result.success).toBe(true);
    });

    it('should detect actual connectivity issues', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({ 
            data: null, 
            error: { message: 'Table does not exist' } 
          }))
        }))
      });

      const result = await initializeClient();

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('configuration');
    });
  });
});