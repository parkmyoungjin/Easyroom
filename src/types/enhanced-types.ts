
/**
 * Enhanced Type System for Data Integrity and Security
 * Branded types to prevent AuthId and DatabaseUserId confusion at compile time
 * Requirements: 1.1, 1.5
 */

// ============================================================================
// BRANDED TYPES FOR USER IDENTIFICATION
// ============================================================================

/**
 * Branded type for Supabase Auth ID (auth.users.id)
 * This represents the authentication system's user identifier
 */
export type AuthId = string & { readonly __brand: 'AuthId' };

/**
 * Branded type for Database User ID (public.users.id)
 * This represents the application database's user identifier
 */
export type DatabaseUserId = string & { readonly __brand: 'DatabaseUserId' };

/**
 * Type guard to create AuthId from string
 */
export function createAuthId(id: string): AuthId {
  if (!isValidUUID(id)) {
    throw new Error(`Invalid AuthId format: ${id}`);
  }
  return id as AuthId;
}

/**
 * Type guard to create DatabaseUserId from string
 */
export function createDatabaseUserId(id: string): DatabaseUserId {
  if (!isValidUUID(id)) {
    throw new Error(`Invalid DatabaseUserId format: ${id}`);
  }
  return id as DatabaseUserId;
}

/**
 * UUID validation helper
 */
function isValidUUID(value: string): boolean {
  // UUID v4에 더 특화된 정규식
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Regex.test(value);
}

// ============================================================================
// VALIDATION CONTEXT INTERFACES
// ============================================================================

/**
 * Enhanced validation context for user ID operations
 */
export interface UserIdValidationContext {
  operation: 'create' | 'update' | 'delete' | 'query' | 'auth_check';
  table: string;
  userId: unknown;
  authContext?: AuthContext;
  requestId?: string;
  timestamp: Date;
  source: 'client' | 'server' | 'middleware' | 'api';
  metadata?: Record<string, any>;
}

/**
 * Authentication context for validation
 */
export interface AuthContext {
  authId: AuthId;
  sessionId?: string;
  role: 'admin' | 'employee';
  email: string;
  isAuthenticated: boolean;
  permissions?: string[];
}

/**
 * Enhanced user identity with branded types
 */
export interface EnhancedUserIdentity {
  databaseId: DatabaseUserId;
  authId: AuthId;
  email: string;
  name: string;
  department: string;
  role: 'admin' | 'employee';
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
  lastValidated?: Date;
}

// ============================================================================
// SECURITY CONTEXT INTERFACES
// ============================================================================

/**
 * Security event types for monitoring
 */
export type SecurityEventType = 
  | 'auth_failure' 
  | 'suspicious_access' 
  | 'data_integrity_violation' 
  | 'rate_limit_exceeded' 
  | 'privilege_escalation_attempt'
  | 'user_id_mismatch'
  | 'invalid_uuid_format'
  | 'unauthorized_operation';

/**
 * Security severity levels
 */
export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Enhanced security event context
 */
export interface SecurityEventContext {
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  userId?: DatabaseUserId;
  authId?: AuthId;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  operation?: string;
  table?: string;
  timestamp: Date;
  source: string;
  metadata: Record<string, any>;
  correlationId?: string;
}

/**
 * Security monitoring configuration
 */
export interface SecurityMonitoringConfig {
  enableRealTimeAlerts: boolean;
  alertThresholds: Record<SecurityEventType, {
    count: number;
    timeWindowMinutes: number;
  }>;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  retentionDays: number;
}

// ============================================================================
// PERFORMANCE CONTEXT INTERFACES
// ============================================================================

/**
 * Performance operation types
 */
export type PerformanceOperation = 
  | 'authentication'
  | 'authorization'
  | 'database_query'
  | 'rpc_function'
  | 'data_validation'
  | 'environment_check'
  | 'user_id_validation'
  | 'security_check';

/**
 * Enhanced performance metric context
 */
export interface PerformanceMetricContext {
  operation: PerformanceOperation;
  duration: number;
  success: boolean;
  userId?: DatabaseUserId;
  authId?: AuthId;
  endpoint?: string;
  queryType?: string;
  recordCount?: number;
  cacheHit?: boolean;
  resourceUsage?: ResourceUsage;
  timestamp: Date;
  correlationId?: string;
  metadata: Record<string, any>;
}

