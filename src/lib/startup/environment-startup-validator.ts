/**
 * Environment Startup Validator
 * Integrates environment validation into application startup process
 * Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4
 */

import { validateEnvironment, quickEnvironmentCheck } from '@/lib/config/environment-validator';
import { handleEnvironmentError } from '@/lib/error-handling/environment-error-handler';
import { logger } from '@/lib/utils/logger';
import type { ValidationResult } from '@/lib/config/environment-validator';
import type { UserFriendlyError } from '@/lib/error-handling/environment-error-handler';

// ============================================================================
// STARTUP VALIDATION INTERFACES
// ============================================================================

export interface StartupValidationResult {
  success: boolean;
  validationResult?: ValidationResult;
  userFriendlyError?: UserFriendlyError;
  canContinue: boolean;
  requiresUserAction: boolean;
  startupTime: number;
}

export interface StartupValidationOptions {
  strictMode?: boolean;
  includeOptional?: boolean;
  failFast?: boolean;
  environment?: 'development' | 'test' | 'production';
}

// ============================================================================
// STARTUP VALIDATOR CLASS
// ============================================================================

class EnvironmentStartupValidator {
  private static instance: EnvironmentStartupValidator;
  private validationCache: Map<string, { result: StartupValidationResult; timestamp: number }> = new Map();
  private readonly cacheTimeout = 30000; // 30 seconds

  private constructor() {}

  static getInstance(): EnvironmentStartupValidator {
    if (!EnvironmentStartupValidator.instance) {
      EnvironmentStartupValidator.instance = new EnvironmentStartupValidator();
    }
    return EnvironmentStartupValidator.instance;
  }

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  /**
   * Perform comprehensive startup validation
   */
  async performStartupValidation(
    options: StartupValidationOptions = {}
  ): Promise<StartupValidationResult> {
    const startTime = performance.now();
    const {
      strictMode = false,
      includeOptional = true,
      failFast = false,
      environment = this.detectEnvironment()
    } = options;

    const cacheKey = this.generateCacheKey(options);
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      logger.debug('Using cached startup validation result', { cacheKey });
      return cached;
    }

    logger.info('Starting environment validation for application startup', {
      environment,
      strictMode,
      includeOptional,
      failFast
    });

