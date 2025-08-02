import { render, screen, fireEvent } from '@testing-library/react';
import { EnhancedLoadingState } from '@/components/ui/enhanced-loading-state';

// Mock the auth error handler
jest.mock('@/lib/utils/auth-error-handler', () => ({
  getAuthErrorHandler: () => ({
    analyzeErrorPatterns: () => ({
      patterns: ['Test pattern'],
      suggestions: ['Test suggestion'],
      severity: 'medium'
    })
  })
}));

// Mock the auth timeout utilities
jest.mock('@/lib/utils/auth-timeout', () => ({
  getNetworkStatus: () => ({
    isOnline: true,
    effectiveType: '4g'
  })
}));

describe('EnhancedLoadingState', () => {
  it('should render loading state correctly', () => {
    render(
      <EnhancedLoadingState
        isLoading={true}
        title="Test Loading"
        description="Loading test data"
      />
    );

    expect(screen.getByText('Test Loading')).toBeInTheDocument();
    expect(screen.getByText('Loading test data')).toBeInTheDocument();
    expect(screen.getByText('연결됨')).toBeInTheDocument();
  });

  it('should render error state correctly', () => {
    const mockRetry = jest.fn();
    
    render(
      <EnhancedLoadingState
        isLoading={false}
        error="Test error message"
        title="Error Title"
        onRetry={mockRetry}
        showErrorDetails={true}
      />
    );

    expect(screen.getByText('Error Title')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
    expect(screen.getByText('다시 시도')).toBeInTheDocument();
    
    // Test retry button
    fireEvent.click(screen.getByText('다시 시도'));
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('should render success state correctly', () => {
    render(
      <EnhancedLoadingState
        isLoading={false}
        success={true}
        title="Success Title"
        description="Operation completed successfully"
      />
    );

    expect(screen.getByText('Success Title')).toBeInTheDocument();
    expect(screen.getByText('Operation completed successfully')).toBeInTheDocument();
  });

  it('should show progress bar when progress is provided', () => {
    render(
      <EnhancedLoadingState
        isLoading={true}
        progress={75}
        title="Loading with Progress"
      />
    );

    expect(screen.getByText('75% 완료')).toBeInTheDocument();
  });

  it('should show cancel button when onCancel is provided', () => {
    const mockCancel = jest.fn();
    
    render(
      <EnhancedLoadingState
        isLoading={true}
        onCancel={mockCancel}
      />
    );

    const cancelButton = screen.getByText('취소');
    expect(cancelButton).toBeInTheDocument();
    
    fireEvent.click(cancelButton);
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it('should not render when not loading, no error, and no success', () => {
    const { container } = render(
      <EnhancedLoadingState
        isLoading={false}
        error={null}
        success={false}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should show error details when enabled', () => {
    render(
      <EnhancedLoadingState
        isLoading={false}
        error="Test error"
        showErrorDetails={true}
      />
    );

    expect(screen.getByText('감지된 패턴:')).toBeInTheDocument();
    expect(screen.getByText('• Test pattern')).toBeInTheDocument();
    expect(screen.getByText('권장 조치:')).toBeInTheDocument();
    expect(screen.getByText('• Test suggestion')).toBeInTheDocument();
  });

  it('should hide network status when disabled', () => {
    render(
      <EnhancedLoadingState
        isLoading={true}
        showNetworkStatus={false}
      />
    );

    expect(screen.queryByText('연결됨')).not.toBeInTheDocument();
  });

  it('should hide retry button when disabled', () => {
    render(
      <EnhancedLoadingState
        isLoading={false}
        error="Test error"
        showRetryButton={false}
      />
    );

    expect(screen.queryByText('다시 시도')).not.toBeInTheDocument();
  });
});