'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { LoadingStep } from '@/components/ui/enhanced-loading-state';
import { 
  createTimeoutHandler, 
  DEFAULT_TIMEOUT_CONFIG,
  createAuthTimeoutError,
  getNetworkStatus
} from '@/lib/utils/auth-timeout';

export interface LoadingStateManager {
  currentStep: LoadingStep | null;
  isLoading: boolean;
  isTimedOut: boolean;
  elapsedTime: number;
  networkStatus: ReturnType<typeof getNetworkStatus>;
  
  // Actions
  setLoadingStep: (step: LoadingStep, message?: string) => void;
  clearLoadingState: () => void;
  handleTimeout: () => void;
  handleManualRefresh: () => void;
  
  // Utilities
  isStepTimeout: (step: LoadingStep) => boolean;
  getStepDuration: (step: LoadingStep) => number;
}

interface LoadingStepConfig {
  step: LoadingStep;
  message?: string;
  startTime: number;
  timeoutThreshold: number;
}

const STEP_TIMEOUT_THRESHOLDS: Record<LoadingStep, number> = {
  initializing: 10000,      // 10 seconds
  authenticating: 15000,    // 15 seconds  
  'loading-profile': 8000,  // 8 seconds
  redirecting: 5000,        // 5 seconds
  finalizing: 3000,         // 3 seconds
};

export function useEnhancedLoadingState(): LoadingStateManager {
  const [currentStepConfig, setCurrentStepConfig] = useState<LoadingStepConfig | null>(null);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [networkStatus, setNetworkStatus] = useState(getNetworkStatus());
  
  const timeoutHandler = useRef(createTimeoutHandler(DEFAULT_TIMEOUT_CONFIG));
  const elapsedTimeInterval = useRef<NodeJS.Timeout | null>(null);

  // Update elapsed time every second
  useEffect(() => {
    if (currentStepConfig) {
      elapsedTimeInterval.current = setInterval(() => {
        const elapsed = Date.now() - currentStepConfig.startTime;
        setElapsedTime(elapsed);
        
        // Check for step-specific timeout
        if (elapsed > currentStepConfig.timeoutThreshold && !isTimedOut) {
          setIsTimedOut(true);
          handleTimeout();
        }
      }, 1000);
    } else {
      if (elapsedTimeInterval.current) {
        clearInterval(elapsedTimeInterval.current);
        elapsedTimeInterval.current = null;
      }
      setElapsedTime(0);
    }

    return () => {
      if (elapsedTimeInterval.current) {
        clearInterval(elapsedTimeInterval.current);
      }
    };
  }, [currentStepConfig, isTimedOut]);

  // Monitor network status
  useEffect(() => {
    const updateNetworkStatus = () => {
      setNetworkStatus(getNetworkStatus());
    };

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    // Update network status periodically
    const networkInterval = setInterval(updateNetworkStatus, 5000);

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
      clearInterval(networkInterval);
    };
  }, []);

  const setLoadingStep = useCallback((step: LoadingStep, message?: string) => {
    const startTime = Date.now();
    const timeoutThreshold = STEP_TIMEOUT_THRESHOLDS[step];
    
    setCurrentStepConfig({
      step,
      message,
      startTime,
      timeoutThreshold
    });
    
    setIsTimedOut(false);
    setElapsedTime(0);

    // Set up timeout for this specific step
    timeoutHandler.current.startTimeout('authTimeout', () => {
      setIsTimedOut(true);
      console.warn(`Loading step '${step}' timed out after ${timeoutThreshold}ms`);
    });

    console.log(`Loading step started: ${step}${message ? ` - ${message}` : ''}`);
  }, []);

  const clearLoadingState = useCallback(() => {
    setCurrentStepConfig(null);
    setIsTimedOut(false);
    setElapsedTime(0);
    timeoutHandler.current.clearAllTimeouts();
    
    if (elapsedTimeInterval.current) {
      clearInterval(elapsedTimeInterval.current);
      elapsedTimeInterval.current = null;
    }

    console.log('Loading state cleared');
  }, []);

  const handleTimeout = useCallback(() => {
    if (!currentStepConfig) return;

    const error = createAuthTimeoutError(
      'auth_timeout',
      elapsedTime,
      () => window.location.reload()
    );

    console.error('Loading timeout occurred:', {
      step: currentStepConfig.step,
      elapsedTime,
      threshold: currentStepConfig.timeoutThreshold,
      error
    });

    // You can emit this error to a global error handler if needed
    // For now, we just log it and let the UI handle the timeout state
  }, [currentStepConfig, elapsedTime]);

  const handleManualRefresh = useCallback(() => {
    console.log('Manual refresh triggered by user');
    
    // Clear current loading state
    clearLoadingState();
    
    // Attempt to refresh the page or restart the process
    try {
      // If there's a specific refresh handler, use it
      // Otherwise, reload the page
      window.location.reload();
    } catch (error) {
      console.error('Manual refresh failed:', error);
      // Fallback to hard refresh
      window.location.href = window.location.href;
    }
  }, [clearLoadingState]);

  const isStepTimeout = useCallback((step: LoadingStep) => {
    if (!currentStepConfig || currentStepConfig.step !== step) {
      return false;
    }
    
    const elapsed = Date.now() - currentStepConfig.startTime;
    return elapsed > STEP_TIMEOUT_THRESHOLDS[step];
  }, [currentStepConfig]);

  const getStepDuration = useCallback((step: LoadingStep) => {
    if (!currentStepConfig || currentStepConfig.step !== step) {
      return 0;
    }
    
    return Date.now() - currentStepConfig.startTime;
  }, [currentStepConfig]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timeoutHandler.current.clearAllTimeouts();
      if (elapsedTimeInterval.current) {
        clearInterval(elapsedTimeInterval.current);
      }
    };
  }, []);

  return {
    currentStep: currentStepConfig?.step || null,
    isLoading: !!currentStepConfig,
    isTimedOut,
    elapsedTime,
    networkStatus,
    
    // Actions
    setLoadingStep,
    clearLoadingState,
    handleTimeout,
    handleManualRefresh,
    
    // Utilities
    isStepTimeout,
    getStepDuration
  };
}

