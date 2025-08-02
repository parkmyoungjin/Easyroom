/**
 * Session Persistence Types
 * 
 * Central type definitions for session persistence functionality.
 * This file consolidates all types to prevent duplication and ensure consistency.
 * 
 * Requirements: 3.5, 5.4, 5.5
 */

// ============================================================================
// ERROR TYPES AND ENUMS
// ============================================================================

export enum SessionPersistenceErrorType {
  // Cookie-related errors
  COOKIE_GENERATION_FAILED = 'cookie_generation_failed',
  COOKIE_VALIDATION_FAILED = 'cookie_validation_failed',
  COOKIE_CORRUPTION = 'cookie_corruption',
  
  // Middleware-related errors
  MIDDLEWARE_COMPATIBILITY_FAILED = 'middleware_compatibility_failed',
  MIDDLEWARE_PARSING_FAILED = 'middleware_parsing_failed',
  MIDDLEWARE_TIMEOUT = 'middleware_timeout',
  
  // Session-related errors
  SESSION_SYNC_TIMEOUT = 'session_sync_timeout',
  SESSION_VALIDATION_FAILED = 'session_validation_failed',
  SESSION_REFRESH_FAILED = 'session_refresh_failed',
  INVALID_SESSION_DATA = 'invalid_session_data',
  
  // Network and system errors
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',
  SYSTEM_ERROR = 'system_error',
  
  // Recovery-related errors
  PERSISTENT_SYNC_FAILURE = 'persistent_sync_failure',
  RECOVERY_EXHAUSTED = 'recovery_exhausted',
  RECOVERY_FAILED = 'recovery_failed'
}

export enum SessionPersistenceErrorCategory {
  // Cookie-related errors
  COOKIE_GENERATION = 'cookie_generation',
  COOKIE_VALIDATION = 'cookie_validation',
  COOKIE_CORRUPTION = 'cookie_corruption',
  
  // Middleware-related errors
  MIDDLEWARE_COMPATIBILITY = 'middleware_compatibility',
  MIDDLEWARE_PARSING = 'middleware_parsing',
  MIDDLEWARE_TIMEOUT = 'middleware_timeout',
  
  // Session-related errors
  SESSION_SYNC = 'session_sync',
  SESSION_VALIDATION = 'session_validation',
  SESSION_REFRESH = 'session_refresh',
  
  // Network and system errors
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',
  SYSTEM_ERROR = 'system_error',
  
  // Recovery-related errors
  RECOVERY_FAILED = 'recovery_failed',
  RECOVERY_EXHAUSTED = 'recovery_exhausted',
  RECOVERY_TIMEOUT = 'recovery_timeout'
}

export enum SessionPersistenceErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// ============================================================================
// RECOVERY TYPES
// ============================================================================

export interface RecoveryResult {
  success: boolean;
  recovered?: boolean;
  retryAfter?: number;
  requiresReauth?: boolean;
  userMessage?: string;
  errorDetails?: string;
  debugInfo?: Record<string, any>;
}

export interface ErrorRecoveryAction {
  type: 'immediate' | 'delayed' | 'manual' | 'escalation';
  action: 'retry' | 'regenerate' | 'clear' | 'reauth' | 'escalate' | 'wait';
  priority: 'critical' | 'high' | 'medium' | 'low';
  delay?: number; // milliseconds
  maxAttempts?: number;
  userMessage: string;
  technicalMessage: string;
  steps: string[];
  estimatedDuration: string;
  successProbability: number;
  fallbackAction?: ErrorRecoveryAction;
}

// ============================================================================
// LOGGING AND CONTEXT TYPES
// ============================================================================

export interface SessionPersistenceLogContext {
  sessionId?: string;
  userId?: string;
  userAgent?: string;
  timestamp: Date;
  operation: string;
  phase: 'initialization' | 'authentication' | 'synchronization' | 'validation' | 'recovery';
  
