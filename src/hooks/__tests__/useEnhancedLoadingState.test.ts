import { renderHook, act } from '@testing-library/react';
import { useEnhancedLoadingState } from '../useEnhancedLoadingState';

// Mock the auth-timeout utilities
jest.mock('@/lib/utils/auth-timeout', () => ({
  createTimeoutHandler: jest.fn(() => ({
    startTimeout: jest.fn(),
    clearAllTimeouts: jest.fn(),
  })),
  DEFAULT_TIMEOUT_CONFIG: {},
  createAuthTimeoutError: jest.fn(() => new Error('Timeout')),
  getNetworkStatus: jest.fn(() => ({ isOnline: true, connectionType: 'unknown' })),
}));

describe('useEnhancedLoadingState', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.log for all tests
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.log
    consoleLogSpy.mockRestore();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useEnhancedLoadingState());

    expect(result.current.currentStep).toBe(null);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isTimedOut).toBe(false);
    expect(result.current.elapsedTime).toBe(0);
    expect(result.current.networkStatus).toEqual({ isOnline: true, connectionType: 'unknown' });
  });

  it('should provide all required methods', () => {
    const { result } = renderHook(() => useEnhancedLoadingState());

    expect(typeof result.current.setLoadingStep).toBe('function');
    expect(typeof result.current.clearLoadingState).toBe('function');
    expect(typeof result.current.handleTimeout).toBe('function');
    expect(typeof result.current.handleManualRefresh).toBe('function');
    expect(typeof result.current.isStepTimeout).toBe('function');
    expect(typeof result.current.getStepDuration).toBe('function');
  });

  it('should set loading step correctly', () => {
    const { result } = renderHook(() => useEnhancedLoadingState());

    act(() => {
      result.current.setLoadingStep('initializing', 'Test message');
    });

    expect(result.current.currentStep).toBe('initializing');
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isTimedOut).toBe(false);
    expect(result.current.elapsedTime).toBe(0);
  });

  it('should clear loading state correctly', () => {
    const { result } = renderHook(() => useEnhancedLoadingState());

    // Set loading step first
    act(() => {
      result.current.setLoadingStep('authenticating');
    });

    expect(result.current.isLoading).toBe(true);

    // Then clear
    act(() => {
      result.current.clearLoadingState();
    });

    expect(result.current.currentStep).toBe(null);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isTimedOut).toBe(false);
    expect(result.current.elapsedTime).toBe(0);
  });

  it('should handle different loading steps', () => {
    const { result } = renderHook(() => useEnhancedLoadingState());

    const steps = ['initializing', 'authenticating', 'loading-profile', 'redirecting', 'finalizing'] as const;

    steps.forEach(step => {
      act(() => {
        result.current.setLoadingStep(step, `Testing ${step}`);
      });

      expect(result.current.currentStep).toBe(step);
      expect(result.current.isLoading).toBe(true);
    });
  });

  it('should reset timeout state when setting new step', () => {
    const { result } = renderHook(() => useEnhancedLoadingState());

    // Set a step and simulate timeout
    act(() => {
      result.current.setLoadingStep('initializing');
    });

    // Set a new step
    act(() => {
      result.current.setLoadingStep('authenticating');
    });

    expect(result.current.currentStep).toBe('authenticating');
    expect(result.current.isTimedOut).toBe(false);
    expect(result.current.elapsedTime).toBe(0);
  });

  it('should handle manual refresh', () => {
    const { result } = renderHook(() => useEnhancedLoadingState());

    // Mock window.location.reload
    const mockReload = jest.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: mockReload },
      writable: true
    });

    act(() => {
      result.current.setLoadingStep('initializing');
    });

    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.handleManualRefresh();
    });

    expect(mockReload).toHaveBeenCalled();
  });

  it('should check step timeout correctly', () => {
    const { result } = renderHook(() => useEnhancedLoadingState());

    act(() => {
      result.current.setLoadingStep('initializing');
    });

    // Initially should not be timed out
    expect(result.current.isStepTimeout('initializing')).toBe(false);
    
    // Should return false for different step
    expect(result.current.isStepTimeout('authenticating')).toBe(false);
  });

  it('should get step duration correctly', () => {
    const { result } = renderHook(() => useEnhancedLoadingState());

    act(() => {
      result.current.setLoadingStep('initializing');
    });

    // Should return a duration >= 0
    expect(result.current.getStepDuration('initializing')).toBeGreaterThanOrEqual(0);
    
    // Should return 0 for different step
    expect(result.current.getStepDuration('authenticating')).toBe(0);
  });
});