'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface OfflineState {
  isOnline: boolean;
  wasOffline: boolean;
  showOfflineMessage: boolean;
}

/**
 * Offline Handler Component
 * Manages offline/online state and shows appropriate messages
 */
export default function OfflineHandler() {
  const [state, setState] = useState<OfflineState>({
    isOnline: true,
    wasOffline: false,
    showOfflineMessage: false,
  });

  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return;
    }

    // Initialize online state
    const initialOnlineState = navigator.onLine;
    setState(prev => ({ ...prev, isOnline: initialOnlineState }));

    const handleOnline = () => {
      setState(prev => ({
        ...prev,
        isOnline: true,
        showOfflineMessage: prev.wasOffline, // Show "back online" message if was offline
      }));

      // Hide the message after 3 seconds
      setTimeout(() => {
        setState(prev => ({ ...prev, showOfflineMessage: false, wasOffline: false }));
      }, 3000);
    };

    const handleOffline = () => {
      setState(prev => ({
        ...prev,
        isOnline: false,
        wasOffline: true,
        showOfflineMessage: true,
      }));
    };

    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for service worker messages about cache updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'CACHE_UPDATED') {
          console.log('Cache updated, content available offline');
        }
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  const handleDismiss = () => {
    setState(prev => ({ ...prev, showOfflineMessage: false }));
  };

  if (!state.showOfflineMessage) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 md:left-1/2 md:right-auto md:transform md:-translate-x-1/2 md:w-96 z-50">
      <div className={`rounded-lg shadow-lg p-4 ${
        state.isOnline 
          ? 'bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700' 
          : 'bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700'
      }`}>
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            {state.isOnline ? (
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-medium ${
              state.isOnline 
                ? 'text-green-800 dark:text-green-200' 
                : 'text-yellow-800 dark:text-yellow-200'
            }`}>
              {state.isOnline ? '연결 복구됨' : '오프라인 모드'}
            </h3>
            <p className={`text-sm mt-1 ${
              state.isOnline 
                ? 'text-green-600 dark:text-green-300' 
                : 'text-yellow-600 dark:text-yellow-300'
            }`}>
              {state.isOnline 
                ? '인터넷 연결이 복구되었습니다.' 
                : '인터넷 연결을 확인하세요. 일부 기능이 제한될 수 있습니다.'
              }
            </p>
            {!state.isOnline && (
              <div className="flex space-x-2 mt-3">
                <Button
                  size="sm"
                  onClick={handleRetry}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white"
                >
                  다시 시도
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDismiss}
                  className="border-yellow-300 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-600 dark:text-yellow-300 dark:hover:bg-yellow-800"
                >
                  확인
                </Button>
              </div>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className={`flex-shrink-0 ${
              state.isOnline 
                ? 'text-green-400 hover:text-green-500 dark:hover:text-green-300' 
                : 'text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for offline functionality
 */
export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return;
    }

    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}