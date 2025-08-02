/**
 * Enhanced Logging and Audit System Tests
 * 
 * Tests for the enhanced logging and audit system implementation
 * Requirements: 5.3 Implement enhanced logging and audit system
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { logger } from '@/lib/utils/logger';

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleInfo = jest.spyOn(console, 'info').mockImplementation();
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('Enhanced Logging and Audit System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Security Event Logging', () => {
    it('should log successful authentication events', () => {
      logger.authEvent('user_login', 'user123', true, { method: 'email' });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY] user_login'),
        expect.objectContaining({
          level: 'SECURITY',
          type: 'authentication',
          action: 'user_login',
          success: true,
          userId: 'user123'
        })
      );
    });

    it('should log failed authentication events with warning', () => {
      logger.authEvent('login_failed', 'user123', false, { reason: 'invalid_password' });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY] login_failed'),
        expect.objectContaining({
          success: false,
          userId: 'user123'
        })
      );

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY-FAILURE] login_failed'),
        expect.any(Object)
      );
    });

    it('should log authorization events', () => {
      logger.authzEvent('admin_access', 'user_management', 'admin123', 'admin', true);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY] admin_access'),
        expect.objectContaining({
          type: 'authorization',
          resource: 'user_management',
          userId: 'admin123',
          userRole: 'admin',
          success: true
        })
      );
    });

    it('should log API calls', () => {
      logger.apiCall('/api/reservations', 'GET', 'user123', true, { query: 'date=2024-01-01' });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY] GET /api/reservations'),
        expect.objectContaining({
          type: 'api_call',
          endpoint: '/api/reservations',
          userId: 'user123',
          success: true
        })
      );
    });

    it('should log suspicious activities as critical', () => {
      logger.suspiciousActivity('multiple_failed_logins', 'user123', { attempts: 5 });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY] multiple_failed_logins'),
        expect.objectContaining({
          type: 'suspicious_activity',
          success: false,
          userId: 'user123'
        })
      );

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('[CRITICAL] Suspicious activity detected'),
        expect.any(Object)
      );
    });
  });

  describe('Audit Event Logging', () => {
    it('should log data access events', () => {
      logger.dataAccess('create', 'reservation', 'res123', 'user123', true, { room: 'A101' });

      // Should log both security and audit events
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY] create reservation'),
        expect.any(Object)
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[AUDIT] reservation.create'),
        expect.objectContaining({
          type: 'create',
          entity: 'reservation',
          entityId: 'res123',
          userId: 'user123',
          success: true
        })
      );
    });

    it('should log failed data access with error level', () => {
      logger.dataAccess('delete', 'user', 'user123', 'admin456', false, { reason: 'permission_denied' });

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('[AUDIT-FAILURE] user.delete'),
        expect.objectContaining({
          success: false,
          entity: 'user',
          entityId: 'user123'
        })
      );
    });
  });

  describe('Data Sanitization', () => {
    it('should sanitize sensitive data in logs', () => {
      // Set environment to development so logger.info actually logs
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      logger.info('User data', {
        name: 'John Doe',
        password: 'secret123',
        auth_id: 'auth_123',
        email: 'john@example.com',
        normalField: 'safe_value'
      });

      // Logger sanitizes sensitive data and uses console.info in development
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] User data'),
        expect.objectContaining({
          name: 'John Doe',
          password: '[REDACTED]',
          auth_id: '[REDACTED]',
          email: '[REDACTED]',
          normalField: 'safe_value'
        })
      );

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Production vs Development Logging', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should always log security events regardless of environment', () => {
      process.env.NODE_ENV = 'production';
      
      logger.authEvent('login_attempt', 'user123', true);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY]'),
        expect.any(Object)
      );
    });

    it('should always log audit events regardless of environment', () => {
      process.env.NODE_ENV = 'production';
      
      logger.dataAccess('update', 'reservation', 'res123', 'user123', true);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[AUDIT]'),
        expect.any(Object)
      );
    });
  });

  describe('Error Integration', () => {
    it('should integrate with ReservationErrorHandler for structured error logging', () => {
      // This would be tested in integration with the error handler
      const errorContext = {
        action: 'create_reservation',
        userId: 'user123',
        timestamp: new Date().toISOString()
      };

      logger.error('Reservation creation failed', errorContext);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Reservation creation failed'),
        errorContext
      );
    });
  });
});