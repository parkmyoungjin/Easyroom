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
  reinitializeClient,
  getClientManager,
  supabase,
  type ClientInitializationResult,
  type ClientStatus
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

describe('Enhanced Supabase Client Manager', () => {
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

  describe('Client Initialization', () => {
    it('should successfully initialize client with valid environment variables', async () => {
      const result = await initializeClient();

      expect(result.success).toBe(true);
      expect(result.client).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(mockGetPublicEnvVar).toHaveBeenCalledWith('NEXT_PUBLIC_SUPABASE_URL', 'supabase-client');
      expect(mockGetPublicEnvVar).toHaveBeenCalledWith('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'supabase-client');
      expect(mockCreateBrowserClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-anon-key-12345678901234567890123456789012345678901234567890'
      );
    });

    it('should handle missing NEXT_PUBLIC_SUPABASE_URL environment variable', async () => {
      mockGetPublicEnvVar.mockImplementation((key: string) => {
        if (key === 'NEXT_PUBLIC_SUPABASE_URL') {
          throw new Error('Required public environment variable NEXT_PUBLIC_SUPABASE_URL is not set');
        }
        return 'test-anon-key-12345678901234567890123456789012345678901234567890';
      });

      const result = await initializeClient();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('environment');
      expect(result.error?.message).toContain('Required environment variable NEXT_PUBLIC_SUPABASE_URL is not set');
      expect(result.error?.canRetry).toBe(false);
      expect(result.error?.troubleshooting).toContain('Check that NEXT_PUBLIC_SUPABASE_URL is set in your environment');
    });

    it('should handle missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable', async () => {
      mockGetPublicEnvVar.mockImplementation((key: string) => {
        if (key === 'NEXT_PUBLIC_SUPABASE_URL') {
          return 'https://test.supabase.co';
        }
        throw new Error('Required public environment variable NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
      });

      const result = await initializeClient();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('environment');
      expect(result.error?.message).toContain('Required environment variable NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
      expect(result.error?.canRetry).toBe(false);
    });

    it('should handle network errors with retry logic', async () => {
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('fetch failed - network error');
      });

      const result = await initializeClient();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('network');
      expect(result.error?.canRetry).toBe(true);
      expect(result.error?.message).toContain('Network error');
      expect(result.error?.troubleshooting).toContain('Check your internet connection');
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
      expect(result.error?.troubleshooting).toContain('Verify your Supabase project URL is correct');
    });
  });

  describe('Client Status Management', () => {
    it('should track client status during initialization', async () => {
      let status = getClientStatus();
      expect(status.state).toBe('uninitialized');
      expect(status.retryCount).toBe(0);

      const initPromise = initializeClient();
      
      status = getClientStatus();
      expect(status.state).toBe('initializing');
      expect(status.lastInitializationAttempt).toBeDefined();

      await initPromise;

      status = getClientStatus();
      expect(status.state).toBe('ready');
      expect(status.retryCount).toBe(0);
    });

    it('should track error state when initialization fails', async () => {
      mockGetPublicEnvVar.mockImplementation(() => {
        throw new Error('Environment error');
      });

      await initializeClient();

      const status = getClientStatus();
      expect(status.state).toBe('error');
      expect(status.lastError).toBeUndefined(); // Error is stored separately
    });

    it('should track retry state during retries', async () => {
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('network timeout');
      });

      const result = await initializeClient();

      expect(result.success).toBe(false);
      const status = getClientStatus();
      expect(status.state).toBe('retrying');
      expect(status.retryCount).toBe(1);
      expect(status.nextRetryAt).toBeDefined();
    });
  });

  describe('Client Readiness', () => {
    it('should report client as ready after successful initialization', async () => {
      expect(isClientReady()).toBe(false);

      await initializeClient();

      expect(isClientReady()).toBe(true);
    });

    it('should report client as not ready when initialization fails', async () => {
      mockGetPublicEnvVar.mockImplementation(() => {
        throw new Error('Environment error');
      });

      await initializeClient();

      expect(isClientReady()).toBe(false);
    });

    it('should report client as not ready during initialization', async () => {
      expect(isClientReady()).toBe(false);

      // Don't await - check status during initialization
      initializeClient();

      expect(isClientReady()).toBe(false);
    });
  });

  describe('Retry Logic with Exponential Backoff', () => {
    it('should retry network errors with exponential backoff', async () => {
      let callCount = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('network timeout');
        }
        return {
          select: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        };
      });

      // First attempt fails, schedules retry
      const result1 = await initializeClient();
      expect(result1.success).toBe(false);
      expect(result1.error?.message).toContain('Retry 1/3');

      // Advance time to trigger first retry
      jest.advanceTimersByTime(1000);
      await Promise.resolve(); // Allow retry to execute

      // Second attempt fails, schedules another retry
      const status = getClientStatus();
      expect(status.retryCount).toBe(2);

      // Advance time to trigger second retry
      jest.advanceTimersByTime(2000);
      await Promise.resolve(); // Allow retry to execute

      // Third attempt should succeed
      expect(callCount).toBe(3);
    });

    it('should stop retrying after max retries reached', async () => {
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('persistent network error');
      });

      // First attempt
      const result1 = await initializeClient();
      expect(result1.success).toBe(false);
      expect(result1.error?.message).toContain('Retry 1/3');

      // Advance through all retries
      for (let i = 0; i < 3; i++) {
        jest.advanceTimersByTime(10000);
        await Promise.resolve();
      }

      const finalStatus = getClientStatus();
      expect(finalStatus.state).toBe('error');
      expect(finalStatus.retryCount).toBe(3);
    });

    it('should not retry environment errors', async () => {
      mockGetPublicEnvVar.mockImplementation(() => {
        throw new Error('Required public environment variable not set');
      });

      const result = await initializeClient();

      expect(result.success).toBe(false);
      expect(result.error?.canRetry).toBe(false);
      expect(result.error?.message).not.toContain('Retry');

      const status = getClientStatus();
      expect(status.state).toBe('error');
      expect(status.retryCount).toBe(0);
    });
  });

  describe('Client Reinitialization', () => {
    it('should reset state and reinitialize client', async () => {
      // First initialization
      await initializeClient();
      expect(isClientReady()).toBe(true);

      // Reinitialize
      const result = await reinitializeClient();

      expect(result.success).toBe(true);
      expect(isClientReady()).toBe(true);

      const status = getClientStatus();
      expect(status.state).toBe('ready');
      expect(status.retryCount).toBe(0);
    });

    it('should clear pending retries during reinitialization', async () => {
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('network error');
      });

      // Start initialization that will fail and schedule retry
      await initializeClient();
      
      const statusBefore = getClientStatus();
      expect(statusBefore.state).toBe('retrying');

      // Reinitialize should clear the retry
      mockSupabaseClient.from.mockImplementation(() => ({
        select: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }));

      const result = await reinitializeClient();

      expect(result.success).toBe(true);
      const statusAfter = getClientStatus();
      expect(statusAfter.state).toBe('ready');
      expect(statusAfter.retryCount).toBe(0);
    });
  });

  describe('Client Access Methods', () => {
    it('should return client through createClient after successful initialization', async () => {
      const client = await createClient();

      expect(client).toBeDefined();
      expect(client).toBe(mockSupabaseClient);
    });

    it('should throw error in createClient when initialization fails', async () => {
      mockGetPublicEnvVar.mockImplementation(() => {
        throw new Error('Environment error');
      });

      await expect(createClient()).rejects.toThrow('Environment error');
    });

    it('should throw error in supabase() when client is not ready', () => {
      expect(() => supabase()).toThrow('Supabase client not initialized');
    });

    it('should return client through supabase() when client is ready', async () => {
      await initializeClient();

      const client = supabase();
      expect(client).toBeDefined();
    });

    it('should return initialization error through getInitializationError', async () => {
      const testError = new Error('Test initialization error');
      mockGetPublicEnvVar.mockImplementation(() => {
        throw testError;
      });

      await initializeClient();

      const manager = getClientManager();
      const error = manager.getInitializationError();
      expect(error).toBeDefined();
      expect(error?.message).toBe('Test initialization error');
    });
  });

  describe('Concurrent Initialization', () => {
    it('should handle concurrent initialization requests', async () => {
      const promise1 = initializeClient();
      const promise2 = initializeClient();
      const promise3 = initializeClient();

      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);
      expect(result1.client).toBe(result2.client);
      expect(result2.client).toBe(result3.client);

      // Should only call environment access once
      expect(mockGetPublicEnvVar).toHaveBeenCalledTimes(2); // Once for each env var
    });

    it('should return existing client for subsequent calls', async () => {
      const result1 = await initializeClient();
      const result2 = await initializeClient();

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.client).toBe(result2.client);
    });
  });

  describe('Client Connectivity Testing', () => {
    it('should handle auth errors during connectivity test gracefully', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({ 
            data: null, 
            error: { message: 'JWT expired' } 
          }))
        }))
      });

      const result = await initializeClient();

      expect(result.success).toBe(true); // Auth errors are expected and ignored
    });

    it('should fail on non-auth database errors during connectivity test', async () => {
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