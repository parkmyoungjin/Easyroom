/**
 * Session Persistence State Management
 * 
 * Provides comprehensive state tracking for session persistence operations,
 * including sync status, error tracking, and performance monitoring.
 * Supports persistence across browser sessions and page refreshes.
 */

import { AuthError } from '@supabase/supabase-js';

// Core session persistence state interface
export interface SessionPersistenceState {
  // Current session status
  sessionId: string | null;
  persistenceStatus: 'active' | 'expired' | 'invalid' | 'syncing';
  lastSyncTime: Date | null;
  
  // Cookie management
  cookieStatus: 'valid' | 'invalid' | 'missing' | 'corrupted';
  cookieGenerationAttempts: number;
  lastCookieValidation: Date | null;
  
  // Middleware compatibility
  middlewareCompatible: boolean;
  lastMiddlewareTest: Date | null;
  middlewareTestResults: MiddlewareTestResult[];
  
  // Error tracking
  syncErrors: SessionSyncError[];
  recoveryAttempts: number;
  lastRecoveryTime: Date | null;
  
  // Performance tracking
  performanceMetrics: SessionPerformanceMetrics;
}

// Middleware test result tracking
export interface MiddlewareTestResult {
  timestamp: Date;
  success: boolean;
  responseTime: number;
  errorMessage?: string;
  cookieFormat: string;
}

// Session synchronization error interface
export interface SessionSyncError {
  type: 'cookie_generation' | 'middleware_compatibility' | 'session_validation';
  message: string;
  recoverable: boolean;
  retryAfter?: number;
  timestamp: Date;
  errorCode?: string;
}

// Performance metrics for session operations
export interface SessionPerformanceMetrics {
  // Cookie operation timings
  cookieGenerationTime: number[];
  cookieValidationTime: number[];
  middlewareTestTime: number[];
  
  // Success rates
  cookieGenerationSuccessRate: number;
  middlewareCompatibilityRate: number;
  sessionSyncSuccessRate: number;
  
  // Operation counts
  totalSyncAttempts: number;
  successfulSyncs: number;
  failedSyncs: number;
  
  // Timing statistics
  averageResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  
  // Last updated timestamp
  lastUpdated: Date;
}

// Enhanced error categorization
export enum SessionPersistenceErrorType {
  COOKIE_GENERATION_FAILED = 'cookie_generation_failed',
  COOKIE_VALIDATION_FAILED = 'cookie_validation_failed',
  MIDDLEWARE_COMPATIBILITY_FAILED = 'middleware_compatibility_failed',
  SESSION_SYNC_TIMEOUT = 'session_sync_timeout',
  PERSISTENT_SYNC_FAILURE = 'persistent_sync_failure',
  RECOVERY_EXHAUSTED = 'recovery_exhausted'
}

// Enhanced session persistence error
export interface SessionPersistenceError extends AuthError {
  persistenceType: SessionPersistenceErrorType;
  syncAttempt: number;
  cookieStatus: string;
  middlewareCompatible: boolean;
  recoveryAction: 'retry' | 'regenerate' | 'clear' | 'reauth';
  debugInfo: {
    sessionId?: string;
    cookieLength?: number;
    lastSyncTime?: Date;
    errorStack?: string;
    userAgent?: string;
    timestamp: Date;
  };
}

// Configuration for session persistence
export interface SessionPersistenceConfig {
  // Retry configuration
  maxRetryAttempts: number;
  retryBackoffMultiplier: number;
  maxRetryDelay: number;
  
  // Validation settings
  enableProactiveValidation: boolean;
  middlewareTestInterval: number;
  cookieValidationTimeout: number;
  
  // Recovery settings
  autoRecoveryEnabled: boolean;
  clearSessionOnMaxRetries: boolean;
  forceReauthOnPersistentFailure: boolean;
  
  // Performance settings with debouncing scenarios
  syncDebounceTime: number; // Default: 500ms
  batchCookieOperations: boolean;
  enablePerformanceTracking: boolean;
  
  // Debouncing scenarios for high-frequency events
  debounceScenarios: {
    tabSwitching: number; // 200ms - Quick tab switches
    appStateChange: number; // 300ms - PWA foreground/background
    authEventBurst: number; // 500ms - Multiple auth events
    pageNavigation: number; // 100ms - Route changes
  };
}

// Default configuration
export const DEFAULT_SESSION_PERSISTENCE_CONFIG: SessionPersistenceConfig = {
  maxRetryAttempts: 3,
  retryBackoffMultiplier: 2,
  maxRetryDelay: 10000,
  
  enableProactiveValidation: true,
  middlewareTestInterval: 30000,
  cookieValidationTimeout: 5000,
  
  autoRecoveryEnabled: true,
  clearSessionOnMaxRetries: true,
  forceReauthOnPersistentFailure: true,
  
  syncDebounceTime: 500,
  batchCookieOperations: true,
  enablePerformanceTracking: true,
  
  debounceScenarios: {
    tabSwitching: 200,
    appStateChange: 300,
    authEventBurst: 500,
    pageNavigation: 100
  }
};