/**
 * Resource usage tracking
 */
export interface ResourceUsage {
  memoryMB?: number;
  cpuPercent?: number;
  diskIOKB?: number;
  networkIOKB?: number;
  databaseConnections?: number;
}

/**
 * Performance monitoring configuration
 */
export interface PerformanceMonitoringConfig {
  enableMetricCollection: boolean;
  thresholds: Record<PerformanceOperation, {
    warningMs: number;
    criticalMs: number;
  }>;
  sampleRate: number; // 0.0 to 1.0
  retentionHours: number;
  enableResourceTracking: boolean;
}

// ============================================================================
// DATA INTEGRITY INTERFACES
// ============================================================================

/**
 * Data integrity violation types
 */
export type DataIntegrityViolationType = 
  | 'user_id_mismatch'
  | 'foreign_key_violation'
  | 'constraint_violation'
  | 'duplicate_key'
  | 'invalid_format'
  | 'missing_required_field'
  | 'referential_integrity';

/**
 * Data integrity check result
 */
export interface DataIntegrityCheckResult {
  isValid: boolean;
  violations: DataIntegrityViolation[];
  correctionSuggestions?: DataIntegrityCorrection[];
  metadata: {
    checkType: string;
    timestamp: Date;
    duration: number;
    recordsChecked: number;
  };
}

/**
 * Data integrity violation details
 */
export interface DataIntegrityViolation {
  type: DataIntegrityViolationType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  table: string;
  column?: string;
  recordId?: string;
  description: string;
  currentValue?: any;
  expectedValue?: any;
  constraint?: string;
}

/**
 * Data integrity correction suggestion
 */
export interface DataIntegrityCorrection {
  violationId: string;
  correctionType: 'update' | 'delete' | 'insert' | 'manual_review';
  sql?: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
}

// ============================================================================
// VALIDATION RESULT INTERFACES
// ============================================================================

/**
 * Enhanced user ID validation result
 */
export interface EnhancedUserIdValidationResult {
  isValid: boolean;
  userId?: DatabaseUserId;
  authId?: AuthId;
  userIdentity?: EnhancedUserIdentity;
  error?: string;
  correctedUserId?: DatabaseUserId;
  validationContext: UserIdValidationContext;
  securityEvents?: SecurityEventContext[];
  performanceMetrics?: PerformanceMetricContext;
  integrityChecks?: DataIntegrityCheckResult;
}

/**
 * Batch validation result for multiple user IDs
 */
export interface BatchUserIdValidationResult {
  totalCount: number;
  validCount: number;
  invalidCount: number;
  correctedCount: number;
  results: Map<string, EnhancedUserIdValidationResult>;
  summary: {
    validationDuration: number;
    errorTypes: Record<string, number>;
    correctionTypes: Record<string, number>;
  };
}

// ============================================================================
// TYPE UTILITIES
// ============================================================================

/**
 * Type predicate to check if a value is AuthId
 * Note: This checks format only, not the actual brand at runtime
 */
export function isAuthId(value: unknown): value is AuthId {
  return typeof value === 'string' && isValidUUID(value);
}

/**
 * Type predicate to check if a value is DatabaseUserId
 * Note: This checks format only, not the actual brand at runtime
 */
export function isDatabaseUserId(value: unknown): value is DatabaseUserId {
  return typeof value === 'string' && isValidUUID(value);
}

/**
 * Convert AuthId to string (for database operations)
 */
export function authIdToString(authId: AuthId): string {
  return authId as string;
}

/**
 * Convert DatabaseUserId to string (for database operations)
 */
export function databaseUserIdToString(userId: DatabaseUserId): string {
  return userId as string;
}

/**
 * Safe conversion from unknown to AuthId with validation
 */
export function toAuthId(value: unknown): AuthId {
  if (typeof value !== 'string') {
    throw new Error(`Cannot convert ${typeof value} to AuthId`);
  }
  return createAuthId(value);
}

/**
 * Safe conversion from unknown to DatabaseUserId with validation
 */
export function toDatabaseUserId(value: unknown): DatabaseUserId {
  if (typeof value !== 'string') {
    throw new Error(`Cannot convert ${typeof value} to DatabaseUserId`);
  }
  return createDatabaseUserId(value);
}

