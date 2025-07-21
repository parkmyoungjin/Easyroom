/**
 * @jest-environment jsdom
 */

import {
  closeWindow,
  monitorWindowClose,
  notifyParentWindow,
  cleanupBeforeClose,
  WindowCloseOptions,
  WindowCloseResult
} from '../window-close';

// Mock window methods
const mockWindowClose = jest.fn();
const mockWindowFocus = jest.fn();
const mockHistoryBack = jest.fn();
const mockPostMessage = jest.fn();

// Setup window mocks
Object.defineProperty(window, 'close', {
  value: mockWindowClose,
  writable: true
});

Object.defineProperty(window, 'focus', {
  value: mockWindowFocus,
  writable: true
});

Object.defineProperty(window, 'history', {
  value: {
    length: 2,
    back: mockHistoryBack
  },
  writable: true
});

Object.defineProperty(window, 'opener', {
  value: {
    postMessage: mockPostMessage,
    closed: false
  },
  writable: true
});

// Mock navigator
Object.defineProperty(navigator, 'userAgent', {
  value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  writable: true
});

describe('window-close utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('closeWindow', () => {
    it('should successfully close window when opened by script', async () => {
      // Setup: window opened by script
      Object.defineProperty(window, 'opener', {
        value: { postMessage: mockPostMessage, closed: false },
        writable: true
      });

      mockWindowClose.mockImplementation(() => {
        Object.defineProperty(window, 'closed', { value: true });
      });

      const resultPromise = closeWindow();
      
      // Fast-forward timers
      jest.advanceTimersByTime(1000);
      
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.method).toBe('auto');
      expect(mockWindowClose).toHaveBeenCalled();
    });

    it('should fail when window not opened by script', async () => {
      // Setup: window not opened by script
      Object.defineProperty(window, 'opener', {
        value: null,
        writable: true
      });
      
      Object.defineProperty(window, 'history', {
        value: { length: 5 },
        writable: true
      });

      const resultPromise = closeWindow();
      jest.advanceTimersByTime(1000);
      
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.method).toBe('failed');
      expect(result.error).toContain('Cannot close window');
    });

    it('should respect delay option', async () => {
      const delay = 2000;
      const options: WindowCloseOptions = { delay };

      Object.defineProperty(window, 'opener', {
        value: { postMessage: mockPostMessage, closed: false },
        writable: true
      });

      const resultPromise = closeWindow(options);
      
      // Should not close immediately
      expect(mockWindowClose).not.toHaveBeenCalled();
      
      // Fast-forward by delay time
      jest.advanceTimersByTime(delay + 1000);
      
      await resultPromise;
      
      expect(mockWindowClose).toHaveBeenCalled();
    });

    it('should retry on failure', async () => {
      Object.defineProperty(window, 'opener', {
        value: { postMessage: mockPostMessage, closed: false },
        writable: true
      });

      // First two calls fail, third succeeds
      mockWindowClose
        .mockImplementationOnce(() => {
          throw new Error('First attempt failed');
        })
        .mockImplementationOnce(() => {
          throw new Error('Second attempt failed');
        })
        .mockImplementationOnce(() => {
          Object.defineProperty(window, 'closed', { value: true });
        });

      const options: WindowCloseOptions = { maxRetries: 3, retryInterval: 100 };
      const resultPromise = closeWindow(options);
      
      jest.advanceTimersByTime(1000);
      
      const result = await resultPromise;

      expect(mockWindowClose).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
    });

    it('should call callback with result', async () => {
      const callback = jest.fn();
      
      Object.defineProperty(window, 'opener', {
        value: { postMessage: mockPostMessage, closed: false },
        writable: true
      });

      mockWindowClose.mockImplementation(() => {
        Object.defineProperty(window, 'closed', { value: true });
      });

      const resultPromise = closeWindow({}, callback);
      jest.advanceTimersByTime(1000);
      
      await resultPromise;

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          method: 'auto'
        })
      );
    });
  });

  describe('monitorWindowClose', () => {
    it('should call onClose when window is closed', () => {
      const onClose = jest.fn();
      const cleanup = monitorWindowClose(onClose, 100);

      // Simulate window closing
      Object.defineProperty(window, 'closed', { value: true });
      
      jest.advanceTimersByTime(150);

      expect(onClose).toHaveBeenCalled();
      
      cleanup();
    });

    it('should not call onClose when window is still open', () => {
      const onClose = jest.fn();
      const cleanup = monitorWindowClose(onClose, 100);

      Object.defineProperty(window, 'closed', { value: false });
      
      jest.advanceTimersByTime(150);

      expect(onClose).not.toHaveBeenCalled();
      
      cleanup();
    });

    it('should cleanup interval when cleanup function is called', () => {
      const onClose = jest.fn();
      const cleanup = monitorWindowClose(onClose, 100);

      cleanup();
      
      // Simulate window closing after cleanup
      Object.defineProperty(window, 'closed', { value: true });
      jest.advanceTimersByTime(150);

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('notifyParentWindow', () => {
    it('should send message to opener window', () => {
      const message = { type: 'TEST_MESSAGE', data: 'test' };
      
      const result = notifyParentWindow(message);

      expect(result).toBe(true);
      expect(mockPostMessage).toHaveBeenCalledWith(message, '*');
    });

    it('should send message to parent window when no opener', () => {
      Object.defineProperty(window, 'opener', { value: null });
      
      const mockParentPostMessage = jest.fn();
      Object.defineProperty(window, 'parent', {
        value: { postMessage: mockParentPostMessage },
        writable: true
      });

      const message = { type: 'TEST_MESSAGE' };
      const result = notifyParentWindow(message);

      expect(result).toBe(true);
      expect(mockParentPostMessage).toHaveBeenCalledWith(message, '*');
    });

    it('should return false when no parent windows available', () => {
      Object.defineProperty(window, 'opener', { value: null });
      Object.defineProperty(window, 'parent', { value: window });

      const result = notifyParentWindow({ type: 'TEST' });

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', () => {
      mockPostMessage.mockImplementation(() => {
        throw new Error('PostMessage failed');
      });

      const result = notifyParentWindow({ type: 'TEST' });

      expect(result).toBe(false);
    });
  });

  describe('cleanupBeforeClose', () => {
    it('should notify parent window about closing', () => {
      cleanupBeforeClose();

      expect(mockPostMessage).toHaveBeenCalledWith(
        { type: 'WINDOW_CLOSING' },
        '*'
      );
    });

    it('should handle cleanup errors gracefully', () => {
      mockPostMessage.mockImplementation(() => {
        throw new Error('Cleanup failed');
      });

      // Should not throw
      expect(() => cleanupBeforeClose()).not.toThrow();
    });
  });

  describe('browser environment detection', () => {
    it('should detect Chrome browser', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        writable: true
      });

      Object.defineProperty(window, 'opener', {
        value: { postMessage: mockPostMessage, closed: false },
        writable: true
      });

      // Mock location.href to avoid JSDOM navigation errors
      Object.defineProperty(window.location, 'href', {
        writable: true,
        value: 'http://localhost:3000'
      });

      mockWindowClose.mockImplementation(() => {
        Object.defineProperty(window, 'closed', { value: true });
      });

      const resultPromise = closeWindow();
      jest.advanceTimersByTime(1000);
      
      const result = await resultPromise;

      // Should attempt standard close first
      expect(mockWindowClose).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should detect Firefox browser', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:91.0) Gecko/20100101 Firefox/91.0',
        writable: true
      });

      Object.defineProperty(window, 'opener', {
        value: { postMessage: mockPostMessage, closed: false },
        writable: true
      });

      // Mock self.close for Firefox
      const mockSelfClose = jest.fn();
      (global as any).self = { close: mockSelfClose };

      const resultPromise = closeWindow();
      jest.advanceTimersByTime(1000);
      
      await resultPromise;

      expect(mockWindowClose).toHaveBeenCalled();
    });

    it('should detect Safari browser', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15',
        writable: true
      });

      Object.defineProperty(window, 'opener', {
        value: { postMessage: mockPostMessage, closed: false },
        writable: true
      });

      const resultPromise = closeWindow();
      jest.advanceTimersByTime(1000);
      
      await resultPromise;

      expect(mockWindowClose).toHaveBeenCalled();
    });

    it('should detect Edge browser', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
        writable: true
      });

      Object.defineProperty(window, 'opener', {
        value: { postMessage: mockPostMessage, closed: false },
        writable: true
      });

      const resultPromise = closeWindow();
      jest.advanceTimersByTime(1000);
      
      await resultPromise;

      expect(mockWindowClose).toHaveBeenCalled();
    });

    it('should detect mobile environment - iOS', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
        writable: true
      });

      Object.defineProperty(window, 'opener', {
        value: { postMessage: mockPostMessage, closed: false },
        writable: true
      });

      const resultPromise = closeWindow();
      jest.advanceTimersByTime(1000);
      
      await resultPromise;

      // Should attempt mobile-specific methods
      expect(mockHistoryBack).toHaveBeenCalled();
    });

    it('should detect mobile environment - Android', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        writable: true
      });

      Object.defineProperty(window, 'opener', {
        value: { postMessage: mockPostMessage, closed: false },
        writable: true
      });

      const resultPromise = closeWindow();
      jest.advanceTimersByTime(1000);
      
      await resultPromise;

      expect(mockHistoryBack).toHaveBeenCalled();
    });

    it('should handle unknown browser gracefully', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'UnknownBrowser/1.0',
        writable: true
      });

      Object.defineProperty(window, 'opener', {
        value: { postMessage: mockPostMessage, closed: false },
        writable: true
      });

      const resultPromise = closeWindow();
      jest.advanceTimersByTime(1000);
      
      await resultPromise;

      // Should still attempt standard close method
      expect(mockWindowClose).toHaveBeenCalled();
    });
  });

  describe('cross-browser compatibility', () => {
    it('should work in popup window context', async () => {
      Object.defineProperty(window, 'opener', {
        value: { postMessage: mockPostMessage, closed: false },
        writable: true
      });
      
      Object.defineProperty(window, 'history', {
        value: { length: 1 }, // Indicates popup
        writable: true
      });

      const resultPromise = closeWindow();
      jest.advanceTimersByTime(1000);
      
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(mockWindowClose).toHaveBeenCalled();
    });

    it('should work in new tab context', async () => {
      Object.defineProperty(window, 'opener', {
        value: null,
        writable: true
      });
      
      Object.defineProperty(window, 'history', {
        value: { length: 1 }, // New tab typically has length 1
        writable: true
      });

      const resultPromise = closeWindow();
      jest.advanceTimersByTime(1000);
      
      const result = await resultPromise;
      
      // Should fail because not opened by script
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot close window');
    });

    it('should handle iframe context', async () => {
      Object.defineProperty(window, 'parent', {
        value: { postMessage: jest.fn() },
        writable: true
      });
      
      Object.defineProperty(window, 'opener', {
        value: null,
        writable: true
      });

      const message = { type: 'TEST' };
      const result = notifyParentWindow(message);

      expect(result).toBe(true);
    });
  });
});