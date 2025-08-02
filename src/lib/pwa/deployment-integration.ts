/**
 * Service Worker Deployment Integration
 * Handles automatic version updates and cache invalidation on deployment
 */

// ✅ secure-environment-access에서 사용하는 키 타입을 import하거나 직접 정의합니다.
// 여기서는 이 파일에서 사용하는 키만 명시적으로 정의합니다.
type PublicDeploymentEnvKey = 'NEXT_PUBLIC_APP_VERSION' | 'NEXT_PUBLIC_BUILD_ID';


export interface DeploymentInfo {
  version: string;
  buildId: string;
  timestamp: number;
  environment: 'development' | 'production' | 'staging';
  gitCommit?: string;
  gitBranch?: string;
}

export interface UpdateNotificationOptions {
  title: string;
  message: string;
  actionText: string;
  dismissText?: string;
  autoReload?: boolean;
  timeout?: number;
}

/**
 * Deployment Integration Manager
 * Manages service worker updates and cache invalidation during deployments
 */
export class DeploymentIntegrationManager {
  private static instance: DeploymentIntegrationManager;
  private currentVersion: string | null = null;
  private updateCheckInterval: NodeJS.Timeout | null = null;
  private listeners: Set<(info: DeploymentInfo) => void> = new Set();

  private constructor() {
    // ✅ 비동기 초기화를 호출합니다.
    this.initializeVersionTracking();
  }

  static getInstance(): DeploymentIntegrationManager {
    if (!DeploymentIntegrationManager.instance) {
      DeploymentIntegrationManager.instance = new DeploymentIntegrationManager();
    }
    return DeploymentIntegrationManager.instance;
  }

