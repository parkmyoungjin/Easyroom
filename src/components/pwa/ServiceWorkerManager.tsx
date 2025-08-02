'use client';

import { useEffect, useState } from 'react';
import { deploymentIntegration, DeploymentInfo } from '@/lib/pwa/deployment-integration';

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isUpdating: boolean;
  error: string | null;
  deploymentInfo: DeploymentInfo | null;
}

/**
 * Service Worker Manager Component
 * Handles service worker registration and updates safely on client-side only
 */
export function ServiceWorkerManager() {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    isUpdating: false,
    error: null,
    deploymentInfo: null,
  });

  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return;
    }

    // 개발 모드에서는 Service Worker 기능을 완전히 비활성화
    if (process.env.NODE_ENV === 'development') {
      console.log('[ServiceWorkerManager] Completely disabled in development mode');
      // 기존 Service Worker가 있다면 제거
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(registration => {
            registration.unregister();
          });
        });
      }
      return;
    }

    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
      setState(prev => ({ ...prev, isSupported: false }));
      return;
    }

    setState(prev => ({ ...prev, isSupported: true }));

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none', // Always check for updates
        });

        console.log('Service Worker registered successfully:', registration.scope);
        setState(prev => ({ ...prev, isRegistered: true }));

        // Handle service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            setState(prev => ({ ...prev, isUpdating: true }));
            
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker is available
                console.log('New service worker available');
                setState(prev => ({ ...prev, isUpdating: false }));
                
                // Skip update prompts during authentication flows
                const isAuthPage = window.location.pathname.includes('/login') || 
                                 window.location.pathname.includes('/auth/') ||
                                 window.location.pathname.includes('/signup');
                
                if (!isAuthPage) {
                  // Only show update prompt if not on auth pages
                  if (window.confirm('새로운 버전이 사용 가능합니다. 지금 업데이트하시겠습니까?')) {
                    // '확인'을 누르면 대기 중인 새 워커에게 활성화되라는 메시지를 보냅니다.
                    if (newWorker) {
                      newWorker.postMessage({ type: 'ACTIVATE_NEW_WORKER' });
                    }
                  }
                } else {
                  console.log('[ServiceWorker] Skipping update prompt - user is on auth page');
                }
              }
            });
          }
        });

        // Handle service worker messages
        navigator.serviceWorker.addEventListener('message', (event) => {
          const { type, data } = event.data || {};
          
          switch (type) {
            case 'SW_UPDATED':
              console.log(`Service Worker updated to version ${data?.version}`);
              setState(prev => ({ ...prev, isUpdating: false }));
              break;
              
            case 'DEPLOYMENT_DETECTED':
              console.log('Deployment detected:', data);
              setState(prev => ({ ...prev, deploymentInfo: data }));
              break;
              
            case 'CACHE_UPDATED':
              console.log('Cache updated for:', data?.url);
              window.dispatchEvent(new CustomEvent('cache-updated', {
                detail: { url: data?.url, timestamp: data?.timestamp }
              }));
              break;
              
            case 'CACHE_INVALIDATED':
              console.log('Cache invalidated:', data);
              window.dispatchEvent(new CustomEvent('cache-invalidated', {
                detail: data
              }));
              break;
              
            case 'FORCE_RELOAD':
              console.log('Force reload requested:', data);
              window.location.reload();
              break;
              
            case 'QR_REFRESH_REQUEST':
              console.log('QR refresh request received');
              window.dispatchEvent(new CustomEvent('qr-refresh'));
              break;
              
            default:
              console.log('Unknown service worker message:', event.data);
          }
        });

        // Check for updates periodically (reduced frequency)
        setInterval(() => {
          // Skip updates during auth flows
          const isAuthPage = window.location.pathname.includes('/login') || 
                           window.location.pathname.includes('/auth/') ||
                           window.location.pathname.includes('/signup');
          
          if (!isAuthPage) {
            registration.update();
          }
        }, 5 * 60 * 1000); // Check every 5 minutes (reduced from 1 minute)

      } catch (error) {
        console.error('Service Worker registration failed:', error);
        setState(prev => ({ 
          ...prev, 
          error: error instanceof Error ? error.message : 'Registration failed' 
        }));
      }
    };

    // Initialize deployment integration
    const initializeDeploymentIntegration = () => {
      // Add deployment update listener
      deploymentIntegration.addUpdateListener((deploymentInfo) => {
        setState(prev => ({ ...prev, deploymentInfo }));
      });

      // Start deployment monitoring
      deploymentIntegration.forceUpdateCheck();
    };

    // Register service worker when page loads
    if (document.readyState === 'loading') {
      window.addEventListener('load', () => {
        registerServiceWorker();
        initializeDeploymentIntegration();
      });
    } else {
      registerServiceWorker();
      initializeDeploymentIntegration();
    }

    return () => {
      window.removeEventListener('load', registerServiceWorker);
      // Cleanup deployment integration
      deploymentIntegration.destroy();
    };
  }, []);

  // This component doesn't render anything visible
  return null;
}

/**
 * Hook for service worker functionality
 */
export function useServiceWorker() {
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      setIsSupported(true);
      
      navigator.serviceWorker.ready.then(() => {
        setIsRegistered(true);
      });
    }
  }, []);

  const sendMessage = (message: any) => {
    if (isSupported && isRegistered && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(message);
    }
  };

  return {
    isSupported,
    isRegistered,
    sendMessage,
  };
}