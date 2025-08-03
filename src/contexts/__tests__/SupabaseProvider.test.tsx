import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { SupabaseProvider, useSupabaseClient } from '../SupabaseProvider';
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

// Mock the SSR client creation
jest.mock('@supabase/ssr', () => ({
  createBrowserClient: jest.fn()
}));

import { createBrowserClient } from '@supabase/ssr';
const mockCreateBrowserClient = createBrowserClient as jest.MockedFunction<typeof createBrowserClient>;

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getSession: jest.fn(),
    onAuthStateChange: jest.fn()
  },
  from: jest.fn()
} as unknown as SupabaseClient<Database>;

// Test component that uses the hooks
function TestClientComponent() {
  const client = useSupabaseClient();
  
  return (
    <div>
      <div data-testid="client">{client ? 'has-client' : 'no-client'}</div>
    </div>
  );
}

describe('SupabaseProvider', () => {
  beforeEach(() => {
    // Default successful initialization
    mockCreateBrowserClient.mockReturnValue(mockSupabaseClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Provider initialization', () => {
    it('should initialize client successfully', async () => {
      render(
        <SupabaseProvider>
          <TestClientComponent />
        </SupabaseProvider>
      );

      expect(screen.getByTestId('client')).toHaveTextContent('has-client');
    });

    it('should handle initialization failure by throwing error', () => {
      const errorMessage = 'Failed to initialize client';
      mockCreateBrowserClient.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      // Should throw error during initialization
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(
          <SupabaseProvider>
            <TestClientComponent />
          </SupabaseProvider>
        );
      }).toThrow(errorMessage);
      
      consoleSpy.mockRestore();
    });
  });

  describe('useSupabaseClient hook', () => {
    it('should return client when provider is available', () => {
      render(
        <SupabaseProvider>
          <TestClientComponent />
        </SupabaseProvider>
      );

      expect(screen.getByTestId('client')).toHaveTextContent('has-client');
    });

    it('should return null when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // When used outside provider, context will be null (default value)
      render(<TestClientComponent />);
      
      // Should show no-client since context is null
      expect(screen.getByTestId('client')).toHaveTextContent('no-client');

      consoleSpy.mockRestore();
    });
  });
});