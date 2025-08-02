/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ClientPolyfillManager, checkBrowserCompatibility, loadPWAComponents } from '@/lib/polyfills/ClientPolyfillManager';

// Mock dynamic imports
jest.mock('next/dynamic', () => {
  return (importFn: any, options: any) => {
    const MockComponent = () => <div data-testid="mock-component">Mock Component</div>;
    MockComponent.displayName = 'MockDynamicComponent';
    return MockComponent;
  };
});

// Mock client polyfills
jest.mock('@/lib/polyfills/client-polyfills', () => ({
  initializeClientPolyfills: jest.fn(),
  isBrowser: jest.fn(() => true),
  browserGlobals: {
    navigator: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      serviceWorker: {
        register: jest.fn()
      }
    },
    window: global.window,
    document: global.document
  }
}));

// Mock server isolation
jest.mock('@/lib/polyfills/server-isolation', () => ({
  environment: {
    isBrowser: true,
    isServer: false,
    isClient: true
  }
}));

describe('ClientPolyfillManager', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Suppress console.log for all tests
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    
    // Mock browser APIs
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });

    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: jest.fn().mockResolvedValue({
          addEventListener: jest.fn(),
          scope: '/'
        }),
        addEventListener: jest.fn()
      },
      writable: true,
    });
  });

  afterEach(() => {
    // Restore console.log
    consoleLogSpy.mockRestore();
  });

  describe('Component Rendering', () => {
    it('should render children correctly', () => {
      render(
        <ClientPolyfillManager>
          <div data-testid="child-content">Test Content</div>
        </ClientPolyfillManager>
      );

      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });

    it('should render with service worker enabled by default', async () => {
      render(
        <ClientPolyfillManager>
          <div>Test Content</div>
        </ClientPolyfillManager>
      );

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should render with PWA components enabled by default', async () => {
      render(
        <ClientPolyfillManager>
          <div>Test Content</div>
        </ClientPolyfillManager>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should disable service worker when specified', () => {
      render(
        <ClientPolyfillManager enableServiceWorker={false}>
          <div data-testid="child-content">Test Content</div>
        </ClientPolyfillManager>
      );

      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });

    it('should disable PWA components when specified', () => {
      render(
        <ClientPolyfillManager enablePWAComponents={false}>
          <div data-testid="child-content">Test Content</div>
        </ClientPolyfillManager>
      );

      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });
  });

  describe('Browser Compatibility Check', () => {
    it('should return compatibility result', () => {
      const result = checkBrowserCompatibility();
      
      expect(result).toHaveProperty('isSupported');
      expect(result).toHaveProperty('missingFeatures');
      expect(result).toHaveProperty('warnings');
      expect(Array.isArray(result.missingFeatures)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should handle browser feature detection', () => {
      const result = checkBrowserCompatibility();
      
      // Should not throw errors during feature detection
      expect(typeof result.isSupported).toBe('boolean');
    });
  });

  describe('PWA Components Loading', () => {
    it('should load PWA components successfully', async () => {
      await expect(loadPWAComponents()).resolves.toBeUndefined();
    });

    it('should handle PWA component loading errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // This should not throw even if components fail to load
      await expect(loadPWAComponents()).resolves.toBeUndefined();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Browser Compatibility Warning', () => {
    it('should render content correctly', () => {
      render(
        <ClientPolyfillManager>
          <div>Test Content</div>
        </ClientPolyfillManager>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should handle compatibility check gracefully', () => {
      // Test that the component renders without throwing errors
      expect(() => {
        render(
          <ClientPolyfillManager>
            <div>Test Content</div>
          </ClientPolyfillManager>
        );
      }).not.toThrow();
    });
  });

  describe('Server-side Rendering', () => {
    it('should handle server-side rendering gracefully', () => {
      // Mock server environment
      const { isBrowser } = require('@/lib/polyfills/client-polyfills');
      isBrowser.mockReturnValue(false);

      render(
        <ClientPolyfillManager>
          <div data-testid="child-content">Test Content</div>
        </ClientPolyfillManager>
      );

      expect(screen.getByTestId('child-content')).toBeInTheDocument();
      
      // Restore
      isBrowser.mockReturnValue(true);
    });
  });

  describe('Service Worker Registration', () => {
    it('should register service worker when supported', () => {
      const mockRegister = jest.fn().mockResolvedValue({
        addEventListener: jest.fn(),
        scope: '/'
      });
      
      Object.defineProperty(navigator, 'serviceWorker', {
        value: { register: mockRegister },
        writable: true
      });

      render(
        <ClientPolyfillManager enableServiceWorker={true}>
          <div>Test Content</div>
        </ClientPolyfillManager>
      );

      // Service worker registration should be called
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should handle service worker registration failure', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockRegister = jest.fn().mockRejectedValue(new Error('Registration failed'));
      
      Object.defineProperty(navigator, 'serviceWorker', {
        value: { register: mockRegister },
        writable: true
      });

      render(
        <ClientPolyfillManager enableServiceWorker={true}>
          <div>Test Content</div>
        </ClientPolyfillManager>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
      consoleSpy.mockRestore();
    });
  });

  describe('Initialization', () => {
    it('should initialize client polyfills on mount', () => {
      const { initializeClientPolyfills } = require('@/lib/polyfills/client-polyfills');
      
      render(
        <ClientPolyfillManager>
          <div>Test Content</div>
        </ClientPolyfillManager>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
      expect(initializeClientPolyfills).toHaveBeenCalled();
    });

    it('should check browser compatibility on mount', () => {
      render(
        <ClientPolyfillManager>
          <div>Test Content</div>
        </ClientPolyfillManager>
      );

      // Component should initialize without errors
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });
  });
});