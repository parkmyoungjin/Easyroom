/**
 * Server-Side Startup Validator
 * Validates environment configuration on the server side for middleware and API routes
 * Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4
 */

import { validateEnvironment, quickEnvironmentCheck } from '@/lib/config/environment-validator';
import { handleEnvironmentError } from '@/lib/error-handling/environment-error-handler';
import { logger } from '@/lib/utils/logger';
import type { ValidationResult } from '@/lib/config/environment-validator';
import type { UserFriendlyError } from '@/lib/error-handling/environment-error-handler';

// ============================================================================
// SERVER VALIDATION INTERFACES
// ============================================================================

export interface ServerStartupValidationResult {
  success: boolean;
  canServeRequests: boolean;
  validationResult?: ValidationResult;
  error?: UserFriendlyError;
  serverStartupTime: number;
  environment: string;
}

export interface ServerValidationOptions {
  strictMode?: boolean;
  includeOptional?: boolean;
  caller?: string;
  skipCache?: boolean;
}

// ============================================================================
// SERVER STARTUP VALIDATOR CLASS
// ============================================================================

class ServerStartupValidator {
  private static instance: ServerStartupValidator;
  private validationCache: ServerStartupValidationResult | null = null;
  private cacheTimestamp: number = 0;
  private readonly cacheTimeout = 60000; // 1 minute for server-side cache
  private isValidating = false;

  private constructor() {}

  static getInstance(): ServerStartupValidator {
    if (!ServerStartupValidator.instance) {
      ServerStartupValidator.instance = new ServerStartupValidator();
    }
    return ServerStartupValidator.instance;
  }

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  /**
   * Validate server startup configuration
   */
  async validateServerStartup(
    options: ServerValidationOptions = {}
  ): Promise<ServerStartupValidationResult> {
    const {
      strictMode = true, // Server-side should be strict by default
      includeOptional = false, // Only check required vars on server
      caller = 'server_startup_validator',
      skipCache = false
    } = options;

    // Return cached result if available and not expired
    if (!skipCache && this.isCacheValid()) {
      logger.debug('Using cached server startup validation result', { caller });
      return this.validationCache!;
    }

    // Prevent concurrent validations
    if (this.isValidating) {
      logger.debug('Server validation already in progress, waiting...', { caller });
      return this.waitForValidation();
    }

    this.isValidating = true;
    const startTime = performance.now();
    const environment = this.detectEnvironment();

    logger.info('Starting server-side environment validation', {
      environment,
      strictMode,
      includeOptional,
      caller
    });

    try {
      // Perform validation
      const validationResult = await validateEnvironment({
        strictMode,
        includeOptional,
        environment,
        caller
      });

      const endTime = performance.now();
      const serverStartupTime = endTime - startTime;

      const result: ServerStartupValidationResult = {
        success: validationResult.valid,
        canServeRequests: this.canServeRequests(validationResult, environment),
        validationResult,
        serverStartupTime,
        environment
      };

      if (!validationResult.valid) {
        const error = new Error(
          `Server environment validation failed: ${validationResult.errors.join(', ')}`
        );
        
        result.error = handleEnvironmentError(error, {
          operation: 'startup',
          environment: environment,
          timestamp: new Date(),
          caller: caller
        });
      }

      // Cache the result
      this.cacheResult(result);

      logger.info('Server-side environment validation completed', {
        success: result.success,
        canServeRequests: result.canServeRequests,
        serverStartupTime: `${serverStartupTime.toFixed(2)}ms`,
        environment,
        caller,
        summary: validationResult.summary
      });

      return result;

    } catch (error) {
      const endTime = performance.now();
      const serverStartupTime = endTime - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown server validation error';

      const result: ServerStartupValidationResult = {
        success: false,
        canServeRequests: false,
        serverStartupTime,
        environment,
        error: handleEnvironmentError(
          error instanceof Error ? error : new Error(errorMessage),
          {
            operation: 'startup',
            environment: environment,
            timestamp: new Date(),
            caller: caller
          }
        )
      };

      logger.error('Server-side environment validation failed', {
        error: errorMessage,
        serverStartupTime: `${serverStartupTime.toFixed(2)}ms`,
        environment,
        caller
      });

      // Cache the error result for a shorter time
      this.cacheResult(result, 10000); // 10 seconds for error cache

      return result;

    } finally {
      this.isValidating = false;
    }
  }

