/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DeploymentUpdateNotification, useDeploymentUpdateNotification } from '@/components/pwa/DeploymentUpdateNotification';
import { deploymentIntegration, DeploymentInfo } from '@/lib/pwa/deployment-integration';

// Mock the deployment integration
jest.mock('@/lib/pwa/deployment-integration', () => ({
  deploymentIntegration: {
    addUpdateListener: jest.fn(),
    removeUpdateListener: jest.fn(),
    getCurrentDeploymentInfo: jest.fn(),
    invalidateAllCaches: jest.fn(),
    forceUpdateCheck: jest.fn(),
  },
}));

// Mock window.location.reload
const mockReload = jest.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});

describe('DeploymentUpdateNotification', () => {
  const mockDeploymentInfo: DeploymentInfo = {
    version: '2.0.0',
    buildId: 'build-123',
    timestamp: Date.now(),
    environment: 'production',
    gitCommit: 'abc123def456',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockReload.mockClear();
  });

  it('should not render when no deployment info is available', () => {
    (deploymentIntegration.getCurrentDeploymentInfo as jest.Mock).mockReturnValue(null);
    
    render(<DeploymentUpdateNotification />);
    
    expect(screen.queryByText('새 버전 사용 가능')).not.toBeInTheDocument();
  });

  it('should render notification when deployment info is available', async () => {
    (deploymentIntegration.getCurrentDeploymentInfo as jest.Mock).mockReturnValue(mockDeploymentInfo);
    
    // Mock the listener to immediately trigger update
    (deploymentIntegration.addUpdateListener as jest.Mock).mockImplementation((callback) => {
      setTimeout(() => callback(mockDeploymentInfo), 0);
    });

    render(<DeploymentUpdateNotification />);
    
    await waitFor(() => {
      expect(screen.getByText('새 버전 사용 가능')).toBeInTheDocument();
    });
    expect(screen.getByText('앱이 업데이트되었습니다 (v2.0.0)')).toBeInTheDocument();
    expect(screen.getByText('지금 업데이트')).toBeInTheDocument();
    expect(screen.getByText('나중에')).toBeInTheDocument();
  });

  it('should show environment info for non-production environments', async () => {
    const devDeploymentInfo = { ...mockDeploymentInfo, environment: 'development' as const };
    
    (deploymentIntegration.addUpdateListener as jest.Mock).mockImplementation((callback) => {
      setTimeout(() => callback(devDeploymentInfo), 0);
    });

    render(<DeploymentUpdateNotification />);
    
    await waitFor(() => {
      expect(screen.getByText('환경: development')).toBeInTheDocument();
    });
  });

  it('should handle update button click', async () => {
    (deploymentIntegration.invalidateAllCaches as jest.Mock).mockResolvedValue(undefined);
    (deploymentIntegration.addUpdateListener as jest.Mock).mockImplementation((callback) => {
      setTimeout(() => callback(mockDeploymentInfo), 0);
    });

    render(<DeploymentUpdateNotification />);
    
    await waitFor(() => {
      expect(screen.getByText('지금 업데이트')).toBeInTheDocument();
    });
    
    const updateButton = screen.getByText('지금 업데이트');
    fireEvent.click(updateButton);

    expect(screen.getByText('업데이트 중...')).toBeInTheDocument();
    expect(deploymentIntegration.invalidateAllCaches).toHaveBeenCalled();

    await waitFor(() => {
      expect(mockReload).toHaveBeenCalled();
    });
  });

  it('should handle dismiss button click', async () => {
    const mockOnDismiss = jest.fn();
    
    (deploymentIntegration.addUpdateListener as jest.Mock).mockImplementation((callback) => {
      setTimeout(() => callback(mockDeploymentInfo), 0);
    });

    render(<DeploymentUpdateNotification onDismiss={mockOnDismiss} />);
    
    await waitFor(() => {
      expect(screen.getByText('나중에')).toBeInTheDocument();
    });
    
    const dismissButton = screen.getByText('나중에');
    fireEvent.click(dismissButton);

    expect(mockOnDismiss).toHaveBeenCalled();
  });

  it('should auto-reload when autoReload is true', async () => {
    (deploymentIntegration.invalidateAllCaches as jest.Mock).mockResolvedValue(undefined);
    (deploymentIntegration.addUpdateListener as jest.Mock).mockImplementation((callback) => {
      setTimeout(() => callback(mockDeploymentInfo), 0);
    });

    render(<DeploymentUpdateNotification autoReload={true} />);
    
    await waitFor(() => {
      expect(screen.getByText('지금 업데이트')).toBeInTheDocument();
    });
    
    const updateButton = screen.getByText('지금 업데이트');
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(mockReload).toHaveBeenCalled();
    });
  });

  it('should hide dismiss button when showDismiss is false', async () => {
    (deploymentIntegration.addUpdateListener as jest.Mock).mockImplementation((callback) => {
      setTimeout(() => callback(mockDeploymentInfo), 0);
    });

    render(<DeploymentUpdateNotification showDismiss={false} />);
    
    await waitFor(() => {
      expect(screen.getByText('지금 업데이트')).toBeInTheDocument();
    });
    
    expect(screen.queryByText('나중에')).not.toBeInTheDocument();
  });

  it('should call onUpdate callback when deployment info is received', async () => {
    const mockOnUpdate = jest.fn();
    
    (deploymentIntegration.addUpdateListener as jest.Mock).mockImplementation((callback) => {
      setTimeout(() => callback(mockDeploymentInfo), 0);
    });

    render(<DeploymentUpdateNotification onUpdate={mockOnUpdate} />);
    
    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith(mockDeploymentInfo);
    });
  });

  it('should show debug info in development mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    (deploymentIntegration.addUpdateListener as jest.Mock).mockImplementation((callback) => {
      setTimeout(() => callback(mockDeploymentInfo), 0);
    });

    render(<DeploymentUpdateNotification />);
    
    await waitFor(() => {
      expect(screen.getByText(/Build ID: build-123/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Commit: abc123de/)).toBeInTheDocument();
    expect(screen.getByText('수동 업데이트 확인')).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('should handle force check button click in development', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    (deploymentIntegration.addUpdateListener as jest.Mock).mockImplementation((callback) => {
      setTimeout(() => callback(mockDeploymentInfo), 0);
    });

    render(<DeploymentUpdateNotification />);
    
    await waitFor(() => {
      expect(screen.getByText('수동 업데이트 확인')).toBeInTheDocument();
    });
    
    const forceCheckButton = screen.getByText('수동 업데이트 확인');
    fireEvent.click(forceCheckButton);

    expect(deploymentIntegration.forceUpdateCheck).toHaveBeenCalled();

    process.env.NODE_ENV = originalEnv;
  });

  it('should handle cache invalidation errors gracefully', async () => {
    (deploymentIntegration.invalidateAllCaches as jest.Mock).mockRejectedValue(new Error('Cache error'));
    (deploymentIntegration.addUpdateListener as jest.Mock).mockImplementation((callback) => {
      setTimeout(() => callback(mockDeploymentInfo), 0);
    });

    render(<DeploymentUpdateNotification />);
    
    await waitFor(() => {
      expect(screen.getByText('지금 업데이트')).toBeInTheDocument();
    });
    
    const updateButton = screen.getByText('지금 업데이트');
    fireEvent.click(updateButton);

    // Should show updating state
    expect(screen.getByText('업데이트 중...')).toBeInTheDocument();

    // Should handle error and reset state
    await waitFor(() => {
      expect(screen.getByText('지금 업데이트')).toBeInTheDocument();
    });

    expect(mockReload).not.toHaveBeenCalled();
  });

  it('should cleanup listeners on unmount', () => {
    const mockRemoveListener = jest.fn();
    (deploymentIntegration.removeUpdateListener as jest.Mock).mockImplementation(mockRemoveListener);

    const { unmount } = render(<DeploymentUpdateNotification />);
    
    unmount();

    expect(mockRemoveListener).toHaveBeenCalled();
  });
});