  /**
   * Initialize version tracking and update checking
   */
  // ✅ 비동기 초기화를 위해 async로 변경합니다.
  private async initializeVersionTracking(): Promise<void> {
    if (typeof window === 'undefined') return;

    // ✅ await를 사용하여 비동기 버전 확인을 기다립니다.
    this.currentVersion = await this.getCurrentVersion();
    console.log(`[DeploymentManager] Initialized with version: ${this.currentVersion}`);
    
    // 개발 모드에서는 업데이트 체크 비활성화
    if (process.env.NODE_ENV !== 'development') {
      this.startUpdateChecking();
      
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.checkForUpdates();
        }
      });
    } else {
      console.log('[DeploymentManager] Update checking disabled in development mode');
    }
    
    this.setupServiceWorkerListener();
  }

  /**
   * Helper method to get environment variables asynchronously
   */
  // ✅ key 타입을 엄격하게 제한하여 타입 에러를 해결합니다.
  private async getEnvVarAsync(key: PublicDeploymentEnvKey): Promise<string | undefined> {
    try {
      const { getPublicEnvVar } = await import('@/lib/security/secure-environment-access');
      // ✅ 이제 key의 타입이 getPublicEnvVar가 허용하는 타입의 일부이므로 안전합니다.
      return await getPublicEnvVar(key, 'deployment-integration');
    } catch {
      return undefined;
    }
  }

  /**
   * Get current application version
   */
  // ✅ 비동기 작업을 포함하므로 async 함수로 변경하고 Promise를 반환하도록 수정합니다.
  private async getCurrentVersion(): Promise<string> {
    try {
      // 1. 환경 변수에서 비동기적으로 가져오기
      const appVersion = await this.getEnvVarAsync('NEXT_PUBLIC_APP_VERSION');
      if (appVersion) return appVersion;

      const buildId = await this.getEnvVarAsync('NEXT_PUBLIC_BUILD_ID');
      if (buildId) return buildId;

      // 2. 동기적으로 DOM과 스토리지에서 가져오기
      const metaVersion = document.querySelector('meta[name="version"]')?.getAttribute('content');
      if (metaVersion) return metaVersion;

      const storageVersion = localStorage.getItem('app-version');
      if (storageVersion) return storageVersion;
    } catch (error) {
      console.warn('Failed to get application version from sources:', error);
    }

    // 3. 모든 방법 실패 시 폴백 버전 반환
    return '1.0.0';
  }

  /**
   * Start periodic update checking
   */
  private startUpdateChecking(): void {
    this.updateCheckInterval = setInterval(() => {
      // Skip updates during auth flows
      if (typeof window !== 'undefined') {
        const isAuthPage = window.location.pathname.includes('/login') || 
                         window.location.pathname.includes('/auth/') ||
                         window.location.pathname.includes('/signup');
        
        if (!isAuthPage) {
          this.checkForUpdates();
        } else {
          console.log('[DeploymentManager] Skipping update check - user is on auth page');
        }
      }
    }, 10 * 60 * 1000); // Check every 10 minutes (increased from 5 minutes)

    // Delay initial check to avoid conflicts during startup
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        const isAuthPage = window.location.pathname.includes('/login') || 
                         window.location.pathname.includes('/auth/') ||
                         window.location.pathname.includes('/signup');
        
        if (!isAuthPage) {
          this.checkForUpdates();
        }
      }
    }, 60000); // Increased from 30 seconds to 1 minute
  }

  /**
   * Setup service worker message listener
   */
  private setupServiceWorkerListener(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        const { type, data } = event.data || {};

        switch (type) {
          case 'SW_UPDATED':
            this.handleServiceWorkerUpdate(data);
            break;
          case 'DEPLOYMENT_DETECTED':
            this.handleDeploymentDetected(data);
            break;
          case 'CACHE_INVALIDATED':
            this.handleCacheInvalidated(data);
            break;
        }
      });
    }
  }

  /**
   * Check for application updates
   */
  async checkForUpdates(): Promise<void> {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.update();
      }

      const deploymentInfo = await this.fetchDeploymentInfo();
      if (deploymentInfo && this.isNewVersion(deploymentInfo.version)) {
        this.notifyListeners(deploymentInfo);
        this.handleNewDeployment(deploymentInfo);
      }
    } catch (error) {
      console.warn('Failed to check for updates:', error);
    }
  }

  /**
   * Fetch deployment information from server
   */
  private async fetchDeploymentInfo(): Promise<DeploymentInfo | null> {
    try {
      const endpoints = [
        '/api/deployment-info',
        '/deployment-info.json',
        '/_next/static/deployment-info.json'
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            cache: 'no-cache',
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
          });

          if (response.ok) {
            const info = await response.json();
            return {
              version: info.version || info.buildId || this.currentVersion || '1.0.0',
              buildId: info.buildId || info.version || Date.now().toString(),
              timestamp: info.timestamp || Date.now(),
              environment: info.environment || 'production',
              gitCommit: info.gitCommit,
              gitBranch: info.gitBranch
            };
          }
        } catch (error) {
          console.warn(`Failed to fetch from ${endpoint}:`, error);
        }
      }

      let environment: 'development' | 'production' | 'staging' = 'production';
      try {
        const { getPublicEnvVar } = await import('@/lib/security/secure-environment-access');
        environment = getPublicEnvVar('NODE_ENV', 'deployment-fallback') as 'development' | 'production' | 'staging';
      } catch (e) {
        console.warn('Could not determine NODE_ENV for deployment info fallback.');
      }
      
      return {
        version: this.currentVersion || '1.0.0',
        buildId: Date.now().toString(),
        timestamp: Date.now(),
        environment
      };
    } catch (error) {
      console.warn('Failed to fetch deployment info:', error);
      return null;
    }
  }

  // ... 이하 모든 코드는 변경 없이 그대로 유지 ...
    /**
   * Check if version is newer than current
   */
  private isNewVersion(version: string): boolean {
    if (!this.currentVersion) return true;
    
    // Simple version comparison (can be enhanced for semantic versioning)
    return version !== this.currentVersion;
  }

  /**
   * Handle new deployment detected
   */
  private async handleNewDeployment(deploymentInfo: DeploymentInfo): Promise<void> {
    console.log('New deployment detected:', deploymentInfo);

    // Update stored version
    this.currentVersion = deploymentInfo.version;
    localStorage.setItem('app-version', deploymentInfo.version);
    localStorage.setItem('deployment-info', JSON.stringify(deploymentInfo));

    // Invalidate caches
    await this.invalidateAllCaches();

    // Show update notification
    this.showUpdateNotification({
      title: '새 버전 사용 가능',
      message: `앱이 업데이트되었습니다 (v${deploymentInfo.version}). 새로고침하여 최신 기능을 사용하세요.`,
      actionText: '지금 업데이트',
      dismissText: '나중에',
      autoReload: false,
      timeout: 30000 // 30 seconds
    });
  }

  /**
   * Handle service worker update
   */
  private handleServiceWorkerUpdate(data: any): void {
    console.log('Service worker updated:', data);
    
    // Force cache refresh
    this.invalidateAllCaches();
    
    // Show notification
    this.showUpdateNotification({
      title: '서비스 워커 업데이트',
      message: '백그라운드 서비스가 업데이트되었습니다. 새로고침하여 변경사항을 적용하세요.',
      actionText: '새로고침',
      autoReload: true
    });
  }

  /**
   * Handle deployment detected by service worker
   */
  private handleDeploymentDetected(data: any): void {
    console.log('Deployment detected by service worker:', data);
    this.checkForUpdates();
  }

  /**
   * Handle cache invalidated event
   */
  private handleCacheInvalidated(data: any): void {
    console.log('Cache invalidated:', data);
    
    // Dispatch custom event for components to react
    window.dispatchEvent(new CustomEvent('cache-invalidated', {
      detail: data
    }));
  }

  /**
   * Invalidate all caches
   */
  async invalidateAllCaches(): Promise<void> {
    try {
      // Clear service worker caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
        console.log('All caches invalidated');
      }

      // Clear browser storage
      localStorage.removeItem('app-cache-timestamp');
      sessionStorage.clear();

      // Notify service worker to clear its caches
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'INVALIDATE_CACHES',
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Failed to invalidate caches:', error);
    }
  }

  /**
   * Show update notification to user
   */
  private showUpdateNotification(options: UpdateNotificationOptions): void {
    // Skip notifications during auth flows
    const isAuthPage = window.location.pathname.includes('/login') || 
                     window.location.pathname.includes('/auth/') ||
                     window.location.pathname.includes('/signup');
    
    if (isAuthPage) {
      console.log('[DeploymentManager] Skipping update notification - user is on auth page');
      return;
    }
    
    // Create notification element
    const notification = this.createNotificationElement(options);
    document.body.appendChild(notification);

    // Auto-dismiss after timeout
    if (options.timeout) {
      setTimeout(() => {
        this.dismissNotification(notification);
      }, options.timeout);
    }
  }

  /**
   * Create notification DOM element
   */
  private createNotificationElement(options: UpdateNotificationOptions): HTMLElement {
    const notification = document.createElement('div');
    notification.className = 'deployment-update-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #1f2937;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      z-index: 10000;
      max-width: 400px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      line-height: 1.4;
      animation: slideIn 0.3s ease-out;
    `;

    notification.innerHTML = `
      <div style="margin-bottom: 12px;">
        <div style="font-weight: 600; margin-bottom: 4px;">${options.title}</div>
        <div style="opacity: 0.9;">${options.message}</div>
      </div>
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        ${options.dismissText ? `
          <button class="dismiss-btn" style="
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: white;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
          ">${options.dismissText}</button>
        ` : ''}
        <button class="action-btn" style="
          background: #3b82f6;
          border: none;
          color: white;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
        ">${options.actionText}</button>
      </div>
    `;

    // Add styles for animation
    if (!document.querySelector('#deployment-notification-styles')) {
      const styles = document.createElement('style');
      styles.id = 'deployment-notification-styles';
      styles.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .deployment-update-notification button:hover {
          opacity: 0.8;
        }
      `;
      document.head.appendChild(styles);
    }

    // Add event listeners
    const actionBtn = notification.querySelector('.action-btn');
    const dismissBtn = notification.querySelector('.dismiss-btn');

    actionBtn?.addEventListener('click', () => {
      if (options.autoReload) {
        window.location.reload();
      } else {
        this.applyUpdate();
      }
      this.dismissNotification(notification);
    });

    dismissBtn?.addEventListener('click', () => {
      this.dismissNotification(notification);
    });

    return notification;
  }

  /**
   * Dismiss notification
   */
  private dismissNotification(notification: HTMLElement): void {
    notification.style.animation = 'slideOut 0.3s ease-in forwards';
    notification.style.setProperty('--slide-out', 'translateX(100%)');
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }

  /**
   * Apply update (reload page)
   */
  private applyUpdate(): void {
    // Clear any remaining caches before reload
    this.invalidateAllCaches().finally(() => {
      window.location.reload();
    });
  }

  /**
   * Add listener for deployment updates
   */
  addUpdateListener(listener: (info: DeploymentInfo) => void): void {
    this.listeners.add(listener);
  }

  /**
   * Remove listener for deployment updates
   */
  removeUpdateListener(listener: (info: DeploymentInfo) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(info: DeploymentInfo): void {
    this.listeners.forEach(listener => {
      try {
        listener(info);
      } catch (error) {
        console.error('Error in deployment update listener:', error);
      }
    });
  }

  /**
   * Force check for updates
   */
  forceUpdateCheck(): Promise<void> {
    return this.checkForUpdates();
  }

  /**
   * Get current deployment info
   */
  getCurrentDeploymentInfo(): DeploymentInfo | null {
    try {
      const stored = localStorage.getItem('deployment-info');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
    this.listeners.clear();
  }
}

// Export singleton instance
export const deploymentIntegration = DeploymentIntegrationManager.getInstance();