'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { initializeClientPolyfills, isBrowser, browserGlobals } from './client-polyfills';
import { environment } from './server-isolation';

// Dynamic imports for browser-specific components
const ServiceWorkerManager = dynamic(
  () => import('@/components/pwa/ServiceWorkerManager').then(mod => ({ default: mod.ServiceWorkerManager })),
  { 
    ssr: false,
    loading: () => null
  }
);

const InstallPrompt = dynamic(
  () => import('@/components/pwa/InstallPrompt'),
  { 
    ssr: false,
    loading: () => null
  }
);

const OfflineHandler = dynamic(
  () => import('@/components/pwa/OfflineHandler'),
  { 
    ssr: false,
    loading: () => null
  }
);

const DeploymentUpdateNotification = dynamic(
  () => import('@/components/pwa/DeploymentUpdateNotification').then(mod => ({ default: mod.DeploymentUpdateNotification })),
  { 
    ssr: false,
    loading: () => null
  }
);

interface BrowserCompatibilityResult {
  isSupported: boolean;
  missingFeatures: string[];
  warnings: string[];
}

interface ClientPolyfillManagerProps {
  children: React.ReactNode;
  enableServiceWorker?: boolean;
  enablePWAComponents?: boolean;
}

/**
 * Client-side polyfill manager component
 * Handles browser-specific code loading and compatibility checks
 */
export function ClientPolyfillManager({ 
  children, 
  enableServiceWorker = process.env.NODE_ENV !== 'development',
  enablePWAComponents = process.env.NODE_ENV !== 'development' 
}: ClientPolyfillManagerProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [compatibility, setCompatibility] = useState<BrowserCompatibilityResult | null>(null);
  const [serviceWorkerLoaded, setServiceWorkerLoaded] = useState(false);

  useEffect(() => {
    if (!isBrowser()) {
      return;
    }

    // Initialize client polyfills
    initializeClientPolyfills();
    
    // Check browser compatibility
    const compatibilityResult = checkBrowserCompatibility();
    setCompatibility(compatibilityResult);
    
    // 개발 모드에서는 Service Worker 비활성화
    if (process.env.NODE_ENV === 'development') {
      console.log('[ClientPolyfillManager] Service Worker disabled in development mode');
      setIsInitialized(true);
      return;
    }
    
    // Load service worker if enabled and supported
    if (enableServiceWorker && compatibilityResult.isSupported) {
      loadServiceWorker().then(() => {
        setServiceWorkerLoaded(true);
      }).catch(error => {
        console.warn('Failed to load service worker:', error);
      });
    }

    setIsInitialized(true);
  }, [enableServiceWorker]);

  // Don't render anything on server
  if (!isBrowser()) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      {isInitialized && enableServiceWorker && serviceWorkerLoaded && (
        <ServiceWorkerManager />
      )}
      {isInitialized && enablePWAComponents && compatibility?.isSupported && (
        <>
          <InstallPrompt />
          <OfflineHandler />
          <DeploymentUpdateNotification />
        </>
      )}
      {compatibility && !compatibility.isSupported && (
        <BrowserCompatibilityWarning compatibility={compatibility} />
      )}
    </>
  );
}

/**
 * Load service worker with proper error handling
 */
async function loadServiceWorker(): Promise<void> {
  if (!isBrowser() || !browserGlobals.navigator) {
    return;
  }

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      
      console.log('Service Worker registered successfully:', registration);
      
      // Handle service worker updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker is available
              console.log('New service worker available');
              // You can show a notification to the user here
            }
          });
        }
      });
      
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      throw error;
    }
  } else {
    throw new Error('Service Worker not supported');
  }
}

/**
 * Load PWA components dynamically
 */