describe('useDeploymentUpdateNotification', () => {
  const mockDeploymentInfo: DeploymentInfo = {
    version: '2.0.0',
    buildId: 'build-123',
    timestamp: Date.now(),
    environment: 'production',
    gitCommit: 'abc123def456',
  };

  const TestComponent = () => {
    const { deploymentInfo, hasUpdate, applyUpdate, dismissUpdate, checkForUpdates } = useDeploymentUpdateNotification();
    
    return (
      <div>
        <div data-testid="has-update">{hasUpdate.toString()}</div>
        <div data-testid="version">{deploymentInfo?.version || 'none'}</div>
        <button onClick={applyUpdate}>Apply Update</button>
        <button onClick={dismissUpdate}>Dismiss</button>
        <button onClick={checkForUpdates}>Check Updates</button>
      </div>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockReload.mockClear();
  });

  it('should initialize with no update', () => {
    render(<TestComponent />);
    
    expect(screen.getByTestId('has-update')).toHaveTextContent('false');
    expect(screen.getByTestId('version')).toHaveTextContent('none');
  });

  it('should update state when deployment info is received', async () => {
    (deploymentIntegration.addUpdateListener as jest.Mock).mockImplementation((callback) => {
      setTimeout(() => callback(mockDeploymentInfo), 0);
    });

    render(<TestComponent />);
    
    await waitFor(() => {
      expect(screen.getByTestId('has-update')).toHaveTextContent('true');
    });
    expect(screen.getByTestId('version')).toHaveTextContent('2.0.0');
  });

  it('should apply update when applyUpdate is called', async () => {
    (deploymentIntegration.invalidateAllCaches as jest.Mock).mockResolvedValue(undefined);
    
    render(<TestComponent />);
    
    const applyButton = screen.getByText('Apply Update');
    fireEvent.click(applyButton);

    expect(deploymentIntegration.invalidateAllCaches).toHaveBeenCalled();
    
    await waitFor(() => {
      expect(mockReload).toHaveBeenCalled();
    });
  });

  it('should dismiss update when dismissUpdate is called', async () => {
    (deploymentIntegration.addUpdateListener as jest.Mock).mockImplementation((callback) => {
      setTimeout(() => callback(mockDeploymentInfo), 0);
    });

    render(<TestComponent />);
    
    // Wait for initial update to be received
    await waitFor(() => {
      expect(screen.getByTestId('has-update')).toHaveTextContent('true');
    });
    
    const dismissButton = screen.getByText('Dismiss');
    fireEvent.click(dismissButton);

    expect(screen.getByTestId('has-update')).toHaveTextContent('false');
  });

  it('should check for updates when checkForUpdates is called', () => {
    render(<TestComponent />);
    
    const checkButton = screen.getByText('Check Updates');
    fireEvent.click(checkButton);

    expect(deploymentIntegration.forceUpdateCheck).toHaveBeenCalled();
  });

  it('should cleanup listeners on unmount', () => {
    const mockRemoveListener = jest.fn();
    (deploymentIntegration.removeUpdateListener as jest.Mock).mockImplementation(mockRemoveListener);

    const { unmount } = render(<TestComponent />);
    
    unmount();

    expect(mockRemoveListener).toHaveBeenCalled();
  });
});