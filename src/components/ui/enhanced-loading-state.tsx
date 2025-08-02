'use client';

import { AlertCircle, CheckCircle, Clock, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getNetworkStatus } from '@/lib/utils/auth-timeout';
import { getAuthErrorHandler } from '@/lib/utils/auth-error-handler';

export type LoadingStep = 
  | 'initializing'
  | 'authenticating' 
  | 'loading-profile'
  | 'redirecting'
  | 'finalizing';

export interface LoadingStateProps {
  isLoading: boolean;
  error?: string | null;
  success?: boolean;
  title?: string;
  description?: string;
  progress?: number;
  showNetworkStatus?: boolean;
  showRetryButton?: boolean;
  showErrorDetails?: boolean;
  onRetry?: () => void;
  onCancel?: () => void;
  className?: string;
}

export function EnhancedLoadingState({
  isLoading,
  error,
  success = false,
  title,
  description,
  progress,
  showNetworkStatus = true,
  showRetryButton = true,
  showErrorDetails = false,
  onRetry,
  onCancel,
  className = ''
}: LoadingStateProps) {
  const [networkStatus, setNetworkStatus] = useState(getNetworkStatus());
  const [errorDetails, setErrorDetails] = useState<any>(null);

  // Update network status periodically
  useEffect(() => {
    if (!showNetworkStatus) return;

    const updateNetworkStatus = () => {
      setNetworkStatus(getNetworkStatus());
    };

    const interval = setInterval(updateNetworkStatus, 2000);
    
    // Listen for online/offline events
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
    };
  }, [showNetworkStatus]);

  // Analyze error details when error changes
  useEffect(() => {
    if (error && showErrorDetails) {
      const errorHandler = getAuthErrorHandler();
      const patterns = errorHandler.analyzeErrorPatterns();
      setErrorDetails(patterns);
    } else {
      setErrorDetails(null);
    }
  }, [error, showErrorDetails]);

  // Success state
  if (success && !isLoading && !error) {
    return (
      <Card className={`w-full max-w-md mx-auto ${className}`}>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-green-800">
            {title || '완료되었습니다'}
          </CardTitle>
          {description && (
            <CardDescription className="text-green-600">
              {description}
            </CardDescription>
          )}
        </CardHeader>
      </Card>
    );
  }

  // Error state
  if (error && !isLoading) {
    return (
      <Card className={`w-full max-w-md mx-auto ${className}`}>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-red-100 rounded-full">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-red-800">
            {title || '오류가 발생했습니다'}
          </CardTitle>
          <CardDescription className="text-red-600">
            {error}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Network Status */}
          {showNetworkStatus && (
            <div className="flex items-center justify-center space-x-2 text-sm">
              {networkStatus.isOnline ? (
                <>
                  <Wifi className="h-4 w-4 text-green-500" />
                  <span className="text-green-600">온라인</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-500" />
                  <span className="text-red-600">오프라인</span>
                </>
              )}
              {networkStatus.effectiveType && (
                <span className="text-gray-500">
                  ({networkStatus.effectiveType})
                </span>
              )}
            </div>
          )}

          {/* Error Details */}
          {errorDetails && errorDetails.patterns.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <h4 className="text-sm font-medium text-yellow-800 mb-2">
                감지된 패턴:
              </h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                {errorDetails.patterns.map((pattern: string, index: number) => (
                  <li key={index}>• {pattern}</li>
                ))}
              </ul>
              {errorDetails.suggestions.length > 0 && (
                <>
                  <h4 className="text-sm font-medium text-yellow-800 mt-3 mb-2">
                    권장 조치:
                  </h4>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {errorDetails.suggestions.map((suggestion: string, index: number) => (
                      <li key={index}>• {suggestion}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2">
            {showRetryButton && onRetry && (
              <Button 
                onClick={onRetry} 
                className="flex-1"
                variant="default"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                다시 시도
              </Button>
            )}
            {onCancel && (
              <Button 
                onClick={onCancel} 
                variant="outline"
                className="flex-1"
              >
                취소
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className={`w-full max-w-md mx-auto ${className}`}>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Clock className="h-6 w-6 text-blue-600 animate-pulse" />
            </div>
          </div>
          <CardTitle className="text-blue-800">
            {title || '처리 중입니다'}
          </CardTitle>
          {description && (
            <CardDescription className="text-blue-600">
              {description}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progress Bar */}
          {typeof progress === 'number' && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-center text-gray-600">
                {Math.round(progress)}% 완료
              </p>
            </div>
          )}

          {/* Loading Spinner */}
          {typeof progress !== 'number' && (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {/* Network Status */}
          {showNetworkStatus && (
            <div className="flex items-center justify-center space-x-2 text-sm">
              {networkStatus.isOnline ? (
                <>
                  <Wifi className="h-4 w-4 text-green-500" />
                  <span className="text-green-600">연결됨</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-500" />
                  <span className="text-red-600">연결 끊김</span>
                </>
              )}
            </div>
          )}

          {/* Cancel Button */}
          {onCancel && (
            <div className="flex justify-center">
              <Button 
                onClick={onCancel} 
                variant="outline"
                size="sm"
              >
                취소
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Default state (no loading, no error, no success)
  return null;
}

// Hook for using enhanced loading state
export function useEnhancedLoadingState() {
  const [state, setState] = useState({
    isLoading: false,
    error: null as string | null,
    success: false,
    progress: undefined as number | undefined
  });

  const setLoading = (loading: boolean, progress?: number) => {
    setState(prev => {
      // Only update if there's actually a change to prevent unnecessary re-renders
      if (prev.isLoading === loading && prev.progress === progress && !prev.error && !prev.success) {
        return prev;
      }
      return { 
        ...prev, 
        isLoading: loading, 
        error: null, 
        success: false,
        progress 
      };
    });
  };

  const setError = (error: string | null) => {
    setState(prev => {
      if (prev.error === error && !prev.isLoading && !prev.success) {
        return prev;
      }
      return { 
        ...prev, 
        isLoading: false, 
        error, 
        success: false,
        progress: undefined 
      };
    });
  };

  const setSuccess = (success: boolean = true) => {
    setState(prev => {
      if (prev.success === success && !prev.isLoading && !prev.error) {
        return prev;
      }
      return { 
        ...prev, 
        isLoading: false, 
        error: null, 
        success,
        progress: success ? 100 : undefined 
      };
    });
  };

  const reset = () => {
    setState(prev => {
      // Only reset if there's something to reset
      if (!prev.isLoading && !prev.error && !prev.success && prev.progress === undefined) {
        return prev;
      }
      return {
        isLoading: false,
        error: null,
        success: false,
        progress: undefined
      };
    });
  };

  return {
    ...state,
    setLoading,
    setError,
    setSuccess,
    reset
  };
}