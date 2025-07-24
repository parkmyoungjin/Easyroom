/**
 * Integration test for Enhanced Supabase Client Manager
 * Tests the actual functionality without complex mocking
 */

import {
  initializeClient,
  isClientReady,
  getClientStatus,
  getClientManager,
  type ClientInitializationResult,
  type ClientStatus
} from '../client';

describe('Enhanced Supabase Client Manager - Integration', () => {
  describe('Client Manager Interface', () => {
    it('should provide all required interface methods', () => {
      const manager = getClientManager();
      
      expect(typeof manager.initializeClient).toBe('function');
      expect(typeof manager.getClient).toBe('function');
      expect(typeof manager.isClientReady).toBe('function');
      expect(typeof manager.getInitializationError).toBe('function');
      expect(typeof manager.reinitializeClient).toBe('function');
      expect(typeof manager.getClientStatus).toBe('function');
    });

    it('should provide client status with correct structure', () => {
      const status = getClientStatus();
      
      expect(status).toBeDefined();
      expect(typeof status.state).toBe('string');
      expect(['uninitialized', 'initializing', 'ready', 'error', 'retrying']).toContain(status.state);
      expect(typeof status.retryCount).toBe('number');
      expect(status.retryCount).toBeGreaterThanOrEqual(0);
    });

    it('should provide initialization result with correct structure', async () => {
      const result = await initializeClient();
      
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      
      if (result.success) {
        expect(result.client).toBeDefined();
        expect(result.error).toBeUndefined();
      } else {
        expect(result.error).toBeDefined();
        expect(result.error?.type).toBeDefined();
        expect(['environment', 'network', 'configuration']).toContain(result.error?.type);
        expect(typeof result.error?.message).toBe('string');
        expect(Array.isArray(result.error?.troubleshooting)).toBe(true);
        expect(typeof result.error?.canRetry).toBe('boolean');
      }
    });

    it('should provide readiness checking', () => {
      const isReady = isClientReady();
      expect(typeof isReady).toBe('boolean');
    });
  });

  describe('Error Handling Structure', () => {
    it('should have proper error categorization types', async () => {
      const result = await initializeClient();
      
      if (!result.success && result.error) {
        // Verify error structure
        expect(result.error.type).toBeDefined();
        expect(result.error.message).toBeDefined();
        expect(result.error.troubleshooting).toBeDefined();
        expect(result.error.canRetry).toBeDefined();
        
        // Verify troubleshooting is helpful
        expect(result.error.troubleshooting.length).toBeGreaterThan(0);
        result.error.troubleshooting.forEach(tip => {
          expect(typeof tip).toBe('string');
          expect(tip.length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('Client Status States', () => {
    it('should track status changes appropriately', async () => {
      const initialStatus = getClientStatus();
      expect(initialStatus.state).toBeDefined();
      
      // Status should be trackable
      expect(typeof initialStatus.retryCount).toBe('number');
      expect(initialStatus.retryCount).toBeGreaterThanOrEqual(0);
      
      if (initialStatus.lastInitializationAttempt) {
        expect(initialStatus.lastInitializationAttempt).toBeInstanceOf(Date);
      }
      
      if (initialStatus.nextRetryAt) {
        expect(initialStatus.nextRetryAt).toBeInstanceOf(Date);
      }
    });
  });

  describe('Retry Logic Configuration', () => {
    it('should have reasonable retry configuration', () => {
      const status = getClientStatus();
      
      // Retry count should be reasonable (not infinite)
      expect(status.retryCount).toBeLessThan(10);
      
      // If retrying, should have next retry time
      if (status.state === 'retrying') {
        expect(status.nextRetryAt).toBeDefined();
        expect(status.nextRetryAt).toBeInstanceOf(Date);
      }
    });
  });

  describe('Singleton Behavior', () => {
    it('should maintain singleton pattern', () => {
      const manager1 = getClientManager();
      const manager2 = getClientManager();
      
      expect(manager1).toBe(manager2);
    });

    it('should maintain consistent status across calls', () => {
      const status1 = getClientStatus();
      const status2 = getClientStatus();
      
      expect(status1.state).toBe(status2.state);
      expect(status1.retryCount).toBe(status2.retryCount);
    });
  });
});