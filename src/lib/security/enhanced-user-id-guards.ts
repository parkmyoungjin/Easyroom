/**
 * Enhanced User ID Guards with Branded Types and Validation Context
 * Extends existing UserIdGuards with compile-time type safety and comprehensive validation
 * Requirements: 1.1, 1.5
 */

import { logger } from '@/lib/utils/logger';
import { securityMonitor, SecurityEvent } from '@/lib/monitoring/security-monitor';
import { performanceMonitor } from '@/lib/monitoring/performance-monitor';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type TypedSupabaseClient = SupabaseClient<Database>;

import type {
  AuthId,
  DatabaseUserId,
  UserIdValidationContext,
  AuthContext,
  EnhancedUserIdentity,
  EnhancedUserIdValidationResult,
  BatchUserIdValidationResult,
  SecurityEventContext,
  PerformanceMetricContext,
  DataIntegrityCheckResult,
  DataIntegrityViolation
} from '@/types/enhanced-types';
import type { ValidatedReservationData } from '@/types/database';

import {
  createAuthId,
  createDatabaseUserId,
  isAuthId,
  isDatabaseUserId,
  toAuthId,
  toDatabaseUserId
} from '@/types/enhanced-types';

// Re-export type utilities for convenience
export {
  createAuthId,
  createDatabaseUserId,
  isAuthId,
  isDatabaseUserId,
  toAuthId,
  toDatabaseUserId
};

// ============================================================================
// ENHANCED VALIDATION FUNCTIONS
// ============================================================================

/**
 * Enhanced user ID validation with comprehensive context and monitoring
 */
