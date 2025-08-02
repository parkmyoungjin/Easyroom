'use client';

import { useEffect, useState } from 'react';
import { deploymentIntegration, DeploymentInfo } from '@/lib/pwa/deployment-integration';

interface DeploymentUpdateNotificationProps {
  onUpdate?: (deploymentInfo: DeploymentInfo) => void;
  onDismiss?: () => void;
  autoReload?: boolean;
  showDismiss?: boolean;
}

/**
 * Deployment Update Notification Component
 * Shows user-friendly notifications when new deployments are available
 */
export function DeploymentUpdateNotification({
  onUpdate,
  onDismiss,
  autoReload = false,
  showDismiss = true
}: DeploymentUpdateNotificationProps) {
  const [deploymentInfo, setDeploymentInfo] = useState<DeploymentInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Listen for deployment updates
    const handleDeploymentUpdate = (info: DeploymentInfo) => {
      setDeploymentInfo(info);
      setIsVisible(true);
      onUpdate?.(info);
    };

    deploymentIntegration.addUpdateListener(handleDeploymentUpdate);

    // Check for existing deployment info
    const currentInfo = deploymentIntegration.getCurrentDeploymentInfo();
    if (currentInfo) {
      setDeploymentInfo(currentInfo);
    }

    return () => {
      deploymentIntegration.removeUpdateListener(handleDeploymentUpdate);
    };
  }, [onUpdate]);

  const handleUpdate = async () => {
    setIsUpdating(true);
    
    try {
      // Invalidate caches and reload
      await deploymentIntegration.invalidateAllCaches();
      
      if (autoReload) {
        window.location.reload();
      } else {
        // Give user control over reload timing
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    } catch (error) {
      console.error('Failed to apply update:', error);
      setIsUpdating(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  const handleForceCheck = () => {
    deploymentIntegration.forceUpdateCheck();
  };

  if (!isVisible || !deploymentInfo) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 animate-in slide-in-from-right-2">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
            새 버전 사용 가능
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            앱이 업데이트되었습니다 (v{deploymentInfo.version})
          </div>
          {deploymentInfo.environment !== 'production' && (
            <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
              환경: {deploymentInfo.environment}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex space-x-2">
        <button
          onClick={handleUpdate}
          disabled={isUpdating}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium py-2 px-3 rounded-md transition-colors duration-200 flex items-center justify-center"
        >
          {isUpdating ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              업데이트 중...
            </>
          ) : (
            '지금 업데이트'
          )}
        </button>
        
        {showDismiss && (
          <button
            onClick={handleDismiss}
            className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors duration-200"
          >
            나중에
          </button>
        )}
      </div>

      {/* Development/Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <div>Build ID: {deploymentInfo.buildId}</div>
            <div>Timestamp: {new Date(deploymentInfo.timestamp).toLocaleString()}</div>
            {deploymentInfo.gitCommit && (
              <div>Commit: {deploymentInfo.gitCommit.substring(0, 8)}</div>
            )}
          </div>
          <button
            onClick={handleForceCheck}
            className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            수동 업데이트 확인
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Hook for deployment update notifications
 */
export function useDeploymentUpdateNotification() {
  const [deploymentInfo, setDeploymentInfo] = useState<DeploymentInfo | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    const handleUpdate = (info: DeploymentInfo) => {
      setDeploymentInfo(info);
      setHasUpdate(true);
    };

    deploymentIntegration.addUpdateListener(handleUpdate);

    return () => {
      deploymentIntegration.removeUpdateListener(handleUpdate);
    };
  }, []);

  const applyUpdate = async () => {
    await deploymentIntegration.invalidateAllCaches();
    window.location.reload();
  };

  const dismissUpdate = () => {
    setHasUpdate(false);
  };

  const checkForUpdates = () => {
    return deploymentIntegration.forceUpdateCheck();
  };

  return {
    deploymentInfo,
    hasUpdate,
    applyUpdate,
    dismissUpdate,
    checkForUpdates
  };
}