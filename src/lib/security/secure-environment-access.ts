/**
 * Secure Environment Access Wrapper
 * Mandatory centralized access for all environment variables with context tracking
 * Requirements: 2.1, 2.5
 */

import { logger } from '@/lib/utils/logger';
import { securityMonitor } from '@/lib/monitoring/security-monitor';
import { 
  recordMissingVariable,
  recordValidationFailure,
  startEnvironmentValidationTracking,
  completeEnvironmentValidationTracking
} from '@/lib/monitoring/environment-monitor';
import { getServiceRoleKey } from '@/lib/security/environment-manager';
import type {
  AuthId,
  DatabaseUserId,
  PerformanceMetricContext
} from '@/types/enhanced-types';

// ============================================================================
// ENVIRONMENT ACCESS CONTEXT INTERFACES
// ============================================================================

/**
 * Context for environment variable access tracking
 */
export interface EnvironmentAccessContext {
  caller: string;
  endpoint?: string;
  userId?: DatabaseUserId;
  authId?: AuthId;
  sessionId?: string;
  operation: 'read' | 'validate' | 'audit';
  purpose: string;
  timestamp: Date;
  requestId?: string;
  metadata?: Record<string, any>;
}

/**
 * Environment variable access result
 */
export interface EnvironmentAccessResult<T = string> {
  success: boolean;
  value?: T;
  error?: string;
  accessContext: EnvironmentAccessContext;
  performanceMetrics?: PerformanceMetricContext;
}

/**
 * Environment variable configuration
 */
export interface EnvironmentVariableConfig {
  key: string;
  required: boolean;
  sensitive: boolean;
  allowedCallers?: string[];
  allowedEnvironments?: ('development' | 'test' | 'production')[];
  validator?: (value: string) => { valid: boolean; error?: string };
  defaultValue?: string;
  description?: string;
}

// ============================================================================
// SECURE ENVIRONMENT ACCESS CLASS
// ============================================================================

class SecureEnvironmentAccess {
  private static instance: SecureEnvironmentAccess;
  private accessLog: EnvironmentAccessContext[] = [];
  private readonly maxLogEntries = 1000;

  // Environment variable registry with security configurations
  private readonly environmentRegistry: Map<string, EnvironmentVariableConfig> = new Map([
    // Public Supabase variables
    ['NEXT_PUBLIC_SUPABASE_URL', {
      key: 'NEXT_PUBLIC_SUPABASE_URL',
      required: true,
      sensitive: false,
      allowedEnvironments: ['development', 'test', 'production'],
      validator: this.validateSupabaseUrl,
      description: 'Supabase project URL'
    }],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', {
      key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      required: true,
      sensitive: true,
      allowedEnvironments: ['development', 'test', 'production'],
      validator: this.validateSupabaseKey,
      description: 'Supabase anonymous key'
    }],

    // Server-only variables
    ['SUPABASE_SERVICE_ROLE_KEY', {
      key: 'SUPABASE_SERVICE_ROLE_KEY',
      required: false, // Required only in production
      sensitive: true,
      allowedCallers: ['createAdminClient', 'admin-api', 'user-management', 'system-maintenance', 'system_validation'],
      allowedEnvironments: ['development', 'test', 'production'],
      validator: this.validateSupabaseKey,
      description: 'Supabase service role key for admin operations'
    }],

    // Node environment
    ['NODE_ENV', {
      key: 'NODE_ENV',
      required: false,
      sensitive: false,
      allowedEnvironments: ['development', 'test', 'production'],
      validator: this.validateNodeEnv,
      defaultValue: 'development',
      description: 'Node.js environment'
    }],

    // Authentication secrets
    ['NEXTAUTH_SECRET', {
      key: 'NEXTAUTH_SECRET',
      required: false,
      sensitive: true,
      allowedEnvironments: ['development', 'test', 'production'],
      validator: this.validateAuthSecret,
      description: 'NextAuth.js secret for JWT signing'
    }],
    ['AUTH_SECRET', {
      key: 'AUTH_SECRET',
      required: false,
      sensitive: true,
      allowedEnvironments: ['development', 'test', 'production'],
      validator: this.validateAuthSecret,
      description: 'Alternative auth secret'
    }],