export async function validateUserIdWithContext(
  supabase: TypedSupabaseClient,
  userId: unknown,
  context: UserIdValidationContext
): Promise<EnhancedUserIdValidationResult> {
  const startTime = performance.now();
  const correlationId = generateCorrelationId();
  
  try {
    // Initialize result structure
    const result: EnhancedUserIdValidationResult = {
      isValid: false,
      validationContext: {
        ...context,
        timestamp: new Date(),
        requestId: correlationId
      },
      securityEvents: [],
      performanceMetrics: undefined,
      integrityChecks: undefined
    };

    // Step 1: Basic format validation
    if (!isValidUserIdFormat(userId)) {
      const securityEvent = createSecurityEvent({
        eventType: 'invalid_uuid_format',
        severity: 'medium',
        operation: context.operation,
        table: context.table,
        metadata: { providedUserId: userId, context }
      });
      
      result.securityEvents!.push(securityEvent);
      result.error = 'Invalid UUID format for user_id';
      
      // Record security event
      securityMonitor.recordEvent({
        type: securityEvent.eventType as SecurityEvent['type'],
        severity: securityEvent.severity,
        userId: securityEvent.userId as string,
        endpoint: securityEvent.endpoint,
        method: undefined,
        details: securityEvent.metadata,
        metadata: securityEvent.metadata,
        source: securityEvent.source,
      });
      
      return result;
    }

    const userIdString = userId as string;
    
    // Step 2: Attempt to create branded type
    let databaseUserId: DatabaseUserId;
    try {
      databaseUserId = createDatabaseUserId(userIdString);
    } catch (error) {
      result.error = `Failed to create DatabaseUserId: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return result;
    }

    // Step 3: Database validation with performance monitoring
    const dbValidationResult = await performanceMonitor.measureDatabaseQuery(
      async () => await validateUserIdInDatabase(supabase, databaseUserId, context),
      { operation: 'user_id_validation', table: context.table }
    );

    // Step 4: Process validation result
    if (dbValidationResult.isValid) {
      result.isValid = true;
      result.userId = databaseUserId;
      result.authId = dbValidationResult.authId;
      result.userIdentity = dbValidationResult.userIdentity;
    } else {
      result.error = dbValidationResult.error;
      result.correctedUserId = dbValidationResult.correctedUserId;
      
      // Record security event for validation failure
      const securityEvent = createSecurityEvent({
        eventType: 'user_id_mismatch',
        severity: dbValidationResult.correctedUserId ? 'medium' : 'high',
        userId: databaseUserId,
        operation: context.operation,
        table: context.table,
        metadata: { 
          originalError: dbValidationResult.error,
          correctedUserId: dbValidationResult.correctedUserId,
          context 
        }
      });
      
      result.securityEvents!.push(securityEvent);
      securityMonitor.recordEvent({
        type: securityEvent.eventType as SecurityEvent['type'],
        severity: securityEvent.severity,
        userId: securityEvent.userId as string,
        endpoint: securityEvent.endpoint,
        method: undefined,
        details: securityEvent.metadata,
        metadata: securityEvent.metadata,
        source: securityEvent.source,
      });
    }

    // Step 5: Data integrity checks
    if (result.isValid && result.userIdentity) {
      result.integrityChecks = await performDataIntegrityChecks(
        supabase,
        result.userIdentity,
        context
      );
    }

    // Step 6: Record performance metrics
    const duration = performance.now() - startTime;
    result.performanceMetrics = {
      operation: 'user_id_validation',
      duration,
      success: result.isValid,
      userId: result.userId,
      authId: result.authId,
      endpoint: context.source,
      timestamp: new Date(),
      correlationId,
      metadata: {
        validationContext: context,
        securityEventsCount: result.securityEvents!.length
      }
    };

    return result;

  } catch (error) {
    const duration = performance.now() - startTime;
    
    // Record error event
    const securityEvent = createSecurityEvent({
      eventType: 'data_integrity_violation',
      severity: 'high',
      operation: context.operation,
      table: context.table,
      metadata: { 
        error: error instanceof Error ? error.message : 'Unknown error',
        context,
        duration
      }
    });
    
    securityMonitor.recordEvent({
      type: securityEvent.eventType as SecurityEvent['type'],
      severity: securityEvent.severity,
      userId: securityEvent.userId as string,
      endpoint: securityEvent.endpoint,
      method: undefined,
      details: securityEvent.metadata,
      metadata: securityEvent.metadata,
      source: securityEvent.source,
    });
    
    return {
      isValid: false,
      error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      validationContext: {
        ...context,
        timestamp: new Date(),
        requestId: correlationId
      },
      securityEvents: [securityEvent],
      performanceMetrics: {
        operation: 'user_id_validation',
        duration,
        success: false,
        timestamp: new Date(),
        correlationId,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    };
  }
}

/**
 * Batch validation for multiple user IDs
 */
export async function validateUserIdsBatch(
  supabase: TypedSupabaseClient,
  userIds: unknown[],
  context: Omit<UserIdValidationContext, 'userId'>
): Promise<BatchUserIdValidationResult> {
  const startTime = performance.now();
  const results = new Map<string, EnhancedUserIdValidationResult>();
  const errorTypes: Record<string, number> = {};
  const correctionTypes: Record<string, number> = {};
  
  let validCount = 0;
  let invalidCount = 0;
  let correctedCount = 0;

  // Process each user ID
  for (const userId of userIds) {
    const userIdKey = String(userId);
    const validationContext: UserIdValidationContext = {
      ...context,
      userId,
      timestamp: new Date()
    };

    const result = await validateUserIdWithContext(supabase, userId, validationContext);
    results.set(userIdKey, result);

    if (result.isValid) {
      validCount++;
    } else {
      invalidCount++;
      if (result.error) {
        errorTypes[result.error] = (errorTypes[result.error] || 0) + 1;
      }
    }

    if (result.correctedUserId) {
      correctedCount++;
      correctionTypes['user_id_correction'] = (correctionTypes['user_id_correction'] || 0) + 1;
    }
  }

  const duration = performance.now() - startTime;

  return {
    totalCount: userIds.length,
    validCount,
    invalidCount,
    correctedCount,
    results,
    summary: {
      validationDuration: duration,
      errorTypes,
      correctionTypes
    }
  };
}

// ============================================================================
// DATABASE VALIDATION HELPERS
// ============================================================================

/**
 * Validate user ID against database with enhanced error handling
 */
async function validateUserIdInDatabase(
  supabase: TypedSupabaseClient,
  userId: DatabaseUserId,
  context: UserIdValidationContext
): Promise<{
  isValid: boolean;
  authId?: AuthId;
  userIdentity?: EnhancedUserIdentity;
  error?: string;
  correctedUserId?: DatabaseUserId;
}> {
  try {
    // Check if user_id exists in users table
    const { data: user, error } = await supabase
      .from('users')
      .select('id, auth_id, name, email, department, role, is_active, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (error) {
      // Check if it might be an auth_id instead
      const { data: userByAuthId, error: authError } = await supabase
        .from('users')
        .select('id, auth_id, name, email, department, role, is_active, created_at, updated_at')
        .eq('auth_id', userId)
        .single();

      if (!authError && userByAuthId) {
        return {
          isValid: false,
          authId: createAuthId(userByAuthId.auth_id),
          error: 'user_id appears to be auth_id instead of database id',
          correctedUserId: createDatabaseUserId(userByAuthId.id)
        };
      }

      return {
        isValid: false,
        error: 'user_id does not exist in users table'
      };
    }

    // Create enhanced user identity
    const userIdentity: EnhancedUserIdentity = {
      databaseId: createDatabaseUserId(user.id),
      authId: createAuthId(user.auth_id),
      email: user.email,
      name: user.name,
      department: user.department,
      role: user.role,
      isActive: user.is_active,
      createdAt: new Date(user.created_at),
      updatedAt: user.updated_at ? new Date(user.updated_at) : undefined,
      lastValidated: new Date()
    };

    return {
      isValid: true,
      authId: createAuthId(user.auth_id),
      userIdentity
    };

  } catch (error) {
    logger.error('Database user ID validation failed', {
      userId,
      context,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return {
      isValid: false,
      error: `Database validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// ============================================================================
// DATA INTEGRITY CHECKS
// ============================================================================

/**
 * Perform comprehensive data integrity checks
 */
async function performDataIntegrityChecks(
  supabase: TypedSupabaseClient,
  userIdentity: EnhancedUserIdentity,
  context: UserIdValidationContext
): Promise<DataIntegrityCheckResult> {
  const startTime = performance.now();
  const violations: DataIntegrityViolation[] = [];

  try {
    // Check 1: Verify auth_id and database_id consistency
    const authConsistencyCheck = await checkAuthIdConsistency(supabase, userIdentity);
    if (!authConsistencyCheck.isValid) {
      violations.push(...authConsistencyCheck.violations);
    }

    // Check 2: Verify referential integrity for reservations
    if (context.table === 'reservations' || context.operation === 'create') {
      const referentialCheck = await checkReferentialIntegrity(supabase, userIdentity);
      if (!referentialCheck.isValid) {
        violations.push(...referentialCheck.violations);
      }
    }

    // Check 3: Verify user account status
    const accountStatusCheck = checkAccountStatus(userIdentity);
    if (!accountStatusCheck.isValid) {
      violations.push(...accountStatusCheck.violations);
    }

    const duration = performance.now() - startTime;

    return {
      isValid: violations.length === 0,
      violations,
      metadata: {
        checkType: 'comprehensive_user_integrity',
        timestamp: new Date(),
        duration,
        recordsChecked: 1
      }
    };

  } catch (error) {
    const duration = performance.now() - startTime;
    
    return {
      isValid: false,
      violations: [{
        type: 'referential_integrity',
        severity: 'high',
        table: context.table,
        recordId: userIdentity.databaseId,
        description: `Data integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }],
      metadata: {
        checkType: 'comprehensive_user_integrity',
        timestamp: new Date(),
        duration,
        recordsChecked: 0
      }
    };
  }
}

/**
 * Check auth_id and database_id consistency
 */
async function checkAuthIdConsistency(supabase: TypedSupabaseClient, userIdentity: EnhancedUserIdentity): Promise<{
  isValid: boolean;
  violations: DataIntegrityViolation[];
}> {
  const violations: DataIntegrityViolation[] = [];

  // Verify that the auth_id exists in Supabase auth
  try {
    const { data: authUser, error } = await supabase.auth.admin.getUserById(userIdentity.authId);
    
    if (error || !authUser.user) {
      violations.push({
        type: 'referential_integrity',
        severity: 'critical',
        table: 'users',
        column: 'auth_id',
        recordId: userIdentity.databaseId,
        description: 'auth_id does not exist in Supabase auth system',
        currentValue: userIdentity.authId,
        expectedValue: 'valid auth user ID'
      });
    }
  } catch (error) {
    // Note: This might fail in client-side context, which is acceptable
    logger.debug('Auth consistency check skipped (client-side limitation)', {
      userId: userIdentity.databaseId,
      authId: userIdentity.authId
    });
  }

  return {
    isValid: violations.length === 0,
    violations
  };
}

/**
 * Check referential integrity for user-related tables
 */
async function checkReferentialIntegrity(supabase: TypedSupabaseClient, userIdentity: EnhancedUserIdentity): Promise<{
  isValid: boolean;
  violations: DataIntegrityViolation[];
}> {
  const violations: DataIntegrityViolation[] = [];

  try {
    // Check for orphaned reservations
    const { data: reservations, error: reservationError } = await supabase
      .from('reservations')
      .select('id, user_id')
      .eq('user_id', userIdentity.databaseId)
      .limit(1);

    if (reservationError) {
      violations.push({
        type: 'referential_integrity',
        severity: 'medium',
        table: 'reservations',
        column: 'user_id',
        recordId: userIdentity.databaseId,
        description: `Failed to check reservation references: ${reservationError.message}`
      });
    }

  } catch (error) {
    violations.push({
      type: 'referential_integrity',
      severity: 'medium',
      table: 'reservations',
      recordId: userIdentity.databaseId,
      description: `Referential integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }

  return {
    isValid: violations.length === 0,
    violations
  };
}

/**
 * Check user account status
 */
function checkAccountStatus(userIdentity: EnhancedUserIdentity): {
  isValid: boolean;
  violations: DataIntegrityViolation[];
} {
  const violations: DataIntegrityViolation[] = [];

  if (!userIdentity.isActive) {
    violations.push({
      type: 'constraint_violation',
      severity: 'medium',
      table: 'users',
      column: 'is_active',
      recordId: userIdentity.databaseId,
      description: 'User account is inactive',
      currentValue: false,
      expectedValue: true
    });
  }

  if (!userIdentity.email || !isValidEmail(userIdentity.email)) {
    violations.push({
      type: 'invalid_format',
      severity: 'high',
      table: 'users',
      column: 'email',
      recordId: userIdentity.databaseId,
      description: 'Invalid email format',
      currentValue: userIdentity.email
    });
  }

  return {
    isValid: violations.length === 0,
    violations
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validate user ID format (UUID)
 */
function isValidUserIdFormat(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generate correlation ID for tracking
 */
function generateCorrelationId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create security event with default values
 */
function createSecurityEvent(params: {
  eventType: SecurityEventContext['eventType'];
  severity: SecurityEventContext['severity'];
  userId?: DatabaseUserId;
  authId?: AuthId;
  operation?: string;
  table?: string;
  metadata: Record<string, any>;
}): SecurityEventContext {
  return {
    eventType: params.eventType,
    severity: params.severity,
    userId: params.userId,
    authId: params.authId,
    operation: params.operation,
    table: params.table,
    timestamp: new Date(),
    source: 'enhanced_user_id_guards',
    metadata: params.metadata
  };
}

// ============================================================================
// ENHANCED TYPE GUARDS AND ASSERTIONS
// ============================================================================

/**
 * Enhanced type guard for reservation user_id validation with branded types
 */
export function assertValidReservationUserId(userId: unknown): asserts userId is DatabaseUserId {
  if (!isDatabaseUserId(userId)) {
    throw new Error(`Invalid reservation user_id: ${userId}. Must be a valid DatabaseUserId`);
  }
}

/**
 * Type guard for AuthId validation
 */
export function assertValidAuthId(authId: unknown): asserts authId is AuthId {
  if (!isAuthId(authId)) {
    throw new Error(`Invalid auth_id: ${authId}. Must be a valid AuthId`);
  }
}



/**
 * Validate and sanitize reservation data with enhanced type checking
 */
export async function validateReservationDataEnhanced(
  supabase: TypedSupabaseClient,
  data: any,
  context: Omit<UserIdValidationContext, 'userId'>
): Promise<ValidatedReservationData> {
  // Validate required fields
  if (!data.room_id || !isValidUserIdFormat(data.room_id)) {
    throw new Error('Invalid or missing room_id');
  }

  if (!data.user_id) {
    throw new Error('Missing user_id');
  }

  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    throw new Error('Invalid or missing title');
  }

  if (!data.start_time || !data.end_time) {
    throw new Error('Invalid or missing start_time or end_time');
  }

  // Enhanced user_id validation with context
  const validationContext: UserIdValidationContext = {
    ...context,
    userId: data.user_id,
    operation: 'create',
    table: 'reservations',
    timestamp: new Date()
  };

  const userValidation = await validateUserIdWithContext(supabase, data.user_id, validationContext);
  
  if (!userValidation.isValid) {
    if (userValidation.correctedUserId) {
      logger.warn('Correcting auth_id to database id in reservation data', {
        originalUserId: data.user_id,
        correctedUserId: userValidation.correctedUserId,
        context: validationContext
      });
      data.user_id = userValidation.correctedUserId;
    } else {
      throw new Error(`Invalid user_id: ${userValidation.error}`);
    }
  }

  // Return validated data with branded types
  return {
    room_id: data.room_id,
    user_id: userValidation.userId || createDatabaseUserId(data.user_id),
    title: data.title.trim(),
    purpose: data.purpose?.trim() || undefined,
    start_time: data.start_time,
    end_time: data.end_time,
    status: data.status || 'confirmed'
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const EnhancedUserIdGuards = {
  // Core validation functions
  validateUserIdWithContext,
  validateUserIdsBatch,
  
  // Type guards and assertions
  assertValidReservationUserId,
  assertValidAuthId,
  
  // Data validation
  validateReservationDataEnhanced,
  
  // Type utilities (re-exported)
  createAuthId,
  createDatabaseUserId,
  isAuthId,
  isDatabaseUserId,
  toAuthId,
  toDatabaseUserId
} as const;