// Utility function to create loading step sequences
export function createLoadingSequence(steps: Array<{ step: LoadingStep; message?: string; duration?: number }>) {
  return {
    steps,
    async execute(
      loadingManager: LoadingStateManager,
      onStepComplete?: (step: LoadingStep) => void | Promise<void>
    ) {
      for (const { step, message, duration = 1000 } of steps) {
        loadingManager.setLoadingStep(step, message);
        
        // Execute step logic if provided
        if (onStepComplete) {
          try {
            await onStepComplete(step);
          } catch (error) {
            console.error(`Error in loading step '${step}':`, error);
            throw error;
          }
        }
        
        // Wait for minimum duration to show the step
        await new Promise(resolve => setTimeout(resolve, duration));
      }
      
      loadingManager.clearLoadingState();
    }
  };
}

// Pre-defined loading sequences for common scenarios
export const LOADING_SEQUENCES = {
  authentication: createLoadingSequence([
    { step: 'initializing' as LoadingStep, message: '시스템을 초기화하고 있습니다...', duration: 1000 },
    { step: 'authenticating' as LoadingStep, message: '사용자 인증을 확인하고 있습니다...', duration: 2000 },
    { step: 'loading-profile' as LoadingStep, message: '사용자 프로필을 불러오고 있습니다...', duration: 1500 },
    { step: 'finalizing' as LoadingStep, message: '설정을 완료하고 있습니다...', duration: 500 }
  ]),
  
  postLogin: createLoadingSequence([
    { step: 'loading-profile' as LoadingStep, message: '사용자 정보를 확인하고 있습니다...', duration: 1000 },
    { step: 'redirecting' as LoadingStep, message: '적절한 페이지로 이동하고 있습니다...', duration: 1500 },
    { step: 'finalizing' as LoadingStep, message: '준비를 완료하고 있습니다...', duration: 500 }
  ]),
  
  pageLoad: createLoadingSequence([
    { step: 'initializing' as LoadingStep, message: '페이지를 준비하고 있습니다...', duration: 800 },
    { step: 'loading-profile' as LoadingStep, message: '사용자 정보를 확인하고 있습니다...', duration: 1200 },
    { step: 'finalizing' as LoadingStep, message: '로딩을 완료하고 있습니다...', duration: 500 }
  ])
};