  /**
   * Quick server health check
   */
  async quickServerCheck(caller = 'server_health_check'): Promise<boolean> {
    try {
      logger.debug('Performing quick server environment check', { caller });
      return await quickEnvironmentCheck();
    } catch (error) {
      logger.error('Quick server check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        caller
      });
      return false;
    }
  }

  /**
   * Validate critical server requirements
   */
  async validateCriticalRequirements(caller = 'critical_requirements_check'): Promise<{
    database: boolean;
    auth: boolean;
    secrets: boolean;
    overall: boolean;
  }> {
    try {
      const validationResult = await validateEnvironment({
        includeOptional: false,
        strictMode: true,
        caller
      });

      const details = validationResult.details;
      
      const requirements = {
        database: this.checkRequirement(details, [
          'NEXT_PUBLIC_SUPABASE_URL',
          'NEXT_PUBLIC_SUPABASE_ANON_KEY'
        ]),
        auth: this.checkRequirement(details, [
          'NEXTAUTH_SECRET',
          'NEXT_PUBLIC_SUPABASE_URL'
        ]),
        secrets: this.checkRequirement(details, [
          'NEXTAUTH_SECRET'
        ]),
        overall: validationResult.valid
      };

      logger.debug('Critical server requirements validation completed', {
        requirements,
        caller
      });

      return requirements;

    } catch (error) {
      logger.error('Critical requirements validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        caller
      });

      return {
        database: false,
        auth: false,
        secrets: false,
        overall: false
      };
    }
  }

  /**
   * Get server validation status
   */
  getServerValidationStatus(): {
    hasCache: boolean;
    cacheAge: number;
    lastValidation?: Date;
    environment: string;
    isValidating: boolean;
  } {
    return {
      hasCache: this.validationCache !== null,
      cacheAge: this.validationCache ? Date.now() - this.cacheTimestamp : 0,
      lastValidation: this.validationCache ? new Date(this.cacheTimestamp) : undefined,
      environment: this.detectEnvironment(),
      isValidating: this.isValidating
    };
  }

  /**
   * Clear server validation cache
   */
  clearServerCache(): void {
    this.validationCache = null;
    this.cacheTimestamp = 0;
    logger.debug('Server validation cache cleared');
  }

  /**
   * Middleware helper to check if requests can be served
   */
  async canServeRequest(
    requestPath: string,
    options: ServerValidationOptions = {}
  ): Promise<{ canServe: boolean; reason?: string }> {
    try {
      // Skip validation for static assets and health checks
      if (this.isStaticAsset(requestPath) || this.isHealthCheck(requestPath)) {
        return { canServe: true };
      }

      const result = await this.validateServerStartup({
        ...options,
        caller: `middleware_${requestPath}`
      });

      if (result.canServeRequests) {
        return { canServe: true };
      }

      const reason = result.error?.message || 'Server environment validation failed';
      return { canServe: false, reason };

    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Server validation error';
      logger.error('Request serving validation failed', {
        requestPath,
        error: reason
      });
      return { canServe: false, reason };
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private canServeRequests(validationResult: ValidationResult, environment: string): boolean {
    // In production, require all critical validations to pass
    if (environment === 'production') {
      return validationResult.valid && validationResult.summary.criticalErrors === 0;
    }

    // In development/test, allow serving with warnings but not critical errors
    return validationResult.summary.criticalErrors === 0;
  }

  private checkRequirement(details: Map<string, any>, requiredVars: string[]): boolean {
    return requiredVars.every(varName => {
      const detail = details.get(varName);
      return detail && detail.status === 'valid';
    });
  }

  private detectEnvironment(): 'development' | 'test' | 'production' {
    if (typeof process !== 'undefined' && process.env) {
      const nodeEnv = process.env.NODE_ENV;
      if (nodeEnv === 'development' || nodeEnv === 'test' || nodeEnv === 'production') {
        return nodeEnv;
      }
    }
    return 'production'; // Safe default
  }

  private isCacheValid(): boolean {
    if (!this.validationCache) return false;
    return Date.now() - this.cacheTimestamp < this.cacheTimeout;
  }

  private cacheResult(result: ServerStartupValidationResult, customTimeout?: number): void {
    this.validationCache = result;
    this.cacheTimestamp = Date.now();
    
    // Set shorter cache timeout for failed validations
    if (customTimeout) {
      setTimeout(() => {
        if (this.cacheTimestamp === Date.now()) {
          this.validationCache = null;
          this.cacheTimestamp = 0;
        }
      }, customTimeout);
    }
  }

  private async waitForValidation(): Promise<ServerStartupValidationResult> {
    // Simple polling mechanism to wait for ongoing validation
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait
    
    while (this.isValidating && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (this.validationCache) {
      return this.validationCache;
    }

    // Fallback if validation is still in progress
    return {
      success: false,
      canServeRequests: false,
      serverStartupTime: 0,
      environment: this.detectEnvironment(),
      error: {
        title: 'Validation Timeout',
        message: 'Server validation is taking too long',
        actions: [],
        severity: 'high',
        errorCode: 'VALIDATION_TIMEOUT',
        canRetry: true
      }
    };
  }

  private isStaticAsset(path: string): boolean {
    const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2'];
    const staticPaths = ['/_next/', '/static/', '/public/', '/favicon.ico', '/manifest.json'];
    
    return staticExtensions.some(ext => path.endsWith(ext)) ||
           staticPaths.some(staticPath => path.startsWith(staticPath));
  }

  private isHealthCheck(path: string): boolean {
    const healthPaths = ['/health', '/api/health', '/status', '/ping'];
    return healthPaths.includes(path);
  }
}

// ============================================================================
// SINGLETON INSTANCE AND CONVENIENCE FUNCTIONS
// ============================================================================

export const serverStartupValidator = ServerStartupValidator.getInstance();

/**
 * Validate server startup with default options
 */
export async function validateServerStartup(
  options?: ServerValidationOptions
): Promise<ServerStartupValidationResult> {
  return serverStartupValidator.validateServerStartup(options);
}

/**
 * Quick server environment check
 */
export async function quickServerCheck(caller?: string): Promise<boolean> {
  return serverStartupValidator.quickServerCheck(caller);
}

/**
 * Validate critical server requirements
 */
export async function validateCriticalRequirements(caller?: string): Promise<{
  database: boolean;
  auth: boolean;
  secrets: boolean;
  overall: boolean;
}> {
  return serverStartupValidator.validateCriticalRequirements(caller);
}

/**
 * Check if server can serve a specific request
 */
export async function canServeRequest(
  requestPath: string,
  options?: ServerValidationOptions
): Promise<{ canServe: boolean; reason?: string }> {
  return serverStartupValidator.canServeRequest(requestPath, options);
}

/**
 * Get server validation status
 */
export function getServerValidationStatus(): {
  hasCache: boolean;
  cacheAge: number;
  lastValidation?: Date;
  environment: string;
  isValidating: boolean;
} {
  return serverStartupValidator.getServerValidationStatus();
}

/**
 * Clear server validation cache
 */
export function clearServerValidationCache(): void {
  serverStartupValidator.clearServerCache();
}