export async function loadPWAComponents(): Promise<void> {
  if (!isBrowser()) {
    return;
  }

  try {
    // Dynamic import of PWA-related modules
    const [
      { default: installPrompt },
      { default: offlineHandler }
    ] = await Promise.all([
      import('@/components/pwa/InstallPrompt').catch(() => ({ default: null })),
      import('@/components/pwa/OfflineHandler').catch(() => ({ default: null }))
    ]);

    if (installPrompt) {
      console.log('PWA install prompt loaded');
    }
    
    if (offlineHandler) {
      console.log('PWA offline handler loaded');
    }
  } catch (error) {
    console.warn('Failed to load PWA components:', error);
  }
}

/**
 * Check browser compatibility for required features
 */
export function checkBrowserCompatibility(): BrowserCompatibilityResult {
  if (!isBrowser()) {
    return {
      isSupported: false,
      missingFeatures: ['Browser environment not available'],
      warnings: []
    };
  }

  const missingFeatures: string[] = [];
  const warnings: string[] = [];

  // Check for essential browser features
  const requiredFeatures = [
    { name: 'localStorage', check: () => 'localStorage' in window },
    { name: 'sessionStorage', check: () => 'sessionStorage' in window },
    { name: 'fetch', check: () => 'fetch' in window },
    { name: 'Promise', check: () => 'Promise' in window },
    { name: 'addEventListener', check: () => 'addEventListener' in window }
  ];

  const optionalFeatures = [
    { name: 'serviceWorker', check: () => 'serviceWorker' in navigator },
    { name: 'Notification', check: () => 'Notification' in window },
    { name: 'indexedDB', check: () => 'indexedDB' in window },
    { name: 'crypto', check: () => 'crypto' in window },
    { name: 'geolocation', check: () => navigator.geolocation !== undefined }
  ];

  // Check required features
  for (const feature of requiredFeatures) {
    try {
      if (!feature.check()) {
        missingFeatures.push(feature.name);
      }
    } catch (error) {
      missingFeatures.push(feature.name);
    }
  }

  // Check optional features (warnings only)
  for (const feature of optionalFeatures) {
    try {
      if (!feature.check()) {
        warnings.push(`Optional feature ${feature.name} not available`);
      }
    } catch (error) {
      warnings.push(`Failed to check feature ${feature.name}`);
    }
  }

  // Check browser version compatibility
  const userAgent = browserGlobals.navigator?.userAgent || '';
  
  // Check for very old browsers
  if (userAgent.includes('MSIE') || userAgent.includes('Trident/')) {
    warnings.push('Internet Explorer detected - some features may not work properly');
  }

  // Check for mobile browsers
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  if (isMobile) {
    warnings.push('Mobile browser detected - PWA features available');
  }

  return {
    isSupported: missingFeatures.length === 0,
    missingFeatures,
    warnings
  };
}

/**
 * Browser compatibility warning component
 */
function BrowserCompatibilityWarning({ compatibility }: { compatibility: BrowserCompatibilityResult }) {
  if (compatibility.isSupported) {
    return null;
  }

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#f59e0b',
        color: 'white',
        padding: '8px 16px',
        textAlign: 'center',
        zIndex: 9999,
        fontSize: '14px'
      }}
    >
      <strong>브라우저 호환성 경고:</strong> 일부 기능이 제대로 작동하지 않을 수 있습니다.
      {compatibility.missingFeatures.length > 0 && (
        <div style={{ fontSize: '12px', marginTop: '4px' }}>
          누락된 기능: {compatibility.missingFeatures.join(', ')}
        </div>
      )}
    </div>
  );
}

/**
 * Hook for using client polyfill manager
 */
export function useClientPolyfillManager() {
  const [isReady, setIsReady] = useState(false);
  const [compatibility, setCompatibility] = useState<BrowserCompatibilityResult | null>(null);

  useEffect(() => {
    if (isBrowser()) {
      initializeClientPolyfills();
      const compatibilityResult = checkBrowserCompatibility();
      setCompatibility(compatibilityResult);
      setIsReady(true);
    }
  }, []);

  return {
    isReady,
    isBrowser: isBrowser(),
    compatibility,
    loadServiceWorker,
    loadPWAComponents
  };
}