    try {
      // Quick check first for fast failure
      if (failFast) {
        const quickCheck = await quickEnvironmentCheck();
        if (!quickCheck) {
          const result = await this.handleValidationFailure(
            new Error('Quick environment check failed'),
            environment,
            startTime
          );
          this.cacheResult(cacheKey, result);
          return result;
        }
      }

      // Comprehensive validation
      const validationResult = await validateEnvironment({
        strictMode,
        includeOptional,
        environment,
        caller: 'startup_validator'
      });

      const endTime = performance.now();
      const startupTime = endTime - startTime;

      if (validationResult.valid) {
        const successResult: StartupValidationResult = {
          success: true,
          validationResult,
          canContinue: true,
          requiresUserAction: false,
          startupTime
        };

        logger.info('Environment startup validation successful', {
          startupTime: `${startupTime.toFixed(2)}ms`,
          summary: validationResult.summary,
          environment
        });

        this.cacheResult(cacheKey, successResult);
        return successResult;
      } else {
        // Handle validation failure
        const error = new Error(
          `Environment validation failed: ${validationResult.errors.join(', ')}`
        );
        const result = await this.handleValidationFailure(error, environment, startTime, validationResult);
        this.cacheResult(cacheKey, result);
        return result;
      }

    } catch (error) {
      const result = await this.handleValidationFailure(
        error instanceof Error ? error : new Error('Unknown startup validation error'),
        environment,
        startTime
      );
      this.cacheResult(cacheKey, result);
      return result;
    }
  }

  /**
   * Quick startup check for fast boot scenarios
   */
  async quickStartupCheck(): Promise<boolean> {
    try {
      logger.debug('Performing quick startup environment check');
      return await quickEnvironmentCheck();
    } catch (error) {
      logger.error('Quick startup check failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Validate specific environment aspects for startup
   */
  async validateStartupRequirements(): Promise<{
    database: boolean;
    auth: boolean;
    storage: boolean;
    monitoring: boolean;
  }> {
    const results = {
      database: false,
      auth: false,
      storage: false,
      monitoring: false
    };

    try {
      const validationResult = await validateEnvironment({
        includeOptional: false,
        strictMode: false,
        caller: 'startup_requirements_check'
      });

      if (validationResult.valid) {
        // Check specific service requirements
        const details = validationResult.details;
        
        // Database requirements
        results.database = this.checkServiceRequirement(details, [
          'NEXT_PUBLIC_SUPABASE_URL',
          'NEXT_PUBLIC_SUPABASE_ANON_KEY'
        ]);

        // Auth requirements
        results.auth = this.checkServiceRequirement(details, [
          'NEXT_PUBLIC_SUPABASE_URL',
          'NEXT_PUBLIC_SUPABASE_ANON_KEY',
          'NEXTAUTH_SECRET'
        ]);

        // Storage requirements (optional for startup)
        results.storage = this.checkServiceRequirement(details, [
          'NEXT_PUBLIC_SUPABASE_URL'
        ]);

        // Monitoring requirements (optional)
        results.monitoring = true; // Always true as monitoring is optional
      }

      logger.debug('Startup requirements validation completed', results);
      return results;

    } catch (error) {
      logger.error('Startup requirements validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return results;
    }
  }

  /**
   * Clear validation cache
   */
  clearCache(): void {
    this.validationCache.clear();
    logger.debug('Startup validation cache cleared');
  }

  /**
   * Get validation status for monitoring
   */
  getValidationStatus(): {
    cacheSize: number;
    lastValidation?: Date;
    environment: string;
  } {
    const lastValidation = this.validationCache.size > 0 
      ? new Date(Math.max(...Array.from(this.validationCache.values()).map(v => v.timestamp)))
      : undefined;

    return {
      cacheSize: this.validationCache.size,
      lastValidation,
      environment: this.detectEnvironment()
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async handleValidationFailure(
    error: Error,
    environment: string,
    startTime: number,
    validationResult?: ValidationResult
  ): Promise<StartupValidationResult> {
    const endTime = performance.now();
    const startupTime = endTime - startTime;
  
    // Generate user-friendly error
    const userFriendlyError = handleEnvironmentError(error, {
      operation: 'startup',
      environment: environment, // ✅ environment as any 제거
      timestamp: new Date(),    // ✅ timestamp 속성 추가!
      caller: 'environment-startup-validator' // ✅ caller 속성 추가 (권장)
    });
  
    // Determine if application can continue
    const canContinue = this.canApplicationContinue(error, environment, validationResult);
    const requiresUserAction = this.requiresUserAction(error, environment);
  
    const result: StartupValidationResult = {
      success: false,
      validationResult,
      userFriendlyError,
      canContinue,
      requiresUserAction,
      startupTime
    };
  
    logger.error('Environment startup validation failed', {
      error: error.message,
      startupTime: `${startupTime.toFixed(2)}ms`,
      canContinue,
      requiresUserAction,
      environment,
      validationSummary: validationResult?.summary
    });
  
    return result;
  }

  private canApplicationContinue(
    error: Error,
    environment: string,
    validationResult?: ValidationResult
  ): boolean {
    // In development, allow continuation with warnings
    if (environment === 'development') {
      // Only block if there are critical errors
      return !validationResult || validationResult.summary.criticalErrors === 0;
    }

    // In test environment, be more lenient
    if (environment === 'test') {
      return !validationResult || validationResult.summary.criticalErrors <= 1;
    }

    // In production, be strict about critical errors
    return !validationResult || validationResult.summary.criticalErrors === 0;
  }

  private requiresUserAction(error: Error, environment: string): boolean {
    const message = error.message.toLowerCase();
    
    // Configuration errors usually require user action
    if (message.includes('missing') || message.includes('invalid') || message.includes('required')) {
      return true;
    }

    // In development, most errors require user action
    if (environment === 'development') {
      return true;
    }

    // Network errors might not require immediate user action
    if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
      return false;
    }

    return true;
  }

  private checkServiceRequirement(
    details: Map<string, any>,
    requiredVars: string[]
  ): boolean {
    return requiredVars.every(varName => {
      const detail = details.get(varName);
      return detail && detail.status === 'valid';
    });
  }

  private detectEnvironment(): 'development' | 'test' | 'production' {
    if (typeof process !== 'undefined' && process.env) {
      const nodeEnv = process.env.NODE_ENV;
      if (nodeEnv === 'production') return 'production';
      if (nodeEnv === 'test') return 'test';
      return 'development';
    }
    return 'production'; // Safe default
  }

  private generateCacheKey(options: StartupValidationOptions): string {
    return JSON.stringify({
      strictMode: options.strictMode || false,
      includeOptional: options.includeOptional || true,
      failFast: options.failFast || false,
      environment: options.environment || this.detectEnvironment()
    });
  }

  private getCachedResult(cacheKey: string): StartupValidationResult | null {
    const cached = this.validationCache.get(cacheKey);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.cacheTimeout) {
      this.validationCache.delete(cacheKey);
      return null;
    }

    return cached.result;
  }

  private cacheResult(cacheKey: string, result: StartupValidationResult): void {
    this.validationCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    // Clean up old cache entries
    this.cleanupCache();
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.validationCache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.validationCache.delete(key);
      }
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE AND CONVENIENCE FUNCTIONS
// ============================================================================

export const environmentStartupValidator = EnvironmentStartupValidator.getInstance();

/**
 * Perform startup validation with default options
 */
export async function validateStartup(
  options?: StartupValidationOptions
): Promise<StartupValidationResult> {
  return environmentStartupValidator.performStartupValidation(options);
}

/**
 * Quick startup check
 */
export async function quickStartupCheck(): Promise<boolean> {
  return environmentStartupValidator.quickStartupCheck();
}

/**
 * Validate startup requirements
 */
export async function validateStartupRequirements(): Promise<{
  database: boolean;
  auth: boolean;
  storage: boolean;
  monitoring: boolean;
}> {
  return environmentStartupValidator.validateStartupRequirements();
}

/**
 * Clear startup validation cache
 */
export function clearStartupValidationCache(): void {
  environmentStartupValidator.clearCache();
}

/**
 * Get startup validation status
 */
export function getStartupValidationStatus(): {
  cacheSize: number;
  lastValidation?: Date;
  environment: string;
} {
  return environmentStartupValidator.getValidationStatus();
}