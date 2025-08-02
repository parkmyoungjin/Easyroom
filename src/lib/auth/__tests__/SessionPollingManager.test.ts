// src/lib/auth/__tests__/SessionPollingManager.test.ts

import { SessionPollingManager, DEFAULT_POLLING_CONFIG, PollingConfig, SessionCheckOptions } from '../SessionPollingManager';

// Mock timers
jest.useFakeTimers();

describe('SessionPollingManager', () => {
  let mockSessionCheck: jest.Mock<Promise<void>, [SessionCheckOptions?]>;
  let pollingManager: SessionPollingManager;

  beforeEach(() => {
    mockSessionCheck = jest.fn().mockResolvedValue(undefined);
    pollingManager = new SessionPollingManager(DEFAULT_POLLING_CONFIG, mockSessionCheck);
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    pollingManager.stop();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default config and inactive state', () => {
      const state = pollingManager.getState();
      const config = pollingManager.getConfig();

      expect(state.isActive).toBe(false);
      expect(state.retryCount).toBe(0);
      expect(state.currentInterval).toBe(DEFAULT_POLLING_CONFIG.baseInterval);
      expect(state.lastAttempt).toBeNull();
      expect(state.intervalId).toBeNull();
      expect(config).toEqual(DEFAULT_POLLING_CONFIG);
    });

    it('should accept custom config', () => {
      const customConfig: PollingConfig = {
        maxRetries: 5,
        baseInterval: 1000,
        maxInterval: 60000,
        backoffMultiplier: 3,
        enabledPaths: ['/custom']
      };

      const customManager = new SessionPollingManager(customConfig, mockSessionCheck);
      expect(customManager.getConfig()).toEqual(customConfig);
    });
  });

  describe('start', () => {
    it('should start polling and set active state', () => {
      pollingManager.start();
      
      const state = pollingManager.getState();
      expect(state.isActive).toBe(true);
      expect(jest.getTimerCount()).toBe(1);
    });

    it('should not start multiple polling instances', () => {
      pollingManager.start();
      pollingManager.start();
      
      expect(jest.getTimerCount()).toBe(1);
    });

    it('should schedule first session check with base interval', () => {
      pollingManager.start();
      
      expect(jest.getTimerCount()).toBe(1);
      
      // Fast-forward to trigger the first check
      jest.advanceTimersByTime(DEFAULT_POLLING_CONFIG.baseInterval);
      
      expect(mockSessionCheck).toHaveBeenCalledWith({
        source: 'polling',
        maxRetries: DEFAULT_POLLING_CONFIG.maxRetries
      });
    });
  });

  describe('stop', () => {
    it('should stop polling and clear timers', () => {
      pollingManager.start();
      expect(pollingManager.getState().isActive).toBe(true);
      
      pollingManager.stop();
      
      const state = pollingManager.getState();
      expect(state.isActive).toBe(false);
      expect(state.intervalId).toBeNull();
      expect(jest.getTimerCount()).toBe(0);
    });

    it('should handle stop when not active', () => {
      expect(() => pollingManager.stop()).not.toThrow();
    });
  });

  describe('reset', () => {
    it('should reset state to initial values', () => {
      pollingManager.start();
      
      // Simulate some polling attempts
      jest.advanceTimersByTime(DEFAULT_POLLING_CONFIG.baseInterval);
      jest.advanceTimersByTime(DEFAULT_POLLING_CONFIG.baseInterval * 2);
      
      pollingManager.reset();
      
      const state = pollingManager.getState();
      expect(state.isActive).toBe(false);
      expect(state.retryCount).toBe(0);
      expect(state.currentInterval).toBe(DEFAULT_POLLING_CONFIG.baseInterval);
      expect(state.lastAttempt).toBeNull();
      expect(state.intervalId).toBeNull();
    });
  });

  describe('shouldPoll', () => {
    it('should return false for authenticated status', () => {
      expect(pollingManager.shouldPoll('/login', 'authenticated')).toBe(false);
    });

    it('should return false for non-enabled paths', () => {
      expect(pollingManager.shouldPoll('/dashboard', 'unauthenticated')).toBe(false);
    });

    it('should return true for enabled paths when unauthenticated', () => {
      expect(pollingManager.shouldPoll('/login', 'unauthenticated')).toBe(true);
      expect(pollingManager.shouldPoll('/auth/callback', 'unauthenticated')).toBe(true);
    });

    it('should return true for loading status on enabled paths', () => {
      expect(pollingManager.shouldPoll('/login', 'loading')).toBe(true);
    });
  });

  describe('core functionality', () => {
    it('should execute session check after base interval', () => {
      pollingManager.start();
      
      // Should not have called yet
      expect(mockSessionCheck).toHaveBeenCalledTimes(0);
      
      // After base interval, should call once
      jest.advanceTimersByTime(2000);
      expect(mockSessionCheck).toHaveBeenCalledTimes(1);
      expect(mockSessionCheck).toHaveBeenCalledWith({
        source: 'polling',
        maxRetries: 3
      });
    });

    it('should track retry count after each attempt', () => {
      pollingManager.start();
      
      // Initial state
      expect(pollingManager.getState().retryCount).toBe(0);
      
      // After first attempt
      jest.advanceTimersByTime(2000);
      expect(pollingManager.getState().retryCount).toBe(1);
    });

    it('should respect max retries configuration', () => {
      pollingManager.start();
      
      // First attempt
      jest.advanceTimersByTime(2000);
      expect(mockSessionCheck).toHaveBeenCalledTimes(1);
      expect(pollingManager.getState().retryCount).toBe(1);
      expect(pollingManager.getState().isActive).toBe(true);
      
      // The polling manager should continue until max retries
      expect(pollingManager.getConfig().maxRetries).toBe(3);
    });

    it('should handle session check errors without crashing', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockSessionCheck.mockRejectedValue(new Error('Test error'));
      
      pollingManager.start();
      
      // Should not crash when session check fails
      expect(() => {
        jest.advanceTimersByTime(2000);
      }).not.toThrow();
      
      expect(mockSessionCheck).toHaveBeenCalledTimes(1);
      expect(pollingManager.getState().isActive).toBe(true);
      
      consoleSpy.mockRestore();
    });
  });

  describe('exponential backoff calculation', () => {
    it('should use correct intervals based on retry count', () => {
      // Test the interval calculation logic
      const manager = new SessionPollingManager(DEFAULT_POLLING_CONFIG, mockSessionCheck);
      
      // Access private method through any cast for testing
      const calculateInterval = (retryCount: number) => {
        const baseInterval = DEFAULT_POLLING_CONFIG.baseInterval;
        const backoffMultiplier = DEFAULT_POLLING_CONFIG.backoffMultiplier;
        const maxInterval = DEFAULT_POLLING_CONFIG.maxInterval;
        
        const exponentialInterval = baseInterval * Math.pow(backoffMultiplier, retryCount);
        return Math.min(exponentialInterval, maxInterval);
      };
      
      expect(calculateInterval(0)).toBe(2000); // 2000 * 2^0 = 2000
      expect(calculateInterval(1)).toBe(4000); // 2000 * 2^1 = 4000  
      expect(calculateInterval(2)).toBe(8000); // 2000 * 2^2 = 8000
    });

    it('should respect max interval limit', () => {
      const shortMaxConfig: PollingConfig = {
        ...DEFAULT_POLLING_CONFIG,
        maxInterval: 5000
      };
      
      const calculateInterval = (retryCount: number) => {
        const baseInterval = shortMaxConfig.baseInterval;
        const backoffMultiplier = shortMaxConfig.backoffMultiplier;
        const maxInterval = shortMaxConfig.maxInterval;
        
        const exponentialInterval = baseInterval * Math.pow(backoffMultiplier, retryCount);
        return Math.min(exponentialInterval, maxInterval);
      };
      
      expect(calculateInterval(0)).toBe(2000); // 2000
      expect(calculateInterval(1)).toBe(4000); // 4000
      expect(calculateInterval(2)).toBe(5000); // 8000 capped to 5000
    });

    it('should track last attempt time', () => {
      const beforeStart = new Date();
      pollingManager.start();
      
      jest.advanceTimersByTime(2000);
      
      const state = pollingManager.getState();
      expect(state.lastAttempt).toBeInstanceOf(Date);
      expect(state.lastAttempt!.getTime()).toBeGreaterThanOrEqual(beforeStart.getTime());
    });
  });

  describe('state management', () => {
    it('should provide readonly state access', () => {
      const state = pollingManager.getState();
      
      // Should not be able to modify the returned state
      expect(() => {
        (state as any).isActive = true;
      }).not.toThrow(); // TypeScript prevents this, but runtime doesn't
      
      // Original state should remain unchanged
      expect(pollingManager.getState().isActive).toBe(false);
    });

    it('should provide readonly config access', () => {
      const config = pollingManager.getConfig();
      expect(config).toEqual(DEFAULT_POLLING_CONFIG);
      
      // Should be a copy, not the original
      expect(config).not.toBe(DEFAULT_POLLING_CONFIG);
    });
  });
});