  // Cookie context
  cookieStatus?: string;
  cookieLength?: number;
  cookieFormat?: string;
  
  // Middleware context
  middlewareCompatible?: boolean;
  middlewareResponseTime?: number;
  middlewareError?: string;
  
  // Session context
  sessionValid?: boolean;
  sessionExpiry?: Date;
  sessionRefreshAttempts?: number;
  
  // Performance context
  operationDuration?: number;
  retryAttempt?: number;
  totalAttempts?: number;
  
  // Recovery context
  recoveryStrategy?: string;
  recoverySuccess?: boolean;
  recoveryRecommendation?: string;
  
  // Debug context
  stackTrace?: string;
  additionalData?: Record<string, any>;
}

export interface SessionPersistenceErrorDetails {
  type: SessionPersistenceErrorType;
  category: SessionPersistenceErrorCategory;
  severity: SessionPersistenceErrorSeverity;
  message: string;
  context: SessionPersistenceLogContext;
  recoverable: boolean;
  recoveryAction: 'retry' | 'regenerate' | 'clear' | 'reauth' | 'escalate';
  recoveryPriority: 'immediate' | 'high' | 'medium' | 'low';
  debugInfo: SessionPersistenceDebugInfo;
}

export interface SessionPersistenceDebugInfo {
  errorId: string;
  timestamp: Date;
  environment: 'development' | 'production' | 'test';
  browserInfo: {
    userAgent: string;
    cookiesEnabled: boolean;
    localStorageEnabled: boolean;
    sessionStorageEnabled: boolean;
  };
  networkInfo: {
    online: boolean;
    connectionType?: string;
    effectiveType?: string;
  };
  sessionInfo: {
    sessionId?: string;
    sessionAge?: number;
    lastSyncTime?: Date;
    syncAttempts: number;
  };
  performanceInfo: {
    operationDuration: number;
    memoryUsage?: number;
    cpuUsage?: number;
  };
  errorChain: Array<{
    error: string;
    timestamp: Date;
    operation: string;
  }>;
}

// ============================================================================
// ANALYSIS AND REPORTING TYPES
// ============================================================================

export interface ErrorAnalysisResult {
  errorDetails: SessionPersistenceErrorDetails;
  recoveryAction: ErrorRecoveryAction;
  contextualInsights: string[];
  preventionRecommendations: string[];
  monitoringRecommendations: string[];
}

export interface SystemDiagnostics {
  timestamp: Date;
  environment: 'development' | 'production' | 'test';
  
  // Browser information
  browser: {
    userAgent: string;
    cookiesEnabled: boolean;
    localStorageEnabled: boolean;
    sessionStorageEnabled: boolean;
    language: string;
    platform: string;
    onLine: boolean;
  };
  
  // Network information
  network: {
    connectionType?: string;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };
  
  // Performance information
  performance: {
    memoryUsage?: {
      used: number;
      total: number;
      limit: number;
    };
    timing?: {
      navigationStart: number;
      loadEventEnd: number;
      domContentLoaded: number;
    };
  };
  
  // Session information
  session: {
    hasActiveSession: boolean;
    sessionAge?: number;
    lastSyncTime?: Date;
    syncAttempts: number;
    cookieCount: number;
    cookieSize: number;
  };
}

export interface DebugReport {
  id: string;
  timestamp: Date;
  systemDiagnostics: SystemDiagnostics;
  errorAnalysis: {
    recentErrors: Array<{
      type: SessionPersistenceErrorType;
      message: string;
      timestamp: Date;
      recoveryAction: string;
    }>;
    errorPatterns: Array<{
      type: SessionPersistenceErrorType;
      frequency: number;
      lastOccurrence: Date;
    }>;
    recoverySuccessRate: number;
  };
  recommendations: {
    immediate: string[];
    preventive: string[];
    monitoring: string[];
  };
  troubleshootingSteps: Array<{
    step: number;
    description: string;
    action: string;
    expectedResult: string;
  }>;
}