    // URL configurations
    ['NEXTAUTH_URL', {
      key: 'NEXTAUTH_URL',
      required: false,
      sensitive: false,
      allowedEnvironments: ['development', 'test', 'production'],
      validator: this.validateUrl,
      description: 'NextAuth.js canonical URL'
    }],
    ['NEXT_PUBLIC_VERCEL_URL', {
      key: 'NEXT_PUBLIC_VERCEL_URL',
      required: false,
      sensitive: false,
      allowedEnvironments: ['development', 'test', 'production'],
      validator: this.validateUrl,
      description: 'Vercel deployment URL'
    }],

    // Application metadata
    ['NEXT_PUBLIC_APP_VERSION', {
      key: 'NEXT_PUBLIC_APP_VERSION',
      required: false,
      sensitive: false,
      allowedEnvironments: ['development', 'test', 'production'],
      description: 'Application version'
    }],
    ['NEXT_PUBLIC_BUILD_ID', {
      key: 'NEXT_PUBLIC_BUILD_ID',
      required: false,
      sensitive: false,
      allowedEnvironments: ['development', 'test', 'production'],
      description: 'Build identifier'
    }],

    // External service configurations
    ['SLACK_WEBHOOK_URL', {
      key: 'SLACK_WEBHOOK_URL',
      required: false,
      sensitive: true,
      allowedCallers: ['security-monitor', 'performance-monitor', 'alert-system', 'system_validation'],
      allowedEnvironments: ['development', 'test', 'production'],
      validator: this.validateUrl,
      description: 'Slack webhook URL for notifications'
    }]
  ]);

  private constructor() {}

  static getInstance(): SecureEnvironmentAccess {
    if (!SecureEnvironmentAccess.instance) {
      SecureEnvironmentAccess.instance = new SecureEnvironmentAccess();
    }
    return SecureEnvironmentAccess.instance;
  }

  // ============================================================================
  // PUBLIC ACCESS METHODS
  // ============================================================================

  /**
   * Get environment variable with full security context tracking
   */
  async getEnvironmentVariable(
    key: string,
    context: Omit<EnvironmentAccessContext, 'timestamp' | 'operation'>
  ): Promise<EnvironmentAccessResult> {
    const startTime = performance.now();
    const accessContext: EnvironmentAccessContext = {
      ...context,
      operation: 'read',
      timestamp: new Date()
    };

    try {
      // Check if variable is registered
      const config = this.environmentRegistry.get(key);
      if (!config) {
        return this.createErrorResult(
          accessContext,
          `Environment variable ${key} is not registered in the secure access system`
        );
      }

      // Validate caller permissions
      const callerValidation = this.validateCaller(config, accessContext);
      if (!callerValidation.valid) {
        return this.createErrorResult(accessContext, callerValidation.error!);
      }

      // Get environment variable value with client-side compatibility
      let value: string | undefined;
      
      // For client-side public variables, use static mapping to allow Next.js build-time replacement
      if (typeof window !== 'undefined' && key.startsWith('NEXT_PUBLIC_')) {
        // Client-side: use static mapping
        value = publicEnvVars[key as keyof typeof publicEnvVars] || config.defaultValue;
      } else {
        // Server-side: use dynamic access with fallback handling
        value = process.env[key] || config.defaultValue;
        
        // Special handling for development environment - ensure .env.local is loaded
        if (!value && process.env.NODE_ENV === 'development' && key.startsWith('NEXT_PUBLIC_')) {
          // In development, if Next.js hasn't loaded the env vars yet, try to read directly
          try {
            const fs = require('fs');
            const path = require('path');
            const envPath = path.join(process.cwd(), '.env.local');
            
            if (fs.existsSync(envPath)) {
              const envContent = fs.readFileSync(envPath, 'utf8');
              const lines = envContent.split('\n');
              
              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith(key + '=')) {
                  value = trimmed.substring(key.length + 1);
                  // Remove quotes if present
                  if (value && ((value.startsWith('"') && value.endsWith('"')) || 
                      (value.startsWith("'") && value.endsWith("'")))) {
                    value = value.slice(1, -1);
                  }
                  break;
                }
              }
            }
          } catch (error) {
            // Fallback failed, continue with normal flow
          }
        }
      }
      
      // Check if required variable is missing
      if (!value && config.required) {
        // Record missing variable error
        recordMissingVariable(key, {
          operation: accessContext.operation === 'read' ? 'runtime_access' : 'startup_validation',
          caller: accessContext.caller,
          environment: process.env.NODE_ENV || 'development',
          endpoint: accessContext.endpoint,
          userId: accessContext.userId ? String(accessContext.userId) : undefined,
          sessionId: accessContext.sessionId
        }, 'high');

        return this.createErrorResult(
          accessContext,
          `Required environment variable ${key} is not set`
        );
      }

      // Validate environment permissions first
      const envValidation = this.validateEnvironment(config);
      if (!envValidation.valid) {
        return this.createErrorResult(accessContext, envValidation.error!);
      }

      // Validate value format if validator exists and we have a value
      if (value && config.validator) {
        // Skip validation in development for basic functionality
        const isDevelopment = (process.env.NODE_ENV || 'development') === 'development';
        if (!isDevelopment) {
          const validation = config.validator(value);
          if (!validation.valid) {
            // Record validation failure
            recordValidationFailure(key, validation.error || 'Unknown validation error', {
              operation: accessContext.operation === 'read' ? 'runtime_access' : 'startup_validation',
              caller: accessContext.caller,
              environment: process.env.NODE_ENV || 'development',
              endpoint: accessContext.endpoint,
              userId: accessContext.userId ? String(accessContext.userId) : undefined,
              sessionId: accessContext.sessionId
            });

            return this.createErrorResult(
              accessContext,
              `Invalid format for ${key}: ${validation.error}`
            );
          }
        }
      }

      // Log access
      this.logAccess(accessContext);

      // Record performance metrics
      const duration = performance.now() - startTime;
      const performanceMetrics: PerformanceMetricContext = {
        operation: 'environment_check',
        duration,
        success: true,
        userId: context.userId,
        authId: context.authId,
        endpoint: context.endpoint,
        timestamp: new Date(),
        correlationId: context.requestId,
        metadata: {
          environmentKey: key,
          sensitive: config.sensitive,
          caller: context.caller
        }
      };

      return {
        success: true,
        value: value,
        accessContext,
        performanceMetrics
      };

    } catch (error) {
      const duration = performance.now() - startTime;
      
      // Record security event for access failure
      securityMonitor.recordEvent({
        type: 'suspicious_access',
        severity: 'high',
        userId: context.userId ? String(context.userId) : undefined,
        sessionId: context.sessionId,
        endpoint: context.endpoint,
        source: 'secure_environment_access',
        details: {
          operation: 'environment_access',
          environmentKey: key,
          caller: context.caller,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        metadata: {
          authId: context.authId,
          requestId: context.requestId
        }
      });

      return {
        success: false,
        error: `Environment access failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        accessContext,
        performanceMetrics: {
          operation: 'environment_check',
          duration,
          success: false,
          timestamp: new Date(),
          correlationId: context.requestId,
          metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
        }
      };
    }
  }

  /**
   * Get public environment variable (client-safe)
   */
  async getPublicVariable(
    key: string,
    context: Omit<EnvironmentAccessContext, 'timestamp' | 'operation' | 'purpose'>
  ): Promise<EnvironmentAccessResult> {
    return this.getEnvironmentVariable(key, {
      ...context,
      purpose: 'public_access'
    });
  }

  /**
   * Get server-only environment variable
   */
  async getServerVariable(
    key: string,
    context: Omit<EnvironmentAccessContext, 'timestamp' | 'operation' | 'purpose'>
  ): Promise<EnvironmentAccessResult> {
    return this.getEnvironmentVariable(key, {
      ...context,
      purpose: 'server_access'
    });
  }

  /**
   * Get service role key with enhanced security
   */
  async getServiceRoleKey(
    context: Omit<EnvironmentAccessContext, 'timestamp' | 'operation' | 'purpose'>
  ): Promise<EnvironmentAccessResult> {
    try {
      // Use existing secure service role key access
      const serviceRoleKey = getServiceRoleKey({
        caller: context.caller,
        endpoint: context.endpoint,
        userId: context.userId ? String(context.userId) : undefined
      });

      const accessContext: EnvironmentAccessContext = {
        ...context,
        operation: 'read',
        purpose: 'service_role_access',
        timestamp: new Date()
      };

      this.logAccess(accessContext);

      return {
        success: true,
        value: serviceRoleKey,
        accessContext
      };

    } catch (error) {
      const accessContext: EnvironmentAccessContext = {
        ...context,
        operation: 'read',
        purpose: 'service_role_access',
        timestamp: new Date()
      };

      return this.createErrorResult(
        accessContext,
        error instanceof Error ? error.message : 'Service role key access failed'
      );
    }
  }

  // ============================================================================
  // VALIDATION METHODS
  // ============================================================================

  /**
   * Validate all registered environment variables
   */
  async validateAllEnvironmentVariables(): Promise<{
    valid: boolean;
    results: Map<string, EnvironmentAccessResult>;
    summary: {
      total: number;
      valid: number;
      invalid: number;
      missing: number;
    };
  }> {
    // Start tracking environment validation
    const validationId = startEnvironmentValidationTracking(`validation_${Date.now()}`);
    
    const results = new Map<string, EnvironmentAccessResult>();
    let validCount = 0;
    let invalidCount = 0;
    let missingCount = 0;

    const validationContext = {
      caller: 'system_validation',
      purpose: 'startup_validation',
      requestId: `validation_${Date.now()}`
    };

    for (const [key, config] of this.environmentRegistry) {
      const result = await this.getEnvironmentVariable(key, validationContext);
      results.set(key, result);

      if (result.success) {
        if (result.value) {
          validCount++;
        } else if (config.required) {
          missingCount++;
          invalidCount++;
        }
      } else {
        invalidCount++;
      }
    }

    // Complete validation tracking
    completeEnvironmentValidationTracking(
      validationId,
      this.environmentRegistry.size,
      validCount,
      invalidCount,
      missingCount
    );

    return {
      valid: invalidCount === 0,
      results,
      summary: {
        total: this.environmentRegistry.size,
        valid: validCount,
        invalid: invalidCount,
        missing: missingCount
      }
    };
  }

  /**
   * Get environment variable registry information
   */
  getEnvironmentRegistry(): Map<string, EnvironmentVariableConfig> {
    return new Map(this.environmentRegistry);
  }

  /**
   * Get access log
   */
  getAccessLog(): EnvironmentAccessContext[] {
    return [...this.accessLog];
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private validateCaller(
    config: EnvironmentVariableConfig,
    context: EnvironmentAccessContext
  ): { valid: boolean; error?: string } {
    if (config.allowedCallers && !config.allowedCallers.includes(context.caller)) {
      return {
        valid: false,
        error: `Caller ${context.caller} is not authorized to access ${config.key}`
      };
    }
    return { valid: true };
  }

  private validateEnvironment(
    config: EnvironmentVariableConfig
  ): { valid: boolean; error?: string } {
    // For NODE_ENV itself, skip environment validation to avoid circular dependency
    if (config.key === 'NODE_ENV') {
      return { valid: true };
    }
    
    const currentEnv = process.env.NODE_ENV || 'development';
    
    if (config.allowedEnvironments && !config.allowedEnvironments.includes(currentEnv as any)) {
      return {
        valid: false,
        error: `Environment variable ${config.key} is not allowed in ${currentEnv} environment`
      };
    }
    return { valid: true };
  }

  private logAccess(context: EnvironmentAccessContext): void {
    // Add to access log
    if (this.accessLog.length >= this.maxLogEntries) {
      this.accessLog.shift();
    }
    this.accessLog.push(context);

    // Log to application logger
    logger.info('Environment variable accessed', {
      key: '[REDACTED]', // Don't log the actual key for security
      caller: context.caller,
      endpoint: context.endpoint,
      purpose: context.purpose,
      timestamp: context.timestamp,
      requestId: context.requestId
    });
  }

  private createErrorResult(
    context: EnvironmentAccessContext,
    error: string
  ): EnvironmentAccessResult {
    // Record security event
    securityMonitor.recordEvent({
      type: 'suspicious_access',
      severity: 'medium',
      userId: context.userId ? String(context.userId) : undefined,
      sessionId: context.sessionId,
      endpoint: context.endpoint,
      source: 'secure_environment_access',
      details: {
        operation: context.operation,
        caller: context.caller,
        purpose: context.purpose,
        error
      },
      metadata: {
        authId: context.authId,
        requestId: context.requestId
      }
    });

    return {
      success: false,
      error,
      accessContext: context
    };
  }

  // ============================================================================
  // VALIDATORS
  // ============================================================================

  private validateSupabaseUrl(value: string): { valid: boolean; error?: string } {
    try {
      // Check for development default values first (exact matches only)
      const devDefaults = ['your_supabase_url_here', 'example.supabase.co'];
      if (devDefaults.some(defaultVal => value.toLowerCase().includes(defaultVal.toLowerCase()))) {
        return { valid: false, error: 'Appears to be a development default value' };
      }

      const url = new URL(value);
      
      if (!url.hostname.includes('supabase')) {
        return { valid: false, error: 'URL does not appear to be a Supabase URL' };
      }

      if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
        return { valid: false, error: 'HTTPS is required in production' };
      }

      return { valid: true };
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }
  }

  private validateSupabaseKey(value: string): { valid: boolean; error?: string } {
    if (value.length < 50) {
      return { valid: false, error: 'Supabase key appears to be too short' };
    }

    // Check for development default values
    const devDefaults = ['your_supabase', 'example', 'test_key', 'your_supabase_url_here'];
    if (devDefaults.some(defaultVal => value.toLowerCase().includes(defaultVal.toLowerCase()))) {
      return { valid: false, error: 'Appears to be a development default value' };
    }

    return { valid: true };
  }

  private validateNodeEnv(value: string): { valid: boolean; error?: string } {
    const validEnvs = ['development', 'test', 'production'];
    if (!validEnvs.includes(value)) {
      return { valid: false, error: `Invalid NODE_ENV value. Must be one of: ${validEnvs.join(', ')}` };
    }
    return { valid: true };
  }

  private validateAuthSecret(value: string): { valid: boolean; error?: string } {
    if (value.length < 32) {
      return { valid: false, error: 'Auth secret should be at least 32 characters long' };
    }
    return { valid: true };
  }

  private validateUrl(value: string): { valid: boolean; error?: string } {
    try {
      new URL(value);
      return { valid: true };
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE AND CONVENIENCE FUNCTIONS
// ============================================================================

export const secureEnvironmentAccess = SecureEnvironmentAccess.getInstance();

// ============================================================================
// CLIENT-SIDE ENVIRONMENT ACCESS (STATIC MAPPING)
// ============================================================================

/**
 * Static mapping of public environment variables for client-side access
 * This allows Next.js to replace variables at build time, avoiding dynamic access issues
 */
const publicEnvVars = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_VERCEL_URL: process.env.NEXT_PUBLIC_VERCEL_URL,
  NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
  NEXT_PUBLIC_BUILD_ID: process.env.NEXT_PUBLIC_BUILD_ID,
} as const;

/**
 * Client-safe function to get public environment variables
 * Uses static mapping to allow Next.js build-time replacement
 * FOR CLIENT-SIDE USE ONLY
 */
export function getPublicEnvVar(
  key: (keyof typeof publicEnvVars) | 'NODE_ENV',
  caller: string
): string {
  // --- ▼▼▼▼▼ 이 부분을 추가하세요 ▼▼▼▼▼ ---
  // 요청된 키가 'NODE_ENV'인 경우, 특별히 처리하여 바로 반환합니다.
  if (key === 'NODE_ENV') {
    // 이 코드는 Next.js에 의해 'development' 또는 'production'으로 교체됩니다.
    return process.env.NODE_ENV;
  }  
  const value = publicEnvVars[key];
  
  if (!value) {
    const errorMessage = `Required public environment variable ${key} is not set. Called by ${caller}.`;
    logger.error(errorMessage, { key, caller });
    throw new Error(errorMessage);
  }

  // Simple logging for client-side access
  logger.info(`Public env var accessed: ${key}`, { caller });
  return value;
}

/**
 * Server-side convenience function to get public environment variable
 * Uses the full secure access system with validation and monitoring
 */
export async function getPublicEnvVarSecure(
  key: string,
  caller: string,
  endpoint?: string
): Promise<string> {
  const result = await secureEnvironmentAccess.getPublicVariable(key, {
    caller,
    endpoint
  });

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.value!;
}

/**
 * Convenience function to get server environment variable
 */
export async function getServerEnvVar(
  key: string,
  caller: string,
  endpoint?: string
): Promise<string> {
  const result = await secureEnvironmentAccess.getServerVariable(key, {
    caller,
    endpoint
  });

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.value!;
}

/**
 * Convenience function to get service role key
 */
export async function getSecureServiceRoleKey(
  caller: string,
  endpoint?: string,
  userId?: DatabaseUserId
): Promise<string> {
  const result = await secureEnvironmentAccess.getServiceRoleKey({
    caller,
    endpoint,
    userId
  });

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.value!;
}

/**
 * Validate all environment variables at startup
 */
export async function validateEnvironmentAtStartup(): Promise<void> {
  const validation = await secureEnvironmentAccess.validateAllEnvironmentVariables();
  
  if (!validation.valid) {
    const errors: string[] = [];
    for (const [key, result] of validation.results) {
      if (!result.success) {
        errors.push(`${key}: ${result.error}`);
      }
    }
    
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }

  logger.info('Environment validation completed successfully', {
    total: validation.summary.total,
    valid: validation.summary.valid,
    invalid: validation.summary.invalid,
    missing: validation.summary.missing
  });
}