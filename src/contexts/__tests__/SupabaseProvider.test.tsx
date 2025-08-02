import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { SupabaseProvider, useSupabase, useSupabaseClient, useSupabaseStatus } from '../SupabaseProvider';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

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

// Mock the auth-helpers client creation
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createPagesBrowserClient: jest.fn()
}));

import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
const mockCreatePagesBrowserClient = createPagesBrowserClient as jest.MockedFunction<typeof createPagesBrowserClient>;

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getSession: jest.fn(),
    onAuthStateChange: jest.fn()
  },
  from: jest.fn()
} as unknown as SupabaseClient<Database>;

// Test component that uses the hooks
function TestComponent() {
  const { client, isReady, error } = useSupabase();

  return (
    <div>
      <div data-testid="ready">{isReady ? 'ready' : 'not-ready'}</div>
      <div data-testid="client">{client ? 'has-client' : 'no-client'}</div>
      <div data-testid="error">{error ? error.message : 'no-error'}</div>
      <div data-testid="status">{isReady ? 'ready' : 'not-ready'}</div>
    </div>
  );
}

function TestClientComponent() {
  try {
    return <div data-testid="client-hook">success</div>;
  } catch (error) {
    return <div data-testid="client-hook">error: {(error as Error).message}</div>;
  }
}

function TestStatusComponent() {
  const { isReady, isLoading, hasError } = useSupabaseStatus();

  return (
    <div>
      <div data-testid="status-ready">{isReady ? 'ready' : 'not-ready'}</div>
      <div data-testid="status-loading">{isLoading ? 'loading' : 'not-loading'}</div>
      <div data-testid="status-error">{hasError ? 'has-error' : 'no-error'}</div>
    </div>
  );
}

describe('SupabaseProvider', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Suppress console logs and errors for all tests
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Default successful initialization
    mockCreatePagesBrowserClient.mockReturnValue(mockSupabaseClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Provider initialization', () => {
    it('should initialize client successfully', async () => {
      render(
        <SupabaseProvider>
          <TestComponent />
        </SupabaseProvider>
      );

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByTestId('ready')).toHaveTextContent('ready');
        expect(screen.getByTestId('client')).toHaveTextContent('has-client');
        expect(screen.getByTestId('error')).toHaveTextContent('no-error');
      });
    });

    it('should handle initialization failure', async () => {
      const errorMessage = 'Failed to initialize client';
      mockCreatePagesBrowserClient.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      render(
        <SupabaseProvider>
          <TestComponent />
        </SupabaseProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('ready')).toHaveTextContent('not-ready');
        expect(screen.getByTestId('client')).toHaveTextContent('no-client');
        expect(screen.getByTestId('error')).toHaveTextContent(errorMessage);
      });
    });

    it('should handle initialization exception', async () => {
      const errorMessage = 'Network error';
      mockCreatePagesBrowserClient.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      render(
        <SupabaseProvider>
          <TestComponent />
        </SupabaseProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('ready')).toHaveTextContent('not-ready');
        expect(screen.getByTestId('client')).toHaveTextContent('no-client');
        expect(screen.getByTestId('error')).toHaveTextContent(errorMessage);
      });
    });
  });

  describe('useSupabaseClient hook', () => {
    it('should return client when ready', async () => {
      render(
        <SupabaseProvider>
          <TestClientComponent />
        </SupabaseProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('client-hook')).toHaveTextContent('success');
      });
    });

    it('should return null when client not ready due to error', async () => {
      const errorMessage = 'Client initialization failed';
      mockCreatePagesBrowserClient.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      render(
        <SupabaseProvider>
          <TestClientComponent />
        </SupabaseProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('client-hook')).toHaveTextContent('success');
      });
    });
  });

  describe('useSupabaseStatus hook', () => {
    it('should return correct status information', async () => {
      render(
        <SupabaseProvider>
          <TestStatusComponent />
        </SupabaseProvider>
      );

      // Initially loading
      expect(screen.getByTestId('status-loading')).toHaveTextContent('loading');

      // Wait for ready state
      await waitFor(() => {
        expect(screen.getByTestId('status-ready')).toHaveTextContent('ready');
        expect(screen.getByTestId('status-loading')).toHaveTextContent('not-loading');
        expect(screen.getByTestId('status-error')).toHaveTextContent('no-error');
      });
    });
  });

  describe('context functionality', () => {
    it('should provide client context successfully', async () => {
      function TestContextComponent() {
        const { client, isReady, error } = useSupabase();
        return (
          <div>
            <div data-testid="context-ready">{isReady ? 'ready' : 'not-ready'}</div>
            <div data-testid="context-client">{client ? 'has-client' : 'no-client'}</div>
            <div data-testid="context-error">{error ? 'has-error' : 'no-error'}</div>
          </div>
        );
      }

      render(
        <SupabaseProvider>
          <TestContextComponent />
        </SupabaseProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('context-ready')).toHaveTextContent('ready');
        expect(screen.getByTestId('context-client')).toHaveTextContent('has-client');
        expect(screen.getByTestId('context-error')).toHaveTextContent('no-error');
      });
    });
  });

  describe('error handling', () => {
    it('should throw error when useSupabase is used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useSupabase must be used within a SupabaseProvider');

      consoleSpy.mockRestore();
    });
  });
});