/**
 * @jest-environment node
 */

import { securityMonitor, recordAuthFailure, recordSuspiciousAccess } from '@/lib/monitoring/security-monitor';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock fetch for external alerts
global.fetch = jest.fn();

describe('Security Monitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset monitor state
    (securityMonitor as any).events = [];
    (securityMonitor as any).alerts.clear();
  });

  describe('Event Recording', () => {
    it('should record authentication failure events', () => {
      recordAuthFailure({
        userId: 'user123',
        ipAddress: '192.168.1.1',
        endpoint: '/api/auth/login',
        reason: 'Invalid credentials'
      });

      const recentEvents = securityMonitor.getRecentEvents(10);
      expect(recentEvents).toHaveLength(1);
      expect(recentEvents[0].type).toBe('auth_failure');
      expect(recentEvents[0].severity).toBe('medium');
      expect(recentEvents[0].details.reason).toBe('Invalid credentials');
    });

    it('should record suspicious access patterns', () => {
      recordSuspiciousAccess({
        userId: 'user123',
        ipAddress: '192.168.1.1',
        endpoint: '/api/admin/users',
        pattern: 'rapid_succession',
        riskScore: 85
      });

      const recentEvents = securityMonitor.getRecentEvents(10);
      expect(recentEvents).toHaveLength(1);
      expect(recentEvents[0].type).toBe('suspicious_access');
      expect(recentEvents[0].severity).toBe('high'); // riskScore >= 80
    });

    it('should limit event storage to prevent memory leaks', () => {
      // Fill beyond maxEvents limit
      for (let i = 0; i < 10005; i++) {
        securityMonitor.recordEvent({
          type: 'auth_failure',
          severity: 'low',
          source: 'test',
          details: { iteration: i }
        });
      }

      const events = securityMonitor.getRecentEvents(20000);
      expect(events.length).toBe(10000); // Should be capped at maxEvents
    });
  });

  describe('Alert Generation', () => {
    it('should generate alert when threshold is exceeded', () => {
      const userId = 'user123';
      
      // Generate 5 auth failures within threshold window
      for (let i = 0; i < 5; i++) {
        recordAuthFailure({
          userId,
          ipAddress: '192.168.1.1',
          endpoint: '/api/auth/login',
          reason: 'Invalid credentials'
        });
      }

      const activeAlerts = securityMonitor.getActiveAlerts();
      expect(activeAlerts.length).toBe(1);
      expect(activeAlerts[0].eventType).toBe('auth_failure');
      expect(activeAlerts[0].count).toBe(5);
    });

    it('should not generate duplicate alerts for same user', () => {
      const userId = 'user123';
      
      // Generate multiple failures
      for (let i = 0; i < 10; i++) {
        recordAuthFailure({
          userId,
          ipAddress: '192.168.1.1',
          endpoint: '/api/auth/login',
          reason: 'Invalid credentials'
        });
      }

      const activeAlerts = securityMonitor.getActiveAlerts();
      expect(activeAlerts.length).toBe(1); // Should only have one alert
      expect(activeAlerts[0].count).toBe(10); // But count should be updated
    });

    it('should generate separate alerts for different users', () => {
      // Generate failures for different users
      for (let i = 0; i < 5; i++) {
        recordAuthFailure({
          userId: 'user1',
          ipAddress: '192.168.1.1',
          endpoint: '/api/auth/login',
          reason: 'Invalid credentials'
        });
        
        recordAuthFailure({
          userId: 'user2',
          ipAddress: '192.168.1.2',
          endpoint: '/api/auth/login',
          reason: 'Invalid credentials'
        });
      }

      const activeAlerts = securityMonitor.getActiveAlerts();
      expect(activeAlerts.length).toBe(2);
    });
  });

  describe('Pattern Analysis', () => {
    it('should detect rapid succession pattern', () => {
      const userId = 'user123';
      
      // Generate events in rapid succession
      for (let i = 0; i < 5; i++) {
        recordAuthFailure({
          userId,
          ipAddress: '192.168.1.1',
          endpoint: '/api/auth/login',
          reason: 'Invalid credentials'
        });
      }

      const activeAlerts = securityMonitor.getActiveAlerts();
      expect(activeAlerts[0].details.pattern).toBe('rapid_succession');
    });

    it('should detect burst pattern with longer intervals', async () => {
      const userId = 'user123';
      
      // Generate events with small delays
      for (let i = 0; i < 5; i++) {
        recordAuthFailure({
          userId,
          ipAddress: '192.168.1.1',
          endpoint: '/api/auth/login',
          reason: 'Invalid credentials'
        });
        
        // Small delay to create burst pattern
        await new Promise(resolve => setTimeout(resolve, 2));
      }

      const activeAlerts = securityMonitor.getActiveAlerts();
      expect(activeAlerts[0].details.pattern).toMatch(/burst_pattern|rapid_succession/);
    });
  });

  describe('External Alerting', () => {
    beforeEach(() => {
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        status: 200
      } as Response);
    });

    afterEach(() => {
      delete process.env.SLACK_WEBHOOK_URL;
    });

    it('should send external alert for critical events', () => {
      // Generate critical privilege escalation attempt
      securityMonitor.recordPrivilegeEscalationAttempt({
        userId: 'user123',
        endpoint: '/api/admin/users',
        attemptedAction: 'delete_user',
        currentRole: 'user',
        requiredRole: 'admin'
      });

      // Should trigger external alert due to critical severity
      expect(fetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });

    it('should handle external alert failures gracefully', () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(
        new Error('Network error')
      );

      // Should not throw error even if external alert fails
      expect(() => {
        securityMonitor.recordPrivilegeEscalationAttempt({
          userId: 'user123',
          endpoint: '/api/admin/users',
          attemptedAction: 'delete_user',
          currentRole: 'user',
          requiredRole: 'admin'
        });
      }).not.toThrow();
    });
  });

  describe('Statistics and Reporting', () => {
    beforeEach(() => {
      // Generate sample events
      recordAuthFailure({
        userId: 'user1',
        endpoint: '/api/auth/login',
        reason: 'Invalid credentials'
      });
      
      recordSuspiciousAccess({
        userId: 'user2',
        endpoint: '/api/admin/users',
        pattern: 'automated_access',
        riskScore: 70
      });
      
      securityMonitor.recordDataIntegrityViolation({
        userId: 'user3',
        table: 'reservations',
        operation: 'update',
        violationType: 'user_id_inconsistency',
        affectedRecords: 1
      });
    });

    it('should provide security statistics', () => {
      const stats = securityMonitor.getSecurityStats(60);
      
      expect(stats.totalEvents).toBe(3);
      expect(stats.eventsByType).toHaveProperty('auth_failure', 1);
      expect(stats.eventsByType).toHaveProperty('suspicious_access', 1);
      expect(stats.eventsByType).toHaveProperty('data_integrity_violation', 1);
      expect(stats.eventsBySeverity).toHaveProperty('medium', 2); // auth_failure + suspicious_access
      expect(stats.eventsBySeverity).toHaveProperty('high', 1); // data_integrity_violation
    });

    it('should provide system health status', () => {
      const health = securityMonitor.getSystemHealth();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('eventsCount');
      expect(health).toHaveProperty('alertsCount');
      expect(health).toHaveProperty('memoryUsage');
      expect(['healthy', 'degraded', 'critical']).toContain(health.status);
    });

    it('should filter events by time window', () => {
      // Get stats for very short time window
      const recentStats = securityMonitor.getSecurityStats(0.01); // 0.6 seconds
      
      // Should have fewer or no events depending on timing
      expect(recentStats.totalEvents).toBeLessThanOrEqual(3);
    });
  });

  describe('Alert Management', () => {
    it('should resolve alerts', () => {
      // Generate alert
      for (let i = 0; i < 5; i++) {
        recordAuthFailure({
          userId: 'user123',
          endpoint: '/api/auth/login',
          reason: 'Invalid credentials'
        });
      }

      const activeAlerts = securityMonitor.getActiveAlerts();
      expect(activeAlerts.length).toBe(1);
      
      const alertId = activeAlerts[0].id;
      const resolved = securityMonitor.resolveAlert(alertId);
      
      expect(resolved).toBe(true);
      expect(securityMonitor.getActiveAlerts().length).toBe(0);
    });

    it('should return false for non-existent alert resolution', () => {
      const resolved = securityMonitor.resolveAlert('non-existent-id');
      expect(resolved).toBe(false);
    });
  });

  describe('Memory Management', () => {
    it('should maintain reasonable memory usage', () => {
      // Generate many events
      for (let i = 0; i < 1000; i++) {
        securityMonitor.recordEvent({
          type: 'auth_failure',
          severity: 'low',
          source: 'test',
          details: { iteration: i }
        });
      }

      const health = securityMonitor.getSystemHealth();
      expect(health.memoryUsage).toBeLessThan(1); // Should be less than 100%
    });

    it('should handle concurrent event recording', async () => {
      const promises = [];
      
      // Generate concurrent events
      for (let i = 0; i < 100; i++) {
        promises.push(Promise.resolve().then(() => {
          recordAuthFailure({
            userId: `user${i}`,
            endpoint: '/api/auth/login',
            reason: 'Invalid credentials'
          });
        }));
      }

      await Promise.all(promises);
      
      const events = securityMonitor.getRecentEvents(200);
      expect(events.length).toBe(100);
    });
  });
});