/**
 * Environment Configuration Validator Service
 * Centralized validation service for all environment configurations
 * Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { logger } from '@/lib/utils/logger';
import { securityMonitor } from '@/lib/monitoring/security-monitor';
import { secureEnvironmentAccess } from '@/lib/security/secure-environment-access';
import type {
  EnvironmentAccessResult,
  EnvironmentVariableConfig
} from '@/lib/security/secure-environment-access';

// ============================================================================
// VALIDATION RESULT INTERFACES
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: ValidationSummary;
  details: Map<string, EnvironmentValidationDetail>;
}

export interface ValidationSummary {
  total: number;
  valid: number;
  invalid: number;
  missing: number;
  warnings: number;
  criticalErrors: number;
}

export interface EnvironmentValidationDetail {
  key: string;
  status: 'valid' | 'invalid' | 'missing' | 'warning';
  value?: string;
  error?: string;
  warning?: string;
  required: boolean;
  sensitive: boolean;
  environment: string;
}

export interface ValidationOptions {
  includeOptional?: boolean;
  strictMode?: boolean;
  environment?: 'development' | 'test' | 'production';
  caller?: string;
}

// ============================================================================
// ENVIRONMENT CONFIGURATION VALIDATOR CLASS
// ============================================================================

class EnvironmentConfigurationValidator {
  private static instance: EnvironmentConfigurationValidator;
  private readonly currentEnvironment: string;

  private constructor() {
    this.currentEnvironment = process.env.NODE_ENV || 'development';
  }

  static getInstance(): EnvironmentConfigurationValidator {
    if (!EnvironmentConfigurationValidator.instance) {
      EnvironmentConfigurationValidator.instance = new EnvironmentConfigurationValidator();
    }
    return EnvironmentConfigurationValidator.instance;
  }

  // ============================================================================
  // PUBLIC VALIDATION METHODS
  // ============================================================================

  /**
   * Validate all environment variables with comprehensive reporting
   */
  async validateEnvironmentConfiguration(
    options: ValidationOptions = {}
  ): Promise<ValidationResult> {
    const {
      includeOptional = true,
      strictMode = false,
      environment = this.currentEnvironment as any,
      caller = 'environment_validator'
    } = options;

    logger.info('Starting environment configuration validation', {
      environment,
      strictMode,
      includeOptional,
      caller
    });

    const startTime = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    const details = new Map<string, EnvironmentValidationDetail>();

    try {
      // Get all registered environment variables
      const registry = secureEnvironmentAccess.getEnvironmentRegistry();
      
      let validCount = 0;
      let invalidCount = 0;
      let missingCount = 0;
      let warningCount = 0;
      let criticalErrorCount = 0;

      // Validate each registered environment variable
      for (const [key, config] of registry) {
        // Skip optional variables if not including them
        if (!includeOptional && !config.required) {
          continue;
        }

        const validationDetail = await this.validateSingleEnvironmentVariable(
          key,
          config,
          { caller, environment, strictMode }
        );

        details.set(key, validationDetail);

        // Update counters based on validation result
        switch (validationDetail.status) {
          case 'valid':
            validCount++;
            break;
          case 'invalid':
            invalidCount++;
            if (config.required) {
              criticalErrorCount++;
              errors.push(`Critical: ${validationDetail.error}`);
            } else {
              errors.push(`Error: ${validationDetail.error}`);
            }
            break;
          case 'missing':
            missingCount++;
            if (config.required) {
              criticalErrorCount++;
              errors.push(`Critical: Required environment variable ${key} is missing`);
            } else {
              warnings.push(`Optional environment variable ${key} is missing`);
              warningCount++;
            }
            break;
          case 'warning':
            warningCount++;
            warnings.push(`Warning: ${validationDetail.warning}`);
            break;
        }
      }

      // Perform additional environment-specific validations
      const environmentSpecificResults = await this.performEnvironmentSpecificValidation(
        environment,
        details,
        { caller, strictMode }
      );

      errors.push(...environmentSpecificResults.errors);
      warnings.push(...environmentSpecificResults.warnings);

      const summary: ValidationSummary = {
        total: details.size,
        valid: validCount,
        invalid: invalidCount,
        missing: missingCount,
        warnings: warningCount,
        criticalErrors: criticalErrorCount
      };

      const isValid = criticalErrorCount === 0 && (strictMode ? invalidCount === 0 : true);

      const result: ValidationResult = {
        valid: isValid,
        errors,
        warnings,
        summary,
        details
      };

      // Log validation completion
      const duration = performance.now() - startTime;
      logger.info('Environment configuration validation completed', {
        duration: `${duration.toFixed(2)}ms`,
        valid: isValid,
        summary,
        environment,
        caller
      });

      // Record security event if validation failed
      if (!isValid) {
        securityMonitor.recordEvent({
          type: 'data_integrity_violation',
          severity: criticalErrorCount > 0 ? 'high' : 'medium',
          source: 'environment_validator',
          details: {
            operation: 'environment_validation',
            environment,
            criticalErrors: criticalErrorCount,
            totalErrors: invalidCount,
            caller
          },
          metadata: {
            summary,
            duration
          }
        });
      }

      return result;

    } catch (error) {
      const duration = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
      
      logger.error('Environment configuration validation failed', {
        error: errorMessage,
        duration: `${duration.toFixed(2)}ms`,
        environment,
        caller
      });

      // Record critical security event
      securityMonitor.recordEvent({
        type: 'data_integrity_violation',
        severity: 'critical',
        source: 'environment_validator',
        details: {
          operation: 'environment_validation',
          error: errorMessage,
          environment,
          caller
        },
        metadata: { duration }
      });

      return {
        valid: false,
        errors: [`Validation system error: ${errorMessage}`],
        warnings: [],
        summary: {
          total: 0,
          valid: 0,
          invalid: 0,
          missing: 0,
          warnings: 0,
          criticalErrors: 1
        },
        details: new Map()
      };
    }
  }

  /**
   * Validate a specific environment variable
   */
  async validateSpecificVariable(
    key: string,
    options: ValidationOptions = {}
  ): Promise<EnvironmentValidationDetail> {
    const { caller = 'environment_validator' } = options;
    
    const registry = secureEnvironmentAccess.getEnvironmentRegistry();
    const config = registry.get(key);

    if (!config) {
      return {
        key,
        status: 'invalid',
        error: `Environment variable ${key} is not registered`,
        required: false,
        sensitive: false,
        environment: this.currentEnvironment
      };
    }

    return this.validateSingleEnvironmentVariable(key, config, options);
  }

  /**
   * Get validation report in human-readable format
   */
  generateValidationReport(result: ValidationResult): string {
    const lines: string[] = [];
    
    lines.push('='.repeat(60));
    lines.push('ENVIRONMENT CONFIGURATION VALIDATION REPORT');
    lines.push('='.repeat(60));
    lines.push('');
    
    // Summary section
    lines.push('SUMMARY:');
    lines.push(`  Overall Status: ${result.valid ? '✅ VALID' : '❌ INVALID'}`);
    lines.push(`  Total Variables: ${result.summary.total}`);
    lines.push(`  Valid: ${result.summary.valid}`);
    lines.push(`  Invalid: ${result.summary.invalid}`);
    lines.push(`  Missing: ${result.summary.missing}`);
    lines.push(`  Warnings: ${result.summary.warnings}`);
    lines.push(`  Critical Errors: ${result.summary.criticalErrors}`);
    lines.push('');

    // Critical errors section
    if (result.summary.criticalErrors > 0) {
      lines.push('🚨 CRITICAL ERRORS:');
      result.errors
        .filter(error => error.startsWith('Critical:'))
        .forEach(error => lines.push(`  ${error}`));
      lines.push('');
    }

    // Errors section
    if (result.errors.length > 0) {
      lines.push('❌ ERRORS:');
      result.errors
        .filter(error => !error.startsWith('Critical:'))
        .forEach(error => lines.push(`  ${error}`));
      lines.push('');
    }

    // Warnings section
    if (result.warnings.length > 0) {
      lines.push('⚠️  WARNINGS:');
      result.warnings.forEach(warning => lines.push(`  ${warning}`));
      lines.push('');
    }

    // Detailed results section
    lines.push('DETAILED RESULTS:');
    for (const [key, detail] of result.details) {
      const statusIcon = this.getStatusIcon(detail.status);
      const requiredText = detail.required ? '[REQUIRED]' : '[OPTIONAL]';
      const sensitiveText = detail.sensitive ? '[SENSITIVE]' : '';
      
      lines.push(`  ${statusIcon} ${key} ${requiredText} ${sensitiveText}`);
      
      if (detail.error) {
        lines.push(`    Error: ${detail.error}`);
      }
      if (detail.warning) {
        lines.push(`    Warning: ${detail.warning}`);
      }
    }

    lines.push('');
    lines.push('='.repeat(60));

    return lines.join('\n');
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async validateSingleEnvironmentVariable(
    key: string,
    config: EnvironmentVariableConfig,
    options: ValidationOptions
  ): Promise<EnvironmentValidationDetail> {
    const { caller = 'environment_validator', strictMode = false } = options;

    try {
      // Use secure environment access to get the variable
      const result = await secureEnvironmentAccess.getEnvironmentVariable(key, {
        caller,
        purpose: 'validation'
      });

      const baseDetail: EnvironmentValidationDetail = {
        key,
        required: config.required,
        sensitive: config.sensitive,
        environment: this.currentEnvironment,
        status: 'valid'
      };

      if (!result.success) {
        return {
          ...baseDetail,
          status: 'invalid',
          error: result.error
        };
      }

      if (!result.value) {
        return {
          ...baseDetail,
          status: config.required ? 'missing' : 'warning',
          error: config.required ? `Required variable ${key} is missing` : undefined,
          warning: !config.required ? `Optional variable ${key} is not set` : undefined
        };
      }

      // Additional validation in strict mode
      if (strictMode) {
        const strictValidation = this.performStrictValidation(key, result.value, config);
        if (!strictValidation.valid) {
          return {
            ...baseDetail,
            status: 'warning',
            value: config.sensitive ? '[REDACTED]' : result.value,
            warning: strictValidation.warning
          };
        }
      }

      return {
        ...baseDetail,
        status: 'valid',
        value: config.sensitive ? '[REDACTED]' : result.value
      };

    } catch (error) {
      return {
        key,
        status: 'invalid',
        error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        required: config.required,
        sensitive: config.sensitive,
        environment: this.currentEnvironment
      };
    }
  }

  private async performEnvironmentSpecificValidation(
    environment: string,
    details: Map<string, EnvironmentValidationDetail>,
    options: { caller: string; strictMode: boolean }
  ): Promise<{ errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Production-specific validations
    if (environment === 'production') {
      // Ensure HTTPS URLs in production
      const urlVars = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXTAUTH_URL'];
      for (const urlVar of urlVars) {
        const detail = details.get(urlVar);
        if (detail && detail.status === 'valid' && detail.value && !detail.value.startsWith('https://')) {
          errors.push(`Production environment requires HTTPS for ${urlVar}`);
        }
      }

      // Ensure service role key is present in production
      const serviceRoleDetail = details.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!serviceRoleDetail || serviceRoleDetail.status !== 'valid') {
        errors.push('SUPABASE_SERVICE_ROLE_KEY is required in production environment');
      }
    }

    // Development-specific warnings
    if (environment === 'development') {
      // Warn about missing optional but recommended variables
      const recommendedDevVars = ['SLACK_WEBHOOK_URL'];
      for (const varName of recommendedDevVars) {
        const detail = details.get(varName);
        if (!detail || detail.status !== 'valid') {
          warnings.push(`Consider setting ${varName} for better development experience`);
        }
      }
    }

    return { errors, warnings };
  }

  private performStrictValidation(
    key: string,
    value: string,
    config: EnvironmentVariableConfig
  ): { valid: boolean; warning?: string } {
    // Check for common development placeholder values
    const commonPlaceholders = [
      'your_',
      'example',
      'test_',
      'placeholder',
      'changeme',
      'default'
    ];

    const lowerValue = value.toLowerCase();
    const hasPlaceholder = commonPlaceholders.some(placeholder => 
      lowerValue.includes(placeholder)
    );

    if (hasPlaceholder) {
      return {
        valid: false,
        warning: `${key} appears to contain a placeholder value`
      };
    }

    // Check for suspiciously short sensitive values
    if (config.sensitive && value.length < 20) {
      return {
        valid: false,
        warning: `${key} appears to be unusually short for a sensitive value`
      };
    }

    return { valid: true };
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'valid': return '✅';
      case 'invalid': return '❌';
      case 'missing': return '🚫';
      case 'warning': return '⚠️';
      default: return '❓';
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE AND CONVENIENCE FUNCTIONS
// ============================================================================

export const environmentValidator = EnvironmentConfigurationValidator.getInstance();

/**
 * Validate environment configuration with default options
 */
export async function validateEnvironment(
  options?: ValidationOptions
): Promise<ValidationResult> {
  return environmentValidator.validateEnvironmentConfiguration(options);
}

/**
 * Validate environment and throw error if invalid
 */
export async function validateEnvironmentOrThrow(
  options?: ValidationOptions
): Promise<void> {
  const result = await environmentValidator.validateEnvironmentConfiguration(options);
  
  if (!result.valid) {
    const report = environmentValidator.generateValidationReport(result);
    throw new Error(`Environment validation failed:\n${report}`);
  }
}

/**
 * Quick validation check for startup
 */
export async function quickEnvironmentCheck(): Promise<boolean> {
  try {
    const result = await environmentValidator.validateEnvironmentConfiguration({
      includeOptional: false,
      strictMode: false
    });
    return result.valid;
  } catch {
    return false;
  }
}

/**
 * Generate and log validation report
 */
export async function logEnvironmentValidationReport(
  options?: ValidationOptions
): Promise<void> {
  const result = await environmentValidator.validateEnvironmentConfiguration(options);
  const report = environmentValidator.generateValidationReport(result);
  
  if (result.valid) {
    logger.info('Environment validation report', { report });
  } else {
    logger.error('Environment validation report', { report });
  }
}