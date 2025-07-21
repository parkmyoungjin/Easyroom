import { renderHook, act } from '@testing-library/react';
import { useEnhancedLoadingState } from '@/components/ui/enhanced-loading-state';

describe('useEnhancedLoadingState', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useEnhancedLoadingState());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.success).toBe(false);
    expect(result.current.progress).toBe(undefined);
  });

  it('should set loading state correctly', () => {
    const { result } = renderHook(() => useEnhancedLoadingState());

    act(() => {
      result.current.setLoading(true, 50);
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe(null);
    expect(result.current.success).toBe(false);
    expect(result.current.progress).toBe(50);
  });

  it('should set error state correctly', () => {
    const { result } = renderHook(() => useEnhancedLoadingState());

    act(() => {
      result.current.setError('Test error message');
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('Test error message');
    expect(result.current.success).toBe(false);
    expect(result.current.progress).toBe(undefined);
  });

  it('should set success state correctly', () => {
    const { result } = renderHook(() => useEnhancedLoadingState());

    act(() => {
      result.current.setSuccess(true);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.success).toBe(true);
    expect(result.current.progress).toBe(100);
  });

  it('should reset state correctly', () => {
    const { result } = renderHook(() => useEnhancedLoadingState());

    // Set some state first
    act(() => {
      result.current.setLoading(true, 75);
    });

    // Then reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.success).toBe(false);
    expect(result.current.progress).toBe(undefined);
  });

  it('should clear error when setting loading', () => {
    const { result } = renderHook(() => useEnhancedLoadingState());

    // Set error first
    act(() => {
      result.current.setError('Test error');
    });

    // Then set loading
    act(() => {
      result.current.setLoading(true);
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe(null);
    expect(result.current.success).toBe(false);
  });

  it('should clear success when setting error', () => {
    const { result } = renderHook(() => useEnhancedLoadingState());

    // Set success first
    act(() => {
      result.current.setSuccess(true);
    });

    // Then set error
    act(() => {
      result.current.setError('Test error');
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('Test error');
    expect(result.current.success).toBe(false);
  });
});