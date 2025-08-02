/**
 * @jest-environment jsdom
 */

import { DeploymentIntegrationManager, deploymentIntegration, DeploymentInfo } from '@/lib/pwa/deployment-integration';

// Mock fetch
global.fetch = jest.fn();

// Mock service worker
const mockServiceWorker = {
  ready: Promise.resolve({
    update: jest.fn(),
    addEventListener: jest.fn(),
  }),
  addEventListener: jest.fn(),
  controller: {
    postMessage: jest.fn(),
  },
};

Object.defineProperty(navigator, 'serviceWorker', {
  value: mockServiceWorker,
  writable: true,
});

// Mock caches
const mockCaches = {
  keys: jest.fn(),
  delete: jest.fn(),
  open: jest.fn(),
};

Object.defineProperty(global, 'caches', {
  value: mockCaches,
  writable: true,
});

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('DeploymentIntegrationManager', () => {
  let manager: DeploymentIntegrationManager;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set required environment variables
    process.env.NEXT_PUBLIC_APP_VERSION = '1.0.0';
    process.env.NEXT_PUBLIC_BUILD_ID = 'test-build-123';
    
    // COMPLETE STERILE FIELD: Suppress all console output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    manager = DeploymentIntegrationManager.getInstance();
    
    // Reset fetch mock
    (fetch as jest.Mock).mockClear();
    
    // Reset localStorage mock
    mockLocalStorage.getItem.mockReturnValue(null);
    mockLocalStorage.setItem.mockImplementation(() => {});
    mockLocalStorage.removeItem.mockImplementation(() => {});
    
    // Reset caches mock
    mockCaches.keys.mockResolvedValue([]);
    mockCaches.delete.mockResolvedValue(true);
    mockCaches.open.mockResolvedValue({
      match: jest.fn(),
      put: jest.fn(),
    });
  });

  afterEach(() => {
    manager.destroy();
    // Restore all console methods after each test
    jest.restoreAllMocks();
  });

  describe('Deployment Detection', () => {
    it('should detect new deployment when version changes', async () => {
      const mockDeploymentInfo: DeploymentInfo = {
        version: '2.0.0',
        buildId: 'build-123',
        timestamp: Date.now(),
        environment: 'production',
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDeploymentInfo),
      });

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        version: '1.0.0',
        buildId: 'build-122',
        timestamp: Date.now() - 1000,
        environment: 'production',
      }));

      const updateListener = jest.fn();
      manager.addUpdateListener(updateListener);

      await manager.checkForUpdates();

      expect(updateListener).toHaveBeenCalledWith(mockDeploymentInfo);
    });

    it('should not trigger update for same version', async () => {
      const mockDeploymentInfo: DeploymentInfo = {
        version: '1.0.0',
        buildId: 'build-123',
        timestamp: Date.now(),
        environment: 'production',
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDeploymentInfo),
      });

      // Set the current version to match the fetched version
      (manager as any).currentVersion = '1.0.0';
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockDeploymentInfo));

      const updateListener = jest.fn();
      manager.addUpdateListener(updateListener);

      await manager.checkForUpdates();

      expect(updateListener).not.toHaveBeenCalled();
    });

    it('should handle fetch errors gracefully', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const updateListener = jest.fn();
      manager.addUpdateListener(updateListener);

      await expect(manager.checkForUpdates()).resolves.not.toThrow();
      expect(updateListener).not.toHaveBeenCalled();
    });

    it('should try multiple endpoints for deployment info', async () => {
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('404'))
        .mockRejectedValueOnce(new Error('404'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            version: '2.0.0',
            buildId: 'build-123',
            timestamp: Date.now(),
            environment: 'production',
          }),
        });

      await manager.checkForUpdates();

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(fetch).toHaveBeenCalledWith('/api/deployment-info', expect.any(Object));
      expect(fetch).toHaveBeenCalledWith('/deployment-info.json', expect.any(Object));
      expect(fetch).toHaveBeenCalledWith('/_next/static/deployment-info.json', expect.any(Object));
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate all caches', async () => {
      const mockCacheNames = ['cache-1', 'cache-2', 'cache-3'];
      mockCaches.keys.mockResolvedValue(mockCacheNames);
      mockCaches.delete.mockResolvedValue(true);

      await manager.invalidateAllCaches();

      expect(mockCaches.keys).toHaveBeenCalled();
      expect(mockCaches.delete).toHaveBeenCalledTimes(3);
      mockCacheNames.forEach(cacheName => {
        expect(mockCaches.delete).toHaveBeenCalledWith(cacheName);
      });
    });

    it('should clear localStorage and sessionStorage', async () => {
      const mockSessionStorage = {
        clear: jest.fn(),
      };
      Object.defineProperty(global, 'sessionStorage', {
        value: mockSessionStorage,
        writable: true,
      });

      await manager.invalidateAllCaches();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('app-cache-timestamp');
      expect(mockSessionStorage.clear).toHaveBeenCalled();
    });

    it('should notify service worker to clear caches', async () => {
      await manager.invalidateAllCaches();

      expect(mockServiceWorker.controller.postMessage).toHaveBeenCalledWith({
        type: 'INVALIDATE_CACHES',
        timestamp: expect.any(Number),
      });
    });

    it('should handle cache invalidation errors gracefully', async () => {
      mockCaches.keys.mockRejectedValue(new Error('Cache error'));

      await expect(manager.invalidateAllCaches()).resolves.not.toThrow();
    });
  });

  describe('Update Notifications', () => {
    it('should show update notification with correct options', async () => {
      const mockCreateElement = jest.spyOn(document, 'createElement');
      const mockAppendChild = jest.spyOn(document.body, 'appendChild');
      
      const mockElement = {
        className: '',
        style: { cssText: '' },
        innerHTML: '',
        querySelector: jest.fn().mockReturnValue({
          addEventListener: jest.fn(),
        }),
        addEventListener: jest.fn(),
      };
      
      mockCreateElement.mockReturnValue(mockElement as any);
      mockAppendChild.mockImplementation(() => mockElement as any);

      // Mock window.location.pathname to avoid auth page check
      Object.defineProperty(window, 'location', {
        value: { pathname: '/dashboard' },
        writable: true,
      });

      // Trigger notification through deployment detection
      const deploymentInfo: DeploymentInfo = {
        version: '2.0.0',
        buildId: 'build-123',
        timestamp: Date.now(),
        environment: 'production',
      };

      // Access private method through type assertion
      await (manager as any).handleNewDeployment(deploymentInfo);

      expect(mockCreateElement).toHaveBeenCalledWith('div');
      expect(mockAppendChild).toHaveBeenCalled();
    });

    it('should handle notification dismissal', () => {
      const mockElement = {
        style: { animation: '', setProperty: jest.fn() },
        parentNode: { removeChild: jest.fn() },
      };

      // Access private method through type assertion
      (manager as any).dismissNotification(mockElement);

      expect(mockElement.style.animation).toBe('slideOut 0.3s ease-in forwards');
    });
  });

  describe('Service Worker Integration', () => {
    it('should update service worker on deployment', async () => {
      const mockRegistration = {
        update: jest.fn(),
      };
      mockServiceWorker.ready = Promise.resolve(mockRegistration);

      await manager.checkForUpdates();

      expect(mockRegistration.update).toHaveBeenCalled();
    });

    it('should handle service worker messages', async () => {
      const mockData = {
        type: 'SW_UPDATED',
        version: '2.0.0',
      };

      // Mock window.location.pathname to avoid auth page check
      Object.defineProperty(window, 'location', {
        value: { pathname: '/dashboard' },
        writable: true,
      });

      // Mock document methods for notification creation
      const mockCreateElement = jest.spyOn(document, 'createElement');
      const mockAppendChild = jest.spyOn(document.body, 'appendChild');
      
      const mockElement = {
        className: '',
        style: { cssText: '' },
        innerHTML: '',
        querySelector: jest.fn().mockReturnValue({
          addEventListener: jest.fn(),
        }),
        addEventListener: jest.fn(),
      };
      
      mockCreateElement.mockReturnValue(mockElement as any);
      mockAppendChild.mockImplementation(() => mockElement as any);

      // Access private method through type assertion
      (manager as any).handleServiceWorkerUpdate(mockData);

      // Verify that cache invalidation was triggered (which calls postMessage)
      await new Promise(resolve => setTimeout(resolve, 0)); // Allow async operations to complete
      
      expect(mockServiceWorker.controller.postMessage).toHaveBeenCalledWith({
        type: 'INVALIDATE_CACHES',
        timestamp: expect.any(Number),
      });
    });
  });

  describe('Listener Management', () => {
    it('should add and remove update listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      manager.addUpdateListener(listener1);
      manager.addUpdateListener(listener2);

      const deploymentInfo: DeploymentInfo = {
        version: '2.0.0',
        buildId: 'build-123',
        timestamp: Date.now(),
        environment: 'production',
      };

      // Access private method through type assertion
      (manager as any).notifyListeners(deploymentInfo);

      expect(listener1).toHaveBeenCalledWith(deploymentInfo);
      expect(listener2).toHaveBeenCalledWith(deploymentInfo);

      manager.removeUpdateListener(listener1);
      (manager as any).notifyListeners(deploymentInfo);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(2);
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = jest.fn();

      manager.addUpdateListener(errorListener);
      manager.addUpdateListener(normalListener);

      const deploymentInfo: DeploymentInfo = {
        version: '2.0.0',
        buildId: 'build-123',
        timestamp: Date.now(),
        environment: 'production',
      };

      // Should not throw despite listener error
      expect(() => {
        (manager as any).notifyListeners(deploymentInfo);
      }).not.toThrow();

      expect(normalListener).toHaveBeenCalledWith(deploymentInfo);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = DeploymentIntegrationManager.getInstance();
      const instance2 = DeploymentIntegrationManager.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Deployment Info Storage', () => {
    it('should store and retrieve deployment info', () => {
      const deploymentInfo: DeploymentInfo = {
        version: '2.0.0',
        buildId: 'build-123',
        timestamp: Date.now(),
        environment: 'production',
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(deploymentInfo));

      const retrieved = manager.getCurrentDeploymentInfo();

      expect(retrieved).toEqual(deploymentInfo);
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('deployment-info');
    });

    it('should handle invalid stored deployment info', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      const retrieved = manager.getCurrentDeploymentInfo();

      expect(retrieved).toBeNull();
    });
  });
});

describe('Deployment Integration Singleton', () => {
  it('should export singleton instance', () => {
    expect(deploymentIntegration).toBeInstanceOf(DeploymentIntegrationManager);
  });

  it('should be same as getInstance()', () => {
    expect(deploymentIntegration).toBe(DeploymentIntegrationManager.getInstance());
  });
});